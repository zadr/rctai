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

    if (request.method === "GET" && request.path === "/save") {
      const name = request.query.name;
      if (name === undefined || name.trim().length === 0) {
        return json(400, { error: "save name is required" });
      }
      const jobId = controller.enqueueSave(name);
      return json(202, { accepted: true, jobId, builder: controller.getStatus() });
    }

    if (request.path === "/health" || request.path === "/build" || request.path === "/clear" || request.path === "/save") {
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
    const body = JSON.stringify(response.body);
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
