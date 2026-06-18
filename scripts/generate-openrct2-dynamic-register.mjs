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
const MAX_CONNECTED_ROUTE_SOURCES = 24;
const MAX_RIDE_PATH_HUB_CANDIDATES = 12;
const MIN_REUSED_PATH_ROUTE_TILES = 12;
const MIN_ACCESS_PATH_TILES = 8;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const FLAT = 0;
const END_STATION = 1;
const BEGIN_STATION = 2;
const MIDDLE_STATION = 3;
const UP_25 = 4;
const UP_60 = 5;
const DOWN_25 = 10;
const DOWN_60 = 11;
const FLAT_TO_UP_25 = 6;
const UP_25_TO_UP_60 = 7;
const UP_60_TO_UP_25 = 8;
const UP_25_TO_FLAT = 9;
const FLAT_TO_DOWN_25 = 12;
const DOWN_25_TO_DOWN_60 = 13;
const DOWN_60_TO_DOWN_25 = 14;
const DOWN_25_TO_FLAT = 15;
const LEFT_TURN_5 = 16;
const RIGHT_TURN_5 = 17;
const BANKED_LEFT_TURN_5 = 22;
const BANKED_RIGHT_TURN_5 = 23;
const S_BEND_LEFT = 38;
const S_BEND_RIGHT = 39;
const LEFT_TURN_3 = 42;
const RIGHT_TURN_3 = 43;
const LEFT_LOOP = 40;
const RIGHT_LOOP = 41;
const LEFT_TWIST_DOWN_TO_UP = 52;
const RIGHT_TWIST_DOWN_TO_UP = 53;
const LEFT_TWIST_UP_TO_DOWN = 54;
const RIGHT_TWIST_UP_TO_DOWN = 55;
const LEFT_CORKSCREW_UP = 58;
const RIGHT_CORKSCREW_UP = 59;
const LEFT_CORKSCREW_DOWN = 60;
const RIGHT_CORKSCREW_DOWN = 61;
const LEFT_QUARTER_BANKED_HELIX_UP = 102;
const RIGHT_QUARTER_BANKED_HELIX_UP = 103;
const LEFT_QUARTER_BANKED_HELIX_DOWN = 104;
const RIGHT_QUARTER_BANKED_HELIX_DOWN = 105;
const LEFT_QUARTER_HELIX_UP = 106;
const RIGHT_QUARTER_HELIX_UP = 107;
const LEFT_QUARTER_HELIX_DOWN = 108;
const RIGHT_QUARTER_HELIX_DOWN = 109;
const BRAKES = 99;
const BOOSTER = 100;
const LEFT_BARREL_ROLL_UP_TO_DOWN = 174;
const RIGHT_BARREL_ROLL_UP_TO_DOWN = 175;
const LEFT_BARREL_ROLL_DOWN_TO_UP = 176;
const RIGHT_BARREL_ROLL_DOWN_TO_UP = 177;
const BLOCK_BRAKES = 216;
const LEFT_LARGE_CORKSCREW_UP = 267;
const RIGHT_LARGE_CORKSCREW_UP = 268;
const LEFT_LARGE_CORKSCREW_DOWN = 269;
const RIGHT_LARGE_CORKSCREW_DOWN = 270;
const LEFT_ZERO_G_ROLL_UP = 275;
const RIGHT_ZERO_G_ROLL_UP = 276;
const LEFT_ZERO_G_ROLL_DOWN = 277;
const RIGHT_ZERO_G_ROLL_DOWN = 278;
const LEFT_LARGE_ZERO_G_ROLL_UP = 279;
const RIGHT_LARGE_ZERO_G_ROLL_UP = 280;
const LEFT_LARGE_ZERO_G_ROLL_DOWN = 281;
const RIGHT_LARGE_ZERO_G_ROLL_DOWN = 282;
const BRAKE_TRACK_TYPES = new Set([BRAKES, BLOCK_BRAKES]);
const RIDE_TYPES_WITHOUT_PAINTED_BRAKES = new Set(["miniature_railway", "suspended_monorail"]);

const RIDE_OBJECT_OVERRIDES = {
  alpine_rc: "openrct2.ride.alpine_coaster",
  dodgems: "rct2.ride.dodg1",
  drink_stall: "rct2.ride.drnks",
  enterprise: "rct2.ride.enterp",
  ferris_wheel: "rct2.ride.fwh1",
  food_stall: "rct2.ride.burgb",
  giga_rc: "rct2.ride.intst",
  haunted_house: "rct2.ride.hhbuild",
  hyper_twister: "rct2.ride.goltr",
  hypercoaster: "rct2.ride.arrt2",
  information_kiosk: "rct2.ride.infok",
  inverted_rc: "rct2.ride.nemt",
  launched_freefall: "rct2.ride.ssc1",
  looping_rc: "rct2.ride.scht1",
  magic_carpet: "rct2.ride.mcarpet1",
  merry_go_round: "rct2.ride.mgr1",
  mini_rc: "rct2.ride.jstar1",
  miniature_railway: "rct2.ride.nrl",
  motion_simulator: "rct2.ride.simpod",
  multi_dimension_rc: "rct2.ride.arrx",
  observation_tower: "rct2.ride.obs1",
  reverser_rc: "rct2.ride.revcar",
  roto_drop: "rct2.ride.gdrop1",
  space_rings: "rct2.ride.srings",
  spiral_rc: "rct2.ride.spdrcr",
  spiral_slide: "rct2.ride.hskelt",
  suspended_monorail: "rct2.ride.smono",
  swinging_ship: "rct2.ride.swsh1",
  toilets: "rct2.ride.tlt1",
  top_spin: "rct2.ride.topsp1",
  twist: "rct2.ride.twist1",
  twister_rc: "rct2.ride.bmsd",
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
const SHOP_FACILITY_RIDE_TYPES = new Set(SHOP_VISUALS.map((visual) => visual.rideType));

const SIMPLE_SOLID_RIDE_TYPES = new Set([
  ...GENTLE_FLAT_VISUALS.map((visual) => visual.rideType),
  ...THRILL_FLAT_VISUALS.map((visual) => visual.rideType),
  ...SHOP_VISUALS.map((visual) => visual.rideType),
  "launched_freefall",
  "observation_tower",
  "roto_drop"
]);

const TRACK_META = {
  [FLAT]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [END_STATION]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [BEGIN_STATION]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [MIDDLE_STATION]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [UP_25]: { endX: 0, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  [UP_60]: { endX: 0, endY: 0, beginZ: 0, endZ: 64, beginDirection: 0, endDirection: 0 },
  [DOWN_25]: { endX: 0, endY: 0, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 0 },
  [DOWN_60]: { endX: 0, endY: 0, beginZ: 64, endZ: 0, beginDirection: 0, endDirection: 0 },
  [FLAT_TO_UP_25]: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  [UP_25_TO_UP_60]: { endX: 0, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  [UP_60_TO_UP_25]: { endX: 0, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  [UP_25_TO_FLAT]: { endX: 0, endY: 0, beginZ: 0, endZ: 8, beginDirection: 0, endDirection: 0 },
  [FLAT_TO_DOWN_25]: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  [DOWN_25_TO_DOWN_60]: { endX: 0, endY: 0, beginZ: 32, endZ: 0, beginDirection: 0, endDirection: 0 },
  [DOWN_60_TO_DOWN_25]: { endX: 0, endY: 0, beginZ: 32, endZ: 0, beginDirection: 0, endDirection: 0 },
  [DOWN_25_TO_FLAT]: { endX: 0, endY: 0, beginZ: 8, endZ: 0, beginDirection: 0, endDirection: 0 },
  [LEFT_TURN_5]: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  [RIGHT_TURN_5]: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  [BANKED_LEFT_TURN_5]: { endX: -64, endY: -64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  [BANKED_RIGHT_TURN_5]: { endX: -64, endY: 64, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  [S_BEND_LEFT]: { endX: -64, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [S_BEND_RIGHT]: { endX: -64, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [LEFT_TURN_3]: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 3 },
  [RIGHT_TURN_3]: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 1 },
  [LEFT_LOOP]: { endX: -32, endY: -32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [RIGHT_LOOP]: { endX: -32, endY: 32, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [LEFT_TWIST_DOWN_TO_UP]: { endX: -64, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  [RIGHT_TWIST_DOWN_TO_UP]: { endX: -64, endY: 0, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 0 },
  [LEFT_TWIST_UP_TO_DOWN]: { endX: -64, endY: 0, beginZ: 0, endZ: -16, beginDirection: 0, endDirection: 0 },
  [RIGHT_TWIST_UP_TO_DOWN]: { endX: -64, endY: 0, beginZ: 0, endZ: -16, beginDirection: 0, endDirection: 0 },
  [LEFT_CORKSCREW_UP]: { endX: -32, endY: -32, beginZ: 0, endZ: 80, beginDirection: 0, endDirection: 3 },
  [RIGHT_CORKSCREW_UP]: { endX: -32, endY: 32, beginZ: 0, endZ: 80, beginDirection: 0, endDirection: 1 },
  [LEFT_CORKSCREW_DOWN]: { endX: -32, endY: -32, beginZ: 0, endZ: -80, beginDirection: 0, endDirection: 3 },
  [RIGHT_CORKSCREW_DOWN]: { endX: -32, endY: 32, beginZ: 0, endZ: -80, beginDirection: 0, endDirection: 1 },
  [BRAKES]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [BOOSTER]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [LEFT_QUARTER_BANKED_HELIX_UP]: { endX: -64, endY: -64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 3 },
  [RIGHT_QUARTER_BANKED_HELIX_UP]: { endX: -64, endY: 64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 1 },
  [LEFT_QUARTER_BANKED_HELIX_DOWN]: { endX: -64, endY: -64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 3 },
  [RIGHT_QUARTER_BANKED_HELIX_DOWN]: { endX: -64, endY: 64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 1 },
  [LEFT_QUARTER_HELIX_UP]: { endX: -64, endY: -64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 3 },
  [RIGHT_QUARTER_HELIX_UP]: { endX: -64, endY: 64, beginZ: 0, endZ: 16, beginDirection: 0, endDirection: 1 },
  [LEFT_QUARTER_HELIX_DOWN]: { endX: -64, endY: -64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 3 },
  [RIGHT_QUARTER_HELIX_DOWN]: { endX: -64, endY: 64, beginZ: 16, endZ: 0, beginDirection: 0, endDirection: 1 },
  [LEFT_BARREL_ROLL_UP_TO_DOWN]: { endX: -64, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  [RIGHT_BARREL_ROLL_UP_TO_DOWN]: { endX: -64, endY: 0, beginZ: 0, endZ: 32, beginDirection: 0, endDirection: 0 },
  [LEFT_BARREL_ROLL_DOWN_TO_UP]: { endX: -64, endY: 0, beginZ: 0, endZ: -32, beginDirection: 0, endDirection: 0 },
  [RIGHT_BARREL_ROLL_DOWN_TO_UP]: { endX: -64, endY: 0, beginZ: 0, endZ: -32, beginDirection: 0, endDirection: 0 },
  [BLOCK_BRAKES]: { endX: 0, endY: 0, beginZ: 0, endZ: 0, beginDirection: 0, endDirection: 0 },
  [LEFT_LARGE_CORKSCREW_UP]: { endX: -64, endY: -64, beginZ: 0, endZ: 112, beginDirection: 0, endDirection: 3 },
  [RIGHT_LARGE_CORKSCREW_UP]: { endX: -64, endY: 64, beginZ: 0, endZ: 112, beginDirection: 0, endDirection: 1 },
  [LEFT_LARGE_CORKSCREW_DOWN]: { endX: -64, endY: -64, beginZ: 0, endZ: -112, beginDirection: 0, endDirection: 3 },
  [RIGHT_LARGE_CORKSCREW_DOWN]: { endX: -64, endY: 64, beginZ: 0, endZ: -112, beginDirection: 0, endDirection: 1 },
  [LEFT_ZERO_G_ROLL_UP]: { endX: -64, endY: 0, beginZ: 0, endZ: 56, beginDirection: 0, endDirection: 0 },
  [RIGHT_ZERO_G_ROLL_UP]: { endX: -64, endY: 0, beginZ: 0, endZ: 56, beginDirection: 0, endDirection: 0 },
  [LEFT_ZERO_G_ROLL_DOWN]: { endX: -64, endY: 0, beginZ: 0, endZ: -56, beginDirection: 0, endDirection: 0 },
  [RIGHT_ZERO_G_ROLL_DOWN]: { endX: -64, endY: 0, beginZ: 0, endZ: -56, beginDirection: 0, endDirection: 0 },
  [LEFT_LARGE_ZERO_G_ROLL_UP]: { endX: -96, endY: 0, beginZ: 0, endZ: 152, beginDirection: 0, endDirection: 0 },
  [RIGHT_LARGE_ZERO_G_ROLL_UP]: { endX: -96, endY: 0, beginZ: 0, endZ: 152, beginDirection: 0, endDirection: 0 },
  [LEFT_LARGE_ZERO_G_ROLL_DOWN]: { endX: -96, endY: 0, beginZ: 0, endZ: -152, beginDirection: 0, endDirection: 0 },
  [RIGHT_LARGE_ZERO_G_ROLL_DOWN]: { endX: -96, endY: 0, beginZ: 0, endZ: -152, beginDirection: 0, endDirection: 0 }
};

const plan = readJson(path.resolve(repoRoot, inputPath));
const workModel = readOptionalJson(path.resolve(repoRoot, workModelPath));
const coalescedRides = coalesceRepeatedPrRides(plan.rides, workModel);
const relationshipIndex = buildRelationshipIndex(workModel);
const rideRelations = resolveRideRelations(coalescedRides, relationshipIndex);
const prepared = coalescedRides.map((ride, index) => prepareRide(ride, index, rideRelations.get(ride.id) ?? fallbackRelation(ride, index)));
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
console.log(`coalesced repeated PR transcript rides ${plan.rides.length} -> ${coalescedRides.length}`);
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

function coalesceRepeatedPrRides(rides, workModel) {
  const workById = new Map((workModel?.prs ?? []).map((work) => [work.id, work]));
  const groups = new Map();

  rides.forEach((ride, index) => {
    const work = workById.get(ride.id) ?? null;
    const key = work?.number === null || work?.number === undefined ? `ride:${ride.id}` : `pr:${work.number}`;
    const group = groups.get(key) ?? { key, entries: [], firstIndex: index };
    group.entries.push({ ride, work, index });
    group.firstIndex = Math.min(group.firstIndex, index);
    groups.set(key, group);
  });

  return [...groups.values()]
    .sort((left, right) => left.firstIndex - right.firstIndex)
    .map((group) => {
      if (group.entries.length === 1) {
        const entry = group.entries[0];
        return { ...entry.ride, __work: entry.work };
      }
      return coalesceRideGroup(group);
    });
}

function coalesceRideGroup(group) {
  const primary = choosePrimaryRideEntry(group.entries);
  const work = mergeWorks(group.entries);
  const axes = evolvedAxes(group.entries, work);
  const count = group.entries.length;
  const ride = primary.ride;

  return {
    ...ride,
    id: work.id,
    name: evolvedName(ride.name, work, count),
    axes,
    sign: evolvedSign(ride.sign, work, count),
    __work: work,
    __evolution: {
      count,
      sourceRideIds: group.entries.map((entry) => entry.ride.id).sort(),
      sessionIds: group.entries
        .map((entry) => entry.work?.session?.sessionId)
        .filter((sessionId) => typeof sessionId === "string")
        .sort()
    }
  };
}

function choosePrimaryRideEntry(entries) {
  return [...entries].sort((left, right) => {
    const scoreDelta = rideComplexityScore(right.ride, right.work) - rideComplexityScore(left.ride, left.work);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return left.index - right.index;
  })[0];
}

function rideComplexityScore(ride, work) {
  const axes = ride.axes ?? {};
  return (
    Number(axes.size ?? 0) * 4 +
    Number(axes.adventure ?? 0) * 2 +
    Number(axes.risk ?? 0) * 2 +
    Math.log2(1 + Number(work?.additions ?? 0) + Number(work?.deletions ?? 0))
  );
}

function mergeWorks(entries) {
  const works = entries.map((entry) => entry.work).filter(Boolean);
  const primary = entries[0]?.work ?? works[0] ?? {};
  const number = primary.number ?? null;
  const sessionIds = works
    .map((work) => work.session?.sessionId)
    .filter((sessionId) => typeof sessionId === "string")
    .sort();
  const session = mergeSessions(works, sessionIds);

  return {
    ...primary,
    id: number === null || number === undefined ? primary.id ?? entries[0]?.ride.id : `PR-${number}`,
    number,
    title: titleForMergedWork(works, primary),
    author: dominantString(works.map((work) => work.author)) ?? primary.author ?? "claude",
    state: dominantString(works.map((work) => work.state)) ?? primary.state ?? "open",
    createdAt: minIso(works.map((work) => work.createdAt)) ?? primary.createdAt ?? null,
    mergedAt: maxIso(works.map((work) => work.mergedAt)) ?? primary.mergedAt ?? null,
    durationHours: sumNumbers(works.map((work) => work.durationHours)),
    commits: sumNumbers(works.map((work) => work.commits)),
    filesChanged: sumNumbers(works.map((work) => work.filesChanged)),
    newFiles: sumNumbers(works.map((work) => work.newFiles)),
    additions: sumNumbers(works.map((work) => work.additions)),
    deletions: sumNumbers(works.map((work) => work.deletions)),
    languages: sumRecords(works.map((work) => work.languages)),
    categories: averageRecords(works.map((work) => work.categories)),
    signals: mergeSignals(works.map((work) => work.signals)),
    session
  };
}

function mergeSessions(works, sessionIds) {
  const sessions = works.map((work) => work.session).filter(Boolean);
  if (sessions.length === 0) {
    return null;
  }

  return {
    sessionId: sessionIds.length === 0 ? `${sessions.length} sessions` : sessionIds.join("+"),
    durationMinutes: sumNumbers(sessions.map((session) => session.durationMinutes)),
    userTurns: sumNumbers(sessions.map((session) => session.userTurns)),
    toolCalls: sumNumbers(sessions.map((session) => session.toolCalls)),
    edits: sumNumbers(sessions.map((session) => session.edits)),
    bashCalls: sumNumbers(sessions.map((session) => session.bashCalls)),
    errors: sumNumbers(sessions.map((session) => session.errors)),
    retries: sumNumbers(sessions.map((session) => session.retries))
  };
}

function mergeSignals(signals) {
  const records = signals.filter(Boolean);
  return {
    touchesTests: records.some((signal) => signal.touchesTests === true),
    touchesConfig: records.some((signal) => signal.touchesConfig === true),
    touchesDocs: records.some((signal) => signal.touchesDocs === true),
    codeTouchedNoTests: records.some((signal) => signal.codeTouchedNoTests === true),
    hasRevert: records.some((signal) => signal.hasRevert === true),
    forcePush: records.some((signal) => signal.forcePush === true),
    netDeletion: records.length > 0 && records.every((signal) => signal.netDeletion === true),
    hotFiles: unique(records.flatMap((signal) => signal.hotFiles ?? [])).sort(),
    reviewCount: sumNumbers(records.map((signal) => signal.reviewCount)),
    approvals: sumNumbers(records.map((signal) => signal.approvals))
  };
}

function evolvedAxes(entries, work) {
  const axesList = entries.map((entry) => entry.ride.axes ?? {});
  const countBoost = Math.log2(entries.length) / 8;
  const churnBoost = Math.min(0.1, Math.log2(1 + work.additions + work.deletions) / 220);
  const session = work.session;
  const errorPressure =
    session === null || session === undefined ? 0 : (session.errors + session.retries) / Math.max(session.userTurns, 1);

  return {
    size: roundAxis(Math.max(...axesList.map((axes) => Number(axes.size ?? 0.5))) + countBoost + churnBoost),
    adventure: roundAxis(Math.max(...axesList.map((axes) => Number(axes.adventure ?? 0.5))) + countBoost * 0.65),
    risk: roundAxis(Math.max(...axesList.map((axes) => Number(axes.risk ?? 0.5))) + countBoost * 0.5 + errorPressure * 0.08)
  };
}

function evolvedName(name, work, count) {
  const prefix = work.number === null || work.number === undefined ? name : `PR #${work.number}`;
  return `${prefix} x${count}`.slice(0, 31);
}

function evolvedSign(sign, work, count) {
  const sessionText = count === 1 ? "1 transcript" : `${count} transcripts`;
  const base = cleanDuplicatePrLabel(sign ?? `${work.id} - ${work.title}`);
  return `${base} EVOLVED ${sessionText}`;
}

function titleForMergedWork(works, primary) {
  const titled = works
    .map((work) => work.title)
    .filter((title) => typeof title === "string" && title.trim().length > 0)
    .sort((left, right) => cleanedTitleScore(right) - cleanedTitleScore(left) || left.length - right.length);
  return titled[0] ?? primary.title ?? "Transcript work";
}

function cleanedTitleScore(title) {
  const normalized = title.toLowerCase();
  let score = 0;
  if (!normalized.includes("you're picking up")) {
    score += 2;
  }
  if (normalized.includes("posprint")) {
    score += 3;
  }
  if (normalized.includes("rebase")) {
    score -= 2;
  }
  return score;
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
    rideObject: RIDE_OBJECT_OVERRIDES[ride.rideType] ?? ride.rideObject ?? null,
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
    rideObject: RIDE_OBJECT_OVERRIDES[visual.rideType] ?? null,
    footprint,
    rotation,
    track: [{ type: visual.trackType, x: 2, y: 2, z: BASE_Z, direction: rotation }],
    __layout: layoutHint(relation, { x: Math.floor(footprint.w / 2), y: Math.floor(footprint.h / 2) }, "flat")
  };
}

function prepareDynamicTrackRide(ride, axes, index, relation) {
  const seed = hash(`${ride.id}:${ride.name}:dynamic-track`);
  const clustered = relation.clusterSize > 1;
  const evolutionCount = Math.max(1, relation.evolutionCount ?? 1);
  const evolutionBoost = Math.min(1, Math.log2(evolutionCount) / 3);
  const stationLength = Math.max(3, Math.min(6, Math.round(3 + axes.size * 3)));
  const sideA =
    stationLength + 6 + Math.round(axes.size * (clustered ? 6 : 10) + seeded(seed, 1) * 5 + evolutionBoost * 10);
  const sideB = 5 + Math.round(axes.adventure * (clustered ? 6 : 8) + seeded(seed, 2) * 5 + evolutionBoost * 6);
  const turnFamily = axes.risk > 0.48 || seeded(seed, 3) > 0.35 ? "turn5" : "turn3";
  const turnClockwise = seeded(seed, 4) > 0.42;
  const turnType = turnTypeFor(turnFamily, turnClockwise);
  const rotation = normalizeDirection(relation.memberIndex + relation.clusterOrdinal + index);
  const visualRideType = visualRideTypeFor(ride, axes, relation);
  const allowLoop =
    canUseRenderedVerticalLoop(ride, visualRideType) &&
    (clustered || evolutionCount > 1 || (axes.adventure > 0.55 && axes.risk > 0.35));
  const hillHeight = Math.max(1, Math.min(4, Math.round(1 + axes.size * 2.5 + evolutionBoost)));
  const variant = Math.abs(hash(`${relation.clusterKey}:${relation.memberIndex}:${ride.id}:${evolutionCount}`)) % 5;

  const track = buildDynamicTrack({
    ride,
    visualRideType,
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

function buildDynamicTrack({ ride, visualRideType, axes, seed, sideA, sideB, stationLength, turnType, hillHeight, allowLoop, relation, variant }) {
  const station = buildStation(stationLength);
  const shortSide = Math.max(8, Math.round(sideB * 0.82));
  const frontSide = Math.max(10, sideA - stationLength + (variant % 3));
  const backSide = frontSide + stationLength;
  const sideSeed = seed + variant * 101;

  return [
    ...station,
    ...buildConnectedSide(frontSide, "front", {
      ride,
      visualRideType,
      axes,
      seed: sideSeed,
      loopSeed: sideSeed,
      hillHeight,
      allowLoop,
      relation,
      previousTurnType: null,
      nextTurnType: turnType
    }),
    { type: turnType },
    ...buildConnectedSide(shortSide, "side-a", {
      ride,
      visualRideType,
      axes,
      seed: sideSeed + 11,
      loopSeed: sideSeed,
      hillHeight,
      allowLoop,
      relation,
      previousTurnType: turnType,
      nextTurnType: turnType
    }),
    { type: turnType },
    ...buildConnectedSide(backSide, "back", {
      ride,
      visualRideType,
      axes,
      seed: sideSeed + 23,
      loopSeed: sideSeed,
      hillHeight,
      allowLoop,
      relation,
      previousTurnType: turnType,
      nextTurnType: turnType
    }),
    { type: turnType },
    ...buildConnectedSide(shortSide, "final", {
      ride,
      visualRideType,
      axes,
      seed: sideSeed + 37,
      loopSeed: sideSeed,
      hillHeight,
      allowLoop,
      relation,
      previousTurnType: turnType,
      nextTurnType: turnType
    }),
    { type: turnType }
  ];
}

function buildStation(length) {
  return [{ type: BEGIN_STATION }, ...repeat(MIDDLE_STATION, length - 2), { type: END_STATION }];
}

function buildLiftDrop(ride, axes, hillHeight, budget, seed) {
  if (budget < hillHeight * 2 + 5 || axes.size < 0.25) {
    return repeat(FLAT, Math.max(1, budget));
  }
  if (canUseSteepDrop(ride) && axes.risk + axes.adventure * 0.55 + seeded(seed, 61) * 0.4 > 0.86) {
    const steepDrop = buildSteepLiftDrop(hillHeight, budget);
    if (steepDrop.length > 0) {
      return steepDrop;
    }
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

function buildSteepLiftDrop(hillHeight, budget) {
  const steepSegments = budget >= 22 && hillHeight >= 4 ? 2 : 1;
  const climbSegments = 4 + steepSegments * 4;
  const required = climbSegments + steepSegments + 8;
  if (budget < required) {
    return [];
  }
  return [
    { type: FLAT_TO_UP_25, chainLift: true },
    ...repeat(UP_25, climbSegments).map((segment) => ({ ...segment, chainLift: true })),
    { type: UP_25_TO_FLAT, chainLift: true },
    ...repeat(FLAT, Math.max(1, Math.min(3, budget - required))),
    { type: FLAT_TO_DOWN_25 },
    { type: DOWN_25_TO_DOWN_60 },
    ...repeat(DOWN_60, steepSegments),
    { type: DOWN_60_TO_DOWN_25 },
    { type: DOWN_25_TO_FLAT }
  ];
}

function buildConnectedSide(length, role, context) {
  const pieces = [];
  let remaining = length;
  const candidates = connectedSideCandidates(length, role, context);

  for (const candidate of candidates) {
    const advance = forwardAdvance(candidate);
    const previousType = lastTrackType(pieces) ?? context.previousTurnType;
    const nextType = context.nextTurnType;
    const reservedBefore =
      previousType !== null && trackStartsWithSameTurnDirection(candidate, previousType) ? 1 : 0;
    const reservedAfter =
      nextType !== null && trackEndsWithSameTurnDirection(candidate, nextType) ? 1 : 0;
    if (advance > 0 && advance + reservedBefore + reservedAfter <= remaining) {
      if (reservedBefore > 0) {
        pieces.push({ type: FLAT });
        remaining -= 1;
      }
      pieces.push(...candidate);
      remaining -= advance;
    }
  }

  pieces.push(...repeat(FLAT, remaining));
  return pieces;
}

function lastTrackType(track) {
  return track[track.length - 1]?.type ?? null;
}

function trackStartsWithSameTurnDirection(track, type) {
  const first = track[0];
  return first !== undefined && sameTurnDirection(first.type, type);
}

function trackEndsWithSameTurnDirection(track, type) {
  const last = track[track.length - 1];
  return last !== undefined && sameTurnDirection(last.type, type);
}

function sameTurnDirection(left, right) {
  const leftDirection = turnDirection(left);
  const rightDirection = turnDirection(right);
  return leftDirection !== null && leftDirection === rightDirection;
}

function turnDirection(type) {
  if ([LEFT_TURN_5, BANKED_LEFT_TURN_5, LEFT_TURN_3].includes(type)) {
    return "left";
  }
  if ([RIGHT_TURN_5, BANKED_RIGHT_TURN_5, RIGHT_TURN_3].includes(type)) {
    return "right";
  }
  return null;
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

function connectedSideCandidates(length, role, { ride, visualRideType, axes, seed, loopSeed = seed, hillHeight, allowLoop, relation }) {
  const candidates = [];
  let reservedAdvance = 0;
  if (role === "front") {
    const liftDrop = buildLiftDrop(ride, axes, hillHeight, Math.min(length, 12 + hillHeight * 2), seed);
    candidates.push(liftDrop);
    reservedAdvance += Math.max(0, forwardAdvance(liftDrop));
  }

  for (const feature of buildPriorityTrackFeatureCandidates(role, { ride, visualRideType, axes, seed, relation })) {
    candidates.push(feature);
    reservedAdvance += Math.max(0, forwardAdvance(feature));
  }

  const requestedLoopPairs = loopPairsForRole(loopSeed, axes, relation, role, allowLoop);
  if (requestedLoopPairs > 0) {
    const loopBudget = Math.max(0, length - reservedAdvance);
    const loopPortal = buildLoopPortal(seed, role, loopBudget, requestedLoopPairs);
    if (loopPortal.length > 0) {
      candidates.push(loopPortal);
      reservedAdvance += Math.max(0, forwardAdvance(loopPortal));
    }
  }

  for (const feature of buildTrackFeatureCandidates(role, { ride, visualRideType, axes, seed, relation })) {
    candidates.push(feature);
  }

  if (role !== "final" && Math.max(relation.clusterSize ?? 1, relation.evolutionCount ?? 1) > 1) {
    candidates.push(buildClusterPass(ride, 8, axes, seed + 9, relation));
  }

  if (role === "side-a" || role === "back") {
    candidates.push(buildWiggle(seeded(seed, 42) > 0.5, 1 + Math.floor(seeded(seed, 43) * 3)));
  }

  if (role === "final") {
    candidates.push(buildFinalSide(6, visualRideType, axes, seed + 37));
  }

  return candidates.filter((candidate) => isStraightPreserving(candidate));
}

function buildPriorityTrackFeatureCandidates(role, { ride, visualRideType, axes, seed, relation }) {
  if (!shouldPrioritizeCorkscrew(role, { ride, visualRideType, axes, seed, relation })) {
    return [];
  }
  return [buildCorkscrewBlock(seed, false)];
}

function buildTrackFeatureCandidates(role, { ride, visualRideType, axes, seed, relation }) {
  const candidates = [];
  const relatedCount = Math.max(relation.clusterSize ?? 1, relation.evolutionCount ?? 1);
  const featurePressure = axes.adventure * 0.7 + axes.risk * 0.55 + Math.min(0.35, Math.log2(relatedCount) / 5);

  if (canUseTrackGroup(ride, "sBend") && role !== "final" && featurePressure + seeded(seed, 401) > 0.82) {
    candidates.push(buildRealSBend(seeded(seed, 402) > 0.5));
  }

  if (role !== "front" && canUseTwist(ride) && featurePressure + seeded(seed, 411) > 1.02) {
    candidates.push(buildInlineTwist(seed));
  }

  if (
    (role === "front" || role === "back") &&
    canUseCorkscrew(ride) &&
    !shouldPrioritizeCorkscrew(role, { ride, visualRideType, axes, seed, relation }) &&
    featurePressure + seeded(seed, 421) > 1.04
  ) {
    candidates.push(buildCorkscrewBlock(seed, false));
  }

  if ((role === "side-a" || role === "back") && canUseHelix(ride) && axes.size + seeded(seed, 451) > 0.75) {
    candidates.push(buildHelixFeature(seed, ride));
  }

  return candidates;
}

function shouldPrioritizeCorkscrew(role, { ride, visualRideType, axes, seed, relation }) {
  if (!(role === "front" || role === "back") || !canUseCorkscrew(ride)) {
    return false;
  }

  const relatedCount = Math.max(relation.clusterSize ?? 1, relation.evolutionCount ?? 1);
  const signatureType = visualRideType ?? ride.rideType;
  const signatureCorkscrewRide = ["corkscrew_rc", "twister_rc", "hyper_twister"].includes(signatureType);
  const pressure = axes.adventure * 0.75 + axes.risk * 0.55 + Math.min(0.35, Math.log2(relatedCount) / 5);
  const threshold = signatureCorkscrewRide ? 0.72 : 1.02;
  return pressure + seeded(seed, 421) > threshold;
}

function loopPairsForRole(seed, axes, relation, role, allowLoop) {
  if (!allowLoop) {
    return 0;
  }

  const targetPairs = targetLoopPairCount(seed, axes, relation);
  if (targetPairs <= 0) {
    return 0;
  }

  const allocation = new Map([
    ["front", 0],
    ["back", 0],
    ["side-a", 0]
  ]);
  let remaining = targetPairs;
  for (const allocationRole of loopRoleOrder(seed)) {
    if (remaining <= 0) {
      break;
    }
    allocation.set(allocationRole, 1);
    remaining -= 1;
  }

  while (remaining > 0) {
    const extraRole = seeded(seed, 340 + remaining) > 0.44 ? "front" : "back";
    allocation.set(extraRole, (allocation.get(extraRole) ?? 0) + 1);
    remaining -= 1;
  }

  return allocation.get(role) ?? 0;
}

function targetLoopPairCount(seed, axes, relation) {
  const relatedCount = Math.max(relation.clusterSize ?? 1, relation.evolutionCount ?? 1);
  const gate = axes.adventure * 0.7 + axes.risk * 0.45 + Math.min(0.45, Math.log2(relatedCount) / 5) + seeded(seed, 305) * 0.65;
  if (gate < 0.82) {
    return 0;
  }

  const maxPairs = clampInt(
    1 + Math.round(axes.adventure * 1.25 + axes.risk * 1.1 + Math.min(1.35, Math.log2(relatedCount) / 1.7)),
    1,
    5
  );
  let pairs = 1 + Math.floor(seeded(seed, 306) * maxPairs);

  if (relatedCount >= 6) {
    pairs = Math.max(pairs, 3 + Math.floor(seeded(seed, 307) * 3));
  } else if (relatedCount >= 3) {
    pairs = Math.max(pairs, 1 + Math.floor(seeded(seed, 308) * Math.min(3, maxPairs)));
  }

  return clampInt(pairs, 1, 5);
}

function loopRoleOrder(seed) {
  const orders = [
    ["front", "back", "side-a"],
    ["front", "side-a", "back"],
    ["back", "front", "side-a"],
    ["side-a", "front", "back"]
  ];
  return orders[Math.floor(seeded(seed, 320) * orders.length)] ?? orders[0];
}

function buildLoopPortal(seed, role, budget, requestedPairs) {
  const maxPairsByBudget = Math.max(0, Math.floor((budget + 1) / 9));
  const maxPairs = Math.min(5, maxPairsByBudget);
  if (maxPairs < 1) {
    return [];
  }

  const desiredPairs = Math.min(maxPairs, requestedPairs);
  for (let pairCount = desiredPairs; pairCount >= 1; pairCount -= 1) {
    for (const compact of [false, true]) {
      const pieces = buildLoopPairs(seed, role, pairCount, compact);
      const advance = forwardAdvance(pieces);
      if (advance > 0 && advance <= budget) {
        return pieces;
      }
    }
  }

  return [];
}

function buildLoopPairs(seed, role, pairCount, compact) {
  const pieces = [];
  const salt = loopRoleSalt(role);
  const alternating = seeded(seed, 150 + salt) > 0.28;
  const startsLeft = seeded(seed, 151 + salt) > 0.5;

  for (let index = 0; index < pairCount; index += 1) {
    const reversePair = alternating ? index % 2 === 1 : seeded(seed, 170 + salt + index) > 0.62;
    const first = startsLeft !== reversePair ? LEFT_LOOP : RIGHT_LOOP;
    const second = first === LEFT_LOOP ? RIGHT_LOOP : LEFT_LOOP;
    pieces.push(...buildVerticalLoop(first));
    pieces.push(...repeat(FLAT, compact ? 0 : loopPairInnerGap(seed, salt, index)));
    pieces.push(...buildVerticalLoop(second));
    if (index < pairCount - 1) {
      pieces.push(...repeat(FLAT, compact ? 0 : loopPairOuterGap(seed, salt, index)));
    }
  }

  return pieces;
}

function loopPairInnerGap(seed, salt, index) {
  return Math.floor(seeded(seed, 190 + salt * 13 + index) * 3);
}

function loopPairOuterGap(seed, salt, index) {
  return 1 + Math.floor(seeded(seed, 210 + salt * 17 + index) * 4);
}

function loopRoleSalt(role) {
  if (role === "front") {
    return 1;
  }
  if (role === "back") {
    return 2;
  }
  if (role === "side-a") {
    return 3;
  }
  return 4;
}

function buildVerticalLoop(type) {
  return [{ type: FLAT_TO_UP_25 }, { type }, { type: DOWN_25_TO_FLAT }];
}

function buildRealSBend(leftFirst) {
  return [{ type: leftFirst ? S_BEND_LEFT : S_BEND_RIGHT }, { type: leftFirst ? S_BEND_RIGHT : S_BEND_LEFT }];
}

function buildInlineTwist(seed) {
  const up = seeded(seed, 510) > 0.5 ? LEFT_TWIST_DOWN_TO_UP : RIGHT_TWIST_DOWN_TO_UP;
  const down = seeded(seed, 511) > 0.5 ? LEFT_TWIST_UP_TO_DOWN : RIGHT_TWIST_UP_TO_DOWN;
  return seeded(seed, 512) > 0.35 ? [{ type: up }, { type: down }] : [{ type: down }, { type: up }];
}

function buildCorkscrewBlock(seed, large) {
  const patterns = large
    ? [
        [LEFT_LARGE_CORKSCREW_UP, RIGHT_LARGE_CORKSCREW_UP, RIGHT_LARGE_CORKSCREW_DOWN, LEFT_LARGE_CORKSCREW_DOWN],
        [RIGHT_LARGE_CORKSCREW_UP, LEFT_LARGE_CORKSCREW_UP, LEFT_LARGE_CORKSCREW_DOWN, RIGHT_LARGE_CORKSCREW_DOWN],
        [LEFT_LARGE_CORKSCREW_UP, LEFT_LARGE_CORKSCREW_DOWN, RIGHT_LARGE_CORKSCREW_UP, RIGHT_LARGE_CORKSCREW_DOWN],
        [RIGHT_LARGE_CORKSCREW_UP, RIGHT_LARGE_CORKSCREW_DOWN, LEFT_LARGE_CORKSCREW_UP, LEFT_LARGE_CORKSCREW_DOWN]
      ]
    : [
        [LEFT_CORKSCREW_UP, RIGHT_CORKSCREW_UP, RIGHT_CORKSCREW_DOWN, LEFT_CORKSCREW_DOWN],
        [RIGHT_CORKSCREW_UP, LEFT_CORKSCREW_UP, LEFT_CORKSCREW_DOWN, RIGHT_CORKSCREW_DOWN],
        [LEFT_CORKSCREW_UP, LEFT_CORKSCREW_DOWN, RIGHT_CORKSCREW_UP, RIGHT_CORKSCREW_DOWN],
        [RIGHT_CORKSCREW_UP, RIGHT_CORKSCREW_DOWN, LEFT_CORKSCREW_UP, LEFT_CORKSCREW_DOWN]
      ];
  return (patterns[Math.floor(seeded(seed, large ? 521 : 522) * patterns.length)] ?? patterns[0]).map((type) => ({ type }));
}

function buildHelixFeature(seed, ride) {
  const banked = canUseAnyTrackFeature(ride, ["helixUpBankedQuarter", "helixDownBankedQuarter"]);
  const leftFirst = seeded(seed, 541) > 0.5;
  if (banked) {
    return leftFirst
      ? [
          { type: LEFT_QUARTER_BANKED_HELIX_UP },
          { type: RIGHT_QUARTER_BANKED_HELIX_DOWN },
          { type: RIGHT_QUARTER_BANKED_HELIX_UP },
          { type: LEFT_QUARTER_BANKED_HELIX_DOWN }
        ]
      : [
          { type: RIGHT_QUARTER_BANKED_HELIX_UP },
          { type: LEFT_QUARTER_BANKED_HELIX_DOWN },
          { type: LEFT_QUARTER_BANKED_HELIX_UP },
          { type: RIGHT_QUARTER_BANKED_HELIX_DOWN }
        ];
  }
  return leftFirst
    ? [
        { type: LEFT_QUARTER_HELIX_UP },
        { type: RIGHT_QUARTER_HELIX_DOWN },
        { type: RIGHT_QUARTER_HELIX_UP },
        { type: LEFT_QUARTER_HELIX_DOWN }
      ]
    : [
        { type: RIGHT_QUARTER_HELIX_UP },
        { type: LEFT_QUARTER_HELIX_DOWN },
        { type: LEFT_QUARTER_HELIX_UP },
        { type: RIGHT_QUARTER_HELIX_DOWN }
      ];
}

function buildClusterPass(ride, length, axes, seed, relation) {
  const pieces = [];
  const isTransport = ride.family === "transport";
  const relatedCount = Math.max(relation.clusterSize ?? 1, relation.evolutionCount ?? 1);
  if (!isTransport && relatedCount > 1 && axes.risk > 0.35) {
    pieces.push({ type: BOOSTER, brakeSpeed: 0 });
  }
  pieces.push(...repeat(FLAT, Math.max(2, length + Math.min(5, relatedCount - 1))));
  if (relatedCount > 1) {
    pieces.push(...buildWiggle(seeded(seed, 92) > 0.5, 1 + ((relation.memberIndex + relatedCount) % 3)));
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

function buildFinalSide(length, visualRideType, axes, seed) {
  const pieces = [];
  let remaining = Math.max(0, length);
  const brakeRun = Math.min(4, Math.max(2, Math.floor(remaining / 3)));
  pieces.push(...repeat(FLAT, Math.max(0, remaining - brakeRun)));
  remaining = brakeRun;
  if (!hasPaintedBrakes(visualRideType)) {
    pieces.push(...repeat(FLAT, remaining));
    return pieces;
  }
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
  return canUseTrackFeature(ride, "verticalLoop");
}

function canUseRenderedVerticalLoop(ride, visualRideType) {
  return (
    canUseVerticalLoop(ride) ||
    ["giga_rc", "looping_rc", "twister_rc", "corkscrew_rc", "stand_up_rc", "inverted_rc"].includes(visualRideType)
  );
}

function canUseTrackFeature(ride, feature) {
  return trackFeatureSet(ride).has(feature);
}

function canUseTrackGroup(ride, group) {
  return canUseTrackFeature(ride, group);
}

function canUseAnyTrackFeature(ride, features) {
  return features.some((feature) => canUseTrackFeature(ride, feature));
}

function canUseSteepDrop(ride) {
  return canUseAnyTrackFeature(ride, ["slopeSteepDown", "slopeSteepLong", "slopeVertical", "curveVertical"]);
}

function canUseTwist(ride) {
  // Inline twists traverse cleanly but currently fail OpenRCT2's open-ride validation.
  void ride;
  return false;
}

function canUseCorkscrew(ride) {
  // Corkscrew blocks require additional placement calibration before generated circuits can open reliably.
  void ride;
  return false;
}

function canUseHelix(ride) {
  // Quarter-helix circuits traverse cleanly but currently fail OpenRCT2's open-ride validation.
  // Keep them out of generated parks until their placement/opening semantics are calibrated.
  void ride;
  return false;
}

function trackFeatureSet(ride) {
  return new Set([
    ...(ride.buildOut?.trackGroups ?? []),
    ...(ride.buildOut?.inversions ?? []),
    ...(ride.buildOut?.helices ?? []),
    ...(ride.buildOut?.steepDrops ?? []),
    ...(ride.buildOut?.banking ?? [])
  ]);
}

function placeRides(rides) {
  const placed = [];
  const occupiedTrackKeys = new Map();
  const occupiedTrackTiles = new Map();
  const occupiedAccessTiles = new Map();
  const occupiedSolidTiles = new Map();
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
      const basePosition = clampPosition(
        {
          x: Math.round(center.x - anchor.x + offset.x),
          y: Math.round(center.y - anchor.y + offset.y)
        },
        ride.footprint
      );
      const position = chooseNonCollidingPosition(ride, basePosition, {
        occupiedTrackKeys,
        occupiedTrackTiles,
        occupiedAccessTiles,
        occupiedSolidTiles
      });
      const placedRide = { ...ride, position };
      reserveRideOccupancy(placedRide, {
        occupiedTrackKeys,
        occupiedTrackTiles,
        occupiedAccessTiles,
        occupiedSolidTiles
      });
      placed.push(placedRide);
    }
  }

  return placed;
}

function chooseNonCollidingPosition(ride, basePosition, occupancy) {
  const seed = hash(`${ride.id}:${ride.name}:placement-search`);
  const seen = new Set();
  for (const candidate of placementCandidates(basePosition, ride.footprint, seed)) {
    const key = `${candidate.x},${candidate.y}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!rideCollidesAt(ride, candidate, occupancy)) {
      return candidate;
    }
  }

  return basePosition;
}

function rideCollidesAt(ride, position, { occupiedTrackKeys, occupiedTrackTiles, occupiedAccessTiles, occupiedSolidTiles }) {
  const trackKeys = trackPositionKeysForRideAt(ride, position);
  if (trackKeys.some((trackKey) => occupiedTrackKeys.has(trackKey))) {
    return true;
  }

  const trackTiles = trackTileKeysForRideAt(ride, position);
  if (trackTiles.some((trackTile) => occupiedSolidTiles.has(trackTile))) {
    return true;
  }

  const accessTiles = rideAccessTileKeysAt(ride, position);
  if (accessTiles.some((accessTile) => occupiedSolidTiles.has(accessTile))) {
    return true;
  }

  if (isSimpleSolidRide(ride)) {
    const solidTiles = simpleSolidTileKeys({ ...ride, position });
    return solidTiles.some(
      (solidTile) =>
        occupiedSolidTiles.has(solidTile) || occupiedTrackTiles.has(solidTile) || occupiedAccessTiles.has(solidTile)
    );
  }

  return false;
}

function* placementCandidates(basePosition, footprint, seed) {
  yield basePosition;
  for (let radius = 8; radius <= 150; radius += 6) {
    const steps = Math.max(12, Math.round(radius / 2));
    for (let step = 0; step < steps; step += 1) {
      const angle = (Math.PI * 2 * step) / steps + seeded(seed, radius * 101 + step) * 0.22;
      yield clampPosition(
        {
          x: Math.round(basePosition.x + Math.cos(angle) * radius),
          y: Math.round(basePosition.y + Math.sin(angle) * radius * 0.82)
        },
        footprint
      );
    }
  }
}

function reserveRideOccupancy(ride, { occupiedTrackKeys, occupiedTrackTiles, occupiedAccessTiles, occupiedSolidTiles }) {
  for (const trackKey of trackPositionKeysForRideAt(ride, ride.position)) {
    occupiedTrackKeys.set(trackKey, ride.id);
  }
  for (const trackTile of trackTileKeysForRideAt(ride, ride.position)) {
    occupiedTrackTiles.set(trackTile, ride.id);
  }
  for (const accessTile of rideAccessTileKeysAt(ride, ride.position)) {
    occupiedAccessTiles.set(accessTile, ride.id);
  }
  if (isSimpleSolidRide(ride)) {
    for (const solidTile of simpleSolidTileKeys(ride)) {
      occupiedSolidTiles.set(solidTile, ride.id);
    }
  }
}

function trackPositionKeysForRideAt(ride, position) {
  if (!Array.isArray(ride.track) || ride.track.length === 0) {
    return [];
  }
  const keys = [];
  let cursor = absoluteTrackStartCursor({ ...ride, position });
  for (const segment of ride.track) {
    keys.push(trackPositionKey(cursor));
    const meta = TRACK_META[segment.type];
    if (meta === undefined) {
      break;
    }
    cursor = advance(cursor, meta);
  }
  return keys;
}

function trackPositionKey(cursor) {
  return `${cursor.x},${cursor.y},${cursor.z}`;
}

function trackTileKeysForRideAt(ride, position) {
  return unique(trackPositionKeysForRideAt(ride, position).map((trackKey) => trackKey.split(",").slice(0, 2).join(",")));
}

function rideAccessTileKeysAt(ride, position) {
  const placedRide = { ...ride, position };
  return unique(rideAccessPathTiles(placedRide).map(coordKey));
}

function simpleRideSolidTileSet(rides) {
  const tiles = new Set();
  for (const ride of rides ?? []) {
    if (!isSimpleSolidRide(ride)) {
      continue;
    }
    for (const tile of simpleSolidTileKeys(ride)) {
      tiles.add(tile);
    }
  }
  return tiles;
}

function pathBlockedTileSet(rides) {
  const tiles = simpleRideSolidTileSet(rides);
  for (const ride of rides ?? []) {
    for (const accessTile of rideAccessPathTiles(ride)) {
      tiles.add(coordKey(accessTile));
    }
  }
  return tiles;
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

function accessBuildingTileKeys(ride) {
  return unique([coordKey(entranceExitLocation(ride, false)), coordKey(entranceExitLocation(ride, true))]);
}

function isSimpleSolidRide(ride) {
  return SIMPLE_SOLID_RIDE_TYPES.has(ride.rideType);
}

function isShopFacilityRide(ride) {
  return SHOP_FACILITY_RIDE_TYPES.has(ride.rideType);
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
  const footprintScale = Math.max(ride.footprint.w, ride.footprint.h);
  const roleScale = hint.role === "flat" || hint.role === "tower" ? 0.45 : 0.72;
  const spacing = Math.max(8, Math.min(28, footprintScale * roleScale));
  const radius = spacing * Math.sqrt(hint.memberIndex + 1) + seeded(seed, 602) * 5;
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
  const blockedTiles = pathBlockedTileSet(rides);
  const pathTiles = new Set();
  const connected = new Map();
  addConnectedPathSource(connected, "entrance", parkEntrancePoint());
  pathTiles.add(coordKey(parkEntrancePoint()));

  for (const [index, ride] of rides.entries()) {
    const accessTiles = rideAccessPathTiles(ride);
    const route = ridePathRoute(
      ride,
      accessTiles,
      [...connected.values()],
      blockedTiles,
      pathTiles,
      index
    );
    paths.push(route.mainPath);

    for (const accessPath of route.accessPaths) {
      paths.push(accessPath);
    }
    addPathEdgeSources(connected, ride.id, route.mainPath);
    addPathEdgeTiles(pathTiles, route.mainPath);
    for (const accessPath of route.accessPaths) {
      addPathEdgeSources(connected, ride.id, accessPath);
      addPathEdgeTiles(pathTiles, accessPath);
    }
  }

  return paths;
}

function addPathEdgeTiles(pathTiles, pathEdge) {
  for (const waypoint of pathEdge.waypoints ?? []) {
    pathTiles.add(coordKey(waypoint));
  }
}

function addPathEdgeSources(connected, id, pathEdge) {
  for (const waypoint of pathEdge.waypoints ?? []) {
    addConnectedPathSource(connected, id, waypoint);
  }
}

function addConnectedPathSource(connected, id, point) {
  const key = coordKey(point);
  if (!connected.has(key)) {
    connected.set(key, { id, point: { x: point.x, y: point.y } });
  }
}

function ridePathRoute(ride, accessTiles, connected, blockedTiles, pathTiles, index) {
  let best = null;
  let bestFallback = null;
  for (const endpoint of ridePathEndpointCandidates(ride, blockedTiles)) {
    for (const source of connectedPathSources(connected, endpoint)) {
      const mainPath = mainPathEdge(
        source.id,
        ride.id,
        source.point,
        endpoint,
        blockedTiles,
        pathTiles,
        index
      );
      if (mainPath === null) {
        continue;
      }
      if (isTooShortForReusedPathSource(source, mainPath)) {
        continue;
      }
      const accessPaths = rideAccessPaths(ride, endpoint, accessTiles, blockedTiles);
      if (accessPaths === null) {
        continue;
      }
      const candidate = { endpoint, mainPath, accessPaths };
      if (hasTooShortAccessPath(accessPaths)) {
        bestFallback = betterPathRoute(bestFallback, candidate);
        continue;
      }
      if (accessPathsOverlapMainRoute(endpoint, accessPaths, mainPath)) {
        bestFallback = betterPathRoute(bestFallback, candidate);
        continue;
      }
      best = betterPathRoute(best, candidate);
    }
  }

  const endpoint = ridePathEndpoint(ride, blockedTiles);
  const mainPath = mainPathEdge(
    connected[0]?.id ?? "entrance",
    ride.id,
    connected[0]?.point ?? parkEntrancePoint(),
    endpoint,
    blockedTiles,
    pathTiles,
    index
  ) ?? mainPathEdge(
    "entrance",
    ride.id,
    parkEntrancePoint(),
    endpoint,
    blockedTiles,
    new Set(),
    index
  );
  if (mainPath === null) {
    throw new Error(`No path route to ${ride.id}`);
  }
  const accessPaths = rideAccessPaths(ride, endpoint, accessTiles, blockedTiles)
    ?? rideAccessPaths(ride, endpoint, accessTiles, blockedTiles, new Set(), false);
  if (accessPaths === null) {
    throw new Error(`No access path route to ${ride.id}`);
  }
  return best ?? bestFallback ?? { endpoint, mainPath, accessPaths };
}

function isTooShortForReusedPathSource(source, mainPath) {
  return source.id !== "entrance" && pathLength(mainPath) < MIN_REUSED_PATH_ROUTE_TILES;
}

function hasTooShortAccessPath(accessPaths) {
  return accessPaths.some((accessPath) => {
    const length = pathLength(accessPath);
    return length > 0 && length < MIN_ACCESS_PATH_TILES;
  });
}

function connectedPathSources(connected, endpoint) {
  const sorted = [...connected].sort((left, right) => {
    const leftDistance = manhattan(left.point, endpoint);
    const rightDistance = manhattan(right.point, endpoint);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return left.id.localeCompare(right.id);
  });
  const result = sorted.slice(0, MAX_CONNECTED_ROUTE_SOURCES);
  const entrance = sorted.find((source) => source.id === "entrance");
  if (entrance !== undefined && !result.some((source) => source.id === "entrance" && coordKey(source.point) === coordKey(entrance.point))) {
    result.push(entrance);
  }
  return result;
}

function betterPathRoute(current, candidate) {
  if (current === null) {
    return candidate;
  }
  const currentCost = pathRouteCost(current);
  const candidateCost = pathRouteCost(candidate);
  if (candidateCost !== currentCost) {
    return candidateCost < currentCost ? candidate : current;
  }
  const currentMainLength = current.mainPath.waypoints?.length ?? 0;
  const candidateMainLength = candidate.mainPath.waypoints?.length ?? 0;
  return candidateMainLength < currentMainLength ? candidate : current;
}

function pathRouteCost(route) {
  return pathLength(route.mainPath) + route.accessPaths.reduce((total, accessPath) => total + pathLength(accessPath), 0);
}

function pathLength(path) {
  return path.waypoints?.length ?? 0;
}

function rideAccessPaths(ride, endpoint, accessTiles, blockedTiles, pathTiles = new Set(), avoidOwnTrack = false) {
  const accessBlockedTiles = accessPathBlockedTileSet(ride, blockedTiles, avoidOwnTrack);
  const paths = [];
  for (const accessTile of accessTiles) {
    if (coordKey(endpoint) !== coordKey(accessTile)) {
      const accessPath = accessPathEdge(ride.id, endpoint, accessTile, accessBlockedTiles, pathTiles);
      if (accessPath === null) {
        return null;
      }
      paths.push(accessPath);
    }
  }
  return paths;
}

function accessPathEdge(rideId, endpoint, accessTile, blockedTiles, pathTiles) {
  for (const approach of accessApproachCandidates(accessTile)) {
    const approachKey = coordKey(approach);
    if (blockedTiles.has(approachKey) || pathTiles.has(approachKey)) {
      continue;
    }
    try {
      const path = pathEdge(rideId, rideId, endpoint, approach, blockedTiles, pathTiles);
      return { from: rideId, to: rideId, waypoints: dedupeCoords([...(path.waypoints ?? []), accessTile]) };
    } catch {
      // Try the next approach side.
    }
  }
  try {
    return pathEdge(rideId, rideId, endpoint, accessTile, blockedTiles, pathTiles);
  } catch {
    return null;
  }
}

function accessApproachCandidates(accessTile) {
  return [
    { x: accessTile.x + 1, y: accessTile.y },
    { x: accessTile.x - 1, y: accessTile.y },
    { x: accessTile.x, y: accessTile.y + 1 },
    { x: accessTile.x, y: accessTile.y - 1 }
  ].filter(isInsideParkTile);
}

function accessPathBlockedTileSet(ride, blockedTiles, avoidOwnTrack = false) {
  const tiles = new Set(blockedTiles);
  if (avoidOwnTrack && Array.isArray(ride.track) && ride.track.length > 0) {
    for (const trackTile of paddedTrackTileKeysForRideAt(ride, ride.position)) {
      tiles.add(trackTile);
    }
  }
  return tiles;
}

function paddedTrackTileKeysForRideAt(ride, position) {
  const keys = [];
  for (const trackTile of trackTileKeysForRideAt(ride, position)) {
    const [x, y] = trackTile.split(",").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          keys.push(coordKey({ x: x + dx, y: y + dy }));
        }
      }
    }
  }
  return unique(keys);
}

function accessPathsOverlapMainRoute(endpoint, accessPaths, mainPath) {
  const endpointKey = coordKey(endpoint);
  const mainKeys = new Set((mainPath.waypoints ?? []).map(coordKey).filter((key) => key !== endpointKey));
  return accessPaths.some((accessPath) =>
    (accessPath.waypoints ?? []).some((waypoint) => {
      const key = coordKey(waypoint);
      return key !== endpointKey && mainKeys.has(key);
    })
  );
}

function mainPathEdge(from, to, start, end, blockedTiles, pathTiles, index) {
  for (const branchX of branchLaneCandidates(end.x, index)) {
    const waypoints = branchPathBetween(start, end, branchX, blockedTiles, pathTiles);
    if (waypoints !== null) {
      return { from, to, waypoints };
    }
  }
  try {
    return pathEdge(from, to, start, end, blockedTiles, pathTiles);
  } catch {
    return null;
  }
}

function branchLaneCandidates(targetX, index) {
  const candidates = [];
  const seen = new Set();
  const add = (x) => {
    const clamped = Math.max(4, Math.min(PARK_WIDTH - 5, Math.round(x)));
    if (!seen.has(clamped)) {
      seen.add(clamped);
      candidates.push(clamped);
    }
  };

  add(targetX);
  const preferredStep = index % 2 === 0 ? 1 : -1;
  for (let offset = 1; offset <= 48; offset += 1) {
    add(targetX + offset * preferredStep);
    add(targetX - offset * preferredStep);
  }
  for (let offset = 49; offset < PARK_WIDTH; offset += 1) {
    add(targetX + offset);
    add(targetX - offset);
  }
  return candidates;
}

function branchPathBetween(start, end, branchX, blockedTiles, pathTiles = new Set()) {
  const corners = [
    start,
    { x: branchX, y: start.y },
    { x: branchX, y: end.y },
    end
  ];
  const path = [];
  for (let index = 0; index < corners.length - 1; index += 1) {
    const segment = straightPathSegment(corners[index], corners[index + 1]);
    if (segment === null) {
      return null;
    }
    for (const coord of segment) {
      if (
        !isInsideParkTile(coord) ||
        isBlockedPathTile(coord, blockedTiles, start, end, pathTiles)
      ) {
        return null;
      }
      path.push(coord);
    }
  }
  return dedupeCoords(path);
}

function straightPathSegment(start, end) {
  if (start.x !== end.x && start.y !== end.y) {
    return null;
  }
  const path = [];
  if (start.x !== end.x) {
    const step = Math.sign(end.x - start.x);
    for (let x = start.x; x !== end.x; x += step) {
      path.push({ x, y: start.y });
    }
  } else if (start.y !== end.y) {
    const step = Math.sign(end.y - start.y);
    for (let y = start.y; y !== end.y; y += step) {
      path.push({ x: start.x, y });
    }
  }
  path.push(end);
  return path;
}

function pathEdge(from, to, start, end, blockedTiles, pathTiles = new Set()) {
  try {
    return {
      from,
      to,
      waypoints: shortestPathBetween(start, end, blockedTiles, pathTiles)
    };
  } catch (error) {
    throw new Error(`No path edge ${from}->${to}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function rideAccessPathTiles(ride) {
  return uniqueCoords([entranceExitPathTile(ride, false), entranceExitPathTile(ride, true)]);
}

function uniqueCoords(coords) {
  const seen = new Set();
  const result = [];
  for (const coord of coords) {
    const key = coordKey(coord);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(coord);
    }
  }
  return result;
}

function shortestPathBetween(start, end, blockedTiles, pathTiles = new Set()) {
  const startKey = coordKey(start);
  const endKey = coordKey(end);
  const queue = [start];
  const previous = new Map([[startKey, null]]);
  let head = 0;

  while (head < queue.length) {
    const current = queue[head];
    head += 1;
    if (coordKey(current) === endKey) {
      break;
    }

    for (const next of orderedPathNeighbors(current, end)) {
      const key = coordKey(next);
      if (previous.has(key) || !isInsideParkTile(next) || isBlockedPathTile(next, blockedTiles, start, end, pathTiles)) {
        continue;
      }
      previous.set(key, current);
      queue.push(next);
    }
  }

  if (!previous.has(endKey)) {
    throw new Error(`No solid-footprint-safe path from ${coordKey(start)} to ${coordKey(end)}`);
  }

  const path = [];
  for (let current = end; current !== null; current = previous.get(coordKey(current))) {
    path.push(current);
  }
  path.reverse();
  return dedupeCoords(path);
}

function orderedPathNeighbors(point, end) {
  return [
    { x: point.x + Math.sign(end.x - point.x), y: point.y },
    { x: point.x, y: point.y + Math.sign(end.y - point.y) },
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 }
  ].filter(
    (coord, index, coords) =>
      (coord.x !== point.x || coord.y !== point.y) &&
      coords.findIndex((other) => other.x === coord.x && other.y === coord.y) === index
  );
}

function isBlockedPathTile(coord, blockedTiles, start, end, pathTiles = new Set()) {
  const key = coordKey(coord);
  return key !== coordKey(start) && key !== coordKey(end) && (blockedTiles.has(key) || pathTiles.has(key));
}

function isInsideParkTile(coord) {
  return coord.x >= 0 && coord.y >= 0 && coord.x < PARK_WIDTH && coord.y < PARK_HEIGHT;
}

function parkEntrancePoint() {
  return { x: Math.floor(PARK_WIDTH / 2), y: 4 };
}

function ridePathEndpoint(ride, blockedTiles) {
  const accessTiles = rideAccessPathTiles(ride);
  if (blockedTiles === undefined) {
    return accessTiles[0] ?? entranceExitPathTile(ride, false);
  }
  return ridePathEndpointCandidates(ride, blockedTiles)[0] ?? accessTiles[0] ?? entranceExitPathTile(ride, false);
}

function ridePathEndpointCandidates(ride, blockedTiles) {
  const accessTiles = rideAccessPathTiles(ride);
  return uniqueCoords([...ridePathHubCandidates(accessTiles, blockedTiles).slice(0, MAX_RIDE_PATH_HUB_CANDIDATES), ...accessTiles]);
}

function ridePathHubCandidates(accessTiles, blockedTiles) {
  if (accessTiles.length <= 1) {
    return accessTiles;
  }

  const minX = Math.min(...accessTiles.map((tile) => tile.x));
  const maxX = Math.max(...accessTiles.map((tile) => tile.x));
  const minY = Math.min(...accessTiles.map((tile) => tile.y));
  const maxY = Math.max(...accessTiles.map((tile) => tile.y));
  const accessKeys = new Set(accessTiles.map(coordKey));
  const candidates = [];
  const seen = new Set();
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let y = minY - radius; y <= maxY + radius; y += 1) {
      for (let x = minX - radius; x <= maxX + radius; x += 1) {
        if (x !== minX - radius && x !== maxX + radius && y !== minY - radius && y !== maxY + radius) {
          continue;
        }
        const candidate = clampPoint({ x, y });
        const key = coordKey(candidate);
        if (seen.has(key) || accessKeys.has(key) || blockedTiles.has(key) || !isInsideParkTile(candidate)) {
          continue;
        }
        seen.add(key);
        candidates.push(candidate);
      }
    }
  }

  const entrance = parkEntrancePoint();
  candidates.sort((left, right) => {
    const leftCost = hubCandidateCost(left, accessTiles, entrance);
    const rightCost = hubCandidateCost(right, accessTiles, entrance);
    if (leftCost !== rightCost) {
      return leftCost - rightCost;
    }
    if (left.y !== right.y) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });

  return candidates.filter((candidate) => accessTiles.every((accessTile) => canConnectPath(candidate, accessTile, blockedTiles)));
}

function hubCandidateCost(candidate, accessTiles, entrance) {
  const accessCost = accessTiles.reduce((total, accessTile) => total + manhattan(candidate, accessTile), 0);
  return accessCost * 1000 + manhattan(candidate, entrance);
}

function canConnectPath(start, end, blockedTiles) {
  try {
    shortestPathBetween(start, end, blockedTiles);
    return true;
  } catch {
    return false;
  }
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
    ...validatePaintedTrackPieces(generated.rides),
    ...validateSimpleRideSolidFootprints(generated),
    ...validateGeneratedTrackPositionCollisions(generated.rides),
    ...validateClosedTrackCircuits(generated.rides)
  ];

  if (issues.length > 0) {
    throw new Error(`Generated register park failed connectivity validation:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
  }
}

function validatePaintedTrackPieces(rides) {
  const issues = [];
  for (const ride of rides ?? []) {
    for (const [index, segment] of (ride.track ?? []).entries()) {
      if (isUnpaintedTrackPiece(ride.rideType, segment.type)) {
        issues.push(`${ride.id} ${ride.rideType} segment ${index} uses unpainted track type ${segment.type}`);
      }
    }
  }
  return issues;
}

function validateGeneratedTrackPositionCollisions(rides) {
  const issues = [];
  const seen = new Map();
  for (const ride of rides ?? []) {
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

function validateSimpleRideSolidFootprints(generated) {
  const issues = [];
  const solidOwners = new Map();
  for (const ride of generated.rides ?? []) {
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

  for (const pathEdge of generated.paths ?? []) {
    for (const coord of pathEdge.waypoints ?? []) {
      const tile = coordKey(coord);
      const owner = solidOwners.get(tile);
      if (owner !== undefined) {
        issues.push(`path ${pathEdge.from}->${pathEdge.to} crosses simple ride ${owner} at ${tile}`);
      }
    }
  }

  for (const ride of generated.rides ?? []) {
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
  if (ride.family === "thrill" && !isTowerRide(ride)) {
    return true;
  }
  return ride.rideType === "mini_golf";
}

function isTowerRide(ride) {
  return ride.rideType === "observation_tower" || ride.rideType === "roto_drop" || ride.rideType === "launched_freefall";
}

function hasPaintedBrakes(rideType) {
  return !RIDE_TYPES_WITHOUT_PAINTED_BRAKES.has(rideType);
}

function isUnpaintedTrackPiece(rideType, trackType) {
  return RIDE_TYPES_WITHOUT_PAINTED_BRAKES.has(rideType) && BRAKE_TRACK_TYPES.has(trackType);
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
        originalIndex: entry.index,
        evolutionCount: entry.ride.__evolution?.count ?? 1
      });
    }
  }
  return relations;
}

function chooseRelationKey(ride, relationshipIndex) {
  const work = ride.__work ?? relationshipIndex.workById.get(ride.id);
  if (work === undefined) {
    return `family:${ride.family ?? ride.archetype ?? "ride"}`;
  }

  const candidates = relationshipIndex.candidatesById.get(ride.id) ?? relationCandidates(work);
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
  if (ride.rideType === "hybrid_rc") {
    return "twister_rc";
  }
  if (ride.rideType === "alpine_rc") {
    return relation.memberIndex % 2 === 0 ? "mini_rc" : "spiral_rc";
  }
  if (
    ride.family?.startsWith("coaster") === true &&
    Math.max(relation.clusterSize ?? 1, relation.evolutionCount ?? 1) > 1 &&
    !canUseVerticalLoop(ride) &&
    axes.adventure + axes.risk > 1.15 &&
    relation.memberIndex % 3 === 0
  ) {
    return "looping_rc";
  }
  return ride.rideType;
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
    originalIndex: index,
    evolutionCount: ride.__evolution?.count ?? 1
  };
}

function stripLayoutHints(ride) {
  const clean = { ...ride };
  delete clean.__layout;
  delete clean.__work;
  delete clean.__evolution;
  if (typeof clean.sign === "string") {
    clean.sign = cleanDuplicatePrLabel(clean.sign);
  }
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

function cleanDuplicatePrLabel(value) {
  return value
    .replace(/^(PR #(\d+)) - PR #\2:\s*/i, "$1 - ")
    .replace(/^(PR #(\d+)) - PR #\2\s+-\s*/i, "$1 - ");
}

function unique(values) {
  return [...new Set(values)];
}

function dominantString(values) {
  const counts = new Map();
  for (const value of values) {
    if (typeof value !== "string" || value.trim().length === 0) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function sumNumbers(values) {
  return values.reduce((sum, value) => sum + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
}

function sumRecords(records) {
  const result = {};
  for (const record of records) {
    for (const [key, value] of Object.entries(record ?? {})) {
      result[key] = (result[key] ?? 0) + (Number.isFinite(Number(value)) ? Number(value) : 0);
    }
  }
  return result;
}

function averageRecords(records) {
  const totals = sumRecords(records);
  const denominator = Math.max(1, records.filter(Boolean).length);
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, Number(value) / denominator]));
}

function minIso(values) {
  return sortedIso(values)[0] ?? null;
}

function maxIso(values) {
  return sortedIso(values).at(-1) ?? null;
}

function sortedIso(values) {
  return values
    .filter((value) => typeof value === "string" && Number.isFinite(Date.parse(value)))
    .sort((left, right) => Date.parse(left) - Date.parse(right));
}

function roundAxis(value) {
  return Math.round(clamp(value) * 1000) / 1000;
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

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function normalizeDirection(direction) {
  return ((direction % 4) + 4) % 4;
}
