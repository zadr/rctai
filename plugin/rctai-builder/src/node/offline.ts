#!/usr/bin/env node

import { loadAndValidatePlan } from "./validate.js";

await import(new URL("../rctai-builder.js", import.meta.url).href);

const args = process.argv.slice(2);
const planIndex = args.indexOf("--plan");

if (planIndex < 0 || args[planIndex + 1] === undefined) {
  process.stderr.write("usage: rctai-builder-offline --plan <file>\n");
  process.exitCode = 2;
} else {
  const planPath = args[planIndex + 1];
  if (planPath === undefined) {
    throw new Error("--plan requires a file path");
  }
  const plan = loadAndValidatePlan(planPath);
  const result = RctaiBuilder.runOfflinePlan(plan);
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        actions: result.actions.length,
        status: result.status
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
}
