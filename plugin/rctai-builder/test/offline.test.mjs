import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

/* global RctaiBuilder */

await import("../dist/rctai-builder.js");

test("offline --plan executes the sample park plan without throwing", () => {
  const result = spawnSync("node", ["dist/node/offline.js", "--plan", "../../fixtures/sample.park-plan.json"], {
    cwd: ".",
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.status.failedActions, 0);
  assert.equal(parsed.status.completedJobs, 1);
  assert.ok(parsed.actions > 0);
});

test("offline ridecreate actions use safe OpenRCT2 colour preset indices", () => {
  const plan = JSON.parse(readFileSync("../../fixtures/sample.park-plan.json", "utf8"));
  const result = RctaiBuilder.runOfflinePlan(plan);
  const rideCreates = result.actions.filter((action) => action.action === "ridecreate");
  assert.ok(rideCreates.length > 0);
  for (const action of rideCreates) {
    assert.equal(action.args.colour1, 0);
    assert.equal(action.args.colour2, 0);
  }
});

test("offline build opens every non-raw ride after constructing paths", () => {
  const plan = JSON.parse(readFileSync("../../fixtures/sample.park-plan.json", "utf8"));
  const result = RctaiBuilder.runOfflinePlan(plan);
  const pathIndex = result.actions.findIndex((action) => action.action === "footpathplace");
  const openRideIndices = result.actions
    .map((action, index) => ({ action, index }))
    .filter((entry) => entry.action.action === "ridesetstatus");
  const expectedOpenCount = plan.rides.filter(
    (ride) => !Array.isArray(ride.track) || !ride.track.some((segment) => segment.raw === true)
  ).length;

  assert.equal(result.status.failedActions, 0);
  assert.equal(openRideIndices.length, expectedOpenCount);
  assert.ok(pathIndex >= 0);
  for (const entry of openRideIndices) {
    assert.ok(entry.index > pathIndex);
    assert.equal(entry.action.args.status, 1);
  }
});

test("missing ride objects are critical build failures", () => {
  class MissingRideObjectAdapter extends RctaiBuilder.FakeGameAdapter {
    resolveRideObject(rideType, preferredObject) {
      if (rideType === "hybrid_rc") {
        return null;
      }
      return super.resolveRideObject(rideType, preferredObject);
    }
  }

  const plan = {
    schemaVersion: 1,
    park: {
      name: "missing object",
      size: { width: 64, height: 64 },
      entrance: { x: 10, y: 10, direction: 2 }
    },
    rides: [
      {
        id: "RID-1",
        name: "Missing Hybrid",
        archetype: "coaster",
        rideType: "hybrid_rc",
        footprint: { w: 3, h: 3 },
        position: { x: 15, y: 15 },
        track: [{ type: 2 }, { type: 1 }]
      }
    ],
    paths: [],
    scenery: []
  };

  const controller = new RctaiBuilder.BuildController(new MissingRideObjectAdapter());
  controller.enqueueBuild(plan);
  const status = controller.runUntilIdle();

  assert.equal(status.failedActions, 1);
  assert.equal(status.criticalFailedActions, 1);
  assert.match(status.failedActionDescriptions[0], /Ride object unavailable/);
});

test("offline build prepares sandbox and owned land before construction", () => {
  const plan = JSON.parse(readFileSync("../../fixtures/sample.park-plan.json", "utf8"));
  const result = RctaiBuilder.runOfflinePlan(plan);

  assert.equal(result.actions[0]?.action, "cheatset");
  assert.deepEqual(result.actions[0]?.args, { type: 0, param1: 1, param2: 0 });
  assert.ok(
    result.actions.some(
      (action) =>
        action.action === "cheatset" &&
        action.args.type === 17 &&
        action.args.param1 === 10_000_000 &&
        action.args.param2 === 0
    )
  );

  const landRights = result.actions.find((action) => action.action === "landsetrights");
  assert.deepEqual(landRights?.args, {
    x1: 0,
    y1: 0,
    x2: (plan.park.size.width - 1) * 32,
    y2: (plan.park.size.height - 1) * 32,
    setting: 4,
    ownership: 32
  });
});

test("offline build emits sloped paths between different anchor heights", () => {
  const plan = {
    schemaVersion: 1,
    park: {
      name: "path ramp",
      size: { width: 64, height: 64 },
      entrance: { x: 10, y: 10, z: 16, direction: 2 }
    },
    rides: [
      {
        id: "ride-high",
        name: "High Ride",
        archetype: "transport",
        rideType: "miniature_railway",
        footprint: { w: 3, h: 3 },
        position: { x: 16, y: 10 },
        rotation: 2,
        track: [{ type: 1, x: 0, y: 0, z: 48, direction: 2 }]
      }
    ],
    paths: [
      {
        from: "entrance",
        to: "ride-high",
        waypoints: [
          { x: 10, y: 10 },
          { x: 11, y: 10 },
          { x: 12, y: 10 },
          { x: 13, y: 10 },
          { x: 14, y: 10 },
          { x: 15, y: 10 },
          { x: 16, y: 10 }
        ]
      }
    ],
    scenery: []
  };

  const result = RctaiBuilder.runOfflinePlan(plan);
  const pathPlaces = result.actions.filter((action) => action.action === "footpathplace");
  const sloped = pathPlaces.filter((action) => action.args.slopeType === 1);

  assert.equal(result.status.failedActions, 0);
  assert.equal(sloped.length, 2);
  assert.deepEqual(
    pathPlaces.map((action) => action.args.z),
    [16, 16, 16, 16, 16, 32, 48]
  );
});
