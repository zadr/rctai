declare const process: {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stderr: {
    write(message: string): void;
  };
  stdout: {
    write(message: string): void;
  };
};

declare module "node:child_process" {
  export interface SpawnSyncResult {
    status: number | null;
    error?: Error;
    stderr: string;
  }

  export function spawnSync(
    command: string,
    args?: readonly string[],
    options?: { encoding?: "utf8"; stdio?: "pipe" }
  ): SpawnSyncResult;
}

declare module "node:fs" {
  export function existsSync(path: string): boolean;
}

declare module "node:fs/promises" {
  export function mkdir(path: string, options: { recursive: true }): Promise<string | undefined>;
  export function readFile(path: string, encoding: "utf8"): Promise<string>;
  export function writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

declare module "node:path" {
  export function dirname(path: string): string;
  export function resolve(...paths: string[]): string;
}
