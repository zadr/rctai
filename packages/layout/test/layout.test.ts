import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { layoutRides } from "../src/layout.js";
import { findRepoRoot } from "../src/io.js";
import {
  assertValidLayout,
  inspectLayout,
  validateParkPlanSchema
} from "../src/validation.js";
import type { ClassifiedRide, WorkModelMinimal } from "../src/types.js";

const repoRoot = findRepoRoot();

const workModel: WorkModelMinimal = {
  repo: { name: "register" },
  prs: [
    { id: "PR-101", mergedAt: "2026-05-01T10:30:00Z" },
    { id: "PR-102", mergedAt: "2026-05-05T17:00:00Z" },
    { id: "PR-103", mergedAt: "2026-05-06T23:10:00Z" },
    { id: "PR-104", mergedAt: "2026-05-12T18:00:00Z" },
    { id: "PR-105", mergedAt: "2026-05-13T11:00:00Z" }
  ]
};

const sampleRides: ClassifiedRide[] = [
  ride("PR-104", "Settlement engine rewrite", "mega_coaster", "giga_rc", 16, 12, 0.97),
  ride("PR-102", "Caching layer", "mega_coaster", "looping_rc", 15, 11, 0.772),
  ride("PR-101", "Bump deps and fix lint", "gentle_micro", "maze", 2, 2, 0.208),
  ride("PR-105", "Docs update", "stall", "cash_machine", 1, 1, 0.254),
  ride("PR-103", "Hotfix legacy import", "drop_thrill", "launched_freefall", 3, 3, 0.21)
];

test("lays out rides in chronological merge order", () => {
  const plan = layoutRides(sampleRides, { workModel });

  deepEqual(
    plan.rides.map((ride) => ride.id),
    ["PR-101", "PR-102", "PR-103", "PR-104", "PR-105"]
  );
  equal(plan.park.name, "rctai: register");
  equal(plan.paths[0]?.from, "entrance");
  equal(plan.paths[0]?.to, "PR-101");
  equal(plan.paths[4]?.from, "PR-104");
  equal(plan.paths[4]?.to, "PR-105");
});

test("produces deterministic byte-stable output for the same input", () => {
  const first = JSON.stringify(layoutRides(sampleRides, { workModel }));
  const second = JSON.stringify(layoutRides(sampleRides, { workModel }));

  equal(first, second);
});

test("creates schema-valid and layout-valid park plans", () => {
  const plan = layoutRides(sampleRides, { workModel });
  const inspection = inspectLayout(plan);

  validateParkPlanSchema(plan, repoRoot);
  assertValidLayout(plan);
  deepEqual(inspection.overlaps, []);
  deepEqual(inspection.disconnectedRideIds, []);
  deepEqual(inspection.invalidPathRefs, []);
  deepEqual(inspection.outOfBoundsRideIds, []);
  ok(plan.park.size.width >= 16);
  ok(plan.park.size.height >= 16);
});

test("preserves classifier ride fields while adding layout fields", () => {
  const plan = layoutRides(sampleRides, { workModel });
  const pr102 = plan.rides.find((candidate) => candidate.id === "PR-102");

  ok(pr102);
  equal(pr102.family, "coaster:mega");
  equal(pr102.buildOut, "preserved");
  ok(pr102.position.x > 0);
  ok(pr102.position.y > 0);
  equal(pr102.rotation, 0);
});

function ride(
  id: string,
  name: string,
  archetype: ClassifiedRide["archetype"],
  rideType: string,
  w: number,
  h: number,
  size: number
): ClassifiedRide {
  return {
    id,
    name,
    archetype,
    family: archetype === "stall" ? "stall" : "coaster:mega",
    rideType,
    rideObject: null,
    footprint: { w, h },
    colours: { main: 1, additional: 2, support: 3, track: 4 },
    intensity: { excitement: 1, intensity: 2, nausea: 3 },
    sign: id,
    axes: { size, adventure: 0.5, risk: 0.5 },
    buildOut: "preserved",
    track: null
  };
}
