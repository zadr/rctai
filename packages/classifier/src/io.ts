import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";
import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { RideProfilesFile, WorkModel } from "./types.js";

const Ajv = AjvModule.default;
const addFormats = addFormatsModule.default;

export function findRepoRoot(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory);

  while (true) {
    if (
      existsSync(join(directory, "data", "ride-profiles.json")) &&
      existsSync(join(directory, "schemas", "work-model.schema.json"))
    ) {
      return directory;
    }

    const parent = dirname(directory);

    if (parent === directory) {
      throw new Error(`Unable to find RCTAI repo root from ${startDirectory}`);
    }

    directory = parent;
  }
}

export function resolveInputPath(path: string, repoRoot = findRepoRoot()): string {
  if (isAbsolute(path)) {
    return path;
  }

  const fromCwd = resolve(process.cwd(), path);

  if (existsSync(fromCwd)) {
    return fromCwd;
  }

  return resolve(repoRoot, path);
}

export function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

export function loadRideProfiles(repoRoot = findRepoRoot()): RideProfilesFile {
  const profilePath = join(repoRoot, "data", "ride-profiles.json");
  const profiles = readJsonFile(profilePath);

  if (!isRideProfilesFile(profiles)) {
    throw new Error(`Invalid ride profiles data at ${profilePath}`);
  }

  return profiles;
}

export function loadAndValidateWorkModel(path: string, repoRoot = findRepoRoot()): WorkModel {
  const schemaPath = join(repoRoot, "schemas", "work-model.schema.json");
  const schema = readJsonFile(schemaPath);
  const workModel = readJsonFile(path);
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);

  const validate = ajv.compile(schema as Record<string, unknown>);

  if (!validate(workModel)) {
    throw new Error(
      `Invalid work model at ${path}:\n${ajv.errorsText(validate.errors, { separator: "\n" })}`
    );
  }

  return workModel as WorkModel;
}

function isRideProfilesFile(value: unknown): value is RideProfilesFile {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.schemaVersion === 1 &&
    typeof value.count === "number" &&
    Array.isArray(value.rides) &&
    value.rides.every(isRideProfile)
  );
}

function isRideProfile(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.axisProfile) || !isRecord(value.buildOut)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.category === "string" &&
    Array.isArray(value.trackGroups) &&
    typeof value.axisProfile.size === "number" &&
    typeof value.axisProfile.adventure === "number" &&
    typeof value.axisProfile.risk === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
