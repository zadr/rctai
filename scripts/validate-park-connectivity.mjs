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
const FLAT = 0;

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
  40: { endX: -64, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  41: { endX: -64, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
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
const issues = [...validateSchema(schema, plan), ...validatePathGraph(plan), ...validateClosedTrackCircuits(plan.rides ?? [])];

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
