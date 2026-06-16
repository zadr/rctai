import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { classifyWorkModel, loadRideProfiles as loadClassifierRideProfiles } from "../../classifier/src/index.js";
import { extractWorkModel } from "../../extractor/src/index.js";
import { assertValidLayout, layoutPark, validateParkPlanSchema } from "../../layout/src/index.js";
import { renderParkPlanToSvg } from "../../preview/src/index.js";
import {
  generateTracksForParkPlan,
  loadRideProfiles as loadTrackgenRideProfiles,
  validateParkPlan
} from "../../trackgen/src/index.js";

import type { WorkModel } from "../../extractor/src/index.js";
import type { ClassifiedRide } from "../../classifier/src/index.js";
import type { ClassifiedRide as LayoutClassifiedRide, ParkPlan as LayoutParkPlan } from "../../layout/src/index.js";
import type { ParkPlan as PreviewParkPlan } from "../../preview/src/index.js";
import type { ParkPlan, RideTrackMetadata } from "../../trackgen/src/index.js";

export interface RenderArtifacts {
  outPath: string;
  svgPath: string;
  pngPath?: string;
}

export interface RenderOptions {
  repoPath: string;
  branch: string;
  outPath?: string;
  pngPath?: string | null;
  svgPath?: string;
  generatedAt?: string;
  buildTarget?: string;
  includeSessions?: boolean;
  prLimit?: number;
  syntheticLimit?: number;
}

export interface CliRenderOptions extends RenderOptions {
  outPath: string;
  pngPath: string;
}

export interface BuildParkPlanResult {
  workModel: WorkModel;
  classifiedRides: ClassifiedRide[];
  laidOutPlan: LayoutParkPlan;
  parkPlan: ParkPlan;
  trackMetadata: Record<string, RideTrackMetadata>;
  specChangeNotes: string[];
}

export interface BuilderPostResult {
  url: string;
  status: number;
  body: string;
}

export interface RenderParkResult extends BuildParkPlanResult {
  artifacts: RenderArtifacts;
  builderPost?: BuilderPostResult;
}

export interface FetchLike {
  (
    input: string,
    init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    }
  ): Promise<FetchResponse>;
}

interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  text(): Promise<string>;
}

interface ParsedArgs {
  command: "render";
  options: CliRenderOptions;
}

const DEFAULT_OUT_PATH = "park-plan.json";
const DEFAULT_PNG_PATH = "preview.png";

export function buildParkPlan(options: RenderOptions): BuildParkPlanResult {
  const workModel = extractWorkModel({
    repoPath: options.repoPath,
    branch: options.branch,
    ...(options.generatedAt === undefined ? {} : { generatedAt: options.generatedAt }),
    ...(options.includeSessions === undefined ? {} : { includeSessions: options.includeSessions }),
    ...(options.prLimit === undefined ? {} : { prLimit: options.prLimit }),
    ...(options.syntheticLimit === undefined ? {} : { syntheticLimit: options.syntheticLimit })
  });
  const classifierProfiles = loadClassifierRideProfiles();
  const classifiedRides = classifyWorkModel(workModel, { rideProfiles: classifierProfiles });
  const layoutRides = classifiedRides as unknown as LayoutClassifiedRide[];
  const laidOutPlan = layoutPark({ rides: layoutRides, workModel });

  validateParkPlanSchema(laidOutPlan);
  assertValidLayout(laidOutPlan);

  const trackgenProfiles = loadTrackgenRideProfiles();
  const generated = generateTracksForParkPlan(laidOutPlan, { rideProfiles: trackgenProfiles });
  const parkPlan = validateParkPlan(generated.output);

  validateParkPlanSchema(parkPlan);
  assertValidLayout(parkPlan as unknown as LayoutParkPlan);

  return {
    workModel,
    classifiedRides,
    laidOutPlan,
    parkPlan,
    trackMetadata: generated.metadata,
    specChangeNotes: generated.specChangeNotes
  };
}

export async function renderPark(
  options: RenderOptions,
  fetchImpl: FetchLike = fetch
): Promise<RenderParkResult> {
  const artifacts = defaultArtifacts(options);
  const built = buildParkPlan(options);
  const planJson = stableJson(built.parkPlan);
  const svg = renderParkPlanToSvg(built.parkPlan as unknown as PreviewParkPlan);

  await writeTextFile(artifacts.outPath, planJson);
  await writeTextFile(artifacts.svgPath, svg);

  if (artifacts.pngPath !== undefined) {
    convertSvgToPng(artifacts.svgPath, artifacts.pngPath);
  }

  const builderPost =
    options.buildTarget === undefined ? undefined : await postToBuilder(built.parkPlan, options.buildTarget, fetchImpl);

  return {
    ...built,
    artifacts,
    ...(builderPost === undefined ? {} : { builderPost })
  };
}

export async function postToBuilder(
  parkPlan: ParkPlan,
  target: string,
  fetchImpl: FetchLike = fetch
): Promise<BuilderPostResult> {
  const url = buildUrl(target);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stableJson(parkPlan)
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Builder POST failed with HTTP ${response.status} ${response.statusText}: ${body}`);
  }

  return { url, status: response.status, body };
}

export function parseRenderArgs(args: readonly string[]): ParsedArgs {
  const [command, repoPath, branch, ...rest] = args;

  if (command !== "render") {
    throw new Error(usage());
  }

  if (repoPath === undefined || branch === undefined) {
    throw new Error(usage());
  }

  const options: CliRenderOptions = {
    repoPath,
    branch,
    outPath: DEFAULT_OUT_PATH,
    pngPath: DEFAULT_PNG_PATH
  };

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];

    if (arg === "--out") {
      options.outPath = readFlagValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--png") {
      options.pngPath = readFlagValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--build") {
      options.buildTarget = readFlagValue(rest, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--generated-at") {
      options.generatedAt = readFlagValue(rest, index, arg);
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg ?? ""}\n${usage()}`);
  }

  return { command, options };
}

export function defaultArtifacts(options: RenderOptions): RenderArtifacts {
  const outPath = resolve(process.cwd(), options.outPath ?? DEFAULT_OUT_PATH);
  const pngPath = options.pngPath === null ? undefined : resolve(process.cwd(), options.pngPath ?? DEFAULT_PNG_PATH);
  const svgPath = resolve(process.cwd(), options.svgPath ?? svgPathFor(pngPath ?? "preview.svg"));

  return {
    outPath,
    svgPath,
    ...(pngPath === undefined ? {} : { pngPath })
  };
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function convertSvgToPng(svgPath: string, pngPath: string): void {
  const attempts = [
    { command: "rsvg-convert", args: ["-o", pngPath, svgPath] },
    { command: "convert", args: [svgPath, pngPath] }
  ];
  const failures: string[] = [];

  for (const attempt of attempts) {
    const result = spawnSync(attempt.command, attempt.args, { encoding: "utf8", stdio: "pipe" });

    if (result.status === 0 && existsSync(pngPath)) {
      return;
    }

    const detail = result.error?.message ?? result.stderr.trim() ?? `exit ${result.status ?? "unknown"}`;
    failures.push(`${attempt.command}: ${detail}`);
  }

  throw new Error(`PNG conversion failed. Install rsvg-convert or ImageMagick convert. ${failures.join("; ")}`);
}

export function usage(): string {
  return [
    "usage: rctai render <repo> <branch> [--out park-plan.json] [--png preview.png]",
    "       [--build host:port] [--generated-at 2026-06-16T12:00:00Z]"
  ].join("\n");
}

function buildUrl(target: string): string {
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ? target : `http://${target}`;
  const parsed = new URL(withProtocol);

  if (parsed.pathname === "" || parsed.pathname === "/") {
    parsed.pathname = "/build";
  }

  return parsed.toString();
}

function svgPathFor(pngPath: string): string {
  return pngPath.replace(/\.[^.\\/]+$/, ".svg");
}

function readFlagValue(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}\n${usage()}`);
  }

  return value;
}

async function writeTextFile(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}
