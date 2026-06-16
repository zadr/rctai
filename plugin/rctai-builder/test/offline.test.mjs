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
