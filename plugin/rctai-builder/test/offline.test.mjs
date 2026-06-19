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
  const parkOpenIndex = result.actions.findIndex((action) => action.action === "parksetparameter");
  const openRideIndices = result.actions
    .map((action, index) => ({ action, index }))
    .filter((entry) => entry.action.action === "ridesetstatus");
  const expectedOpenCount = plan.rides.filter(
    (ride) => !Array.isArray(ride.track) || !ride.track.some((segment) => segment.raw === true)
  ).length;

  assert.equal(result.status.failedActions, 0);
  assert.equal(openRideIndices.length, expectedOpenCount);
  assert.ok(pathIndex >= 0);
  assert.ok(parkOpenIndex >= 0);
  assert.deepEqual(result.actions[parkOpenIndex]?.args, { parameter: 1, value: 0 });
  for (const entry of openRideIndices) {
    assert.ok(entry.index > pathIndex);
    assert.equal(entry.action.args.status, 1);
    assert.ok(entry.index < parkOpenIndex);
  }
});

test("offline build leaves the park open for guests", () => {
  const plan = JSON.parse(readFileSync("../../fixtures/sample.park-plan.json", "utf8"));
  const adapter = new RctaiBuilder.FakeGameAdapter();
  const controller = new RctaiBuilder.BuildController(adapter);
  controller.enqueueBuild(plan);
  const status = controller.runUntilIdle();

  assert.equal(status.failedActions, 0);
  assert.equal(adapter.inspectPark().isOpen, true);
});

test("offline build limits generated track rides to one train before opening", () => {
  const plan = JSON.parse(readFileSync("../../fixtures/sample.park-plan.json", "utf8"));
  const result = RctaiBuilder.runOfflinePlan(plan);
  const expectedTrainLimited = plan.rides.filter(
    (ride) => Array.isArray(ride.track) && ride.track.length > 0 && !ride.track.some((segment) => segment.raw === true)
  ).length;
  const vehicleActions = result.actions
    .map((action, index) => ({ action, index }))
    .filter((entry) => entry.action.action === "ridesetvehicle");

  assert.equal(result.status.failedActions, 0);
  assert.equal(vehicleActions.length, expectedTrainLimited);
  for (const entry of vehicleActions) {
    const openIndex = result.actions.findIndex(
      (action) => action.action === "ridesetstatus" && action.args.ride === entry.action.args.ride
    );
    assert.ok(openIndex >= 0);
    assert.ok(entry.index < openIndex);
    assert.deepEqual(
      { type: entry.action.args.type, value: entry.action.args.value, colour: entry.action.args.colour },
      { type: 0, value: 1, colour: 0 }
    );
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
    [16, 16, 16, 16, 32, 48, 48]
  );
});

test("offline build smooths terrain-induced path z valleys", () => {
  class BumpyTerrainAdapter extends RctaiBuilder.FakeGameAdapter {
    getSurfaceZ(x, y) {
      if (y !== 20) {
        return null;
      }
      if (x === 18) {
        return 256;
      }
      if (x === 19) {
        return 240;
      }
      return null;
    }
  }

  const plan = {
    schemaVersion: 1,
    park: {
      name: "path valley smoothing",
      size: { width: 64, height: 64 },
      entrance: { x: 10, y: 20, z: 208, direction: 2 }
    },
    rides: [
      {
        id: "ride-high",
        name: "High Ride",
        archetype: "transport",
        rideType: "miniature_railway",
        footprint: { w: 3, h: 3 },
        position: { x: 22, y: 20 },
        rotation: 2,
        track: [{ type: 1, x: 0, y: 0, z: 304, direction: 2 }]
      }
    ],
    paths: [
      {
        from: "entrance",
        to: "ride-high",
        waypoints: Array.from({ length: 13 }, (_value, index) => ({ x: 10 + index, y: 20 }))
      }
    ],
    scenery: []
  };

  const adapter = new BumpyTerrainAdapter();
  const controller = new RctaiBuilder.BuildController(adapter);
  controller.enqueueBuild(plan);
  const status = controller.runUntilIdle();

  assert.equal(status.failedActions, 0);

  const zValues = adapter.actions.filter((action) => action.action === "footpathplace").map((action) => action.args.z);
  assert.equal(adapter.inspectPark().rides.length, 1);
  for (let index = 1; index < zValues.length - 1; index += 1) {
    assert.ok(
      !(zValues[index] < zValues[index - 1] && zValues[index] < zValues[index + 1]),
      `unexpected one-tile path z valley: ${zValues.join(",")}`
    );
  }
});

test("offline build keeps raised path junctions flat and walkable", () => {
  class RaisedJunctionAdapter extends RctaiBuilder.FakeGameAdapter {
    getSurfaceZ(x, y) {
      if (x === 16 && y === 30) {
        return 224;
      }
      return null;
    }
  }

  const mainPath = Array.from({ length: 11 }, (_value, index) => ({ x: 10 + index, y: 30 }));
  const branchPath = Array.from({ length: 6 }, (_value, index) => ({ x: 15, y: 30 + index }));
  const plan = {
    schemaVersion: 1,
    park: {
      name: "path junction ramp",
      size: { width: 64, height: 64 },
      entrance: { x: 10, y: 30, z: 208, direction: 2 }
    },
    rides: [],
    paths: [
      {
        from: "entrance",
        to: "main-path",
        waypoints: mainPath
      },
      {
        from: "branch",
        to: "branch-end",
        waypoints: branchPath
      }
    ],
    scenery: []
  };

  const adapter = new RaisedJunctionAdapter();
  const controller = new RctaiBuilder.BuildController(adapter);
  controller.enqueueBuild(plan);
  const status = controller.runUntilIdle();

  assert.equal(status.failedActions, 0);

  const pathTiles = adapter.actions
    .filter((action) => action.action === "footpathplace")
    .map((action) => footpathActionTile(action));
  const tilesByCoord = new Map(pathTiles.map((tile) => [`${tile.x},${tile.y}`, tile]));
  const junction = tilesByCoord.get("15,30");

  assert.equal(junction?.slopeType, 0);
  assertPlanPathIsWalkable(mainPath, tilesByCoord);
  assertPlanPathIsWalkable(branchPath, tilesByCoord);
});

function footpathActionTile(action) {
  return {
    x: action.args.x / 32,
    y: action.args.y / 32,
    z: action.args.z,
    slopeType: action.args.slopeType,
    slopeDirection: action.args.slopeDirection
  };
}

function assertPlanPathIsWalkable(coords, tilesByCoord) {
  for (let index = 0; index < coords.length - 1; index += 1) {
    const fromCoord = coords[index];
    const toCoord = coords[index + 1];
    const from = tilesByCoord.get(`${fromCoord.x},${fromCoord.y}`);
    const to = tilesByCoord.get(`${toCoord.x},${toCoord.y}`);
    assert.ok(from, `missing path tile ${fromCoord.x},${fromCoord.y}`);
    assert.ok(to, `missing path tile ${toCoord.x},${toCoord.y}`);
    const direction = footpathDirection(fromCoord, toCoord);
    assert.equal(
      footpathEdgeZ(from, direction),
      footpathEdgeZ(to, normalizeTestDirection(direction + 2)),
      `unwalkable path edge ${fromCoord.x},${fromCoord.y} -> ${toCoord.x},${toCoord.y}`
    );
  }
}

function footpathEdgeZ(tile, direction) {
  if (tile.slopeType !== 1) {
    return tile.z;
  }
  return normalizeTestDirection(tile.slopeDirection) === normalizeTestDirection(direction) ? tile.z + 16 : tile.z;
}

function footpathDirection(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === -1 && dy === 0) {
    return 0;
  }
  if (dx === 0 && dy === 1) {
    return 1;
  }
  if (dx === 1 && dy === 0) {
    return 2;
  }
  if (dx === 0 && dy === -1) {
    return 3;
  }
  throw new Error(`non-adjacent test path coords: ${from.x},${from.y} -> ${to.x},${to.y}`);
}

function normalizeTestDirection(direction) {
  return ((direction % 4) + 4) % 4;
}
