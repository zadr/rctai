#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TICKS_PER_SECOND = 40;
const DEFAULT_TOP_COUNT = 10;

const BEGIN_STATION = 2;
const MIDDLE_STATION = 3;
const END_STATION = 1;
const FLAT = 0;
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
const LEFT_LOOP = 40;
const RIGHT_LOOP = 41;
const LEFT_TURN_3 = 42;
const RIGHT_TURN_3 = 43;
const TOWER_BASE = 66;
const TOWER_SECTION = 67;
const BRAKES = 99;
const BOOSTER = 100;
const BLOCK_BRAKES = 216;

const PIECE_TICKS = new Map([
  [BEGIN_STATION, 64],
  [MIDDLE_STATION, 64],
  [END_STATION, 64],
  [FLAT, 28],
  [LEFT_TURN_3, 34],
  [RIGHT_TURN_3, 34],
  [LEFT_TURN_5, 48],
  [RIGHT_TURN_5, 48],
  [BANKED_LEFT_TURN_5, 48],
  [BANKED_RIGHT_TURN_5, 48],
  [FLAT_TO_UP_25, 42],
  [UP_25, 54],
  [UP_25_TO_FLAT, 42],
  [FLAT_TO_DOWN_25, 24],
  [DOWN_25, 18],
  [DOWN_25_TO_FLAT, 24],
  [LEFT_LOOP, 96],
  [RIGHT_LOOP, 96],
  [TOWER_BASE, 120],
  [TOWER_SECTION, 42],
  [BOOSTER, 16],
  [BRAKES, 40],
  [BLOCK_BRAKES, 52]
]);

const args = parseArgs(process.argv.slice(2));
const plan = readJson(resolve(process.cwd(), args.planPath));
const estimates = estimateParkPlan(plan);

if (args.json) {
  process.stdout.write(`${JSON.stringify(estimates, null, 2)}\n`);
} else {
  printSummary(args.planPath, estimates, args.topCount);
}

function parseArgs(argv) {
  const parsed = {
    planPath: "",
    topCount: DEFAULT_TOP_COUNT,
    json: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--top") {
      parsed.topCount = readInteger(readFlag(argv, ++index, arg), arg);
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      usage(0);
    }
    if (arg?.startsWith("-") === true) {
      fail(`unknown option: ${arg}`);
    }
    if (parsed.planPath.length > 0) {
      fail(`unexpected positional argument: ${arg}`);
    }
    parsed.planPath = arg ?? "";
  }

  if (parsed.planPath.length === 0) {
    usage(1);
  }

  return parsed;
}

function usage(exitCode) {
  process.stderr.write(
    [
      "usage: node scripts/estimate-ride-runtime.mjs <park-plan.json> [--top N] [--json]",
      "",
      "Estimates ride cycle duration from generated park-plan track pieces.",
      "The estimate is deterministic and intended for relative sizing, not exact OpenRCT2 physics."
    ].join("\n") + "\n"
  );
  process.exit(exitCode);
}

function estimateParkPlan(plan) {
  const rides = (plan.rides ?? []).map(estimateRide).sort((left, right) => {
    if (right.estimatedTicks !== left.estimatedTicks) {
      return right.estimatedTicks - left.estimatedTicks;
    }
    return left.id.localeCompare(right.id);
  });
  const totalRideTicks = rides.reduce((sum, ride) => sum + ride.estimatedTicks, 0);
  const trackedRides = rides.filter((ride) => ride.trackPieces > 1).length;
  const totalTrackPieces = rides.reduce((sum, ride) => sum + ride.trackPieces, 0);

  return {
    park: plan.park?.name ?? "unknown park",
    rides: rides.length,
    trackedRides,
    totalTrackPieces,
    aggregateRideTicks: totalRideTicks,
    aggregateRideSeconds: secondsForTicks(totalRideTicks),
    longest: rides,
    assumptions: {
      ticksPerSecond: TICKS_PER_SECOND,
      unknownTrackPieceTicks: 32,
      flatVisualRideTicks: 1800
    }
  };
}

function estimateRide(ride) {
  const track = Array.isArray(ride.track) ? ride.track : [];
  const features = trackFeatures(track);
  const estimatedTicks = estimateTrackTicks(track);

  return {
    id: String(ride.id ?? ""),
    name: String(ride.name ?? ride.id ?? ""),
    rideType: String(ride.rideType ?? ""),
    family: ride.family ?? ride.archetype ?? null,
    trackPieces: track.length,
    estimatedTicks,
    estimatedSeconds: secondsForTicks(estimatedTicks),
    features
  };
}

function estimateTrackTicks(track) {
  if (track.length === 0) {
    return 0;
  }

  if (track.length === 1 && !isCircuitPiece(track[0]?.type)) {
    return 1800;
  }

  return track.reduce((sum, segment) => {
    const type = segment.type;
    return sum + (PIECE_TICKS.get(type) ?? 32);
  }, 0);
}

function trackFeatures(track) {
  const counts = {
    stationPieces: 0,
    liftPieces: 0,
    dropPieces: 0,
    loopPieces: 0,
    brakePieces: 0,
    boosterPieces: 0,
    towerPieces: 0,
    unknownPieces: 0
  };

  for (const segment of track) {
    const type = segment.type;
    if (type === BEGIN_STATION || type === MIDDLE_STATION || type === END_STATION) {
      counts.stationPieces += 1;
    } else if (type === FLAT_TO_UP_25 || type === UP_25 || type === UP_25_TO_FLAT || segment.chainLift === true) {
      counts.liftPieces += 1;
    } else if (type === FLAT_TO_DOWN_25 || type === DOWN_25 || type === DOWN_25_TO_FLAT) {
      counts.dropPieces += 1;
    } else if (type === LEFT_LOOP || type === RIGHT_LOOP) {
      counts.loopPieces += 1;
    } else if (type === BRAKES || type === BLOCK_BRAKES) {
      counts.brakePieces += 1;
    } else if (type === BOOSTER) {
      counts.boosterPieces += 1;
    } else if (type === TOWER_BASE || type === TOWER_SECTION) {
      counts.towerPieces += 1;
    } else if (!PIECE_TICKS.has(type)) {
      counts.unknownPieces += 1;
    }
  }

  return counts;
}

function isCircuitPiece(type) {
  return type === BEGIN_STATION || type === MIDDLE_STATION || type === END_STATION || type === FLAT;
}

function printSummary(inputPath, estimates, topCount) {
  process.stdout.write(`ride runtime estimate: ${inputPath}\n`);
  process.stdout.write(
    `${estimates.rides} rides, ${estimates.trackedRides} tracked circuits, ${estimates.totalTrackPieces} track pieces\n`
  );
  process.stdout.write(
    `aggregate ride time: ${estimates.aggregateRideTicks} ticks (${formatSeconds(estimates.aggregateRideSeconds)})\n`
  );
  process.stdout.write(`longest ${Math.min(topCount, estimates.longest.length)} rides:\n`);

  for (const ride of estimates.longest.slice(0, topCount)) {
    process.stdout.write(
      [
        `- ${ride.id}`,
        `${ride.estimatedTicks} ticks`,
        formatSeconds(ride.estimatedSeconds),
        `${ride.trackPieces} pieces`,
        ride.name
      ].join(" | ") + "\n"
    );
  }
}

function formatSeconds(seconds) {
  if (seconds < 90) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function secondsForTicks(ticks) {
  return Math.round((ticks / TICKS_PER_SECOND) * 10) / 10;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
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

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}
