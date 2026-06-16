#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { renderParkPlanToSvg } from "./renderer.js";
import { readAndValidateParkPlan } from "./validate.js";

async function main(): Promise<void> {
  const inputArg = process.argv[2];
  const svgArg = process.argv[3];
  const pngArg = process.argv[4];

  if (!inputArg || !svgArg) {
    process.stderr.write("usage: npm run render -- <park-plan.json> <preview.svg> [preview.png]\n");
    process.exitCode = 2;
    return;
  }

  const inputPath = resolve(process.cwd(), inputArg);
  const svgPath = resolve(process.cwd(), svgArg);
  const pngPath = pngArg ? resolve(process.cwd(), pngArg) : undefined;
  const plan = await readAndValidateParkPlan(inputPath);
  const svg = renderParkPlanToSvg(plan);

  await mkdir(dirname(svgPath), { recursive: true });
  await writeFile(svgPath, svg, "utf8");
  process.stdout.write(`wrote ${svgPath}\n`);

  if (pngPath) {
    await mkdir(dirname(pngPath), { recursive: true });
    convertSvgToPng(svgPath, pngPath);
    process.stdout.write(`wrote ${pngPath}\n`);
  }
}

function convertSvgToPng(svgPath: string, pngPath: string): void {
  const attempts = [
    { command: "rsvg-convert", args: ["-o", pngPath, svgPath] },
    { command: "convert", args: [svgPath, pngPath] }
  ];
  const failures: string[] = [];

  for (const attempt of attempts) {
    const result = spawnSync(attempt.command, attempt.args, { encoding: "utf8", stdio: "pipe" });
    if (result.status === 0) {
      return;
    }

    const detail = result.error?.message ?? result.stderr.trim() ?? `exit ${result.status ?? "unknown"}`;
    failures.push(`${attempt.command}: ${detail}`);
  }

  throw new Error(`PNG conversion failed. Install rsvg-convert or ImageMagick convert. ${failures.join("; ")}`);
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
