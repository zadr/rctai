#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import { extractWorkModel } from "./extractor.js";
import type { ExtractOptions } from "./types.js";

interface CliArgs {
  repoPath: string;
  branch: string;
  outputPath?: string;
  generatedAt?: string;
  sessionsRoot?: string;
  includeSessions: boolean;
  pretty: boolean;
  authors?: string[];
  before?: string;
  after?: string;
  is?: string[];
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const options: ExtractOptions = {
    repoPath: resolveCliPath(args.repoPath),
    branch: args.branch,
    includeSessions: args.includeSessions,
    ...(args.generatedAt === undefined ? {} : { generatedAt: args.generatedAt }),
    ...(args.sessionsRoot === undefined ? {} : { sessionsRoot: resolveCliPath(args.sessionsRoot) }),
    ...(args.authors === undefined ? {} : { authors: args.authors }),
    ...(args.before === undefined ? {} : { before: args.before }),
    ...(args.after === undefined ? {} : { after: args.after }),
    ...(args.is === undefined ? {} : { is: args.is })
  };
  const workModel = extractWorkModel(options);
  const json = `${JSON.stringify(workModel, null, args.pretty ? 2 : 0)}\n`;

  if (args.outputPath === undefined) {
    process.stdout.write(json);
    return;
  }

  const outputPath = resolveCliPath(args.outputPath);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, json, "utf8");
  process.stdout.write(`wrote ${outputPath}\n`);
}

function parseArgs(argv: string[]): CliArgs {
  let repoPath: string | undefined;
  let branch: string | undefined;
  let outputPath: string | undefined;
  let generatedAt: string | undefined;
  let sessionsRoot: string | undefined;
  const authors: string[] = [];
  const isFilters: string[] = [];
  let before: string | undefined;
  let after: string | undefined;
  let includeSessions = true;
  let pretty = true;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === undefined) {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (arg === "--out") {
      outputPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--generated-at") {
      generatedAt = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--sessions-root") {
      sessionsRoot = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--author") {
      authors.push(...parseListValue(readOptionValue(argv, index, arg)));
      index += 1;
      continue;
    }

    if (arg === "--before") {
      before = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--after") {
      after = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--is") {
      isFilters.push(...parseListValue(readOptionValue(argv, index, arg)));
      index += 1;
      continue;
    }

    if (arg === "--no-sessions") {
      includeSessions = false;
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

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (repoPath === undefined) {
      repoPath = arg;
      continue;
    }

    if (branch === undefined) {
      branch = arg;
      continue;
    }

    throw new Error(`Unexpected positional argument: ${arg}`);
  }

  if (repoPath === undefined || branch === undefined) {
    throw new Error("Missing required <repo-path> and <branch> arguments");
  }

  return {
    repoPath,
    branch,
    includeSessions,
    pretty,
    ...(outputPath === undefined ? {} : { outputPath }),
    ...(generatedAt === undefined ? {} : { generatedAt }),
    ...(sessionsRoot === undefined ? {} : { sessionsRoot }),
    ...(authors.length === 0 ? {} : { authors: unique(authors) }),
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
    ...(isFilters.length === 0 ? {} : { is: unique(isFilters) })
  };
}

function parseListValue(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function readOptionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function resolveCliPath(path: string): string {
  if (isAbsolute(path)) {
    return path;
  }

  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

function usage(): void {
  process.stdout.write(
    "usage: rctai-extract <repo-path> <branch> [--out work-model.json] [--generated-at ISO] [--sessions-root dir] [--author USER[,USER...]] [--before DATE] [--after DATE] [--is open|closed|merged] [--no-sessions] [--pretty|--compact]\n"
  );
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
  process.stderr.write(`${formatError(error)}\n`);
  process.exitCode = 1;
});
