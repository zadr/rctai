/* eslint-disable @typescript-eslint/no-namespace */

namespace RctaiBuilder {
  export interface ParsedHttpRequest {
    method: string;
    target: string;
    path: string;
    query: Record<string, string>;
    version: string;
    headers: Record<string, string>;
    body: string;
  }

  export interface HttpParseResult {
    ok: boolean;
    request?: ParsedHttpRequest;
    incomplete?: boolean;
    status?: number;
    error?: string;
  }

  export interface HttpResponse {
    status: number;
    body: unknown;
    headers?: Record<string, string>;
  }

  export interface BuildControllerPort {
    enqueueBuild(plan: RctaiBuilder.ParkPlan): string;
    enqueueClear(): string;
    enqueueSave(name: string): string;
    getStatus(): RctaiBuilder.BuildStatus;
    inspectPark(): RctaiBuilder.ParkInspection;
    inspectSurfaces(coords: RctaiBuilder.Coord[]): RctaiBuilder.ParkInspectionSurface[];
    inspectTracks(rideIds: number[] | null): RctaiBuilder.ParkInspectionTrack[];
    inspectTrackTraversals(rideIds: number[] | null): RctaiBuilder.ParkInspectionTrackTraversal[];
    inspectTrackSegments(types: number[]): Record<string, RctaiBuilder.TrackSegmentInfo | null>;
    resetRuntimeEvents(): void;
    setGameSpeed(speed: number, callback: (result: RctaiBuilder.GameActionResultLike) => void): void;
  }

  const STATUS_TEXT: Record<number, string> = {
    200: "OK",
    202: "Accepted",
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    413: "Payload Too Large",
    422: "Unprocessable Entity"
  };

  export function parseHttpRequest(raw: string, maxBodyBytes = 2_000_000): HttpParseResult {
    const headerEnd = raw.indexOf("\r\n\r\n");
    if (headerEnd < 0) {
      return { ok: false, incomplete: true };
    }

    const headerBlock = raw.slice(0, headerEnd);
    const lines = headerBlock.split("\r\n");
    const requestLine = lines[0];
    if (requestLine === undefined) {
      return badRequest("missing request line");
    }

    const requestParts = requestLine.split(" ");
    if (requestParts.length !== 3) {
      return badRequest("malformed request line");
    }

    const [method, target, version] = requestParts;
    if (!method || !target || version !== "HTTP/1.1") {
      return badRequest("expected HTTP/1.1 request line");
    }

    const headers: Record<string, string> = {};
    for (let index = 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line === undefined || line.length === 0) {
        continue;
      }
      const colon = line.indexOf(":");
      if (colon <= 0) {
        return badRequest(`malformed header at line ${index + 1}`);
      }
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (key.length === 0) {
        return badRequest(`empty header name at line ${index + 1}`);
      }
      headers[key] = value;
    }

    const contentLengthHeader = headers["content-length"];
    let contentLength = 0;
    if (contentLengthHeader !== undefined) {
      if (!/^\d+$/.test(contentLengthHeader)) {
        return badRequest("invalid content-length");
      }
      contentLength = Number(contentLengthHeader);
      if (!Number.isSafeInteger(contentLength)) {
        return badRequest("content-length is too large");
      }
      if (contentLength > maxBodyBytes) {
        return { ok: false, status: 413, error: "request body is too large" };
      }
    }

    const bodyStart = headerEnd + 4;
    if (raw.length < bodyStart + contentLength) {
      return { ok: false, incomplete: true };
    }

    const body = raw.slice(bodyStart, bodyStart + contentLength);
    const targetParts = splitTarget(target);
    if (targetParts === null) {
      return badRequest("malformed target");
    }

    return {
      ok: true,
      request: {
        method,
        target,
        path: targetParts.path,
        query: targetParts.query,
        version,
        headers,
        body
      }
    };
  }

  export function routeHttpRequest(request: ParsedHttpRequest, controller: BuildControllerPort): HttpResponse {
    if (request.method === "GET" && request.path === "/health") {
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        builder: controller.getStatus()
      });
    }

    if (request.method === "GET" && request.path === "/inspect") {
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        park: controller.inspectPark()
      });
    }

    if (request.method === "POST" && request.path === "/inspect") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }
      const parsedFilter = parseFootpathFilter(parsedBody.value);
      if (!parsedFilter.ok) {
        return json(400, { error: parsedFilter.error });
      }
      const park = controller.inspectPark();
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        park: {
          ...park,
          footpaths: filterFootpaths(park.footpaths, parsedFilter.filter)
        }
      });
    }

    if (request.method === "POST" && request.path === "/inspect-footpaths") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }
      const parsedFilter = parseFootpathFilter(parsedBody.value);
      if (!parsedFilter.ok) {
        return json(400, { error: parsedFilter.error });
      }
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        footpaths: filterFootpaths(controller.inspectPark().footpaths, parsedFilter.filter)
      });
    }

    if (request.method === "POST" && request.path === "/inspect-tracks") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }
      const parsedFilter = parseRideIdFilter(parsedBody.value);
      if (!parsedFilter.ok) {
        return json(400, { error: parsedFilter.error });
      }
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        tracks: controller.inspectTracks(parsedFilter.rideIds)
      });
    }

    if (request.method === "POST" && request.path === "/inspect-surfaces") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }
      const parsedCoords = parseSurfaceCoords(parsedBody.value);
      if (!parsedCoords.ok) {
        return json(400, { error: parsedCoords.error });
      }
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        surfaces: controller.inspectSurfaces(parsedCoords.coords)
      });
    }

    if (request.method === "POST" && request.path === "/inspect-track-traversals") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }
      const parsedFilter = parseRideIdFilter(parsedBody.value);
      if (!parsedFilter.ok) {
        return json(400, { error: parsedFilter.error });
      }
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        traversals: controller.inspectTrackTraversals(parsedFilter.rideIds)
      });
    }

    if (request.method === "GET" && request.path === "/track-segments") {
      const types = parseTrackSegmentTypes(request.query.types ?? "");
      return json(200, {
        status: "ok",
        version: RctaiBuilder.VERSION,
        segments: controller.inspectTrackSegments(types)
      });
    }

    if (request.method === "POST" && request.path === "/build") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }

      const validation = RctaiBuilder.validatePlanShape(parsedBody.value);
      if (!validation.ok || validation.value === undefined) {
        return json(422, { error: "invalid park plan", details: validation.errors });
      }

      const jobId = controller.enqueueBuild(validation.value);
      return json(202, { accepted: true, jobId, builder: controller.getStatus() });
    }

    if (request.method === "POST" && request.path === "/clear") {
      const jobId = controller.enqueueClear();
      return json(202, { accepted: true, jobId, builder: controller.getStatus() });
    }

    if (request.method === "POST" && request.path === "/reset-runtime-events") {
      controller.resetRuntimeEvents();
      return json(200, { ok: true });
    }

    if (request.method === "POST" && request.path === "/speed") {
      const parsedBody = parseJsonBody(request.body);
      if (!parsedBody.ok) {
        return json(400, { error: parsedBody.error });
      }
      const input = parsedBody.value as { speed?: unknown };
      const speed = typeof input.speed === "number" ? input.speed : Number.NaN;
      if (!Number.isInteger(speed) || speed < 0 || speed > 4) {
        return json(400, { error: "speed must be an integer between 0 and 4" });
      }
      let actionResult: RctaiBuilder.GameActionResultLike = {};
      controller.setGameSpeed(speed, (result) => {
        actionResult = result;
      });
      if (actionResult.error !== undefined && actionResult.error !== 0) {
        return json(422, { error: RctaiBuilder.formatGameActionError(actionResult) });
      }
      return json(200, { ok: true, speed });
    }

    if (request.method === "GET" && request.path === "/save") {
      const name = request.query.name;
      if (name === undefined || name.trim().length === 0) {
        return json(400, { error: "save name is required" });
      }
      const jobId = controller.enqueueSave(name);
      return json(202, { accepted: true, jobId, builder: controller.getStatus() });
    }

    if (
      request.path === "/health" ||
      request.path === "/inspect" ||
      request.path === "/inspect-footpaths" ||
      request.path === "/inspect-tracks" ||
      request.path === "/inspect-surfaces" ||
      request.path === "/inspect-track-traversals" ||
      request.path === "/track-segments" ||
      request.path === "/build" ||
      request.path === "/clear" ||
      request.path === "/reset-runtime-events" ||
      request.path === "/speed" ||
      request.path === "/save"
    ) {
      return json(405, { error: "method not allowed" });
    }

    return json(404, { error: "not found" });
  }

  export function handleHttpRequest(raw: string, controller: BuildControllerPort): HttpResponse {
    const parsed = parseHttpRequest(raw);
    if (!parsed.ok || parsed.request === undefined) {
      return json(parsed.status ?? 400, { error: parsed.error ?? "malformed request" });
    }
    return routeHttpRequest(parsed.request, controller);
  }

  export function formatHttpResponse(response: HttpResponse): string {
    const body = stringifyJsonAscii(response.body);
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Length": String(utf8ByteLength(body)),
      Connection: "close",
      ...(response.headers ?? {})
    };

    const statusText = STATUS_TEXT[response.status] ?? "Unknown";
    const headerLines = Object.keys(headers).map((key) => `${key}: ${headers[key] ?? ""}`);
    return `HTTP/1.1 ${response.status} ${statusText}\r\n${headerLines.join("\r\n")}\r\n\r\n${body}`;
  }

  function parseJsonBody(body: string): { ok: true; value: unknown } | { ok: false; error: string } {
    if (body.length === 0) {
      return { ok: false, error: "request body is required" };
    }
    try {
      return { ok: true, value: JSON.parse(body) as unknown };
    } catch {
      return { ok: false, error: "request body must be valid JSON" };
    }
  }

  function parseFootpathFilter(input: unknown): { ok: true; filter: Set<string> | null } | { ok: false; error: string } {
    const footpaths = typeof input === "object" && input !== null
      ? (input as { footpaths?: unknown }).footpaths
      : undefined;
    if (footpaths === undefined || footpaths === "all") {
      return { ok: true, filter: null };
    }
    if (!Array.isArray(footpaths)) {
      return { ok: false, error: "footpaths must be an array of coordinates or \"all\"" };
    }

    const filter = new Set<string>();
    for (const [index, footpath] of footpaths.entries()) {
      if (!isCoordLike(footpath)) {
        return { ok: false, error: `footpaths[${index}] must contain integer x and y` };
      }
      filter.add(`${footpath.x},${footpath.y}`);
    }
    return { ok: true, filter };
  }

  function filterFootpaths(
    footpaths: RctaiBuilder.ParkInspectionFootpath[],
    filter: Set<string> | null
  ): RctaiBuilder.ParkInspectionFootpath[] {
    if (filter === null) {
      return footpaths;
    }
    return footpaths.filter((footpath) => filter.has(`${footpath.x},${footpath.y}`));
  }

  function parseSurfaceCoords(input: unknown): { ok: true; coords: RctaiBuilder.Coord[] } | { ok: false; error: string } {
    const coords = typeof input === "object" && input !== null
      ? (input as { coords?: unknown }).coords
      : undefined;
    if (!Array.isArray(coords)) {
      return { ok: false, error: "coords must be an array of coordinates" };
    }

    const result: RctaiBuilder.Coord[] = [];
    for (const [index, coord] of coords.entries()) {
      if (!isCoordLike(coord)) {
        return { ok: false, error: `coords[${index}] must contain integer x and y` };
      }
      result.push({ x: coord.x, y: coord.y });
    }
    return { ok: true, coords: result };
  }

  function parseRideIdFilter(input: unknown): { ok: true; rideIds: number[] | null } | { ok: false; error: string } {
    const rideIds = typeof input === "object" && input !== null
      ? (input as { rideIds?: unknown }).rideIds
      : undefined;
    if (rideIds === undefined || rideIds === "all") {
      return { ok: true, rideIds: null };
    }
    if (!Array.isArray(rideIds)) {
      return { ok: false, error: "rideIds must be an array of non-negative integers or \"all\"" };
    }

    const result: number[] = [];
    for (const [index, rideId] of rideIds.entries()) {
      if (!Number.isInteger(rideId) || rideId < 0) {
        return { ok: false, error: `rideIds[${index}] must be a non-negative integer` };
      }
      result.push(rideId);
    }
    return { ok: true, rideIds: result };
  }

  function isCoordLike(input: unknown): input is RctaiBuilder.Coord {
    if (typeof input !== "object" || input === null) {
      return false;
    }
    const coord = input as { x?: unknown; y?: unknown };
    return Number.isInteger(coord.x) && Number.isInteger(coord.y);
  }

  function parseTrackSegmentTypes(input: string): number[] {
    return input
      .split(",")
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value >= 0);
  }

  function splitTarget(target: string): { path: string; query: Record<string, string> } | null {
    const queryStart = target.indexOf("?");
    const rawPath = queryStart >= 0 ? target.slice(0, queryStart) : target;
    if (!rawPath.startsWith("/")) {
      return null;
    }

    const query: Record<string, string> = {};
    if (queryStart >= 0) {
      const rawQuery = target.slice(queryStart + 1);
      const pairs = rawQuery.length === 0 ? [] : rawQuery.split("&");
      for (const pair of pairs) {
        const equals = pair.indexOf("=");
        const key = equals >= 0 ? pair.slice(0, equals) : pair;
        const value = equals >= 0 ? pair.slice(equals + 1) : "";
        query[decodeQueryPart(key)] = decodeQueryPart(value);
      }
    }

    return { path: rawPath, query };
  }

  function decodeQueryPart(value: string): string {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value;
    }
  }

  function json(status: number, body: unknown): HttpResponse {
    return { status, body };
  }

  function stringifyJsonAscii(value: unknown): string {
    return JSON.stringify(value).replace(/[\u0080-\uFFFF]/g, (character) => {
      return `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`;
    });
  }

  function utf8ByteLength(input: string): number {
    let bytes = 0;
    for (let index = 0; index < input.length; index += 1) {
      const code = input.charCodeAt(index);
      if (code < 0x80) {
        bytes += 1;
      } else if (code < 0x800) {
        bytes += 2;
      } else if (code >= 0xd800 && code <= 0xdbff && index + 1 < input.length) {
        const next = input.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes += 4;
          index += 1;
        } else {
          bytes += 3;
        }
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  function badRequest(error: string): HttpParseResult {
    return { ok: false, status: 400, error };
  }
}
