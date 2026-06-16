declare module "node:assert/strict" {
  export function deepEqual(actual: unknown, expected: unknown, message?: string): void;
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function ok(value: unknown, message?: string): asserts value;
}

declare module "node:child_process" {
  export interface SpawnSyncOptions {
    cwd?: string;
    encoding?: "utf8";
    env?: Record<string, string | undefined>;
    maxBuffer?: number;
    stdio?: "pipe" | "inherit";
  }

  export interface SpawnSyncResult {
    status: number | null;
    signal: string | null;
    error?: Error;
    stdout: string;
    stderr: string;
  }

  export function spawnSync(command: string, args?: readonly string[], options?: SpawnSyncOptions): SpawnSyncResult;
}

declare module "node:fs" {
  export interface Dirent {
    isDirectory(): boolean;
    isFile(): boolean;
    name: string;
  }

  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function mkdtempSync(prefix: string): string;
  export function readFileSync(path: string, encoding: "utf8"): string;
  export function readdirSync(path: string, options?: { withFileTypes?: false }): string[];
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(path: string, data: string, encoding?: "utf8"): void;
}

declare module "node:fs/promises" {
  export function mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  export function writeFile(path: string, data: string, encoding?: "utf8"): Promise<void>;
}

declare module "node:os" {
  export function homedir(): string;
  export function tmpdir(): string;
}

declare module "node:path" {
  export function basename(path: string, suffix?: string): string;
  export function dirname(path: string): string;
  export function extname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function join(...paths: string[]): string;
  export function normalize(path: string): string;
  export function relative(from: string, to: string): string;
  export function resolve(...paths: string[]): string;
  export const sep: string;
}

declare module "node:test" {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare const console: {
  error: (...data: unknown[]) => void;
  log: (...data: unknown[]) => void;
};

declare const process: {
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  exit(code?: number): never;
  exitCode?: number;
  stderr: { write(message: string): void };
  stdout: { write(message: string): void };
};
