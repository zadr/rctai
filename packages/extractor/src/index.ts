export { classifyCategory, classifyLanguage, makeWorkFile, summarizeFiles } from "./classify.js";
export { extractWorkModel } from "./extractor.js";
export { extractSyntheticPullRequests, gitNumstatForCommit, readRepoInfo } from "./git.js";
export { extractGithubPullRequests } from "./github.js";
export { attachClaudeSessions, claudeProjectSlug, readClaudeSessions } from "./sessions.js";
export { findSpecRoot, validateWorkModel } from "./validate.js";
export type {
  ClaudeSession,
  CommandResult,
  ExtractedPullRequest,
  ExtractOptions,
  FileStatus,
  PullRequestState,
  PullRequestWork,
  RepoInfo,
  SessionMetrics,
  WorkCategory,
  WorkFile,
  WorkModel,
  WorkSignals
} from "./types.js";
