import { spawnSync } from "node:child_process";

import type { CommandResult } from "./types.js";

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export function runCommand(command: string, args: readonly string[], cwd: string): CommandResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: "pipe"
  });

  const status = result.status;

  return {
    ok: result.error === undefined && status === 0,
    status,
    stdout: result.stdout,
    stderr: result.stderr,
    ...(result.error === undefined ? {} : { error: result.error })
  };
}

export function runGit(cwd: string, args: readonly string[]): CommandResult {
  return runCommand("git", args, cwd);
}

export function runGh(cwd: string, args: readonly string[]): CommandResult {
  return runCommand("gh", args, cwd);
}

export function requireGit(cwd: string, args: readonly string[], label: string): string {
  const result = runGit(cwd, args);

  if (!result.ok) {
    const detail = result.stderr.trim() || result.error?.message || `exit ${result.status ?? "unknown"}`;
    throw new Error(`${label}: ${detail}`);
  }

  return result.stdout;
}
