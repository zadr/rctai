#!/usr/bin/env node
import { parseRenderArgs, renderPark } from "./orchestrator.js";

async function main(): Promise<void> {
  const parsed = parseRenderArgs(process.argv.slice(2));
  const result = await renderPark(parsed.options);

  process.stdout.write(`wrote ${result.artifacts.outPath}\n`);
  process.stdout.write(`wrote ${result.artifacts.svgPath}\n`);

  if (result.artifacts.pngPath !== undefined) {
    process.stdout.write(`wrote ${result.artifacts.pngPath}\n`);
  }

  process.stdout.write(`rides ${result.parkPlan.rides.length}\n`);

  if (result.builderPost !== undefined) {
    process.stdout.write(`posted ${result.builderPost.url} (${result.builderPost.status})\n`);
  }

  for (const note of result.specChangeNotes) {
    process.stdout.write(`SPEC-CHANGE: ${note}\n`);
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
