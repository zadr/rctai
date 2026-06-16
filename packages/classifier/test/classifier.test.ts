import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { classifyWorkModel } from "../src/classifier.js";
import { findRepoRoot, loadAndValidateWorkModel, loadRideProfiles } from "../src/io.js";

const repoRoot = findRepoRoot();
const workModel = loadAndValidateWorkModel(`${repoRoot}/fixtures/sample.work-model.json`, repoRoot);
const rideProfiles = loadRideProfiles(repoRoot);

test("classifies the sample work model deterministically", () => {
  const first = classifyWorkModel(workModel, { rideProfiles });
  const second = classifyWorkModel(workModel, { rideProfiles });

  deepEqual(first, second);
  equal(first.length, 5);
});

test("emits pre-layout ride objects only", () => {
  const rides = classifyWorkModel(workModel, { rideProfiles });

  for (const ride of rides) {
    ok(!("position" in ride), `${ride.id} should not include layout position`);
    ok(!("rotation" in ride), `${ride.id} should not include layout rotation`);
    ok(ride.buildOut.rideProfile === ride.rideType);
  }
});

test("matches the sample classification expectations", () => {
  const ridesById = Object.fromEntries(classifyWorkModel(workModel, { rideProfiles }).map((ride) => [ride.id, ride]));
  const pr101 = ridesById["PR-101"];
  const pr102 = ridesById["PR-102"];
  const pr103 = ridesById["PR-103"];
  const pr104 = ridesById["PR-104"];
  const pr105 = ridesById["PR-105"];

  ok(pr101);
  equal(pr101.family, "gentle");
  equal(pr101.archetype, "gentle_micro");

  ok(pr102);
  equal(pr102.family, "coaster:mega");
  equal(pr102.archetype, "mega_coaster");
  equal(pr102.buildOut.isCoaster, true);

  ok(pr103);
  equal(pr103.family, "thrill");
  equal(pr103.archetype, "drop_thrill");
  equal(pr103.buildOut.isTower, true);

  ok(pr104);
  equal(pr104.family, "coaster:mega");
  equal(pr104.archetype, "mega_coaster");
  equal(pr104.rideType, "giga_rc");

  ok(pr105);
  equal(pr105.family, "stall");
  equal(pr105.archetype, "stall");
  equal(pr105.rideType, "cash_machine");
});
