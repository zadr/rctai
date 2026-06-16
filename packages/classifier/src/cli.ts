import { writeFileSync } from "node:fs";
import { classifyWorkModel } from "./classifier.js";
import { findRepoRoot, loadAndValidateWorkModel, loadRideProfiles, resolveInputPath } from "./io.js";

interface CliArgs {
  inputPath: string;
  outputPath?: string;
  pretty: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let pretty = true;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--out") {
      outputPath = args[index + 1];
      index += 1;
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
    throw new Error("Missing input work-model path");
  }

  if (outputPath === undefined) {
    return { inputPath, pretty };
  }

  return { inputPath, outputPath, pretty };
}

function usage(): void {
  console.log("usage: rctai-classifier <work-model.json> [--out rides.json] [--pretty|--compact]");
}

function main(): void {
  try {
    const args = parseArgs(process.argv);
    const repoRoot = findRepoRoot();
    const inputPath = resolveInputPath(args.inputPath, repoRoot);
    const workModel = loadAndValidateWorkModel(inputPath, repoRoot);
    const rideProfiles = loadRideProfiles(repoRoot);
    const rides = classifyWorkModel(workModel, { rideProfiles });
    const json = `${JSON.stringify(rides, null, args.pretty ? 2 : 0)}\n`;

    if (args.outputPath !== undefined) {
      writeFileSync(resolveInputPath(args.outputPath, repoRoot), json, "utf8");
      return;
    }

    process.stdout.write(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}

main();
