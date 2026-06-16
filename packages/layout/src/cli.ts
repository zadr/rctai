#!/usr/bin/env node
import { writeFileSync } from "node:fs";

import { findRepoRoot, readJsonFile, resolveInputPath } from "./io.js";
import { layoutRides } from "./layout.js";
import { assertValidLayout, validateParkPlanSchema } from "./validation.js";
import type { ClassifiedRide, LayoutOptions, WorkModelMinimal } from "./types.js";

interface CliArgs {
  inputPath: string;
  outputPath?: string;
  workModelPath?: string;
  parkName?: string;
  baseScenario?: string | null;
  pretty: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let workModelPath: string | undefined;
  let parkName: string | undefined;
  let baseScenario: string | null | undefined;
  let pretty = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--out") {
      outputPath = requiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--work-model") {
      workModelPath = requiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--name") {
      parkName = requiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--base-scenario") {
      baseScenario = requiredValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--no-base-scenario") {
      baseScenario = null;
      continue;
    }

    if (arg === "--compact") {
      pretty = false;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg !== undefined && arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (inputPath !== undefined) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }

    inputPath = arg;
  }

  if (inputPath === undefined) {
    throw new Error("Missing classified rides input path");
  }

  const result: CliArgs = {
    inputPath,
    pretty
  };

  if (outputPath !== undefined) {
    result.outputPath = outputPath;
  }

  if (workModelPath !== undefined) {
    result.workModelPath = workModelPath;
  }

  if (parkName !== undefined) {
    result.parkName = parkName;
  }

  if (baseScenario !== undefined) {
    result.baseScenario = baseScenario;
  }

  return result;
}

function requiredValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function usage(): void {
  console.log(
    "usage: rctai-layout <classified-rides.json> [--work-model work-model.json] [--out park-plan.json] [--name NAME] [--pretty|--compact]"
  );
}

function main(): void {
  try {
    const args = parseArgs(process.argv);
    const repoRoot = findRepoRoot();
    const input = readJsonFile(resolveInputPath(args.inputPath, repoRoot));
    const rides = extractRides(input);
    const embeddedWorkModel = extractEmbeddedWorkModel(input);
    const options: LayoutOptions = {};

    if (args.workModelPath !== undefined) {
      options.workModel = readJsonFile(resolveInputPath(args.workModelPath, repoRoot)) as WorkModelMinimal;
    } else if (embeddedWorkModel !== undefined) {
      options.workModel = embeddedWorkModel;
    }

    if (args.parkName !== undefined) {
      options.parkName = args.parkName;
    }

    if (args.baseScenario !== undefined) {
      options.baseScenario = args.baseScenario;
    }

    const plan = layoutRides(rides, options);
    validateParkPlanSchema(plan, repoRoot);
    assertValidLayout(plan);

    const json = `${JSON.stringify(plan, null, args.pretty ? 2 : 0)}\n`;

    if (args.outputPath !== undefined) {
      writeFileSync(resolveInputPath(args.outputPath, repoRoot), json, "utf8");
      return;
    }

    process.stdout.write(json);
  } catch (error) {
    process.stderr.write(`${formatError(error)}\n`);
    process.exit(1);
  }
}

function extractRides(value: unknown): ClassifiedRide[] {
  if (Array.isArray(value)) {
    return value as ClassifiedRide[];
  }

  if (isRecord(value) && Array.isArray(value.rides)) {
    return value.rides as ClassifiedRide[];
  }

  throw new Error(
    "Input must be a classified rides array, or an object with a classified rides array at .rides"
  );
}

function extractEmbeddedWorkModel(value: unknown): WorkModelMinimal | undefined {
  if (isRecord(value) && isRecord(value.workModel)) {
    return value.workModel as WorkModelMinimal;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main();
