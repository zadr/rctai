#!/usr/bin/env node
/* global fetch */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_OPENRCT2 = process.env.OPENRCT2_BIN ?? "openrct2";
const DEFAULT_HOST_PORT = 11753;
const DEFAULT_BUILDER_PORT = 6427;
const FIRST_MONTH_TICKS = 16_384;
const FOOTPATH_BATCH_SIZE = 1_000;
const TRACK_RIDE_BATCH_SIZE = 12;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

const options = parseArgs(process.argv.slice(2));
const plan = readJson(resolve(process.cwd(), options.planPath));
const parkPath = resolve(process.cwd(), options.parkPath);

if (!existsSync(parkPath)) {
  fail(`park file does not exist: ${parkPath}`);
}

const openrct2 = resolveOpenRCT2(options.openrct2);
const issues = [];
const hostOutput = [];
let host = null;

try {
  host = await ensureLiveBuilder(openrct2, parkPath, options.hostPort, options.builderPort, options.startTimeoutMs, hostOutput);
  await postJson(options.builderPort, "/reset-runtime-events", {});

  let inspection = await getInspection(options.builderPort, plan);
  issues.push(...validateInspection(plan, inspection, "initial"));

  if (options.runtimeTicks > 0) {
    await postJson(options.builderPort, "/speed", { speed: 4 });
    const startTicks = inspection.park.date.ticksElapsed;
    const deadline = Date.now() + options.runtimeTimeoutMs;
    let lastTicks = startTicks;

    while (Date.now() < deadline) {
      inspection = await getInspection(options.builderPort, plan);
      const elapsed = inspection.park.date.ticksElapsed - startTicks;
      lastTicks = inspection.park.date.ticksElapsed;
      if (inspection.park.crashes.length > 0 || elapsed >= options.runtimeTicks) {
        break;
      }
      await delay(options.pollMs);
    }

    inspection = await getInspection(options.builderPort, plan);
    const elapsed = inspection.park.date.ticksElapsed - startTicks;
    if (elapsed < options.runtimeTicks) {
      issues.push(
        `runtime validation timed out after ${options.runtimeTimeoutMs}ms: advanced ${elapsed}/${options.runtimeTicks} ticks (last tick ${lastTicks})`
      );
    }
    issues.push(...validateInspection(plan, inspection, "runtime"));
    process.stdout.write(`runtime advanced: ${Math.max(0, elapsed)} ticks\n`);
  }
} catch (error) {
  issues.push(error instanceof Error ? error.message : String(error));
} finally {
  if (host !== null) {
    host.kill("SIGTERM");
    await delay(500);
    if (host.exitCode === null) {
      host.kill("SIGKILL");
    }
  }
}

if (issues.length > 0) {
  process.stderr.write(`OpenRCT2 park verification failed for ${parkPath}\n`);
  for (const issue of issues) {
    process.stderr.write(`- ${issue}\n`);
  }
  process.stderr.write(`host output:\n${hostOutput.join("").trim()}\n`);
  process.exit(1);
}

process.stdout.write(`OpenRCT2 park verification passed: ${parkPath}\n`);

function parseArgs(args) {
  const parsed = {
    openrct2: DEFAULT_OPENRCT2,
    hostPort: DEFAULT_HOST_PORT,
    builderPort: DEFAULT_BUILDER_PORT,
    runtimeTicks: 0,
    runtimeTimeoutMs: 180_000,
    startTimeoutMs: 30_000,
    pollMs: 1_000,
    planPath: "",
    parkPath: ""
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--openrct2") {
      parsed.openrct2 = readFlag(args, ++index, arg);
    } else if (arg === "--plan") {
      parsed.planPath = readFlag(args, ++index, arg);
    } else if (arg === "--park") {
      parsed.parkPath = readFlag(args, ++index, arg);
    } else if (arg === "--host-port") {
      parsed.hostPort = readInteger(readFlag(args, ++index, arg), arg);
    } else if (arg === "--builder-port") {
      parsed.builderPort = readInteger(readFlag(args, ++index, arg), arg);
    } else if (arg === "--runtime-ticks") {
      parsed.runtimeTicks = readInteger(readFlag(args, ++index, arg), arg);
    } else if (arg === "--runtime-timeout-ms") {
      parsed.runtimeTimeoutMs = readInteger(readFlag(args, ++index, arg), arg);
    } else if (arg === "--start-timeout-ms") {
      parsed.startTimeoutMs = readInteger(readFlag(args, ++index, arg), arg);
    } else if (arg === "--poll-ms") {
      parsed.pollMs = readInteger(readFlag(args, ++index, arg), arg);
    } else if (arg === "--first-month-runtime") {
      parsed.runtimeTicks = FIRST_MONTH_TICKS;
    } else if (arg === "-h" || arg === "--help") {
      usage(0);
    } else {
      fail(`unknown option: ${arg}`);
    }
  }

  if (parsed.planPath.length === 0 || parsed.parkPath.length === 0) {
    usage(1);
  }

  return parsed;
}

function usage(exitCode) {
  const text = [
    "usage: node scripts/verify-openrct2-park.mjs --plan plan.json --park park.park [options]",
    "",
    "options:",
    "  --openrct2 <path>          OpenRCT2 binary. Defaults to $OPENRCT2_BIN, then openrct2.",
    "  --host-port <port>         OpenRCT2 network host port. Default: 11753.",
    "  --builder-port <port>      RCTAI builder plugin HTTP port. Default: 6427.",
    "  --runtime-ticks <ticks>    Wait for live headless ticks and fail on plugin crash events.",
    "  --first-month-runtime      Shorthand for --runtime-ticks 16384."
  ].join("\n");
  process.stderr.write(`${text}\n`);
  process.exit(exitCode);
}

function readFlag(args, index, flag) {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) {
    fail(`${flag} requires a value`);
  }
  return value;
}

function readInteger(value, flag) {
  if (!/^\d+$/.test(value)) {
    fail(`${flag} must be a non-negative integer`);
  }
  return Number(value);
}

function resolveOpenRCT2(candidate) {
  if (candidate.includes("/")) {
    const resolved = resolve(process.cwd(), candidate);
    if (!existsSync(resolved)) {
      fail(`OpenRCT2 binary not found: ${resolved}`);
    }
    return resolved;
  }
  return candidate;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

async function ensureLiveBuilder(openrct2, parkPath, hostPort, builderPort, timeoutMs, hostOutput) {
  if (await builderIsReady(builderPort)) {
    process.stdout.write(`using live OpenRCT2 builder on 127.0.0.1:${builderPort}\n`);
    return null;
  }

  const host = spawn(openrct2, ["host", parkPath, "--headless", "--port", String(hostPort)], {
    stdio: ["ignore", "pipe", "pipe"]
  });
  host.stdout.on("data", (chunk) => rememberOutput(hostOutput, chunk));
  host.stderr.on("data", (chunk) => rememberOutput(hostOutput, chunk));
  await waitForBuilder(builderPort, timeoutMs);
  return host;
}

async function builderIsReady(port) {
  try {
    const response = await fetchJson(port, "/health");
    return response.status === "ok";
  } catch {
    return false;
  }
}

async function waitForBuilder(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetchJson(port, "/health");
      if (response.status === "ok") {
        return;
      }
    } catch {
      // Keep polling until the headless plugin server is ready.
    }
    await delay(500);
  }
  throw new Error(`builder plugin did not answer on 127.0.0.1:${port} within ${timeoutMs}ms`);
}

async function getInspection(port, plan) {
  const inspection = await postJson(port, "/inspect", { footpaths: [] });
  const coords = inspectionFootpathCoords(plan, inspection.park.rides ?? []);
  const trackRideIds = plannedTrackRideIds(plan, inspection.park.rides ?? []);
  inspection.park.footpaths = await fetchInspectionFootpaths(port, coords);
  inspection.park.tracks = await fetchInspectionTracks(port, trackRideIds);
  inspection.park.trackTraversals = await fetchInspectionTrackTraversals(port, trackRideIds);
  inspection.park.trackSegments = await fetchInspectionTrackSegments(port, plannedTrackTypes(plan));
  return inspection;
}

async function fetchInspectionFootpaths(port, coords) {
  const footpaths = [];
  for (let index = 0; index < coords.length; index += FOOTPATH_BATCH_SIZE) {
    const batch = coords.slice(index, index + FOOTPATH_BATCH_SIZE);
    const response = await postJson(port, "/inspect-footpaths", { footpaths: batch });
    footpaths.push(...(response.footpaths ?? []));
  }
  return dedupeFootpaths(footpaths);
}

function inspectionFootpathCoords(plan, actualRides) {
  const coords = new Map();
  const add = (coord) => {
    coords.set(xyKey(coord), { x: coord.x, y: coord.y });
  };

  add(plan.park.entrance);
  for (const pathEdge of plan.paths ?? []) {
    for (const waypoint of pathEdge.waypoints ?? []) {
      add(waypoint);
    }
  }

  for (const expected of plan.rides ?? []) {
    const rawVisual = Array.isArray(expected.track) && expected.track.some((segment) => segment.raw === true);
    if (rawVisual) {
      continue;
    }
    const actual = actualRides.find((ride) => ride.name === expected.id || ride.name.startsWith(`${expected.id} `));
    if (actual === undefined) {
      continue;
    }
    for (const access of actualAccessPathTiles(actual, plan)) {
      add(access.tile);
    }
  }

  return [...coords.values()];
}

function dedupeFootpaths(footpaths) {
  const byKey = new Map();
  for (const footpath of footpaths) {
    byKey.set(pathKey(footpath), footpath);
  }
  return [...byKey.values()];
}

async function fetchInspectionTracks(port, rideIds) {
  if (rideIds.length === 0) {
    return [];
  }
  const tracks = [];
  for (let index = 0; index < rideIds.length; index += TRACK_RIDE_BATCH_SIZE) {
    const batch = rideIds.slice(index, index + TRACK_RIDE_BATCH_SIZE);
    const response = await postJson(port, "/inspect-tracks", { rideIds: batch });
    tracks.push(...(response.tracks ?? []));
  }
  return tracks;
}

async function fetchInspectionTrackTraversals(port, rideIds) {
  if (rideIds.length === 0) {
    return [];
  }
  const traversals = [];
  for (let index = 0; index < rideIds.length; index += TRACK_RIDE_BATCH_SIZE) {
    const batch = rideIds.slice(index, index + TRACK_RIDE_BATCH_SIZE);
    const response = await postJson(port, "/inspect-track-traversals", { rideIds: batch });
    traversals.push(...(response.traversals ?? []));
  }
  return traversals;
}

async function fetchInspectionTrackSegments(port, types) {
  if (types.length === 0) {
    return {};
  }
  const response = await fetchJson(port, `/track-segments?types=${types.join(",")}`);
  return response.segments ?? {};
}

function plannedTrackRideIds(plan, actualRides) {
  const ids = [];
  for (const expected of plan.rides ?? []) {
    if (!requiresPlacedTrackValidation(expected)) {
      continue;
    }
    const actual = actualRides.find((ride) => ride.name === expected.id || ride.name.startsWith(`${expected.id} `));
    if (actual !== undefined) {
      ids.push(actual.id);
    }
  }
  return ids;
}

function plannedTrackTypes(plan) {
  const types = new Set();
  for (const ride of plan.rides ?? []) {
    if (!requiresPlacedTrackValidation(ride)) {
      continue;
    }
    for (const segment of ride.track ?? []) {
      if (Number.isInteger(segment.type)) {
        types.add(segment.type);
      }
    }
  }
  return [...types].sort((left, right) => left - right);
}

async function postJson(port, path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const parsed = text.length === 0 ? {} : JSON.parse(text);
  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${text}`);
  }
  return parsed;
}

async function fetchJson(port, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} failed with HTTP ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

function validateInspection(plan, inspection, phase) {
  const phaseIssues = [];
  const actualRides = inspection.park.rides ?? [];
  const footpaths = (inspection.park.footpaths ?? []).map((footpath) => normalizeInspectionCoord(footpath, plan));
  const footpathsByXY = pathTilesByXY(footpaths);
  const footpathTiles = new Set(footpaths.map((footpath) => coordKey(footpath)));
  const tracksByRide = tracksByRideId(inspection.park.tracks ?? []);
  const traversalsByRide = traversalsByRideId(inspection.park.trackTraversals ?? []);
  const trackSegments = inspection.park.trackSegments ?? {};
  const entranceTiles = footpaths.filter(
    (footpath) => footpath.x === plan.park.entrance.x && footpath.y === plan.park.entrance.y
  );
  const reachable = reachablePathTiles(footpaths, entranceTiles);

  if (entranceTiles.length === 0) {
    phaseIssues.push(`${phase}: no accepted footpath at park entrance ${xyKey(plan.park.entrance)}`);
  }

  if ((inspection.park.crashes ?? []).length > 0) {
    for (const crash of inspection.park.crashes) {
      phaseIssues.push(
        `${phase}: vehicle ${crash.vehicleId} crashed into ${crash.crashIntoType} at tick ${crash.ticksElapsed}`
      );
    }
  }

  for (const expected of plan.rides ?? []) {
    const actual = actualRides.find((ride) => ride.name === expected.id || ride.name.startsWith(`${expected.id} `));
    const rawVisual = Array.isArray(expected.track) && expected.track.some((segment) => segment.raw === true);
    if (actual === undefined) {
      phaseIssues.push(`${phase}: missing ride ${expected.id}`);
      continue;
    }
    if (!rawVisual && actual.status !== "open") {
      phaseIssues.push(`${phase}: ride ${expected.id} is ${actual.status}, expected open`);
    }
    if (!rawVisual && !hasEntranceAndExit(actual)) {
      phaseIssues.push(`${phase}: ride ${expected.id} is missing an entrance or exit`);
    }
    if (!rawVisual) {
      for (const access of actualAccessPathTiles(actual, plan)) {
        const tile = access.tile;
        const candidates = (footpathsByXY.get(xyKey(tile)) ?? []).filter((footpath) => footpath.z === tile.z);
        if (!footpathTiles.has(coordKey(tile))) {
          phaseIssues.push(
            `${phase}: ride ${expected.id} ${access.label} path tile was not accepted by OpenRCT2 at ${coordKey(tile)}`
          );
        } else if (!candidates.some((candidate) => reachable.has(pathKey(candidate)))) {
          phaseIssues.push(
            `${phase}: ride ${expected.id} ${access.label} path tile is not connected to the main path at ${coordKey(tile)}`
          );
        }
      }
    }
    if (requiresPlacedTrackValidation(expected)) {
      phaseIssues.push(...validatePlacedTrackGraph(expected, actual, tracksByRide, trackSegments, phase));
      phaseIssues.push(...validateTrackTraversal(expected, actual, traversalsByRide, phase));
    }
  }

  for (const pathEdge of plan.paths ?? []) {
    for (const waypoint of pathEdge.waypoints ?? []) {
      const candidates = footpathsByXY.get(xyKey(waypoint)) ?? [];
      if (candidates.length === 0) {
        phaseIssues.push(`${phase}: planned path tile was not accepted by OpenRCT2 at ${xyKey(waypoint)}`);
      } else if (!candidates.some((candidate) => reachable.has(pathKey(candidate)))) {
        phaseIssues.push(`${phase}: planned path tile is not connected to the main path at ${xyKey(waypoint)}`);
      }
    }
  }

  return phaseIssues;
}

function validateTrackTraversal(ride, actual, traversalsByRide, phase) {
  const traversals = traversalsByRide.get(actual.id) ?? [];
  if (traversals.length === 0) {
    return [`${phase}: ride ${ride.id} has no OpenRCT2 track traversal`];
  }

  const issues = [];
  for (const traversal of traversals) {
    if (!traversal.closed || !traversal.complete) {
      const reason = traversal.reason === null || traversal.reason === undefined ? "unknown reason" : traversal.reason;
      const missing = Array.isArray(traversal.missingKeys) ? traversal.missingKeys : [];
      const unexpected = Array.isArray(traversal.unexpectedKeys) ? traversal.unexpectedKeys : [];
      const examples = [
        missing.length > 0 ? `missing ${missing.length}: ${missing.slice(0, 5).join("; ")}` : null,
        unexpected.length > 0 ? `unexpected ${unexpected.length}: ${unexpected.slice(0, 5).join("; ")}` : null
      ].filter((entry) => entry !== null);
      issues.push(
        `${phase}: ride ${ride.id} station ${traversal.station} track traversal failed: ` +
          `${reason}; closed=${traversal.closed}, complete=${traversal.complete}, ` +
          `visited ${traversal.visitedSegments}/${traversal.expectedSegments}` +
          (examples.length > 0 ? `; ${examples.join("; ")}` : "")
      );
    }
  }
  return issues;
}

function validatePlacedTrackGraph(ride, actual, tracksByRide, trackSegments, phase) {
  const issues = [];
  const actualTracks = (tracksByRide.get(actual.id) ?? []).filter((track) => track.sequence === 0);
  if (actualTracks.length === 0) {
    return [`${phase}: ride ${ride.id} has no placed track elements`];
  }

  const firstSegment = ride.track[0];
  if (firstSegment === undefined) {
    return issues;
  }

  const firstMeta = trackSegmentInfo(trackSegments, firstSegment.type);
  if (firstMeta === null) {
    return [`${phase}: ride ${ride.id} has unknown track segment type ${firstSegment.type}`];
  }

  const firstDirection = normalizeDirection(firstSegment.direction ?? ride.rotation ?? 0);
  const firstActual = actualTracks.find(
    (track) =>
      track.x === ride.position.x + (firstSegment.x ?? 0) &&
      track.y === ride.position.y + (firstSegment.y ?? 0) &&
      normalizeDirection(track.direction) === firstDirection &&
      track.trackType === firstSegment.type
  );
  if (firstActual === undefined) {
    return [
      `${phase}: ride ${ride.id} is missing first placed track segment ${formatTrackExpectation({
        x: ride.position.x + (firstSegment.x ?? 0),
        y: ride.position.y + (firstSegment.y ?? 0),
        z: firstSegment.z ?? 0,
        direction: firstDirection,
        trackType: firstSegment.type
      })}`
    ];
  }

  const buildZ = firstSegment.z ?? firstActual.z + firstMeta.beginZ;
  const actualCounts = countedTrackKeys(actualTracks.map((track) => trackKey(track)));
  const expectedCounts = new Map();
  const missing = [];
  let cursor = null;
  let startCursor = null;
  let endCursor = null;

  for (let index = 0; index < ride.track.length; index += 1) {
    const segment = ride.track[index];
    if (segment.raw === true) {
      continue;
    }
    const meta = trackSegmentInfo(trackSegments, segment.type);
    if (meta === null) {
      issues.push(`${phase}: ride ${ride.id} has unknown track segment type ${segment.type} at #${index}`);
      continue;
    }

    if (cursor === null || hasExplicitTrackOrigin(segment)) {
      cursor = {
        x: ride.position.x + (segment.x ?? 0),
        y: ride.position.y + (segment.y ?? 0),
        z: segment.z ?? buildZ,
        direction: normalizeDirection(segment.direction ?? ride.rotation ?? 0)
      };
      if (startCursor === null) {
        startCursor = { ...cursor };
      }
    }

    const expected = {
      x: cursor.x,
      y: cursor.y,
      z: cursor.z - meta.beginZ,
      direction: cursor.direction,
      trackType: segment.type
    };
    const key = trackKey(expected);
    expectedCounts.set(key, (expectedCounts.get(key) ?? 0) + 1);
    const available = actualCounts.get(key) ?? 0;
    if (available <= 0) {
      missing.push({ index, expected });
    } else {
      actualCounts.set(key, available - 1);
    }

    cursor = advanceTrackCursor(cursor, meta);
    endCursor = { ...cursor };
  }

  if (missing.length > 0) {
    const examples = missing
      .slice(0, 5)
      .map((entry) => `#${entry.index} ${formatTrackExpectation(entry.expected)}`)
      .join("; ");
    issues.push(
      `${phase}: ride ${ride.id} is missing ${missing.length} placed track segment(s); first missing: ${examples}`
    );
  }

  const unexpected = [];
  for (const [key, count] of actualCounts.entries()) {
    if (count > 0 && !expectedCounts.has(key)) {
      unexpected.push({ key, count });
    }
  }
  if (unexpected.length > 0) {
    const examples = unexpected
      .slice(0, 5)
      .map((entry) => `${entry.key}${entry.count > 1 ? ` x${entry.count}` : ""}`)
      .join("; ");
    issues.push(
      `${phase}: ride ${ride.id} has ${unexpected.reduce((sum, entry) => sum + entry.count, 0)} unexpected placed track segment(s); first extra: ${examples}`
    );
  }

  issues.push(...validateActualTrackComponents(ride, actualTracks, trackSegments, phase));

  if (startCursor !== null && endCursor !== null && !sameTrackCursor(startCursor, endCursor)) {
    issues.push(
      `${phase}: ride ${ride.id} planned track cursor is not closed: start ${formatCursor(startCursor)}, end ${formatCursor(endCursor)}`
    );
  }

  return issues;
}

function validateActualTrackComponents(ride, actualTracks, trackSegments, phase) {
  const issues = [];
  const nodes = [];
  const nodesByPose = new Map();

  for (let index = 0; index < actualTracks.length; index += 1) {
    const track = actualTracks[index];
    const meta = trackSegmentInfo(trackSegments, track.trackType);
    if (meta === null) {
      issues.push(`${phase}: ride ${ride.id} has actual track with unknown type ${track.trackType}`);
      continue;
    }
    const start = actualTrackStartCursor(track, meta);
    const node = {
      key: actualTrackNodeKey(track, start, index),
      track,
      meta,
      start
    };
    nodes.push(node);
    const pose = trackPoseKey(start);
    const group = nodesByPose.get(pose) ?? [];
    group.push(node);
    nodesByPose.set(pose, group);
  }

  if (nodes.length === 0) {
    return issues;
  }

  const links = new Map(nodes.map((node) => [node.key, new Set()]));
  const missingNext = [];
  for (const node of nodes) {
    const end = advanceTrackCursor(node.start, node.meta);
    const nextNodes = nodesByPose.get(trackPoseKey(end)) ?? [];
    if (nextNodes.length === 0) {
      missingNext.push({ node, end });
      continue;
    }
    for (const next of nextNodes) {
      links.get(node.key)?.add(next.key);
      links.get(next.key)?.add(node.key);
    }
  }

  const components = trackComponents(nodes, links);
  if (components.length > 1) {
    const examples = components
      .slice(0, 5)
      .map((component) => `${component.length}: ${formatActualTrackNode(component[0])}`)
      .join("; ");
    issues.push(
      `${phase}: ride ${ride.id} actual placed track has ${components.length} disconnected component(s); ` +
        `sizes ${components.map((component) => component.length).join(", ")}; first components: ${examples}`
    );
  }

  if (missingNext.length > 0) {
    const examples = missingNext
      .slice(0, 5)
      .map((entry) => `${formatActualTrackNode(entry.node)} -> ${formatCursor(entry.end)}`)
      .join("; ");
    issues.push(
      `${phase}: ride ${ride.id} actual placed track has ${missingNext.length} segment(s) whose next position has no placed segment; ` +
        `first missing links: ${examples}`
    );
  }

  return issues;
}

function requiresPlacedTrackValidation(ride) {
  return (
    Array.isArray(ride.track) &&
    ride.track.length > 1 &&
    !isTowerRide(ride) &&
    !ride.track.some((segment) => segment.raw === true)
  );
}

function isTowerRide(ride) {
  return ride.rideType === "observation_tower" || ride.rideType === "roto_drop" || ride.rideType === "launched_freefall";
}

function tracksByRideId(tracks) {
  const byRide = new Map();
  for (const track of tracks) {
    const group = byRide.get(track.ride) ?? [];
    group.push(track);
    byRide.set(track.ride, group);
  }
  return byRide;
}

function traversalsByRideId(traversals) {
  const byRide = new Map();
  for (const traversal of traversals) {
    const group = byRide.get(traversal.ride) ?? [];
    group.push(traversal);
    byRide.set(traversal.ride, group);
  }
  return byRide;
}

function countedTrackKeys(keys) {
  const counts = new Map();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function actualTrackStartCursor(track, trackInfo) {
  return {
    x: track.x,
    y: track.y,
    z: track.z + trackInfo.beginZ,
    direction: normalizeDirection(track.direction)
  };
}

function actualTrackNodeKey(track, start, index) {
  return `${trackPoseKey(start)},t${track.trackType},e${track.elementIndex ?? index}`;
}

function trackPoseKey(cursor) {
  return `${cursor.x},${cursor.y},${cursor.z},d${normalizeDirection(cursor.direction)}`;
}

function trackComponents(nodes, links) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const unvisited = new Set(nodes.map((node) => node.key));
  const components = [];

  while (unvisited.size > 0) {
    const start = unvisited.values().next().value;
    const queue = [start];
    const component = [];
    unvisited.delete(start);

    while (queue.length > 0) {
      const key = queue.shift();
      const node = byKey.get(key);
      if (node !== undefined) {
        component.push(node);
      }
      for (const next of links.get(key) ?? []) {
        if (unvisited.delete(next)) {
          queue.push(next);
        }
      }
    }

    components.push(component);
  }

  return components.sort((left, right) => right.length - left.length);
}

function trackSegmentInfo(trackSegments, type) {
  const info = trackSegments[String(type)];
  if (info === null || info === undefined) {
    return null;
  }
  return {
    endX: Number(info.endX ?? 0),
    endY: Number(info.endY ?? 0),
    beginZ: Number(info.beginZ ?? 0),
    endZ: Number(info.endZ ?? 0),
    beginDirection: Number(info.beginDirection ?? 0),
    endDirection: Number(info.endDirection ?? 0)
  };
}

function hasExplicitTrackOrigin(segment) {
  return segment.x !== undefined || segment.y !== undefined || segment.z !== undefined || segment.direction !== undefined;
}

function advanceTrackCursor(cursor, trackInfo) {
  const rotated = rotateDelta(trackInfo.endX, trackInfo.endY, cursor.direction);
  const direction = normalizeDirection(cursor.direction + trackInfo.endDirection - trackInfo.beginDirection);
  let x = cursor.x + Math.round(rotated.x / 32);
  let y = cursor.y + Math.round(rotated.y / 32);
  if ((trackInfo.endDirection & 4) !== 4) {
    const delta = directionDelta(direction);
    x += delta.x;
    y += delta.y;
  }

  return {
    x,
    y,
    z: cursor.z - trackInfo.beginZ + trackInfo.endZ,
    direction
  };
}

function rotateDelta(x, y, direction) {
  switch (direction & 3) {
    case 1:
      return { x: y, y: -x };
    case 2:
      return { x: -x, y: -y };
    case 3:
      return { x: -y, y: x };
    default:
      return { x, y };
  }
}

function sameTrackCursor(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z && left.direction === right.direction;
}

function trackKey(track) {
  return `${track.x},${track.y},${track.z},d${normalizeDirection(track.direction)},t${track.trackType}`;
}

function formatTrackExpectation(track) {
  return `(${track.x},${track.y},${track.z},d${normalizeDirection(track.direction)},t${track.trackType})`;
}

function formatCursor(cursor) {
  return `(${cursor.x},${cursor.y},${cursor.z},d${cursor.direction})`;
}

function formatActualTrackNode(node) {
  return `${formatCursor(node.start)},t${node.track.trackType}`;
}

function hasEntranceAndExit(ride) {
  return (ride.stations ?? []).some((station) => station.entrance !== null && station.exit !== null);
}

function actualAccessPathTiles(ride, plan) {
  const tiles = [];
  for (const station of ride.stations ?? []) {
    if (station.entrance !== null) {
      tiles.push({ label: "entrance", tile: accessPathTile(station.entrance, plan) });
    }
    if (station.exit !== null) {
      tiles.push({ label: "exit", tile: accessPathTile(station.exit, plan) });
    }
  }
  return tiles;
}

function accessPathTile(access, plan) {
  const location = normalizeInspectionCoord(access, plan);
  const delta = directionDelta(normalizeDirection(location.direction ?? 0));
  return clampPoint(
    {
      x: location.x - delta.x,
      y: location.y - delta.y,
      z: location.z
    },
    plan.park.size.width,
    plan.park.size.height
  );
}

function normalizeInspectionCoord(coord, plan) {
  const width = plan.park.size.width;
  const height = plan.park.size.height;
  const x = coord.x >= width ? Math.floor(coord.x / 32) : coord.x;
  const y = coord.y >= height ? Math.floor(coord.y / 32) : coord.y;
  return {
    ...coord,
    x,
    y,
    z: coord.z ?? 0
  };
}

function reachablePathTiles(footpaths, entranceTiles) {
  const pathTiles = new Set(footpaths.map((footpath) => pathKey(footpath)));
  const byXY = pathTilesByXY(footpaths);

  const visited = new Set();
  const queue = [...entranceTiles];
  while (queue.length > 0) {
    const point = queue.shift();
    if (point === undefined) {
      continue;
    }
    const key = pathKey(point);
    if (visited.has(key) || !pathTiles.has(key)) {
      continue;
    }
    visited.add(key);
    for (const direction of [0, 1, 2, 3]) {
      const delta = directionDelta(direction);
      const candidates = byXY.get(xyKey({ x: point.x + delta.x, y: point.y + delta.y })) ?? [];
      for (const candidate of candidates) {
        if (pathTilesConnect(point, candidate, direction)) {
          queue.push(candidate);
        }
      }
    }
  }
  return visited;
}

function pathTilesByXY(footpaths) {
  const byXY = new Map();
  for (const footpath of footpaths) {
    const key = xyKey(footpath);
    const candidates = byXY.get(key) ?? [];
    candidates.push(footpath);
    byXY.set(key, candidates);
  }
  return byXY;
}

function pathTilesConnect(from, to, direction) {
  const fromEdgeZ = pathEdgeZ(from, direction);
  const toEdgeZ = pathEdgeZ(to, oppositeDirection(direction));
  return fromEdgeZ !== null && toEdgeZ !== null && fromEdgeZ === toEdgeZ;
}

function pathEdgeZ(path, direction) {
  if (path.slopeDirection === null || path.slopeDirection === undefined) {
    return path.z;
  }
  const uphill = normalizeDirection(path.slopeDirection);
  if (direction === uphill) {
    return path.z + 16;
  }
  return path.z;
}

function oppositeDirection(direction) {
  return normalizeDirection(direction + 2);
}

function directionDelta(direction) {
  switch (direction & 3) {
    case 0:
      return { x: -1, y: 0 };
    case 1:
      return { x: 0, y: 1 };
    case 2:
      return { x: 1, y: 0 };
    case 3:
      return { x: 0, y: -1 };
    default:
      return { x: 0, y: 0 };
  }
}

function normalizeDirection(direction) {
  return ((direction % 4) + 4) % 4;
}

function clampPoint(point, width, height) {
  return {
    ...point,
    x: Math.max(0, Math.min(width - 1, point.x)),
    y: Math.max(0, Math.min(height - 1, point.y))
  };
}

function coordKey(coord) {
  return `${coord.x},${coord.y},${coord.z ?? 0}`;
}

function pathKey(coord) {
  return `${coordKey(coord)},${coord.slopeDirection ?? "flat"}`;
}

function xyKey(coord) {
  return `${coord.x},${coord.y}`;
}

function rememberOutput(buffer, chunk) {
  buffer.push(stripAnsi(String(chunk)));
  while (buffer.length > 80) {
    buffer.shift();
  }
}

function stripAnsi(value) {
  return value.replace(ANSI_PATTERN, "");
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}
