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
const SHOP_FACILITY_RIDE_TYPES = new Set(["drink_stall", "food_stall", "information_kiosk", "toilets"]);
const SIMPLE_SOLID_RIDE_TYPES = new Set([
  "dodgems",
  "drink_stall",
  "enterprise",
  "ferris_wheel",
  "food_stall",
  "haunted_house",
  "information_kiosk",
  "launched_freefall",
  "magic_carpet",
  "merry_go_round",
  "motion_simulator",
  "observation_tower",
  "roto_drop",
  "space_rings",
  "spiral_slide",
  "swinging_ship",
  "toilets",
  "top_spin",
  "twist"
]);

const TRACK_META = {
  0: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  1: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  2: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  3: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  4: { endX: 0, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  5: { endX: 0, endY: 0, beginZ: 0, endZ: 64, beginDirection: 0, endDirection: 0 },
  6: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  7: { endX: 0, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  8: { endX: 0, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  9: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  10: { endX: 0, endY: 0, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 0 },
  11: { endX: 0, endY: 0, beginZ: 64, endZ: 0, beginDirection: 0, endDirection: 0 },
  12: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  13: { endX: 0, endY: 0, beginZ: 32, endZ: 0, beginDirection: 0, endDirection: 0 },
  14: { endX: 0, endY: 0, beginZ: 32, endZ: 0, beginDirection: 0, endDirection: 0 },
  15: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  16: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  17: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  22: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  23: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  38: { endX: -64, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  39: { endX: -64, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  40: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  41: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  42: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  43: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  50: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  51: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  52: { endX: -64, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  53: { endX: -64, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  54: { endX: -64, endY: 0, beginZ: 0, endZ: -16, beginDirection: 0, endDirection: 0 },
  55: { endX: -64, endY: 0, beginZ: 0, endZ: -16, beginDirection: 0, endDirection: 0 },
  58: { endX: -32, endY: -32, beginZ: 0, endZ: 80, beginDirection: 0, endDirection: 3 },
  59: { endX: -32, endY: 32, beginZ: 0, endZ: 80, beginDirection: 0, endDirection: 1 },
  60: { endX: -32, endY: -32, beginZ: 0, endZ: -80, beginDirection: 0, endDirection: 3 },
  61: { endX: -32, endY: 32, beginZ: 0, endZ: -80, beginDirection: 0, endDirection: 1 },
  99: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  102: { endX: -64, endY: -64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 3 },
  103: { endX: -64, endY: 64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 1 },
  104: { endX: -64, endY: -64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 3 },
  105: { endX: -64, endY: 64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 1 },
  106: { endX: -64, endY: -64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 3 },
  107: { endX: -64, endY: 64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 1 },
  108: { endX: -64, endY: -64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 3 },
  109: { endX: -64, endY: 64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 1 },
  100: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  174: { endX: -64, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  175: { endX: -64, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  176: { endX: -64, endY: 0, beginZ: 0, endZ: -32, beginDirection: 0, endDirection: 0 },
  177: { endX: -64, endY: 0, beginZ: 0, endZ: -32, beginDirection: 0, endDirection: 0 },
  216: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  267: { endX: -64, endY: -64, beginZ: 0, endZ: 112, beginDirection: 0, endDirection: 3 },
  268: { endX: -64, endY: 64, beginZ: 0, endZ: 112, beginDirection: 0, endDirection: 1 },
  269: { endX: -64, endY: -64, beginZ: 0, endZ: -112, beginDirection: 0, endDirection: 3 },
  270: { endX: -64, endY: 64, beginZ: 0, endZ: -112, beginDirection: 0, endDirection: 1 },
  275: { endX: -64, endY: 0, beginZ: 0, endZ: 56, beginDirection: 0, endDirection: 0 },
  276: { endX: -64, endY: 0, beginZ: 0, endZ: 56, beginDirection: 0, endDirection: 0 },
  277: { endX: -64, endY: 0, beginZ: 0, endZ: -56, beginDirection: 0, endDirection: 0 },
  278: { endX: -64, endY: 0, beginZ: 0, endZ: -56, beginDirection: 0, endDirection: 0 },
  279: { endX: -96, endY: 0, beginZ: 0, endZ: 152, beginDirection: 0, endDirection: 0 },
  280: { endX: -96, endY: 0, beginZ: 0, endZ: 152, beginDirection: 0, endDirection: 0 },
  281: { endX: -96, endY: 0, beginZ: 0, endZ: -152, beginDirection: 0, endDirection: 0 },
  282: { endX: -96, endY: 0, beginZ: 0, endZ: -152, beginDirection: 0, endDirection: 0 }
};

const plan = readJson(resolve(process.cwd(), inputPath));
const schema = readJson(resolve(process.cwd(), "schemas/park-plan.schema.json"));
const issues = [
  ...validateSchema(schema, plan),
  ...validatePathGraph(plan),
  ...validatePhysicalPathNetwork(plan),
  ...validatePaintedTrackPieces(plan.rides ?? []),
  ...validateSimpleRideSolidFootprints(plan),
  ...validateTrackPositionCollisions(plan.rides ?? []),
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

function validateTrackPositionCollisions(rides) {
  const issues = [];
  const seen = new Map();
  for (const ride of rides) {
    if (!Array.isArray(ride.track) || ride.track.length === 0) {
      continue;
    }
    let cursor = absoluteTrackStartCursor(ride);
    for (let index = 0; index < ride.track.length; index += 1) {
      const segment = ride.track[index];
      const key = trackPositionKey(cursor);
      const previous = seen.get(key);
      if (previous !== undefined) {
        issues.push(
          `${ride.id} track segment ${index} (${segment.type}) intersects ${previous.rideId} segment ${previous.index} (${previous.type}) at ${key}`
        );
      } else {
        seen.set(key, { rideId: ride.id, index, type: segment.type });
      }

      const meta = TRACK_META[segment.type];
      if (meta === undefined) {
        break;
      }
      cursor = advance(cursor, meta);
    }
  }
  return issues;
}

function validateSimpleRideSolidFootprints(plan) {
  const issues = [];
  const solidOwners = new Map();
  for (const ride of plan.rides ?? []) {
    if (!isSimpleSolidRide(ride)) {
      continue;
    }
    for (const tile of simpleSolidTileKeys(ride)) {
      const previous = solidOwners.get(tile);
      if (previous !== undefined && previous !== ride.id) {
        issues.push(`${ride.id} simple ride footprint overlaps ${previous} at ${tile}`);
      } else {
        solidOwners.set(tile, ride.id);
      }
    }
  }

  for (const pathEdge of plan.paths ?? []) {
    for (const coord of pathEdge.waypoints ?? []) {
      const tile = coordKey(coord);
      const owner = solidOwners.get(tile);
      if (owner !== undefined) {
        issues.push(`path ${pathEdge.from}->${pathEdge.to} crosses simple ride ${owner} at ${tile}`);
      }
    }
  }

  for (const ride of plan.rides ?? []) {
    if (!Array.isArray(ride.track) || ride.track.length === 0) {
      continue;
    }
    let cursor = absoluteTrackStartCursor(ride);
    for (let index = 0; index < ride.track.length; index += 1) {
      const segment = ride.track[index];
      const tile = coordKey(cursor);
      const owner = solidOwners.get(tile);
      if (owner !== undefined && owner !== ride.id) {
        issues.push(`${ride.id} track segment ${index} (${segment.type}) crosses simple ride ${owner} at ${tile}`);
      }

      const meta = TRACK_META[segment.type];
      if (meta === undefined) {
        break;
      }
      cursor = advance(cursor, meta);
    }
  }

  return issues;
}

function accessBuildingTileKeys(ride) {
  return unique([coordKey(entranceExitLocation(ride, false)), coordKey(entranceExitLocation(ride, true))]);
}

function simpleSolidTileKeys(ride) {
  return unique([...fallbackRideBodyTileKeys(ride), ...accessBuildingTileKeys(ride)]);
}

function fallbackRideBodyTileKeys(ride) {
  const bounds = fallbackRideBodyBounds(ride);
  const keys = [];
  for (let x = ride.position.x + bounds.x; x < ride.position.x + bounds.x + bounds.w; x += 1) {
    for (let y = ride.position.y + bounds.y; y < ride.position.y + bounds.y + bounds.h; y += 1) {
      keys.push(coordKey({ x, y }));
    }
  }
  return keys;
}

function isSimpleSolidRide(ride) {
  return SIMPLE_SOLID_RIDE_TYPES.has(ride.rideType);
}

function isShopFacilityRide(ride) {
  return SHOP_FACILITY_RIDE_TYPES.has(ride.rideType);
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

function unique(values) {
  return [...new Set(values)];
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
  if (isShopFacilityRide(ride)) {
    return shopFacilityAccessOffset(fallbackRideBodyBounds(ride), normalizeDirection(ride.rotation ?? 1), isExit);
  }
  return sideAccessOffset(fallbackRideBodyBounds(ride), normalizeDirection(ride.rotation ?? 1), isExit);
}

function fallbackRideBodyBounds(ride) {
  const first = ride.track?.[0] ?? {};
  const origin = { x: first.x ?? Math.floor(ride.footprint.w / 2), y: first.y ?? Math.floor(ride.footprint.h / 2) };
  const direction = normalizeDirection(first.direction ?? ride.rotation ?? 0);
  switch (first.type) {
    case 66:
    case 266:
      return { x: origin.x - 1, y: origin.y - 1, w: 3, h: 3 };
    case 258:
      return rotatedBoxBounds(origin, { w: 2, h: 2 }, direction);
    case 259:
      return rotatedBoxBounds(origin, { w: 4, h: 4 }, direction);
    case 257:
    case 265:
      return rotatedLineBounds(origin, 4, direction);
    case 261:
      return rotatedLineBounds(origin, 5, direction);
    case 262:
    case 264:
      return { x: origin.x, y: origin.y, w: 1, h: 1 };
    default:
      return { x: 0, y: 0, w: ride.footprint.w, h: ride.footprint.h };
  }
}

function rotatedBoxBounds(origin, size, direction) {
  if (direction === 0) {
    return { x: origin.x, y: origin.y, w: size.w, h: size.h };
  }
  if (direction === 1) {
    return { x: origin.x, y: origin.y - size.h + 1, w: size.h, h: size.w };
  }
  if (direction === 2) {
    return { x: origin.x - size.w + 1, y: origin.y - size.h + 1, w: size.w, h: size.h };
  }
  return { x: origin.x - size.w + 1, y: origin.y, w: size.h, h: size.w };
}

function rotatedLineBounds(origin, length, direction) {
  const before = Math.floor((length - 1) / 2);
  const after = length - before - 1;
  if (direction === 0) {
    return { x: origin.x - before, y: origin.y, w: length, h: 1 };
  }
  if (direction === 1) {
    return { x: origin.x, y: origin.y - before, w: 1, h: length };
  }
  if (direction === 2) {
    return { x: origin.x - after, y: origin.y, w: length, h: 1 };
  }
  return { x: origin.x, y: origin.y - after, w: 1, h: length };
}

function sideAccessOffset(bounds, side, isExit) {
  const horizontal = side === 1 || side === 3;
  const span = horizontal ? bounds.w : bounds.h;
  if (isExit && span <= 1) {
    return perpendicularExitAccessOffset(bounds, side);
  }
  const along = isExit ? Math.max(span - 1, 1) : 0;
  if (side === 0) {
    return { x: bounds.x - 1, y: bounds.y + along, direction: 2 };
  }
  if (side === 1) {
    return { x: bounds.x + along, y: bounds.y + bounds.h, direction: 3 };
  }
  if (side === 2) {
    return { x: bounds.x + bounds.w, y: bounds.y + along, direction: 0 };
  }
  return { x: bounds.x + along, y: bounds.y - 1, direction: 1 };
}

function shopFacilityAccessOffset(bounds, side, isExit) {
  return bodyEdgeAccessOffset(bounds, normalizeDirection(side + (isExit ? 1 : 0)));
}

function bodyEdgeAccessOffset(bounds, side) {
  if (side === 0) {
    return { x: bounds.x, y: bounds.y, direction: 2 };
  }
  if (side === 1) {
    return { x: bounds.x, y: bounds.y + bounds.h - 1, direction: 3 };
  }
  if (side === 2) {
    return { x: bounds.x + bounds.w - 1, y: bounds.y, direction: 0 };
  }
  return { x: bounds.x, y: bounds.y, direction: 1 };
}

function perpendicularExitAccessOffset(bounds, side) {
  if (side === 0) {
    return { x: bounds.x, y: bounds.y - 1, direction: 1 };
  }
  if (side === 1) {
    return { x: bounds.x + bounds.w, y: bounds.y + bounds.h - 1, direction: 0 };
  }
  if (side === 2) {
    return { x: bounds.x + bounds.w - 1, y: bounds.y - 1, direction: 1 };
  }
  return { x: bounds.x + bounds.w, y: bounds.y, direction: 0 };
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

function absoluteTrackStartCursor(ride) {
  const first = ride.track[0] ?? {};
  const position = ride.position ?? { x: 0, y: 0 };
  return {
    x: position.x + (first.x ?? 0),
    y: position.y + (first.y ?? 0),
    z: first.z ?? BASE_Z,
    direction: normalizeDirection(first.direction ?? ride.rotation ?? 0)
  };
}

function trackPositionKey(cursor) {
  return `${cursor.x},${cursor.y},${cursor.z}`;
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
