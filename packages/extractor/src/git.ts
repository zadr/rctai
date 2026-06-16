import { basename, resolve } from "node:path";

import { makeWorkFile, normalizeGitPath } from "./classify.js";
import { requireGit, runGit } from "./process.js";
import type { ExtractedPullRequest, FileStatus, RepoInfo, WorkFile } from "./types.js";

interface CommitRecord {
  sha: string;
  parents: string[];
  author: string;
  date: string;
  subject: string;
}

interface RawFileChange {
  path: string;
  additions: number;
  deletions: number;
  status: FileStatus;
}

const FIELD_SEPARATOR = "\u001f";

export function resolveGitRoot(repoPath: string): string {
  return requireGit(repoPath, ["rev-parse", "--show-toplevel"], "git rev-parse").trim();
}

export function readRepoInfo(repoPath: string, branch: string): RepoInfo {
  const root = resolveGitRoot(repoPath);
  const remoteUrl = readOptionalGit(root, ["remote", "get-url", "origin"]);
  const defaultBranch = readDefaultBranch(root) ?? branch;

  return {
    name: basename(root),
    ...(remoteUrl === null ? {} : { url: remoteUrl }),
    defaultBranch
  };
}

export function extractSyntheticPullRequests(
  repoPath: string,
  branch: string,
  syntheticLimit: number
): ExtractedPullRequest[] {
  const mergeCommits = readMergeCommits(repoPath, branch, syntheticLimit);
  const syntheticCommits =
    mergeCommits.length > 0 ? mergeCommits : readRecentCommits(repoPath, branch, syntheticLimit);

  return syntheticCommits
    .reverse()
    .map((commit, index) => syntheticPullRequestForCommit(repoPath, branch, commit, index + 1));
}

export function gitNumstatForCommit(repoPath: string, sha: string): WorkFile[] {
  const numstat = requireGit(repoPath, ["log", "-1", "--numstat", "--format=", "--no-renames", sha], "git log");
  const statuses = readNameStatuses(repoPath, sha);

  return rawChangesToWorkFiles(parseNumstat(numstat, statuses));
}

export function gitNumstatForDiff(repoPath: string, fromRef: string, toRef: string): WorkFile[] {
  const numstat = requireGit(repoPath, ["diff", "--numstat", "--no-renames", fromRef, toRef], "git diff");
  const statusOutput = requireGit(repoPath, ["diff", "--name-status", "--no-renames", fromRef, toRef], "git diff");

  return rawChangesToWorkFiles(parseNumstat(numstat, parseNameStatus(statusOutput)));
}

export function countCommits(repoPath: string, fromExclusive: string, toInclusive: string): number {
  const result = runGit(repoPath, ["rev-list", "--count", `${fromExclusive}..${toInclusive}`]);

  if (!result.ok) {
    return 1;
  }

  const count = Number.parseInt(result.stdout.trim(), 10);

  return Number.isFinite(count) && count >= 0 ? count : 1;
}

export function normalizeRepoPath(path: string): string {
  return resolve(path);
}

function syntheticPullRequestForCommit(
  repoPath: string,
  branch: string,
  commit: CommitRecord,
  syntheticNumber: number
): ExtractedPullRequest {
  const firstParent = commit.parents[0];
  const files =
    firstParent === undefined ? gitNumstatForCommit(repoPath, commit.sha) : gitNumstatForDiff(repoPath, firstParent, commit.sha);
  const secondParent = commit.parents[1];
  const commits = secondParent === undefined ? 1 : Math.max(countCommits(repoPath, firstParent ?? commit.sha, secondParent), 1);

  return {
    id: `SYNTH-${syntheticNumber}`,
    number: null,
    title: cleanSyntheticTitle(commit.subject),
    author: commit.author || "unknown",
    state: "synthetic",
    createdAt: commit.date,
    mergedAt: commit.date,
    durationHours: null,
    commits,
    files,
    hasRevert: /\brevert(ed|s|ing)?\b/i.test(commit.subject),
    forcePush: false,
    reviewCount: 0,
    approvals: 0,
    headBranch: branch,
    baseBranch: branch,
    mergeCommit: commit.sha,
    session: null
  };
}

function readMergeCommits(repoPath: string, branch: string, limit: number): CommitRecord[] {
  const result = runGit(repoPath, [
    "log",
    branch,
    "--first-parent",
    "--merges",
    `--max-count=${limit}`,
    `--pretty=format:%H${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s`
  ]);

  if (!result.ok) {
    return [];
  }

  return parseCommitRecords(result.stdout);
}

function readRecentCommits(repoPath: string, branch: string, limit: number): CommitRecord[] {
  const output = requireGit(repoPath, [
    "log",
    branch,
    `--max-count=${limit}`,
    `--pretty=format:%H${FIELD_SEPARATOR}%P${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%s`
  ], "git log");

  return parseCommitRecords(output);
}

function readNameStatuses(repoPath: string, sha: string): Map<string, FileStatus> {
  const result = runGit(repoPath, ["diff-tree", "--root", "--name-status", "--no-commit-id", "-r", sha]);

  if (!result.ok) {
    return new Map();
  }

  return parseNameStatus(result.stdout);
}

function readDefaultBranch(repoPath: string): string | null {
  const symbolicRemote = readOptionalGit(repoPath, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"]);

  if (symbolicRemote !== null) {
    return symbolicRemote.replace(/^origin\//, "");
  }

  const symbolicLocal = readOptionalGit(repoPath, ["symbolic-ref", "--quiet", "--short", "HEAD"]);

  return symbolicLocal;
}

function readOptionalGit(repoPath: string, args: readonly string[]): string | null {
  const result = runGit(repoPath, args);

  if (!result.ok) {
    return null;
  }

  const trimmed = result.stdout.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function parseCommitRecords(stdout: string): CommitRecord[] {
  return stdout
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const [sha = "", parentsText = "", author = "", date = "", subject = ""] = line.split(FIELD_SEPARATOR);

      return {
        sha,
        parents: parentsText.split(" ").filter((parent) => parent.length > 0),
        author,
        date,
        subject
      };
    })
    .filter((commit) => commit.sha.length > 0);
}

function parseNumstat(stdout: string, statuses: Map<string, FileStatus>): RawFileChange[] {
  const changes = new Map<string, RawFileChange>();

  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    const fields = line.split("\t");
    const additionsText = fields[0];
    const deletionsText = fields[1];
    const path = fields.slice(2).join("\t");

    if (additionsText === undefined || deletionsText === undefined || path.length === 0) {
      continue;
    }

    const normalizedPath = normalizeGitPath(path);
    changes.set(normalizedPath, {
      path: normalizedPath,
      additions: parseGitCount(additionsText),
      deletions: parseGitCount(deletionsText),
      status: statuses.get(normalizedPath) ?? "unknown"
    });
  }

  for (const [path, status] of statuses.entries()) {
    if (!changes.has(path)) {
      changes.set(path, { path, additions: 0, deletions: 0, status });
    }
  }

  return [...changes.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function parseNameStatus(stdout: string): Map<string, FileStatus> {
  const statuses = new Map<string, FileStatus>();

  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) {
      continue;
    }

    const fields = line.split("\t");
    const code = fields[0] ?? "";
    const rawPath = fields.length >= 3 && code.startsWith("R") ? fields[2] : fields[1];

    if (rawPath === undefined) {
      continue;
    }

    statuses.set(normalizeGitPath(rawPath), statusFromGitCode(code));
  }

  return statuses;
}

function rawChangesToWorkFiles(changes: RawFileChange[]): WorkFile[] {
  return changes.map((change) => makeWorkFile(change.path, change.additions, change.deletions, change.status));
}

function statusFromGitCode(code: string): FileStatus {
  if (code.startsWith("A")) {
    return "added";
  }

  if (code.startsWith("D")) {
    return "deleted";
  }

  if (code.startsWith("R")) {
    return "renamed";
  }

  if (code.startsWith("M")) {
    return "modified";
  }

  return "unknown";
}

function parseGitCount(value: string): number {
  if (value === "-") {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function cleanSyntheticTitle(subject: string): string {
  return subject.replace(/^Merge pull request #\d+\s*/i, "").trim() || subject || "Synthetic work";
}
