import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

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
