export type WorkCategory =
  | "feature"
  | "perf"
  | "refactor"
  | "test"
  | "build"
  | "config"
  | "chore"
  | "docs";

export type PullRequestState = "open" | "merged" | "closed" | "synthetic";

export interface WorkModel {
  schemaVersion: 1;
  repo: {
    name: string;
    url?: string;
    defaultBranch?: string;
  };
  branch: string;
  generatedAt: string;
  prs: PullRequestWork[];
}

export interface PullRequestWork {
  id: string;
  number: number | null;
  title: string;
  author: string;
  state: PullRequestState;
  createdAt: string | null;
  mergedAt: string | null;
  durationHours: number | null;
  commits: number;
  filesChanged: number;
  newFiles: number;
  additions: number;
  deletions: number;
  languages: Record<string, number>;
  categories: Partial<Record<WorkCategory, number>>;
  signals: WorkSignals;
  session: SessionMetrics | null;
}

export interface WorkSignals {
  touchesTests: boolean;
  touchesConfig: boolean;
  touchesDocs: boolean;
  codeTouchedNoTests: boolean;
  hasRevert: boolean;
  forcePush: boolean;
  netDeletion: boolean;
  hotFiles: string[];
  reviewCount: number;
  approvals: number;
}

export interface SessionMetrics {
  sessionId: string;
  durationMinutes: number;
  userTurns: number;
  toolCalls: number;
  edits: number;
  bashCalls: number;
  errors: number;
  retries: number;
}

export interface WorkFile {
  path: string;
  additions: number;
  deletions: number;
  status: FileStatus;
  language: string;
  category: WorkCategory;
}

export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "unknown";

export interface ExtractedPullRequest {
  id: string;
  number: number | null;
  title: string;
  author: string;
  state: PullRequestState;
  createdAt: string | null;
  mergedAt: string | null;
  durationHours: number | null;
  commits: number;
  files: WorkFile[];
  hasRevert: boolean;
  forcePush: boolean;
  reviewCount: number;
  approvals: number;
  headBranch: string | null;
  baseBranch: string | null;
  mergeCommit: string | null;
  session: SessionMetrics | null;
}

export interface ExtractOptions {
  repoPath: string;
  branch: string;
  generatedAt?: string;
  sessionsRoot?: string;
  includeSessions?: boolean;
  prLimit?: number;
  syntheticLimit?: number;
}

export interface RepoInfo {
  name: string;
  url?: string;
  defaultBranch?: string;
}

export interface ClaudeSession {
  sessionId: string;
  sourcePath: string;
  projectSlug: string | null;
  cwd: string | null;
  branch: string | null;
  startedAt: string | null;
  endedAt: string | null;
  files: string[];
  metrics: SessionMetrics;
}

export interface CommandResult {
  ok: boolean;
  status: number | null;
  stdout: string;
  stderr: string;
  error?: Error;
}
