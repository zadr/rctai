import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

import { normalizeGitPath } from "./classify.js";
import type { ClaudeSession, ExtractedPullRequest, WorkFile } from "./types.js";

interface MutableSession {
  sessionId: string;
  sourcePath: string;
  projectSlug: string | null;
  cwd: string | null;
  branch: string | null;
  timestamps: number[];
  userTurns: number;
  toolCalls: number;
  edits: number;
  bashCalls: number;
  errors: number;
  retries: number;
  files: Set<string>;
}

interface LinkCandidate {
  prIndex: number;
  score: number;
  overlap: number;
}

const EDIT_TOOL_NAMES = new Set(["edit", "multiedit", "write", "notebookedit", "str_replace_editor"]);
const LINK_THRESHOLD = 3;
const PATH_TOKEN_PATTERN =
  /(?:\.{0,2}\/)?[A-Za-z0-9_.@-]+(?:\/[A-Za-z0-9_.@-]+)*\.(?:adoc|c|cc|cpp|cs|css|go|h|hpp|html|java|js|jsx|json|kt|kts|md|mdx|mjs|php|proto|py|rb|rs|scss|sh|sql|swift|toml|ts|tsx|xml|ya?ml)\b/g;

export function readClaudeSessions(sessionsRoot: string, repoPath: string): ClaudeSession[] {
  if (!existsSync(sessionsRoot)) {
    return [];
  }

  return findJsonlFiles(sessionsRoot)
    .map((path) => parseClaudeSessionFile(path, repoPath))
    .filter((session): session is ClaudeSession => session !== null)
    .sort(compareSessions);
}

export function attachClaudeSessions(
  prs: ExtractedPullRequest[],
  sessions: ClaudeSession[],
  repoPath: string,
  branch: string
): ExtractedPullRequest[] {
  const assigned = new Map<number, { session: ClaudeSession; candidate: LinkCandidate }>();

  for (const session of sessions) {
    const candidate = bestCandidateForSession(session, prs, repoPath, branch);

    if (candidate === null || candidate.score < LINK_THRESHOLD) {
      continue;
    }

    const existing = assigned.get(candidate.prIndex);

    if (
      existing === undefined ||
      candidate.score > existing.candidate.score ||
      (candidate.score === existing.candidate.score && candidate.overlap > existing.candidate.overlap) ||
      (candidate.score === existing.candidate.score &&
        candidate.overlap === existing.candidate.overlap &&
        session.sessionId.localeCompare(existing.session.sessionId) < 0)
    ) {
      assigned.set(candidate.prIndex, { session, candidate });
    }
  }

  return prs.map((pr, index) => {
    const linked = assigned.get(index);

    if (linked === undefined) {
      return { ...pr, session: null };
    }

    return { ...pr, session: linked.session.metrics };
  });
}

export function claudeProjectSlug(path: string): string {
  return resolve(path).replaceAll(sep, "-");
}

function parseClaudeSessionFile(path: string, repoPath: string): ClaudeSession | null {
  const mutable: MutableSession = {
    sessionId: basename(path, ".jsonl"),
    sourcePath: path,
    projectSlug: basename(dirname(path)) || null,
    cwd: null,
    branch: null,
    timestamps: [],
    userTurns: 0,
    toolCalls: 0,
    edits: 0,
    bashCalls: 0,
    errors: 0,
    retries: 0,
    files: new Set()
  };

  const lines = readFileSync(path, "utf8").split("\n");

  for (const line of lines) {
    if (line.trim().length === 0) {
      continue;
    }

    const record = parseJsonRecord(line);

    if (record === null) {
      continue;
    }

    ingestClaudeRecord(mutable, record, repoPath);
  }

  if (mutable.timestamps.length === 0 && mutable.toolCalls === 0 && mutable.userTurns === 0) {
    return null;
  }

  mutable.timestamps.sort((left, right) => left - right);

  const startedAtMs = mutable.timestamps[0];
  const endedAtMs = mutable.timestamps.at(-1);
  const startedAt = startedAtMs === undefined ? null : new Date(startedAtMs).toISOString();
  const endedAt = endedAtMs === undefined ? null : new Date(endedAtMs).toISOString();
  const durationMinutes =
    startedAtMs === undefined || endedAtMs === undefined
      ? 0
      : Math.round(Math.max(endedAtMs - startedAtMs, 0) / 60_000);

  return {
    sessionId: mutable.sessionId,
    sourcePath: mutable.sourcePath,
    projectSlug: mutable.projectSlug,
    cwd: mutable.cwd,
    branch: mutable.branch,
    startedAt,
    endedAt,
    files: [...mutable.files].sort(),
    metrics: {
      sessionId: mutable.sessionId,
      durationMinutes,
      userTurns: mutable.userTurns,
      toolCalls: mutable.toolCalls,
      edits: mutable.edits,
      bashCalls: mutable.bashCalls,
      errors: mutable.errors,
      retries: mutable.retries
    }
  };
}

function ingestClaudeRecord(session: MutableSession, record: Record<string, unknown>, repoPath: string): void {
  const sessionId = readString(record, "sessionId");

  if (sessionId !== null) {
    session.sessionId = sessionId;
  }

  const cwd = readString(record, "cwd");

  if (cwd !== null) {
    session.cwd = cwd;
  }

  const branch = readString(record, "gitBranch") ?? readString(record, "branch");

  if (branch !== null) {
    session.branch = branch;
  }

  const timestamp = readTimestamp(record);

  if (timestamp !== null) {
    session.timestamps.push(timestamp);
  }

  const message = readRecord(record, "message");
  const type = readString(record, "type");
  const content = message?.content ?? record.content;

  if (isUserTurn(type, message, content)) {
    session.userTurns += 1;
  }

  if (record.is_error === true || record.isError === true || type === "error") {
    session.errors += 1;
  }

  collectFromContent(session, content, repoPath);
}

function collectFromContent(session: MutableSession, content: unknown, repoPath: string): void {
  if (typeof content === "string") {
    collectPathTokens(session, content, repoPath);

    if (isRetryText(content)) {
      session.retries += 1;
    }

    return;
  }

  if (!Array.isArray(content)) {
    return;
  }

  for (const item of content) {
    if (!isRecord(item)) {
      continue;
    }

    const itemType = readString(item, "type");

    if (itemType === "tool_use") {
      collectToolUse(session, item, repoPath);
      continue;
    }

    if (itemType === "tool_result") {
      if (item.is_error === true || item.isError === true) {
        session.errors += 1;
      }

      collectFromContent(session, item.content, repoPath);
      continue;
    }

    const text = readString(item, "text");

    if (text !== null) {
      collectFromContent(session, text, repoPath);
    }
  }
}

function collectToolUse(session: MutableSession, item: Record<string, unknown>, repoPath: string): void {
  const toolName = readString(item, "name") ?? "unknown";
  const normalizedTool = normalizeToolName(toolName);
  const input = readRecord(item, "input");

  session.toolCalls += 1;

  if (EDIT_TOOL_NAMES.has(normalizedTool)) {
    session.edits += 1;
    collectToolPath(session, input, repoPath);
  }

  if (normalizedTool === "bash") {
    session.bashCalls += 1;
    collectFromContent(session, readString(input, "command"), repoPath);
  }
}

function collectToolPath(session: MutableSession, input: Record<string, unknown>, repoPath: string): void {
  const filePath =
    readString(input, "file_path") ??
    readString(input, "path") ??
    readString(input, "notebook_path") ??
    readString(input, "filename");

  if (filePath !== null) {
    addSessionFile(session, filePath, repoPath);
  }
}

function collectPathTokens(session: MutableSession, text: string, repoPath: string): void {
  for (const match of text.matchAll(PATH_TOKEN_PATTERN)) {
    addSessionFile(session, match[0], repoPath);
  }
}

function addSessionFile(session: MutableSession, filePath: string, repoPath: string): void {
  const normalized = normalizeSessionPath(filePath, session.cwd, repoPath);

  if (normalized !== null) {
    session.files.add(normalized);
  }
}

function bestCandidateForSession(
  session: ClaudeSession,
  prs: ExtractedPullRequest[],
  repoPath: string,
  branch: string
): LinkCandidate | null {
  let best: LinkCandidate | null = null;

  for (let index = 0; index < prs.length; index += 1) {
    const pr = prs[index];

    if (pr === undefined) {
      continue;
    }

    const candidate = scoreSessionForPr(session, pr, index, repoPath, branch);

    if (
      best === null ||
      candidate.score > best.score ||
      (candidate.score === best.score && candidate.overlap > best.overlap) ||
      (candidate.score === best.score && candidate.overlap === best.overlap && index < best.prIndex)
    ) {
      best = candidate;
    }
  }

  return best;
}

function scoreSessionForPr(
  session: ClaudeSession,
  pr: ExtractedPullRequest,
  prIndex: number,
  repoPath: string,
  branch: string
): LinkCandidate {
  let score = 0;
  const overlap = fileOverlap(session.files, pr.files);

  if (sessionMatchesRepo(session, repoPath)) {
    score += 1.5;
  }

  if (session.branch !== null) {
    if (pr.headBranch !== null && session.branch === pr.headBranch) {
      score += 4;
    } else if (pr.state === "synthetic" && session.branch === branch) {
      score += 2;
    } else if (session.branch === branch) {
      score += 0.5;
    }
  }

  score += timeScore(session, pr);

  if (overlap > 0) {
    score += Math.min(4, overlap * 1.25);
    score += overlap / Math.max(new Set(pr.files.map((file) => file.path)).size, session.files.length, 1);
  }

  return { prIndex, score, overlap };
}

function fileOverlap(sessionFiles: string[], prFiles: WorkFile[]): number {
  const prPaths = new Set(prFiles.map((file) => file.path));
  let overlap = 0;

  for (const file of sessionFiles) {
    if (prPaths.has(file)) {
      overlap += 1;
    }
  }

  return overlap;
}

function timeScore(session: ClaudeSession, pr: ExtractedPullRequest): number {
  const sessionStart = session.startedAt === null ? null : Date.parse(session.startedAt);
  const sessionEnd = session.endedAt === null ? sessionStart : Date.parse(session.endedAt);
  const prStart = pr.createdAt === null ? null : Date.parse(pr.createdAt);
  const prEnd = pr.mergedAt === null ? prStart : Date.parse(pr.mergedAt);

  if (
    sessionStart === null ||
    sessionEnd === null ||
    prStart === null ||
    prEnd === null ||
    !Number.isFinite(sessionStart) ||
    !Number.isFinite(sessionEnd) ||
    !Number.isFinite(prStart) ||
    !Number.isFinite(prEnd)
  ) {
    return 0;
  }

  const buffer = 72 * 3_600_000;

  if (sessionStart <= prEnd + buffer && sessionEnd >= prStart - buffer) {
    const strictOverlap = sessionStart <= prEnd && sessionEnd >= prStart;

    return strictOverlap ? 3 : 1.25;
  }

  return 0;
}

function sessionMatchesRepo(session: ClaudeSession, repoPath: string): boolean {
  const root = resolve(repoPath);

  if (session.cwd !== null) {
    const cwd = resolve(session.cwd);
    const relativePath = relative(root, cwd);

    if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) {
      return true;
    }
  }

  return session.projectSlug === claudeProjectSlug(root) || session.projectSlug === basename(root);
}

function normalizeSessionPath(filePath: string, cwd: string | null, repoPath: string): string | null {
  const repoRoot = resolve(repoPath);
  const absolute = isAbsolute(filePath) ? normalize(filePath) : normalize(resolve(cwd ?? repoRoot, filePath));
  const relativePath = relative(repoRoot, absolute);

  if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    const normalizedRelative = normalizeGitPath(filePath);

    return normalizedRelative.startsWith("/") || normalizedRelative.startsWith("..") ? null : normalizedRelative;
  }

  return normalizeGitPath(relativePath);
}

function findJsonlFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...findJsonlFiles(path));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      files.push(path);
    }
  }

  return files.sort();
}

function isUserTurn(type: string | null, message: Record<string, unknown> | null, content: unknown): boolean {
  if (type !== "user" && readString(message, "role") !== "user") {
    return false;
  }

  if (!Array.isArray(content)) {
    return true;
  }

  return content.some((item) => !isRecord(item) || readString(item, "type") !== "tool_result");
}

function readTimestamp(record: Record<string, unknown>): number | null {
  const value = readString(record, "timestamp") ?? readString(record, "createdAt");

  if (value === null) {
    return null;
  }

  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseJsonRecord(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;

    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function compareSessions(left: ClaudeSession, right: ClaudeSession): number {
  const startDelta = (left.startedAt ?? "").localeCompare(right.startedAt ?? "");

  if (startDelta !== 0) {
    return startDelta;
  }

  return left.sourcePath.localeCompare(right.sourcePath);
}

function isRetryText(text: string): boolean {
  return /\b(retry|try again|rerun|re-run)\b/i.test(text);
}

function normalizeToolName(toolName: string): string {
  return toolName.replaceAll(/\s+/g, "").toLowerCase();
}

function readRecord(record: Record<string, unknown> | null, key: string): Record<string, unknown> {
  if (record === null) {
    return {};
  }

  const value = record[key];

  return isRecord(value) ? value : {};
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (record === null) {
    return null;
  }

  const value = record[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
