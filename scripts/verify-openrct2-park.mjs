#!/usr/bin/env node
/* global fetch */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const DEFAULT_OPENRCT2 = process.env.OPENRCT2_BIN ?? "openrct2";
const DEFAULT_HOST_PORT = 11753;
const DEFAULT_BUILDER_PORT = 6427;
const FIRST_MONTH_TICKS = 16_384;
const FOOTPATH_BATCH_SIZE = 1_000;
const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

const BEGIN_STATION = 2;
const END_STATION = 1;
const MIDDLE_STATION = 3;

const options = parseArgs(process.argv.slice(2));
const plan = readJson(resolve(process.cwd(), options.planPath));
const parkPath = resolve(process.cwd(), options.parkPath);

if (!existsSync(parkPath)) {
  fail(`park file does not exist: ${parkPath}`);
}

const openrct2 = resolveOpenRCT2(options.openrct2);
const issues = [];

if (options.simulateTicks > 0) {
  const result = spawnSync(openrct2, ["simulate", parkPath, String(options.simulateTicks)], {
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    issues.push(`OpenRCT2 simulate failed: ${stripAnsi(result.stderr || result.stdout || `exit ${result.status}`)}`);
  } else {
    process.stdout.write(`simulate passed: ${options.simulateTicks} ticks\n`);
  }
}

const host = spawn(openrct2, ["host", parkPath, "--headless", "--port", String(options.hostPort)], {
  stdio: ["ignore", "pipe", "pipe"]
});
const hostOutput = [];
host.stdout.on("data", (chunk) => rememberOutput(hostOutput, chunk));
host.stderr.on("data", (chunk) => rememberOutput(hostOutput, chunk));

try {
  await waitForBuilder(options.builderPort, options.startTimeoutMs);
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
  host.kill("SIGTERM");
  await delay(500);
  if (host.exitCode === null) {
    host.kill("SIGKILL");
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
    simulateTicks: FIRST_MONTH_TICKS,
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
    } else if (arg === "--simulate-ticks") {
      parsed.simulateTicks = readInteger(readFlag(args, ++index, arg), arg);
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
    } else if (arg === "--no-simulate") {
      parsed.simulateTicks = 0;
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
    "  --simulate-ticks <ticks>   Run OpenRCT2 CLI simulate before inspection. Default: 16384.",
    "  --no-simulate              Skip CLI simulate.",
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
  inspection.park.footpaths = await fetchInspectionFootpaths(port, coords);
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

function entranceExitPathTile(ride, isExit, plan) {
  const location = entranceExitLocation(ride, isExit);
  const delta = directionDelta(normalizeDirection(location.direction ?? ride.rotation ?? 0));
  return clampPoint(
    {
      x: location.x - delta.x,
      y: location.y - delta.y
    },
    plan.park.size.width,
    plan.park.size.height
  );
}

function entranceExitLocation(ride, isExit) {
  const stationLocation = stationEntranceExitLocation(ride, isExit);
  if (stationLocation !== null) {
    return {
      x: ride.position.x + stationLocation.x,
      y: ride.position.y + stationLocation.y,
      direction: stationLocation.direction
    };
  }

  const fallback = fallbackEntranceExitOffset(ride, isExit);
  return {
    x: ride.position.x + fallback.x,
    y: ride.position.y + fallback.y,
    direction: fallback.direction
  };
}

function stationEntranceExitLocation(ride, isExit) {
  const stationSegments = (ride.track ?? []).filter(
    (segment) => segment.type === END_STATION || segment.type === BEGIN_STATION || segment.type === MIDDLE_STATION
  );
  const stationIndex = isExit ? stationSegments.length - 1 : 0;
  const station = stationSegments[stationIndex];
  if (station === undefined) {
    return null;
  }

  const stationOrigin = stationSegments[0];
  const direction = normalizeDirection(station.direction ?? stationOrigin?.direction ?? ride.rotation ?? 0);
  const stationStep = directionDelta(direction);
  const side = stationSideOffset(direction, isExit);
  const sideDirection = directionFromDelta(side.x, side.y);
  return {
    x: (station.x ?? (stationOrigin?.x ?? 0) + stationStep.x * stationIndex) + side.x,
    y: (station.y ?? (stationOrigin?.y ?? 0) + stationStep.y * stationIndex) + side.y,
    direction: normalizeDirection(sideDirection + 2)
  };
}

function fallbackEntranceExitOffset(ride, isExit) {
  const direction = normalizeDirection(ride.rotation ?? 0);
  if (!isExit) {
    return { x: 0, y: ride.footprint.h, direction };
  }
  if (ride.footprint.w <= 1) {
    return { x: 1, y: ride.footprint.h, direction };
  }
  return { x: Math.max(ride.footprint.w - 1, 0), y: ride.footprint.h, direction };
}

function stationSideOffset(direction, isExit) {
  if (direction === 0) {
    return { x: 0, y: isExit ? -1 : 1 };
  }
  if (direction === 1) {
    return { x: isExit ? 1 : -1, y: 0 };
  }
  if (direction === 2) {
    return { x: 0, y: isExit ? 1 : -1 };
  }
  return { x: isExit ? -1 : 1, y: 0 };
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

function directionFromDelta(x, y) {
  if (x < 0) {
    return 0;
  }
  if (y > 0) {
    return 1;
  }
  if (x > 0) {
    return 2;
  }
  if (y < 0) {
    return 3;
  }
  return 0;
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
