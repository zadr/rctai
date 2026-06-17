import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";
import { classifyWorkModel } from "../src/classifier.js";
import { findRepoRoot, loadAndValidateWorkModel, loadRideProfiles } from "../src/io.js";
import type { PullRequestWork, WorkCategory, WorkModel } from "../src/types.js";

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

test("normalizes large batches across the ride distribution", () => {
  const distributionModel = workModelWithPrs(
    Array.from({ length: 32 }, (_, index) =>
      makePr(index, {
        feature: 1
      })
    )
  );
  const rides = classifyWorkModel(distributionModel, { rideProfiles });
  const families = new Set(rides.map((ride) => ride.family));

  ok(families.has("gentle"), "lowest-ranked feature work should not all become coasters");
  ok(families.has("coaster:compact"));
  ok(families.has("coaster:mid"));
  ok(families.has("coaster:mega"));
  ok(families.size >= 4);
});

test("maps the most low-code work in a large batch to stalls by relative distribution", () => {
  const prs = [
    ...Array.from({ length: 18 }, (_, index) =>
      makePr(index, {
        feature: 1
      })
    ),
    makePr(18, {
      feature: 0.5,
      chore: 0.5
    }),
    makePr(19, {
      feature: 0.5,
      docs: 0.5
    })
  ];
  const ridesById = Object.fromEntries(classifyWorkModel(workModelWithPrs(prs), { rideProfiles }).map((ride) => [ride.id, ride]));

  equal(ridesById["DIST-018"]?.family, "stall");
  equal(ridesById["DIST-019"]?.family, "stall");
});

test("does not repeat a PR label in ride signs when the title already has one", () => {
  const model = workModelWithPrs([
    {
      ...makePr(151763, {
        feature: 1
      }),
      id: "SES-024",
      number: 151763,
      title: "PR #151763: Update local command caveat"
    }
  ]);
  const [ride] = classifyWorkModel(model, { rideProfiles });

  equal(ride?.sign, "PR #151763 - Update local command caveat (agent)");
});

function workModelWithPrs(prs: PullRequestWork[]): WorkModel {
  return {
    schemaVersion: 1,
    repo: { name: "distribution-fixture" },
    branch: "main",
    generatedAt: "2026-06-16T12:00:00Z",
    prs
  };
}

function makePr(index: number, categories: Partial<Record<WorkCategory, number>>): PullRequestWork {
  return {
    id: `DIST-${String(index).padStart(3, "0")}`,
    number: index,
    title: `Distribution work ${index}`,
    author: "agent",
    state: "merged",
    commits: 2,
    filesChanged: 4,
    newFiles: 0,
    additions: 120,
    deletions: 80,
    languages: { typescript: 200 },
    categories,
    signals: {
      touchesTests: true,
      touchesConfig: false,
      touchesDocs: categories.docs !== undefined,
      codeTouchedNoTests: false,
      hasRevert: false,
      forcePush: false,
      netDeletion: false,
      hotFiles: [],
      reviewCount: 2,
      approvals: 1
    },
    session: null
  };
}
