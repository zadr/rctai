import { basename, extname } from "node:path";

import type { FileStatus, WorkCategory, WorkFile } from "./types.js";

const CATEGORY_ORDER: WorkCategory[] = ["feature", "perf", "refactor", "test", "build", "config", "chore", "docs"];

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".c": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cs": "csharp",
  ".css": "css",
  ".go": "go",
  ".h": "c",
  ".hpp": "cpp",
  ".html": "html",
  ".java": "java",
  ".js": "javascript",
  ".jsx": "javascript",
  ".json": "json",
  ".kt": "kotlin",
  ".kts": "kotlin",
  ".mjs": "javascript",
  ".md": "markdown",
  ".mdx": "markdown",
  ".php": "php",
  ".proto": "proto",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".scss": "css",
  ".sh": "shell",
  ".sql": "sql",
  ".swift": "swift",
  ".toml": "toml",
  ".ts": "typescript",
  ".tsx": "typescript",
  ".xml": "xml",
  ".yaml": "yaml",
  ".yml": "yaml"
};

const BUILD_FILES = new Set([
  "cargo.lock",
  "cargo.toml",
  "dockerfile",
  "gemfile",
  "gemfile.lock",
  "go.mod",
  "go.sum",
  "gradle.properties",
  "makefile",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "pom.xml",
  "requirements.txt",
  "yarn.lock"
]);

const CONFIG_FILES = new Set([
  ".editorconfig",
  ".env",
  ".eslintrc",
  ".gitignore",
  ".npmrc",
  ".prettierrc",
  "eslint.config.js",
  "eslint.config.mjs",
  "tsconfig.json"
]);

const HOT_FILE_PATTERNS = [
  /(^|\/)(auth|security|crypto|permission|policy)(\/|\.|$)/i,
  /(^|\/)(payment|settlement|ledger|billing|payout|bank)(\/|\.|$)/i,
  /(^|\/)(database|db|schema|migration|migrations)(\/|\.|$)/i,
  /(^|\/)(core|engine|legacy|import|prod|infra)(\/|\.|$)/i
];

export function makeWorkFile(path: string, additions: number, deletions: number, status: FileStatus): WorkFile {
  return {
    path: normalizeGitPath(path),
    additions,
    deletions,
    status,
    language: classifyLanguage(path),
    category: classifyCategory(path)
  };
}

export function classifyLanguage(path: string): string {
  const lowerBase = basename(path).toLowerCase();

  if (lowerBase === "dockerfile") {
    return "dockerfile";
  }

  if (lowerBase === "makefile") {
    return "makefile";
  }

  return LANGUAGE_BY_EXTENSION[extname(path).toLowerCase()] ?? "other";
}

export function classifyCategory(path: string): WorkCategory {
  const normalized = normalizeGitPath(path);
  const lower = normalized.toLowerCase();
  const base = basename(lower);
  const extension = extname(lower);

  if (isTestPath(lower)) {
    return "test";
  }

  if (isDocsPath(lower)) {
    return "docs";
  }

  if (lower.includes("/benchmark/") || lower.includes("/benchmarks/") || lower.includes("/perf/")) {
    return "perf";
  }

  if (lower.includes("/refactor/") || lower.includes("/cleanup/") || lower.includes("/migration/")) {
    return "refactor";
  }

  if (BUILD_FILES.has(base) || lower.startsWith(".github/workflows/") || lower.startsWith("ci/")) {
    return "build";
  }

  if (
    CONFIG_FILES.has(base) ||
    lower.startsWith("config/") ||
    lower.includes("/config/") ||
    [".json", ".yaml", ".yml", ".toml", ".ini"].includes(extension)
  ) {
    return "config";
  }

  if (extension === "" || lower.startsWith(".github/")) {
    return "chore";
  }

  return "feature";
}

export function summarizeFiles(files: WorkFile[]): {
  additions: number;
  deletions: number;
  filesChanged: number;
  newFiles: number;
  languages: Record<string, number>;
  categories: Partial<Record<WorkCategory, number>>;
  touchesTests: boolean;
  touchesConfig: boolean;
  touchesDocs: boolean;
  codeTouchedNoTests: boolean;
  netDeletion: boolean;
  hotFiles: string[];
} {
  const sortedFiles = [...files].sort((left, right) => left.path.localeCompare(right.path));
  const languages = new Map<string, number>();
  const categoryTotals = new Map<WorkCategory, number>();
  let additions = 0;
  let deletions = 0;
  let newFiles = 0;
  let totalEffectiveLines = 0;

  for (const file of sortedFiles) {
    additions += file.additions;
    deletions += file.deletions;

    if (file.status === "added") {
      newFiles += 1;
    }

    const changedLines = file.additions + file.deletions;
    const effectiveLines = Math.max(changedLines, 1);
    totalEffectiveLines += effectiveLines;
    languages.set(file.language, (languages.get(file.language) ?? 0) + changedLines);
    categoryTotals.set(file.category, (categoryTotals.get(file.category) ?? 0) + effectiveLines);
  }

  const categories: Partial<Record<WorkCategory, number>> = {};

  for (const category of CATEGORY_ORDER) {
    const count = categoryTotals.get(category);

    if (count !== undefined && totalEffectiveLines > 0) {
      categories[category] = roundFraction(count / totalEffectiveLines);
    }
  }

  const orderedLanguages = Object.fromEntries(
    [...languages.entries()]
      .filter(([, changedLines]) => changedLines > 0)
      .sort(([left], [right]) => left.localeCompare(right))
  );
  const touchesTests = sortedFiles.some((file) => file.category === "test");
  const touchesConfig = sortedFiles.some((file) => file.category === "config" || file.category === "build");
  const touchesDocs = sortedFiles.some((file) => file.category === "docs");
  const touchesCode = sortedFiles.some((file) => ["feature", "perf", "refactor"].includes(file.category));

  return {
    additions,
    deletions,
    filesChanged: new Set(sortedFiles.map((file) => file.path)).size,
    newFiles,
    languages: orderedLanguages,
    categories,
    touchesTests,
    touchesConfig,
    touchesDocs,
    codeTouchedNoTests: touchesCode && !touchesTests,
    netDeletion: deletions > additions,
    hotFiles: sortedFiles.filter((file) => isHotFile(file.path)).map((file) => file.path)
  };
}

export function normalizeGitPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isTestPath(lowerPath: string): boolean {
  const base = basename(lowerPath);

  return (
    lowerPath.includes("/test/") ||
    lowerPath.includes("/tests/") ||
    lowerPath.includes("/__tests__/") ||
    lowerPath.includes("/spec/") ||
    base.includes(".test.") ||
    base.includes(".spec.") ||
    base.endsWith("_test.go")
  );
}

function isDocsPath(lowerPath: string): boolean {
  const base = basename(lowerPath);

  return (
    lowerPath.startsWith("docs/") ||
    lowerPath.includes("/docs/") ||
    lowerPath.startsWith("documentation/") ||
    base === "readme.md" ||
    base.startsWith("readme.") ||
    base.startsWith("changelog.") ||
    [".md", ".mdx", ".rst", ".adoc"].includes(extname(lowerPath))
  );
}

function isHotFile(path: string): boolean {
  return HOT_FILE_PATTERNS.some((pattern) => pattern.test(path));
}

function roundFraction(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
