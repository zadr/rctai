import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

export function findRepoRoot(startDirectory = process.cwd()): string {
  let directory = resolve(startDirectory);

  while (true) {
    if (existsSync(join(directory, "schemas", "park-plan.schema.json"))) {
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
