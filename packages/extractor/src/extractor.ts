import { homedir } from "node:os";
import { join } from "node:path";

import { summarizeFiles } from "./classify.js";
import { extractSyntheticPullRequests, normalizeRepoPath, readRepoInfo, resolveGitRoot } from "./git.js";
import { extractGithubPullRequests } from "./github.js";
import { attachClaudeSessions, readClaudeSessions } from "./sessions.js";
import type { ExtractOptions, ExtractedPullRequest, PullRequestWork, WorkModel } from "./types.js";
import { validateWorkModel } from "./validate.js";

const DEFAULT_PR_LIMIT = 100;
const DEFAULT_SYNTHETIC_LIMIT = 50;

export function extractWorkModel(options: ExtractOptions): WorkModel {
  const repoPath = resolveGitRoot(normalizeRepoPath(options.repoPath));
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const repo = readRepoInfo(repoPath, options.branch);
  const ghPrs = extractGithubPullRequests(repoPath, options.branch, options.prLimit ?? DEFAULT_PR_LIMIT);
  const basePrs =
    ghPrs !== null && ghPrs.length > 0
      ? ghPrs
      : extractSyntheticPullRequests(repoPath, options.branch, options.syntheticLimit ?? DEFAULT_SYNTHETIC_LIMIT);
  const prsWithSessions =
    options.includeSessions === false
      ? basePrs.map((pr) => ({ ...pr, session: null }))
      : attachClaudeSessions(
          basePrs,
          readClaudeSessions(options.sessionsRoot ?? join(homedir(), ".claude", "projects"), repoPath),
          repoPath,
          options.branch
        );

  const workModel: WorkModel = {
    schemaVersion: 1,
    repo,
    branch: options.branch,
    generatedAt,
    prs: prsWithSessions.map(toPullRequestWork)
  };

  validateWorkModel(workModel);

  return workModel;
}

function toPullRequestWork(pr: ExtractedPullRequest): PullRequestWork {
  const summary = summarizeFiles(pr.files);

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    author: pr.author,
    state: pr.state,
    createdAt: pr.createdAt,
    mergedAt: pr.mergedAt,
    durationHours: pr.durationHours,
    commits: pr.commits,
    filesChanged: summary.filesChanged,
    newFiles: summary.newFiles,
    additions: summary.additions,
    deletions: summary.deletions,
    languages: summary.languages,
    categories: summary.categories,
    signals: {
      touchesTests: summary.touchesTests,
      touchesConfig: summary.touchesConfig,
      touchesDocs: summary.touchesDocs,
      codeTouchedNoTests: summary.codeTouchedNoTests,
      hasRevert: pr.hasRevert,
      forcePush: pr.forcePush,
      netDeletion: summary.netDeletion,
      hotFiles: summary.hotFiles,
      reviewCount: pr.reviewCount,
      approvals: pr.approvals
    },
    session: pr.session
  };
}
