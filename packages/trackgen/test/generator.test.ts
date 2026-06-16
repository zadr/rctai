import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  INVERSION_ELEMENT_IDS,
  TrackElemType,
  generateTracksForParkPlan,
  generateTracksForRides,
  findRepoRoot,
  loadRideProfiles,
  readJsonFile,
  validateParkPlan
} from "../src/index.js";
import type { ParkPlan, RideProfile, RideProfilesFile, RideTrackMetadata, TrackgenRide } from "../src/index.js";

const repoRoot = findRepoRoot();
const rideProfiles = loadRideProfiles(repoRoot);

test("generates schema-valid tracks for the fixture park plan", () => {
  const plan = validateParkPlan(readJsonFile(`${repoRoot}/fixtures/sample.park-plan.json`), repoRoot);
  const generated = generateTracksForParkPlan(plan, { rideProfiles });
  const validated = validateParkPlan(generated.output, repoRoot);
  const coaster102 = rideById(validated, "PR-102");
  const coaster104 = rideById(validated, "PR-104");
  const metadata102 = metadataById(generated.metadata, "PR-102");
  const metadata104 = metadataById(generated.metadata, "PR-104");

  ok(Array.isArray(coaster102.track));
  ok(Array.isArray(coaster104.track));
  equal(coaster102.track[0]?.type, TrackElemType.beginStation);
  equal(coaster102.track.at(-1)?.type, TrackElemType.beginStation);
  equal(coaster104.track[0]?.type, TrackElemType.beginStation);
  equal(coaster104.track.at(-1)?.type, TrackElemType.beginStation);
  equal(metadata102.kind, "coaster");
  ok(coaster104.track.length > coaster102.track.length, "larger fixture coaster should receive a longer track");
  equal(metadata104.resolvedRideType, "giga_rc");
  equal(rideById(validated, "PR-103").track, null);
  ok(metadataById(generated.metadata, "PR-103").towerHeight !== undefined);
  ok(generated.specChangeNotes.length > 0);
});

test("coaster budgets scale with size, adventure, and risk", () => {
  const small = makeRide("small", "corkscrew_rc", { size: 0.2, adventure: 0.2, risk: 0.2 });
  const large = makeRide("large", "corkscrew_rc", { size: 0.92, adventure: 0.95, risk: 0.86 });
  const generated = generateTracksForRides([small, large], { rideProfiles });
  const smallRide = generated.output[0];
  const largeRide = generated.output[1];
  const smallMetadata = metadataById(generated.metadata, "small");
  const largeMetadata = metadataById(generated.metadata, "large");

  ok(Array.isArray(smallRide?.track));
  ok(Array.isArray(largeRide?.track));
  ok(largeRide.track.length > smallRide.track.length);
  ok((largeMetadata.stationLength ?? 0) > (smallMetadata.stationLength ?? 0));
  ok((largeMetadata.liftHillSegments ?? 0) > (smallMetadata.liftHillSegments ?? 0));
  ok((largeMetadata.inversionBudget ?? 0) > (smallMetadata.inversionBudget ?? 0));
  equal(smallMetadata.firstDrop, "down25");
  equal(largeMetadata.firstDrop, "down90");
});

test("unsupported inversion groups are never emitted", () => {
  const mineTrain = makeRide("mine", "mine_train_rc", { size: 0.8, adventure: 1, risk: 0.6 });
  const generated = generateTracksForRides([mineTrain], { rideProfiles });
  const ride = generated.output[0];
  const metadata = metadataById(generated.metadata, "mine");

  ok(Array.isArray(ride?.track));
  equal(metadata.inversionBudget, 0);
  equal(metadata.inversionGroups?.length, 0);
  ok(!ride.track.some((segment) => INVERSION_ELEMENT_IDS.has(segment.type)));
});

test("water rides get closed station-rooted tracks without inversions", () => {
  const logFlume = makeRide("flume", "log_flume", { size: 0.72, adventure: 0.6, risk: 0.5 }, "water_flume");
  const generated = generateTracksForRides([logFlume], { rideProfiles });
  const ride = generated.output[0];
  const metadata = metadataById(generated.metadata, "flume");

  ok(Array.isArray(ride?.track));
  equal(metadata.kind, "water");
  equal(metadata.inversionBudget, 0);
  equal(ride.track[0]?.type, TrackElemType.beginStation);
  equal(ride.track.at(-1)?.type, TrackElemType.beginStation);
  ok(!ride.track.some((segment) => INVERSION_ELEMENT_IDS.has(segment.type)));
});

test("transport, tower, and flat rides keep track null with API metadata hints", () => {
  const generated = generateTracksForRides(
    [
      makeRide("transport", "chairlift", { size: 0.9, adventure: 0.2, risk: 0.2 }, "transport"),
      makeRide("tower", "launched_freefall", { size: 0.3, adventure: 0.5, risk: 0.9 }, "drop_thrill"),
      makeRide("flat", "maze", { size: 0.55, adventure: 0.1, risk: 0.1 }, "gentle_micro")
    ],
    { rideProfiles }
  );

  equal(generated.output[0]?.track, null);
  equal(generated.output[1]?.track, null);
  equal(generated.output[2]?.track, null);
  ok((metadataById(generated.metadata, "transport").transportLoopLength ?? 0) > 12);
  equal(metadataById(generated.metadata, "tower").towerMode, "launch-drop");
  ok(metadataById(generated.metadata, "tower").towerHeight !== undefined);
  ok(metadataById(generated.metadata, "flat").flatFootprintHint !== undefined);
  ok(generated.specChangeNotes.length > 0);
});

function makeRide(
  id: string,
  rideType: string,
  axes: { size: number; adventure: number; risk: number },
  archetype: TrackgenRide["archetype"] = "mega_coaster"
): TrackgenRide {
  const profile = profileByName(rideProfiles, rideType);

  return {
    id,
    name: id,
    archetype,
    family: familyForArchetype(archetype),
    rideType,
    rideObject: null,
    footprint: { w: 8, h: 6 },
    axes,
    buildOut: {
      rideProfile: profile.name,
      trackGroups: [...profile.trackGroups],
      isCoaster: profile.buildOut.isCoaster,
      isTower: profile.buildOut.isTower,
      inversions: [...profile.buildOut.inversions],
      helices: [...profile.buildOut.helices],
      steepDrops: [...profile.buildOut.steepDrops],
      banking: [...profile.buildOut.banking],
      supportsLiftHill: profile.buildOut.supportsLiftHill
    },
    track: null
  };
}

function familyForArchetype(archetype: TrackgenRide["archetype"]): NonNullable<TrackgenRide["family"]> {
  if (archetype === "water_flume") {
    return "water";
  }

  if (archetype === "transport") {
    return "transport";
  }

  if (archetype === "drop_thrill") {
    return "thrill";
  }

  if (archetype === "gentle_micro") {
    return "gentle";
  }

  return "coaster:mega";
}

function profileByName(profiles: RideProfilesFile, name: string): RideProfile {
  const profile = profiles.rides.find((candidate) => candidate.name === name);

  if (profile === undefined) {
    throw new Error(`Missing ride profile ${name}`);
  }

  return profile;
}

function rideById(plan: ParkPlan, id: string): TrackgenRide {
  const ride = plan.rides.find((candidate) => candidate.id === id);

  if (ride === undefined) {
    throw new Error(`Missing ride ${id}`);
  }

  return ride;
}

function metadataById(metadata: Record<string, RideTrackMetadata>, id: string): RideTrackMetadata {
  const value = metadata[id];

  if (value === undefined) {
    throw new Error(`Missing metadata ${id}`);
  }

  return value;
}
