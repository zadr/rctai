import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import type { RideProfile, RideProfilesFile, TrackgenRide } from "./types.js";

const RIDE_TYPE_ALIASES: Record<string, string> = {
  giga_coaster: "giga_rc"
};

export function findRepoRoot(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory);

  while (true) {
    if (
      existsSync(join(directory, "data", "ride-profiles.json")) &&
      existsSync(join(directory, "schemas", "park-plan.schema.json"))
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

export function canonicalRideType(rideType: string): string {
  return RIDE_TYPE_ALIASES[rideType] ?? rideType;
}

export function resolveRideProfile(ride: TrackgenRide, profiles: RideProfilesFile): RideProfile {
  const profileNames = [
    canonicalRideType(ride.rideType),
    ride.buildOut?.rideProfile ? canonicalRideType(ride.buildOut.rideProfile) : undefined
  ].filter((name): name is string => name !== undefined);

  for (const profileName of profileNames) {
    const profile = profiles.rides.find((candidate) => candidate.name === profileName);

    if (profile !== undefined) {
      return profile;
    }
  }

  throw new Error(`No ride profile found for ${ride.id} (${ride.rideType})`);
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
    typeof value.axisProfile.risk === "number" &&
    Array.isArray(value.buildOut.inversions) &&
    Array.isArray(value.buildOut.helices) &&
    Array.isArray(value.buildOut.steepDrops) &&
    Array.isArray(value.buildOut.banking)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
