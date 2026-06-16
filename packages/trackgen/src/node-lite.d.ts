declare module "node:assert/strict" {
  export function deepEqual(actual: unknown, expected: unknown, message?: string): void;
  export function equal(actual: unknown, expected: unknown, message?: string): void;
  export function notEqual(actual: unknown, expected: unknown, message?: string): void;
  export function ok(value: unknown, message?: string): asserts value;
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options: { recursive: true }): string | undefined;
  export function readFileSync(path: string, encoding: string): string;
  export function writeFileSync(path: string, data: string, encoding?: string): void;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function isAbsolute(path: string): boolean;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
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
  cwd: () => string;
  env: Record<string, string | undefined>;
  exit: (code?: number) => never;
  exitCode?: number;
  stderr: { write: (message: string) => void };
  stdout: { write: (message: string) => void };
};
