import { makeWorkFile } from "./classify.js";
import { runGh } from "./process.js";
import type { ExtractedPullRequest, FileStatus, PullRequestState, WorkFile } from "./types.js";

const LIST_FIELDS = ["number"];
const VIEW_FIELDS = [
  "additions",
  "author",
  "baseRefName",
  "changedFiles",
  "commits",
  "createdAt",
  "deletions",
  "files",
  "headRefName",
  "latestReviews",
  "mergeCommit",
  "mergedAt",
  "number",
  "reviews",
  "state",
  "title"
];

export function extractGithubPullRequests(
  repoPath: string,
  branch: string,
  prLimit: number
): ExtractedPullRequest[] | null {
  const list = runGh(repoPath, [
    "pr",
    "list",
    "--base",
    branch,
    "--state",
    "all",
    "--limit",
    String(prLimit),
    "--json",
    LIST_FIELDS.join(",")
  ]);

  if (!list.ok) {
    return null;
  }

  const listed = parseJsonArray(list.stdout);

  if (listed === null || listed.length === 0) {
    return [];
  }

  const prs: ExtractedPullRequest[] = [];

  for (const item of listed) {
    const number = readNumber(item, "number");

    if (number === null) {
      continue;
    }

    const pr = viewPullRequest(repoPath, number);

    if (pr !== null) {
      prs.push(pr);
    }
  }

  return prs.sort(compareExtractedPrs);
}

function viewPullRequest(repoPath: string, number: number): ExtractedPullRequest | null {
  const view = runGh(repoPath, ["pr", "view", String(number), "--json", VIEW_FIELDS.join(",")]);

  if (!view.ok) {
    return null;
  }

  const parsed = parseJsonObject(view.stdout);

  if (parsed === null) {
    return null;
  }

  return prFromGhObject(parsed, number);
}

function prFromGhObject(value: Record<string, unknown>, fallbackNumber: number): ExtractedPullRequest {
  const number = readNumber(value, "number") ?? fallbackNumber;
  const createdAt = readString(value, "createdAt");
  const mergedAt = readString(value, "mergedAt");
  const files = readGhFiles(value.files);
  const reviews = readReviews(value.reviews, value.latestReviews);
  const title = readString(value, "title") ?? `Pull request #${number}`;
  const mergeCommit = readMergeCommit(value.mergeCommit);

  return {
    id: `PR-${number}`,
    number,
    title,
    author: readAuthor(value.author),
    state: stateFromGh(readString(value, "state")),
    createdAt,
    mergedAt,
    durationHours: durationHours(createdAt, mergedAt),
    commits: readCommitCount(value.commits),
    files,
    hasRevert: /\brevert(ed|s|ing)?\b/i.test(title),
    forcePush: false,
    reviewCount: reviews.reviewCount,
    approvals: reviews.approvals,
    headBranch: readString(value, "headRefName"),
    baseBranch: readString(value, "baseRefName"),
    mergeCommit,
    session: null
  };
}

function readGhFiles(value: unknown): WorkFile[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const path = readString(item, "path") ?? readString(item, "filename");

      if (path === null) {
        return null;
      }

      return makeWorkFile(
        path,
        readNumber(item, "additions") ?? 0,
        readNumber(item, "deletions") ?? 0,
        statusFromGh(readString(item, "status"))
      );
    })
    .filter((file): file is WorkFile => file !== null)
    .sort((left, right) => left.path.localeCompare(right.path));
}

function readReviews(reviewsValue: unknown, latestReviewsValue: unknown): { reviewCount: number; approvals: number } {
  const reviews = Array.isArray(reviewsValue) ? reviewsValue : Array.isArray(latestReviewsValue) ? latestReviewsValue : [];
  let reviewCount = 0;
  let approvals = 0;

  for (const review of reviews) {
    if (!isRecord(review)) {
      continue;
    }

    reviewCount += 1;

    if ((readString(review, "state") ?? "").toUpperCase() === "APPROVED") {
      approvals += 1;
    }
  }

  return { reviewCount, approvals };
}

function readCommitCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(Math.trunc(value), 0);
  }

  return 0;
}

function readAuthor(value: unknown): string {
  if (isRecord(value)) {
    return readString(value, "login") ?? readString(value, "name") ?? "unknown";
  }

  return "unknown";
}

function readMergeCommit(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  return readString(value, "oid");
}

function stateFromGh(value: string | null): PullRequestState {
  if (value === null) {
    return "closed";
  }

  const normalized = value.toLowerCase();

  if (normalized === "open" || normalized === "merged" || normalized === "closed") {
    return normalized;
  }

  return "closed";
}

function statusFromGh(value: string | null): FileStatus {
  const normalized = (value ?? "").toLowerCase();

  if (normalized === "added" || normalized === "a") {
    return "added";
  }

  if (normalized === "removed" || normalized === "deleted" || normalized === "d") {
    return "deleted";
  }

  if (normalized === "renamed" || normalized === "r") {
    return "renamed";
  }

  if (normalized === "changed" || normalized === "modified" || normalized === "m") {
    return "modified";
  }

  return "unknown";
}

function durationHours(start: string | null, end: string | null): number | null {
  if (start === null || end === null) {
    return null;
  }

  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return null;
  }

  return Math.round(((endMs - startMs) / 3_600_000) * 10) / 10;
}

function compareExtractedPrs(left: ExtractedPullRequest, right: ExtractedPullRequest): number {
  const leftTime = left.mergedAt ?? left.createdAt ?? "";
  const rightTime = right.mergedAt ?? right.createdAt ?? "";
  const timeDelta = leftTime.localeCompare(rightTime);

  if (timeDelta !== 0) {
    return timeDelta;
  }

  return (left.number ?? 0) - (right.number ?? 0);
}

function parseJsonArray(text: string): Record<string, unknown>[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.filter(isRecord);
  } catch {
    return null;
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text) as unknown;

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
