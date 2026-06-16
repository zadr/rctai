#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { generateTracks } from "./generator.js";
import { findRepoRoot, readJsonFile, resolveInputPath } from "./profiles.js";
import type { ParkPlan, TrackgenInput } from "./types.js";
import { validateParkPlan } from "./validate.js";

interface CliArgs {
  inputPath: string;
  outputPath?: string;
  metadataPath?: string;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = findRepoRoot();
  const inputPath = resolveInputPath(args.inputPath, repoRoot);
  const input = readJsonFile(inputPath);
  const isPlan = isParkPlan(input);
  const trackgenInput = isPlan ? validateParkPlan(input, repoRoot) : validateRideArray(input);
  const result = generateTracks(trackgenInput, { repoRoot });

  if (isParkPlan(result.output)) {
    validateParkPlan(result.output, repoRoot);
  }

  const outputText = `${JSON.stringify(result.output, null, 2)}\n`;

  if (args.outputPath === undefined) {
    process.stdout.write(outputText);
  } else {
    writeJson(args.outputPath, outputText);
    process.stdout.write(`wrote ${resolve(process.cwd(), args.outputPath)}\n`);
  }

  if (args.metadataPath !== undefined) {
    writeJson(
      args.metadataPath,
      `${JSON.stringify({ metadata: result.metadata, specChangeNotes: result.specChangeNotes }, null, 2)}\n`
    );
    process.stdout.write(`wrote ${resolve(process.cwd(), args.metadataPath)}\n`);
  }
}

function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = [];
  let metadataPath: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--metadata") {
      const value = argv[index + 1];

      if (value === undefined) {
        throw new Error("--metadata requires a path");
      }

      metadataPath = value;
      index += 1;
      continue;
    }

    if (arg !== undefined) {
      positional.push(arg);
    }
  }

  const inputPath = positional[0];

  if (inputPath === undefined || positional.length > 2) {
    throw new Error("usage: npm run trackgen -- <rides-or-park-plan.json> [output.json] [--metadata metadata.json]");
  }

  const parsed: CliArgs = { inputPath };
  const outputPath = positional[1];

  if (outputPath !== undefined) {
    parsed.outputPath = outputPath;
  }

  if (metadataPath !== undefined) {
    parsed.metadataPath = metadataPath;
  }

  return parsed;
}

function validateRideArray(input: unknown): TrackgenInput {
  if (!Array.isArray(input) || !input.every(isRideLike)) {
    throw new Error("Input must be a park-plan object or an array of classifier ride objects");
  }

  return input;
}

function isParkPlan(value: unknown): value is ParkPlan {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    isRecord(value.park) &&
    Array.isArray(value.rides)
  );
}

function isRideLike(value: unknown): boolean {
  return isRecord(value) && typeof value.id === "string" && typeof value.rideType === "string";
}

function writeJson(path: string, text: string): void {
  const outputPath = resolve(process.cwd(), path);
  const outputDirectory = dirname(outputPath);

  mkdirSync(outputDirectory, { recursive: true });

  writeFileSync(outputPath, text, "utf8");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

try {
  main();
} catch (error: unknown) {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
}
