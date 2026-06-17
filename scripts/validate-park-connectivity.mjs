#!/usr/bin/env node
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const inputPath = process.argv[2];
if (inputPath === undefined) {
  console.error("usage: node scripts/validate-park-connectivity.mjs <park-plan.json>");
  process.exit(1);
}

const BASE_Z = 112;
const BEGIN_STATION = 2;
const END_STATION = 1;
const MIDDLE_STATION = 3;
const FLAT = 0;
const BRAKES = 99;
const BLOCK_BRAKES = 216;
const BRAKE_TRACK_TYPES = new Set([BRAKES, BLOCK_BRAKES]);
const RIDE_TYPES_WITHOUT_PAINTED_BRAKES = new Set(["miniature_railway", "suspended_monorail"]);

const TRACK_META = {
  0: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  1: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  2: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  3: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  4: { endX: 0, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  6: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  9: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  10: { endX: 0, endY: 0, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 0 },
  12: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  15: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  16: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  17: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  22: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  23: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  40: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  41: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  42: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  43: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  50: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  51: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  99: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  100: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  216: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 }
};

const plan = readJson(resolve(process.cwd(), inputPath));
const schema = readJson(resolve(process.cwd(), "schemas/park-plan.schema.json"));
const issues = [
  ...validateSchema(schema, plan),
  ...validatePathGraph(plan),
  ...validatePhysicalPathNetwork(plan),
  ...validatePaintedTrackPieces(plan.rides ?? []),
  ...validateClosedTrackCircuits(plan.rides ?? [])
];

if (issues.length > 0) {
  console.error(`park connectivity validation failed for ${inputPath}`);
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log(
  `park connectivity valid: ${inputPath} (${plan.rides.length} rides, ${(plan.paths ?? []).length} paths, ${closedCircuitRideCount(plan.rides)} closed track circuits)`
);

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function validateSchema(schema, value) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (validate(value)) {
    return [];
  }
  return (validate.errors ?? []).map((error) => {
    const location = error.instancePath === "" ? "/" : error.instancePath;
    return `${location} ${error.message ?? "is invalid"}`;
  });
}

function validatePathGraph(plan) {
  const rideIds = new Set((plan.rides ?? []).map((ride) => ride.id));
  const graph = new Map([["entrance", new Set()]]);
  const issues = [];

  for (const id of rideIds) {
    graph.set(id, new Set());
  }

  for (const pathEdge of plan.paths ?? []) {
    if (!graph.has(pathEdge.from)) {
      issues.push(`path references unknown node ${pathEdge.from}`);
      continue;
    }
    if (!graph.has(pathEdge.to)) {
      issues.push(`path references unknown node ${pathEdge.to}`);
      continue;
    }
    graph.get(pathEdge.from)?.add(pathEdge.to);
    graph.get(pathEdge.to)?.add(pathEdge.from);
  }

  const visited = new Set();
  const queue = ["entrance"];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined || visited.has(node)) {
      continue;
    }
    visited.add(node);
    for (const next of graph.get(node) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  for (const id of [...rideIds].sort((left, right) => left.localeCompare(right))) {
    if (!visited.has(id)) {
      issues.push(`ride is not path-connected to entrance: ${id}`);
    }
  }

  return issues;
}

function validatePhysicalPathNetwork(plan) {
  const issues = [];
  const width = plan.park?.size?.width ?? 0;
  const height = plan.park?.size?.height ?? 0;
  const entrance = { x: plan.park?.entrance?.x ?? 0, y: plan.park?.entrance?.y ?? 0 };
  const pathTiles = new Set();

  for (const pathEdge of plan.paths ?? []) {
    for (const coord of pathEdge.waypoints ?? []) {
      if (!isInsidePark(coord, width, height)) {
        issues.push(`path tile is outside park: ${coord.x},${coord.y}`);
        continue;
      }
      pathTiles.add(coordKey(coord));
    }
  }

  if (!pathTiles.has(coordKey(entrance))) {
    issues.push(`main path does not include park entrance tile: ${entrance.x},${entrance.y}`);
  }

  const reachable = reachablePathTiles(pathTiles, entrance);
  for (const ride of plan.rides ?? []) {
    for (const isExit of [false, true]) {
      const tile = entranceExitPathTile(ride, isExit, width, height);
      const label = isExit ? "exit" : "entrance";
      if (!pathTiles.has(coordKey(tile))) {
        issues.push(`${ride.id} ${label} connection tile missing from path network: ${tile.x},${tile.y}`);
      } else if (!reachable.has(coordKey(tile))) {
        issues.push(`${ride.id} ${label} connection tile is not connected to main path: ${tile.x},${tile.y}`);
      }
    }
  }

  return issues;
}

function validatePaintedTrackPieces(rides) {
  const issues = [];
  for (const ride of rides) {
    for (const [index, segment] of (ride.track ?? []).entries()) {
      if (isUnpaintedTrackPiece(ride.rideType, segment.type)) {
        issues.push(`${ride.id} ${ride.rideType} segment ${index} uses unpainted track type ${segment.type}`);
      }
    }
  }
  return issues;
}

function reachablePathTiles(pathTiles, entrance) {
  const visited = new Set();
  const queue = [entrance];
  while (queue.length > 0) {
    const point = queue.shift();
    if (point === undefined) {
      continue;
    }
    const key = coordKey(point);
    if (visited.has(key) || !pathTiles.has(key)) {
      continue;
    }
    visited.add(key);
    for (const delta of [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]) {
      queue.push({ x: point.x + delta.x, y: point.y + delta.y });
    }
  }
  return visited;
}

function isInsidePark(coord, width, height) {
  return coord.x >= 0 && coord.y >= 0 && coord.x < width && coord.y < height;
}

function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

function entranceExitPathTile(ride, isExit, width, height) {
  const location = entranceExitLocation(ride, isExit);
  const delta = directionDelta(normalizeDirection(location.direction ?? ride.rotation ?? 0));
  return clampPoint(
    {
      x: location.x - delta.x,
      y: location.y - delta.y
    },
    width,
    height
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
  const stationSegments = (ride.track ?? []).filter((segment) => segment.type === END_STATION || segment.type === BEGIN_STATION || segment.type === MIDDLE_STATION);
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

function clampPoint(point, width, height) {
  return {
    x: Math.max(0, Math.min(width - 1, point.x)),
    y: Math.max(0, Math.min(height - 1, point.y))
  };
}

function validateClosedTrackCircuits(rides) {
  const issues = [];
  for (const ride of rides) {
    if (!requiresClosedTrackCircuit(ride)) {
      continue;
    }

    if (ride.track[0]?.type !== BEGIN_STATION) {
      issues.push(`${ride.id} closed circuit does not start with begin station`);
      continue;
    }

    const start = trackStartCursor(ride);
    const end = simulateTrack(ride.track, start);
    if (!sameCursor(start, end)) {
      issues.push(`${ride.id} track is not closed: start ${formatCursor(start)}, end ${formatCursor(end)}, pieces ${ride.track.length}`);
    }
  }
  return issues;
}

function requiresClosedTrackCircuit(ride) {
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

function isUnpaintedTrackPiece(rideType, trackType) {
  return RIDE_TYPES_WITHOUT_PAINTED_BRAKES.has(rideType) && BRAKE_TRACK_TYPES.has(trackType);
}

function trackStartCursor(ride) {
  const first = ride.track[0] ?? {};
  return {
    x: first.x ?? 0,
    y: first.y ?? 0,
    z: first.z ?? BASE_Z,
    direction: normalizeDirection(first.direction ?? ride.rotation ?? 0)
  };
}

function simulateTrack(track, start) {
  let cursor = { ...start };
  for (const segment of track) {
    const meta = TRACK_META[segment.type] ?? (segment.type === FLAT ? TRACK_META[FLAT] : null);
    if (meta === null) {
      throw new Error(`unknown generated track element type ${segment.type}`);
    }
    cursor = advance(cursor, meta);
  }
  return cursor;
}

function advance(cursor, meta) {
  const rotated = rotate(meta.endX, meta.endY, cursor.direction);
  const direction = normalizeDirection(cursor.direction + meta.endDirection - meta.beginDirection);
  const step = directionDelta(direction);
  return {
    x: cursor.x + Math.round(rotated.x / 32) + step.x,
    y: cursor.y + Math.round(rotated.y / 32) + step.y,
    z: cursor.z - meta.beginZ + meta.endZ,
    direction
  };
}

function rotate(x, y, direction) {
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

function sameCursor(left, right) {
  return left.x === right.x && left.y === right.y && left.z === right.z && left.direction === right.direction;
}

function formatCursor(cursor) {
  return `(${cursor.x},${cursor.y},${cursor.z},d${cursor.direction})`;
}

function closedCircuitRideCount(rides) {
  return rides.filter((ride) => requiresClosedTrackCircuit(ride)).length;
}

function normalizeDirection(direction) {
  return ((direction % 4) + 4) % 4;
}
