declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: "utf8"): string;
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
}

declare class URL {
  constructor(input: string, base?: string | URL);
  readonly href: string;
}

interface ImportMeta {
  readonly url: string;
}

interface ProcessLike {
  argv: string[];
  cwd(): string;
  exitCode?: number;
  stderr: {
    write(message: string): void;
  };
  stdout: {
    write(message: string): void;
  };
}

declare const process: ProcessLike;
