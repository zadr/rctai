#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const inputPath = process.argv[2] ?? "build/register-transcripts/register-transcripts.park-plan.tracked.json";
const outputPath = process.argv[3] ?? "build/register-transcripts/register-transcripts.openrct2-dynamic.park-plan.json";
const workModelPath = process.argv[4] ?? "build/register-transcripts/register-transcripts.work-model.json";

const BASE_Z = 176;
const PARK_WIDTH = 360;
const PARK_HEIGHT = 320;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const FLAT = 0;
const END_STATION = 1;
const BEGIN_STATION = 2;
const MIDDLE_STATION = 3;
const UP_25 = 4;
const DOWN_25 = 10;
const FLAT_TO_UP_25 = 6;
const UP_25_TO_FLAT = 9;
const FLAT_TO_DOWN_25 = 12;
const DOWN_25_TO_FLAT = 15;
const LEFT_TURN_5 = 16;
const RIGHT_TURN_5 = 17;
const BANKED_LEFT_TURN_5 = 22;
const BANKED_RIGHT_TURN_5 = 23;
const LEFT_TURN_3 = 42;
const RIGHT_TURN_3 = 43;
const LEFT_LOOP = 40;
const RIGHT_LOOP = 41;
const BRAKES = 99;
const BOOSTER = 100;
const BLOCK_BRAKES = 216;

const RIDE_OBJECT_OVERRIDES = {
  alpine_rc: "openrct2.ride.alpine_coaster",
  giga_rc: "rct2.ride.intst",
  hypercoaster: "rct2.ride.arrt2",
  looping_rc: "rct2.ride.scht1",
  mini_rc: "rct2.ride.jstar1",
  miniature_railway: "rct2.ride.nrl",
  multi_dimension_rc: "rct2.ride.arrx",
  reverser_rc: "rct2.ride.revcar",
  spiral_rc: "rct2.ride.spdrcr",
  suspended_monorail: "rct2.ride.smono",
  vertical_drop_rc: "rct2.ride.bmvd"
};

const GENTLE_FLAT_VISUALS = [
  { rideType: "merry_go_round", footprint: { w: 3, h: 3 }, trackType: 266 },
  { rideType: "dodgems", footprint: { w: 4, h: 4 }, trackType: 259 },
  { rideType: "twist", footprint: { w: 3, h: 3 }, trackType: 266 },
  { rideType: "ferris_wheel", footprint: { w: 4, h: 4 }, trackType: 265 },
  { rideType: "haunted_house", footprint: { w: 3, h: 3 }, trackType: 266 },
  { rideType: "spiral_slide", footprint: { w: 2, h: 2 }, trackType: 258 }
];

const THRILL_FLAT_VISUALS = [
  { rideType: "swinging_ship", footprint: { w: 5, h: 1 }, trackType: 261 },
  { rideType: "enterprise", footprint: { w: 4, h: 4 }, trackType: 259 },
  { rideType: "top_spin", footprint: { w: 3, h: 3 }, trackType: 266 },
  { rideType: "space_rings", footprint: { w: 3, h: 3 }, trackType: 266 },
  { rideType: "motion_simulator", footprint: { w: 2, h: 2 }, trackType: 258 },
  { rideType: "magic_carpet", footprint: { w: 4, h: 1 }, trackType: 257 }
];

const SHOP_VISUALS = [
  { rideType: "food_stall", footprint: { w: 1, h: 1 }, trackType: 262 },
  { rideType: "drink_stall", footprint: { w: 1, h: 1 }, trackType: 262 },
  { rideType: "toilets", footprint: { w: 1, h: 1 }, trackType: 262 },
  { rideType: "information_kiosk", footprint: { w: 1, h: 1 }, trackType: 264 }
];

const TRACK_META = {
  [FLAT]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [END_STATION]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [BEGIN_STATION]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [MIDDLE_STATION]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [UP_25]: { endX: 0, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  [DOWN_25]: { endX: 0, endY: 0, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 0 },
  [FLAT_TO_UP_25]: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  [UP_25_TO_FLAT]: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  [FLAT_TO_DOWN_25]: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  [DOWN_25_TO_FLAT]: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  [LEFT_TURN_5]: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  [RIGHT_TURN_5]: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  [BANKED_LEFT_TURN_5]: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  [BANKED_RIGHT_TURN_5]: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  [LEFT_TURN_3]: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  [RIGHT_TURN_3]: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  [LEFT_LOOP]: { endX: -64, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [RIGHT_LOOP]: { endX: -64, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [BRAKES]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [BOOSTER]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [BLOCK_BRAKES]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 }
};

const plan = readJson(path.resolve(repoRoot, inputPath));
const workModel = readOptionalJson(path.resolve(repoRoot, workModelPath));
const relationshipIndex = buildRelationshipIndex(workModel);
const rideRelations = resolveRideRelations(plan.rides, relationshipIndex);
const prepared = plan.rides.map((ride, index) => prepareRide(ride, index, rideRelations.get(ride.id) ?? fallbackRelation(ride, index)));
const placed = placeRides(prepared);

const output = {
  ...plan,
  park: {
    ...plan.park,
    name: `${plan.park?.name ?? "register transcripts"} dynamic OpenRCT2`,
    size: { width: PARK_WIDTH, height: PARK_HEIGHT },
    baseScenario: null,
    entrance: { x: Math.floor(PARK_WIDTH / 2), y: 4, direction: 2 }
  },
  rides: placed.map(stripLayoutHints),
  paths: buildRidePaths(placed),
  scenery: []
};

validateGeneratedPlan(output);

fs.mkdirSync(path.dirname(path.resolve(repoRoot, outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(repoRoot, outputPath), `${JSON.stringify(output, null, 2)}\n`);
console.log(`wrote ${outputPath}`);
console.log(`rides ${output.rides.length}, park ${PARK_WIDTH}x${PARK_HEIGHT}`);
console.log(`track pieces ${output.rides.reduce((sum, ride) => sum + (ride.track?.length ?? 0), 0)}`);
console.log(
  `paths ${output.paths.length}, path tiles ${output.paths.reduce((sum, pathEdge) => sum + (pathEdge.waypoints?.length ?? 0), 0)}, connected track circuits ${closedCircuitRideCount(output.rides)}`
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return readJson(filePath);
}

function prepareRide(ride, index, relation) {
  const axes = {
    size: clamp(Number(ride.axes?.size ?? 0.5)),
    adventure: clamp(Number(ride.axes?.adventure ?? 0.5)),
    risk: clamp(Number(ride.axes?.risk ?? 0.5))
  };

  if (isTowerRide(ride)) {
    return prepareTower(ride, axes, index, relation);
  }
  if (shouldRenderAsFlatRide(ride)) {
    return prepareFlatRide(ride, axes, index, relation);
  }
  return prepareDynamicTrackRide(ride, axes, index, relation);
}

function prepareTower(ride, axes, index, relation) {
  const height = 6 + Math.round(axes.size * 5 + axes.risk * 3);
  const track = [{ type: 66, x: 2, y: 2, z: BASE_Z, direction: index % 4 }];
  for (let step = 1; step < height; step += 1) {
    track.push({ type: 67 });
  }
  return {
    ...ride,
    footprint: { w: 7, h: 7 },
    rotation: index % 4,
    track,
    __layout: layoutHint(relation, { x: 3, y: 3 }, "tower")
  };
}

function prepareFlatRide(ride, axes, index, relation) {
  const palette = ride.archetype === "stall" ? SHOP_VISUALS : axes.risk >= 0.45 ? THRILL_FLAT_VISUALS : GENTLE_FLAT_VISUALS;
  const visual = palette[Math.abs(hash(`${ride.id}:${ride.name}`)) % palette.length];
  const rotation = index % 4;
  const footprint = { w: visual.footprint.w + 5, h: visual.footprint.h + 5 };
  return {
    ...ride,
    rideType: visual.rideType,
    footprint,
    rotation,
    track: [{ type: visual.trackType, x: 2, y: 2, z: BASE_Z, direction: rotation }],
    __layout: layoutHint(relation, { x: Math.floor(footprint.w / 2), y: Math.floor(footprint.h / 2) }, "flat")
  };
}

function prepareDynamicTrackRide(ride, axes, index, relation) {
  const seed = hash(`${ride.id}:${ride.name}:dynamic-track`);
  const clustered = relation.clusterSize > 1;
  const stationLength = Math.max(3, Math.min(6, Math.round(3 + axes.size * 3)));
  const sideA = stationLength + 6 + Math.round(axes.size * (clustered ? 6 : 10) + seeded(seed, 1) * 5);
  const sideB = 5 + Math.round(axes.adventure * (clustered ? 6 : 8) + seeded(seed, 2) * 5);
  const turnFamily = axes.risk > 0.48 ? "banked5" : seeded(seed, 3) > 0.35 ? "turn5" : "turn3";
  const turnClockwise = seeded(seed, 4) > 0.42;
  const turnType = turnTypeFor(turnFamily, turnClockwise);
  const rotation = normalizeDirection(relation.memberIndex + relation.clusterOrdinal + index);
  const visualRideType = visualRideTypeFor(ride, axes, relation);
  const allowLoop = canUseRenderedVerticalLoop(ride, visualRideType) && (clustered || (axes.adventure > 0.55 && axes.risk > 0.35));
  const hillHeight = Math.max(1, Math.min(3, Math.round(1 + axes.size * 2.5)));
  const variant = Math.abs(hash(`${relation.clusterKey}:${relation.memberIndex}:${ride.id}`)) % 5;

  const track = buildDynamicTrack({
    ride,
    axes,
    seed,
    sideA,
    sideB,
    stationLength,
    turnType,
    hillHeight,
    allowLoop,
    relation,
    variant
  });

  const shifted = shiftTrackStart(track, rotation);
  return {
    ...ride,
    rideType: visualRideType,
    rideObject: RIDE_OBJECT_OVERRIDES[visualRideType] ?? null,
    footprint: shifted.footprint,
    rotation,
    track: shifted.track,
    __layout: layoutHint(relation, shifted.anchor, allowLoop ? "portal" : "track")
  };
}

function buildDynamicTrack({ ride, axes, seed, sideA, sideB, stationLength, turnType, hillHeight, allowLoop, relation, variant }) {
  const station = buildStation(stationLength);
  const shortSide = Math.max(8, Math.round(sideB * 0.82));
  const frontSide = Math.max(10, sideA - stationLength + (variant % 3));
  const backSide = frontSide + stationLength;
  const sideSeed = seed + variant * 101;

  return [
    ...station,
    ...buildConnectedSide(frontSide, "front", { ride, axes, seed: sideSeed, hillHeight, allowLoop, relation }),
    { type: turnType },
    ...buildConnectedSide(shortSide, "side-a", { ride, axes, seed: sideSeed + 11, hillHeight, allowLoop, relation }),
    { type: turnType },
    ...buildConnectedSide(backSide, "back", { ride, axes, seed: sideSeed + 23, hillHeight, allowLoop, relation }),
    { type: turnType },
    ...buildConnectedSide(shortSide, "final", { ride, axes, seed: sideSeed + 37, hillHeight, allowLoop, relation }),
    { type: turnType }
  ];
}

function buildStation(length) {
  return [{ type: BEGIN_STATION }, ...repeat(MIDDLE_STATION, length - 2), { type: END_STATION }];
}

function buildLiftDrop(axes, hillHeight, budget) {
  if (budget < hillHeight * 2 + 5 || axes.size < 0.25) {
    return repeat(FLAT, Math.max(1, budget));
  }
  return [
    { type: FLAT_TO_UP_25, chainLift: true },
    ...repeat(UP_25, hillHeight).map((segment) => ({ ...segment, chainLift: true })),
    { type: UP_25_TO_FLAT, chainLift: true },
    ...repeat(FLAT, Math.max(1, Math.min(3, budget - hillHeight * 2 - 4))),
    { type: FLAT_TO_DOWN_25 },
    ...repeat(DOWN_25, hillHeight),
    { type: DOWN_25_TO_FLAT }
  ];
}

function buildConnectedSide(length, role, context) {
  const pieces = [];
  let remaining = length;
  const candidates = connectedSideCandidates(role, context);

  for (const candidate of candidates) {
    const advance = forwardAdvance(candidate);
    if (advance > 0 && advance <= remaining) {
      pieces.push(...candidate);
      remaining -= advance;
    }
  }

  pieces.push(...repeat(FLAT, remaining));
  return pieces;
}

function forwardAdvance(track) {
  const start = { x: 0, y: 0, z: BASE_Z, direction: 2 };
  const end = simulateTrack(track, start).cursor;
  if (end.y !== start.y || end.z !== start.z || end.direction !== start.direction) {
    return -1;
  }
  return end.x - start.x;
}

function isStraightPreserving(track) {
  return forwardAdvance(track) > 0;
}

function connectedSideCandidates(role, { ride, axes, seed, hillHeight, allowLoop, relation }) {
  const candidates = [];
  if (role === "front") {
    candidates.push(buildLiftDrop(axes, hillHeight, 10 + hillHeight * 2));
  }

  if (allowLoop && (role === "front" || role === "back" || relation.clusterSize > 2)) {
    candidates.push(buildLoopPortal(seed, axes, relation));
  }

  if (role !== "final" && relation.clusterSize > 1) {
    candidates.push(buildClusterPass(ride, 8, axes, seed + 9, relation));
  }

  if (role === "side-a" || role === "back") {
    candidates.push(buildWiggle(seeded(seed, 42) > 0.5, 1 + Math.floor(seeded(seed, 43) * 3)));
  }

  if (role === "final") {
    candidates.push(buildFinalSide(6, axes, seed + 37));
  }

  return candidates.filter((candidate) => isStraightPreserving(candidate));
}

function buildLoopPortal(seed, axes, relation) {
  const first = seeded(seed, 90) > 0.5 ? LEFT_LOOP : RIGHT_LOOP;
  const second = first === LEFT_LOOP ? RIGHT_LOOP : LEFT_LOOP;
  const pieces = [{ type: first }, { type: second }];
  if (relation.clusterSize > 2 || axes.risk > 0.55) {
    pieces.push(...repeat(FLAT, 1), { type: second }, { type: first });
  }
  return pieces;
}

function buildClusterPass(ride, length, axes, seed, relation) {
  const pieces = [];
  const isTransport = ride.family === "transport";
  if (!isTransport && relation.clusterSize > 1 && axes.risk > 0.35) {
    pieces.push({ type: BOOSTER, brakeSpeed: 0 });
  }
  pieces.push(...repeat(FLAT, Math.max(2, length)));
  if (relation.clusterSize > 1) {
    pieces.push(...buildWiggle(seeded(seed, 92) > 0.5, 1 + (relation.memberIndex % 3)));
  }
  return pieces;
}

function buildWiggle(clockwise, depth) {
  const first = clockwise ? RIGHT_TURN_3 : LEFT_TURN_3;
  const second = clockwise ? LEFT_TURN_3 : RIGHT_TURN_3;
  return [
    { type: first },
    ...repeat(FLAT, depth),
    { type: second },
    ...repeat(FLAT, 2),
    { type: second },
    ...repeat(FLAT, depth),
    { type: first }
  ];
}

function buildFinalSide(length, axes, seed) {
  const pieces = [];
  let remaining = Math.max(0, length);
  const brakeRun = Math.min(4, Math.max(2, Math.floor(remaining / 3)));
  pieces.push(...repeat(FLAT, Math.max(0, remaining - brakeRun)));
  remaining = brakeRun;
  if (remaining > 0 && axes.risk > 0.45) {
    pieces.push({ type: BLOCK_BRAKES, brakeSpeed: 12 });
    remaining -= 1;
  }
  if (remaining > 0) {
    pieces.push(...repeat(BRAKES, remaining).map((segment, index) => ({ ...segment, brakeSpeed: 12 + index * 2 + Math.round(seeded(seed, index) * 4) })));
  }
  return pieces;
}

function shiftTrackStart(track, rotation) {
  const trace = traceTrack(track, rotation);
  const bounds = trace.bounds;
  const margin = 7;
  const shiftX = -bounds.minX + margin;
  const shiftY = -bounds.minY + margin;
  const shifted = track.map((segment, index) =>
    index === 0
      ? {
          ...segment,
          x: shiftX,
          y: shiftY,
          z: BASE_Z,
          direction: rotation
        }
      : segment
  );
  const anchorPoint = chooseInteractionAnchor(track, trace.points);
  return {
    track: shifted,
    footprint: {
      w: bounds.maxX - bounds.minX + margin * 2 + 1,
      h: bounds.maxY - bounds.minY + margin * 2 + 1
    },
    anchor: {
      x: anchorPoint.x + shiftX,
      y: anchorPoint.y + shiftY
    }
  };
}

function traceTrack(track, rotation) {
  return simulateTrack(track, { x: 0, y: 0, z: BASE_Z, direction: rotation });
}

function simulateTrack(track, start) {
  let cursor = { ...start };
  const bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const points = [];
  for (const segment of track) {
    points.push(cursor);
    const meta = TRACK_META[segment.type];
    if (meta === undefined) {
      throw new Error(`unknown generated track element type ${segment.type}`);
    }
    const next = advance(cursor, meta);
    include(bounds, cursor);
    include(bounds, next);
    cursor = next;
  }
  return { bounds, points, cursor };
}

function chooseInteractionAnchor(track, points) {
  const loopIndex = track.findIndex((segment) => segment.type === LEFT_LOOP || segment.type === RIGHT_LOOP);
  if (loopIndex >= 0 && points[loopIndex] !== undefined) {
    return points[loopIndex];
  }

  const passIndex = track.findIndex((segment) => segment.type === BOOSTER || segment.type === BLOCK_BRAKES);
  if (passIndex >= 0 && points[passIndex] !== undefined) {
    return points[passIndex];
  }

  return points[Math.floor(points.length / 2)] ?? { x: 0, y: 0 };
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

function include(bounds, point) {
  bounds.minX = Math.min(bounds.minX, point.x);
  bounds.minY = Math.min(bounds.minY, point.y);
  bounds.maxX = Math.max(bounds.maxX, point.x);
  bounds.maxY = Math.max(bounds.maxY, point.y);
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

function turnTypeFor(family, clockwise) {
  if (family === "banked5") {
    return clockwise ? BANKED_RIGHT_TURN_5 : BANKED_LEFT_TURN_5;
  }
  if (family === "turn3") {
    return clockwise ? RIGHT_TURN_3 : LEFT_TURN_3;
  }
  return clockwise ? RIGHT_TURN_5 : LEFT_TURN_5;
}

function canUseVerticalLoop(ride) {
  return ride.buildOut?.trackGroups?.includes("verticalLoop") === true || ride.buildOut?.inversions?.includes("verticalLoop") === true;
}

function placeRides(rides) {
  const placed = [];
  const centerX = Math.floor(PARK_WIDTH / 2);
  const centerY = Math.floor(PARK_HEIGHT / 2) + 14;
  const clusters = clusterRides(rides);
  const centers = assignClusterCenters(clusters, centerX, centerY);

  for (const cluster of clusters) {
    const center = centers.get(cluster.key) ?? { x: centerX, y: centerY };
    for (const ride of cluster.rides) {
      const hint = ride.__layout ?? fallbackRelation(ride, 0);
      const offset = clusterMemberOffset(hint, ride);
      const anchor = hint.anchor ?? { x: Math.floor(ride.footprint.w / 2), y: Math.floor(ride.footprint.h / 2) };
      const position = clampPosition(
        {
          x: Math.round(center.x - anchor.x + offset.x),
          y: Math.round(center.y - anchor.y + offset.y)
        },
        ride.footprint
      );
      placed.push({ ...ride, position });
    }
  }

  return placed;
}

function clusterRides(rides) {
  const groups = new Map();
  for (const ride of rides) {
    const key = ride.__layout?.clusterKey ?? `fallback:${ride.family ?? "ride"}`;
    const group = groups.get(key) ?? { key, rides: [], seed: hash(key) };
    group.rides.push(ride);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => {
    if (right.rides.length !== left.rides.length) {
      return right.rides.length - left.rides.length;
    }
    return left.key.localeCompare(right.key);
  });
}

function assignClusterCenters(clusters, centerX, centerY) {
  const centers = new Map();
  for (let index = 0; index < clusters.length; index += 1) {
    const cluster = clusters[index];
    const seed = cluster.seed;
    const largest = index === 0;
    const angle = index * GOLDEN_ANGLE + seeded(seed, 500) * 0.9;
    const radius = largest ? 0 : 18 + Math.sqrt(index) * 22 + Math.min(18, cluster.rides.length * 1.2);
    const x = Math.round(centerX + Math.cos(angle) * radius);
    const y = Math.round(centerY + Math.sin(angle) * radius * 0.72);
    centers.set(cluster.key, {
      x: Math.max(28, Math.min(PARK_WIDTH - 28, x)),
      y: Math.max(36, Math.min(PARK_HEIGHT - 28, y))
    });
  }
  return centers;
}

function clusterMemberOffset(hint, ride) {
  if ((hint.clusterSize ?? 1) <= 1) {
    return { x: 0, y: 0 };
  }
  const seed = hash(`${hint.clusterKey}:${ride.id}:member-offset`);
  const angle = hint.memberIndex * GOLDEN_ANGLE + seeded(seed, 601) * 0.55;
  const ring = Math.floor(hint.memberIndex / 5);
  const roleScale = hint.role === "flat" || hint.role === "tower" ? 4 : 7;
  const radius = 2 + ring * roleScale + seeded(seed, 602) * 3;
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius * 0.82)
  };
}

function clampPosition(position, footprint) {
  return {
    x: Math.max(2, Math.min(PARK_WIDTH - footprint.w - 2, position.x)),
    y: Math.max(8, Math.min(PARK_HEIGHT - footprint.h - 2, position.y))
  };
}

function buildRidePaths(rides) {
  const paths = [];
  const clusters = clusterRides(rides).map((cluster) => ({
    ...cluster,
    rides: nearestRideOrder(cluster.rides, { x: Math.floor(PARK_WIDTH / 2), y: 4 })
  }));

  const remainingClusters = [...clusters];
  let previousHubId = "entrance";
  let previousPoint = { x: Math.floor(PARK_WIDTH / 2), y: 4 };

  while (remainingClusters.length > 0) {
    const nextIndex = nearestClusterIndex(remainingClusters, previousPoint);
    const [cluster] = remainingClusters.splice(nextIndex, 1);
    const hub = cluster?.rides[0];
    if (hub === undefined) {
      continue;
    }

    paths.push(pathEdge(previousHubId, hub.id, previousPoint, ridePathEndpoint(hub)));
    paths.push(...rideAccessEdges(hub));

    for (let index = 1; index < cluster.rides.length; index += 1) {
      const previousRide = cluster.rides[index - 1];
      const ride = cluster.rides[index];
      if (previousRide !== undefined && ride !== undefined) {
        paths.push(pathEdge(previousRide.id, ride.id, ridePathEndpoint(previousRide), ridePathEndpoint(ride)));
        paths.push(...rideAccessEdges(ride));
      }
    }

    const tail = cluster.rides[cluster.rides.length - 1] ?? hub;
    previousHubId = tail.id;
    previousPoint = ridePathEndpoint(tail);
  }

  return paths;
}

function nearestRideOrder(rides, startPoint) {
  const remaining = [...rides];
  const ordered = [];
  let current = startPoint;

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const ride = remaining[index];
      if (ride === undefined) {
        continue;
      }
      const distance = manhattan(current, ridePathEndpoint(ride));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    const [next] = remaining.splice(bestIndex, 1);
    if (next !== undefined) {
      ordered.push(next);
      current = ridePathEndpoint(next);
    }
  }

  return ordered;
}

function nearestClusterIndex(clusters, point) {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < clusters.length; index += 1) {
    const hub = clusters[index]?.rides[0];
    if (hub === undefined) {
      continue;
    }
    const distance = manhattan(point, ridePathEndpoint(hub));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function pathEdge(from, to, start, end) {
  return {
    from,
    to,
    waypoints: orthogonalWaypoints(start, end)
  };
}

function rideAccessEdges(ride) {
  const endpoint = ridePathEndpoint(ride);
  const entrance = entranceExitPathTile(ride, false);
  const exit = entranceExitPathTile(ride, true);
  const edges = [];

  edges.push({
    from: ride.id,
    to: ride.id,
    waypoints: orthogonalWaypoints(endpoint, entrance)
  });

  if (entrance.x !== exit.x || entrance.y !== exit.y) {
    edges.push({
      from: ride.id,
      to: ride.id,
      waypoints: orthogonalWaypoints(endpoint, exit)
    });
  }

  return edges;
}

function orthogonalWaypoints(start, end) {
  const coords = [];
  const stepX = start.x <= end.x ? 1 : -1;
  for (let x = start.x; x !== end.x; x += stepX) {
    coords.push({ x, y: start.y });
  }

  const stepY = start.y <= end.y ? 1 : -1;
  for (let y = start.y; y !== end.y; y += stepY) {
    coords.push({ x: end.x, y });
  }
  coords.push(end);
  return dedupeCoords(coords);
}

function ridePathEndpoint(ride) {
  return {
    x: ride.position.x + Math.floor(ride.footprint.w / 2),
    y: Math.min(PARK_HEIGHT - 2, ride.position.y + ride.footprint.h + 1)
  };
}

function entranceExitPathTile(ride, isExit) {
  const location = entranceExitLocation(ride, isExit);
  const delta = directionDelta(normalizeDirection(location.direction ?? ride.rotation ?? 0));
  return clampPoint({
    x: location.x - delta.x,
    y: location.y - delta.y
  });
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
  if (!isExit) {
    return { x: 0, y: ride.footprint.h, direction: normalizeDirection(ride.rotation ?? 0) };
  }
  if (ride.footprint.w <= 1) {
    return { x: 1, y: ride.footprint.h, direction: normalizeDirection(ride.rotation ?? 0) };
  }
  return { x: Math.max(ride.footprint.w - 1, 0), y: ride.footprint.h, direction: normalizeDirection(ride.rotation ?? 0) };
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

function clampPoint(point) {
  return {
    x: Math.max(0, Math.min(PARK_WIDTH - 1, point.x)),
    y: Math.max(0, Math.min(PARK_HEIGHT - 1, point.y))
  };
}

function dedupeCoords(coords) {
  const result = [];
  let previous = null;
  for (const coord of coords) {
    if (previous === null || previous.x !== coord.x || previous.y !== coord.y) {
      result.push(coord);
      previous = coord;
    }
  }
  return result;
}

function manhattan(left, right) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function validateGeneratedPlan(generated) {
  const issues = [
    ...validatePathGraph(generated),
    ...validatePhysicalPathNetwork(generated),
    ...validateClosedTrackCircuits(generated.rides)
  ];

  if (issues.length > 0) {
    throw new Error(`Generated register park failed connectivity validation:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
}

function validatePathGraph(generated) {
  const rideIds = new Set(generated.rides.map((ride) => ride.id));
  const graph = new Map([["entrance", new Set()]]);
  const issues = [];

  for (const id of rideIds) {
    graph.set(id, new Set());
  }

  for (const pathEdge of generated.paths ?? []) {
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

function validatePhysicalPathNetwork(generated) {
  const issues = [];
  const pathTiles = new Set();
  const entrance = { x: generated.park.entrance.x, y: generated.park.entrance.y };

  for (const pathEdge of generated.paths ?? []) {
    for (const coord of pathEdge.waypoints ?? []) {
      if (!isInsidePark(coord)) {
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
  for (const ride of generated.rides ?? []) {
    for (const isExit of [false, true]) {
      const tile = entranceExitPathTile(ride, isExit);
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

function isInsidePark(coord) {
  return coord.x >= 0 && coord.y >= 0 && coord.x < PARK_WIDTH && coord.y < PARK_HEIGHT;
}

function coordKey(coord) {
  return `${coord.x},${coord.y}`;
}

function validateClosedTrackCircuits(rides) {
  const issues = [];
  for (const ride of rides) {
    if (!requiresClosedTrackCircuit(ride)) {
      continue;
    }

    const start = trackStartCursor(ride);
    const simulation = simulateTrack(ride.track, start);
    const end = simulation.cursor;
    if (!sameCursor(start, end)) {
      issues.push(
        `${ride.id} track is not closed: start ${formatCursor(start)}, end ${formatCursor(end)}, pieces ${ride.track.length}`
      );
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

function trackStartCursor(ride) {
  const first = ride.track[0] ?? {};
  if (first.type !== BEGIN_STATION) {
    throw new Error(`${ride.id} generated circuit must start with begin station`);
  }
  return {
    x: first.x ?? 0,
    y: first.y ?? 0,
    z: first.z ?? BASE_Z,
    direction: normalizeDirection(first.direction ?? ride.rotation ?? 0)
  };
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

function shouldRenderAsFlatRide(ride) {
  if (ride.archetype === "stall" || ride.family === "stall") {
    return true;
  }
  if (ride.archetype === "gentle_micro" && !isTowerRide(ride)) {
    return true;
  }
  return ride.rideType === "mini_golf";
}

function isTowerRide(ride) {
  return ride.rideType === "observation_tower" || ride.rideType === "roto_drop" || ride.rideType === "launched_freefall";
}

function buildRelationshipIndex(workModel) {
  const works = Array.isArray(workModel?.prs) ? workModel.prs : [];
  const workById = new Map();
  const candidatesById = new Map();
  const candidateCounts = new Map();

  for (const work of works) {
    workById.set(work.id, work);
    const candidates = relationCandidates(work);
    candidatesById.set(work.id, candidates);
    for (const candidate of candidates) {
      candidateCounts.set(candidate, (candidateCounts.get(candidate) ?? 0) + 1);
    }
  }

  return { workById, candidatesById, candidateCounts };
}

function resolveRideRelations(rides, relationshipIndex) {
  const entries = rides.map((ride, index) => ({
    ride,
    index,
    key: chooseRelationKey(ride, relationshipIndex)
  }));
  const groups = new Map();
  for (const entry of entries) {
    const group = groups.get(entry.key) ?? [];
    group.push(entry);
    groups.set(entry.key, group);
  }

  const ordinals = new Map(
    [...groups.entries()]
      .sort((left, right) => {
        if (right[1].length !== left[1].length) {
          return right[1].length - left[1].length;
        }
        return left[0].localeCompare(right[0]);
      })
      .map(([key], index) => [key, index])
  );

  const relations = new Map();
  for (const [key, group] of groups.entries()) {
    for (let memberIndex = 0; memberIndex < group.length; memberIndex += 1) {
      const entry = group[memberIndex];
      relations.set(entry.ride.id, {
        clusterKey: key,
        clusterSize: group.length,
        memberIndex,
        clusterOrdinal: ordinals.get(key) ?? 0,
        originalIndex: entry.index
      });
    }
  }
  return relations;
}

function chooseRelationKey(ride, relationshipIndex) {
  const work = relationshipIndex.workById.get(ride.id);
  if (work === undefined) {
    return `family:${ride.family ?? ride.archetype ?? "ride"}`;
  }

  const candidates = relationshipIndex.candidatesById.get(ride.id) ?? [];
  const exact = candidates.find(
    (candidate) =>
      (candidate.startsWith("pr:") || candidate.startsWith("module:") || candidate.startsWith("topic:")) &&
      (relationshipIndex.candidateCounts.get(candidate) ?? 0) > 1
  );
  if (exact !== undefined) {
    return exact;
  }

  return `${themeKey(work)}:${ride.family ?? ride.archetype ?? "ride"}`;
}

function relationCandidates(work) {
  const candidates = [];
  if (work.number !== null && work.number !== undefined) {
    candidates.push(`pr:${work.number}`);
  }

  const modules = unique((work.signals?.hotFiles ?? []).map(moduleKeyFromPath).filter(Boolean));
  for (const module of modules.slice(0, 3)) {
    candidates.push(`module:${module}`);
  }

  const topic = topicKeyFromTitle(work.title ?? "");
  if (topic !== null) {
    candidates.push(`topic:${topic}`);
  }

  candidates.push(themeKey(work));
  return unique(candidates);
}

function moduleKeyFromPath(filePath) {
  const cleaned = String(filePath)
    .replace(/^\.worktrees\/[^/]+\//, "")
    .replace(/^register\//, "");
  const parts = cleaned.split("/").filter(Boolean);
  const frameworksIndex = parts.indexOf("Frameworks");
  if (frameworksIndex >= 0 && parts[frameworksIndex + 1] !== undefined) {
    return parts.slice(frameworksIndex, Math.min(parts.length, frameworksIndex + 3)).join("/");
  }
  if (parts[0]?.startsWith(".")) {
    return parts.slice(0, Math.min(parts.length, 2)).join("/");
  }
  return parts.slice(0, Math.min(parts.length, 2)).join("/");
}

function topicKeyFromTitle(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes("posprint")) {
    return "posprint";
  }
  if (normalized.includes("producer context") || normalized.includes("cleanup")) {
    return "cleanup";
  }
  if (normalized.includes("dependency context")) {
    return "dependency";
  }
  if (normalized.includes("local-command-caveat")) {
    return "local-command";
  }
  if (normalized.includes("worktree")) {
    return "worktree";
  }
  if (normalized.includes("ci") || normalized.includes("failing test")) {
    return "ci-tests";
  }
  if (normalized.includes("review")) {
    return "review";
  }
  return null;
}

function themeKey(work) {
  return `theme:${dominantKey(work.categories, "feature")}:${dominantKey(work.languages, "swift")}`;
}

function dominantKey(record, fallback) {
  const entries = Object.entries(record ?? {});
  if (entries.length === 0) {
    return fallback;
  }
  entries.sort((left, right) => Number(right[1]) - Number(left[1]) || left[0].localeCompare(right[0]));
  return entries[0]?.[0] ?? fallback;
}

function visualRideTypeFor(ride, axes, relation) {
  if (ride.rideType === "alpine_rc") {
    return relation.memberIndex % 2 === 0 ? "mini_rc" : "spiral_rc";
  }
  if (
    ride.family?.startsWith("coaster") === true &&
    relation.clusterSize > 1 &&
    !canUseVerticalLoop(ride) &&
    axes.adventure + axes.risk > 1.15 &&
    relation.memberIndex % 3 === 0
  ) {
    return "looping_rc";
  }
  return ride.rideType;
}

function canUseRenderedVerticalLoop(ride, visualRideType) {
  return (
    canUseVerticalLoop(ride) ||
    ["giga_rc", "looping_rc", "twister_rc", "corkscrew_rc", "stand_up_rc", "inverted_rc"].includes(visualRideType)
  );
}

function layoutHint(relation, anchor, role) {
  return {
    ...relation,
    anchor,
    role
  };
}

function fallbackRelation(ride, index) {
  return {
    clusterKey: `family:${ride.family ?? ride.archetype ?? "ride"}`,
    clusterSize: 1,
    memberIndex: 0,
    clusterOrdinal: index,
    originalIndex: index
  };
}

function stripLayoutHints(ride) {
  const clean = { ...ride };
  delete clean.__layout;
  if (Array.isArray(clean.track)) {
    clean.track = clean.track.map((segment) => {
      const rest = { ...segment };
      delete rest.z;
      delete rest.clearanceZ;
      return rest;
    });
  }
  return clean;
}

function unique(values) {
  return [...new Set(values)];
}

function repeat(type, count) {
  return Array.from({ length: Math.max(0, count) }, () => ({ type }));
}

function seeded(seed, salt) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function clamp(value) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.5));
}

function normalizeDirection(direction) {
  return ((direction % 4) + 4) % 4;
}
