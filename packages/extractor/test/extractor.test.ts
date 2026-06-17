import { deepEqual, equal, ok } from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { extractWorkModel } from "../src/extractor.js";
import { buildPullRequestListArgs } from "../src/github.js";
import { claudeProjectSlug } from "../src/sessions.js";
import { validateWorkModel } from "../src/validate.js";

const GENERATED_AT = "2026-06-16T12:00:00Z";

test("builds deterministic GitHub PR search arguments from optional filters", () => {
  deepEqual(
    buildPullRequestListArgs(
      "main",
      25,
      {
        after: "2026-06-01",
        before: "2026-06-30",
        is: ["merged", "is:closed"]
      },
      "author:zdrayer"
    ),
    [
      "pr",
      "list",
      "--base",
      "main",
      "--state",
      "all",
      "--limit",
      "25",
      "--author",
      "zdrayer",
      "--search",
      "is:merged is:closed created:>=2026-06-01 created:<=2026-06-30",
      "--json",
      "number"
    ]
  );
});

test("extracts deterministic schema-valid synthetic PRs from a git repo with no GitHub PRs", () => {
  const fixture = createGitFixture();

  try {
    const first = extractWorkModel({
      repoPath: fixture.repoPath,
      branch: "main",
      generatedAt: GENERATED_AT,
      includeSessions: false,
      syntheticLimit: 10
    });
    const second = extractWorkModel({
      repoPath: fixture.repoPath,
      branch: "main",
      generatedAt: GENERATED_AT,
      includeSessions: false,
      syntheticLimit: 10
    });

    validateWorkModel(first);
    deepEqual(first, second);
    equal(first.schemaVersion, 1);
    equal(first.generatedAt, GENERATED_AT);
    ok(first.prs.length >= 1);

    const cachePr = first.prs.find((pr) => pr.title === "Add cache layer");
    ok(cachePr);
    equal(cachePr.id, "SYNTH-2");
    equal(cachePr.state, "synthetic");
    equal(cachePr.languages.typescript, 8);
    equal(cachePr.categories.feature, 1);
    equal(cachePr.signals.codeTouchedNoTests, true);
    equal(cachePr.session, null);
  } finally {
    rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

test("links a Claude JSONL session to the matching synthetic PR by repo, branch, time, and file overlap", () => {
  const fixture = createGitFixture();

  try {
    const sessionsRoot = join(fixture.rootPath, "claude-projects");
    const projectRoot = join(sessionsRoot, claudeProjectSlug(fixture.repoPath));
    mkdirSync(projectRoot, { recursive: true });
    writeFileSync(
      join(projectRoot, "known-session.jsonl"),
      [
        JSON.stringify({
          type: "user",
          sessionId: "known-session",
          cwd: fixture.repoPath,
          gitBranch: "main",
          timestamp: "2026-06-16T10:20:00.000Z",
          message: { role: "user", content: "implement src/cache.ts" }
        }),
        JSON.stringify({
          type: "assistant",
          sessionId: "known-session",
          cwd: fixture.repoPath,
          gitBranch: "main",
          timestamp: "2026-06-16T10:25:00.000Z",
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", name: "Edit", input: { file_path: join(fixture.repoPath, "src/cache.ts") } },
              { type: "tool_use", name: "Bash", input: { command: "npm test -- src/cache.ts" } }
            ]
          }
        }),
        JSON.stringify({
          type: "user",
          sessionId: "known-session",
          cwd: fixture.repoPath,
          gitBranch: "main",
          timestamp: "2026-06-16T10:35:00.000Z",
          message: {
            role: "user",
            content: [{ type: "tool_result", is_error: true, content: "test failed, retry" }]
          }
        })
      ].join("\n"),
      "utf8"
    );

    const model = extractWorkModel({
      repoPath: fixture.repoPath,
      branch: "main",
      generatedAt: GENERATED_AT,
      sessionsRoot,
      syntheticLimit: 10
    });

    validateWorkModel(model);

    const cachePr = model.prs.find((pr) => pr.title === "Add cache layer");
    const docsPr = model.prs.find((pr) => pr.title === "Add docs");
    ok(cachePr);
    ok(docsPr);
    ok(cachePr.session);
    equal(cachePr.session.sessionId, "known-session");
    equal(cachePr.session.durationMinutes, 15);
    equal(cachePr.session.userTurns, 1);
    equal(cachePr.session.toolCalls, 2);
    equal(cachePr.session.edits, 1);
    equal(cachePr.session.bashCalls, 1);
    equal(cachePr.session.errors, 1);
    equal(cachePr.session.retries, 1);
    equal(docsPr.session, null);
  } finally {
    rmSync(fixture.rootPath, { recursive: true, force: true });
  }
});

interface GitFixture {
  rootPath: string;
  repoPath: string;
}

function createGitFixture(): GitFixture {
  const rootPath = mkdtempSync(join(process.env.TMPDIR ?? "/tmp", "rctai-extractor-"));
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
      "  if (key.length === 0) {",
      "    return null;",
      "  }",
      "  const value = new Map<string, string>();",
      "  value.set(key, key.toUpperCase());",
      "  return value.get(key) ?? null;",
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
