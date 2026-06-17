import { deepEqual, equal, ok } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildParkPlan,
  defaultArtifacts,
  parseRenderArgs,
  postToBuilder,
  renderPark,
  stableJson
} from "../src/index.js";

const GENERATED_AT = "2026-06-16T12:00:00Z";

test("parses the required render command and deterministic options", () => {
  const parsed = parseRenderArgs([
    "render",
    ".",
    "main",
    "--out",
    "/tmp/park.json",
    "--png",
    "/tmp/preview.png",
    "--build",
    "localhost:12345",
    "--generated-at",
    GENERATED_AT,
    "--author",
    "alice,bob",
    "--author",
    "carol",
    "--after",
    "2026-06-01",
    "--before",
    "2026-06-30",
    "--is",
    "merged",
    "--is",
    "is:closed"
  ]);

  equal(parsed.command, "render");
  equal(parsed.options.repoPath, ".");
  equal(parsed.options.branch, "main");
  equal(parsed.options.outPath, "/tmp/park.json");
  equal(parsed.options.pngPath, "/tmp/preview.png");
  equal(parsed.options.buildTarget, "localhost:12345");
  equal(parsed.options.generatedAt, GENERATED_AT);
  deepEqual(parsed.options.authors, ["alice", "bob", "carol"]);
  equal(parsed.options.after, "2026-06-01");
  equal(parsed.options.before, "2026-06-30");
  deepEqual(parsed.options.is, ["merged", "is:closed"]);
});

test("builds deterministic park plans from a git repo using synthetic extraction", () => {
  const fixture = createGitFixture();

  try {
    const first = buildParkPlan({
      repoPath: fixture.repoPath,
      branch: "main",
      generatedAt: GENERATED_AT,
      includeSessions: false,
      syntheticLimit: 10
    });
    const second = buildParkPlan({
      repoPath: fixture.repoPath,
      branch: "main",
      generatedAt: GENERATED_AT,
      includeSessions: false,
      syntheticLimit: 10
    });

    equal(first.workModel.generatedAt, GENERATED_AT);
    ok(first.workModel.prs.length >= 1);
    equal(first.parkPlan.rides.length, first.workModel.prs.length);
    deepEqual(first.parkPlan, second.parkPlan);
  } finally {
    rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("writes park-plan JSON and SVG artifacts without requiring PNG conversion", async () => {
  const fixture = createGitFixture();
  const outPath = join(fixture.rootPath, "out", "park-plan.json");
  const svgPath = join(fixture.rootPath, "out", "preview.svg");

  try {
    const result = await renderPark({
      repoPath: fixture.repoPath,
      branch: "main",
      outPath,
      svgPath,
      pngPath: null,
      generatedAt: GENERATED_AT,
      includeSessions: false,
      syntheticLimit: 10
    });
    const writtenPlan = JSON.parse(readFileSync(outPath, "utf8")) as unknown;

    ok(existsSync(outPath));
    ok(existsSync(svgPath));
    deepEqual(writtenPlan, result.parkPlan);
    equal(readFileSync(outPath, "utf8"), stableJson(result.parkPlan));
    ok(readFileSync(svgPath, "utf8").includes("<svg"));
    equal(result.artifacts.pngPath, undefined);
  } finally {
    rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("defaults CLI artifacts to park-plan JSON plus PNG and SVG companion", () => {
  const artifacts = defaultArtifacts({ repoPath: ".", branch: "main" });

  ok(artifacts.outPath.endsWith("park-plan.json"));
  ok(artifacts.pngPath?.endsWith("preview.png"));
  ok(artifacts.svgPath.endsWith("preview.svg"));
});

test("posts the final plan to the builder /build endpoint", async () => {
  const fixture = createGitFixture();

  try {
    const plan = buildParkPlan({
      repoPath: fixture.repoPath,
      branch: "main",
      generatedAt: GENERATED_AT,
      includeSessions: false,
      syntheticLimit: 10
    }).parkPlan;
    const calls: Array<{ url: string; body: string | undefined }> = [];
    const result = await postToBuilder(plan, "127.0.0.1:4567", async (url, init) => {
      calls.push({ url, body: init?.body });

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        async text() {
          return "built";
        }
      };
    });

    equal(result.url, "http://127.0.0.1:4567/build");
    equal(result.status, 200);
    equal(calls.length, 1);
    equal(calls[0]?.body, stableJson(plan));
  } finally {
    rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

interface GitFixture {
  rootPath: string;
  repoPath: string;
}

function createGitFixture(): GitFixture {
  const rootPath = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "rctai-cli-"));
  const repoPath = join(rootPath, "repo");
  mkdirSync(repoPath, { recursive: true });
  run("git", ["init", "-b", "main"], repoPath);
  run("git", ["config", "user.name", "Test User"], repoPath);
  run("git", ["config", "user.email", "test@example.com"], repoPath);

  writeFileSync(join(repoPath, "README.md"), "# Fixture\n", "utf8");
  run("git", ["add", "README.md"], repoPath);
  run("git", ["commit", "-m", "Add docs"], repoPath, {
    GIT_AUTHOR_DATE: "2026-06-16T09:00:00Z",
    GIT_COMMITTER_DATE: "2026-06-16T09:00:00Z"
  });

  mkdirSync(join(repoPath, "src"), { recursive: true });
  writeFileSync(
    join(repoPath, "src", "cache.ts"),
    [
      "export function getCached(key: string): string | null {",
      "  const values = new Map<string, string>();",
      "  values.set(key, key.toUpperCase());",
      "  return values.get(key) ?? null;",
      "}",
      ""
    ].join("\n"),
    "utf8"
  );
  run("git", ["add", "src/cache.ts"], repoPath);
  run("git", ["commit", "-m", "Add cache layer"], repoPath, {
    GIT_AUTHOR_DATE: "2026-06-16T10:30:00Z",
    GIT_COMMITTER_DATE: "2026-06-16T10:30:00Z"
  });

  return { rootPath, repoPath };
}

function run(command: string, args: string[], cwd: string, env: Record<string, string> = {}): void {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, ...env },
    stdio: "pipe"
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.stderr}`);
  }
}
