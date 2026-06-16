import type { WorkCategory } from "./types.js";

export const WEIGHTS = {
  axis: {
    size: {
      churnLogDenominator: 12,
      filesLogDenominator: 7,
      commitsLogDenominator: 5,
      churn: 0.6,
      filesChanged: 0.25,
      commits: 0.15
    },
    adventure: {
      categories: {
        feature: 1,
        perf: 0.8,
        refactor: 0.6,
        test: 0.3,
        build: 0.2,
        config: 0.15,
        chore: 0.1,
        docs: 0.05
      } satisfies Record<WorkCategory, number>,
      newFilesRatio: 0.15,
      languageBreadth: 0.1,
      languageBreadthMaxLanguages: 4
    },
    risk: {
      codeTouchedNoTests: 0.3,
      netDeletion: 0.25,
      hotFilesPresent: 0.2,
      bigDiffNoReview: 0.2,
      hasRevert: 0.2,
      forcePush: 0.15,
      sessionErrorPressure: 0.2
    }
  },
  selection: {
    distance: {
      size: 1,
      adventure: 1.2,
      risk: 1.2
    },
    thresholds: {
      docsOrChoreStall: 0.8,
      boringAdventure: 0.4,
      bigBoringSize: 0.55,
      compactSize: 0.42,
      megaSize: 0.72,
      waterMinSize: 0.4,
      waterMaxSize: 0.8,
      configBuildDominant: 0.55,
      riskyThrill: 0.6,
      towerThrillRisk: 0.85
    },
    distribution: {
      minBatchSize: 8,
      lowCodeStallMinShare: 0.35,
      lowCodeStallRank: 0.92,
      configBuildWaterMinShare: 0.3,
      configBuildWaterRank: 0.92
    }
  },
  display: {
    riskyTagRisk: 0.75,
    showpieceSize: 0.9,
    showpieceAdventure: 0.7,
    nameMaxLength: 32,
    signTitleMaxLength: 36
  },
  intensity: {
    nonStallBase: 0.5,
    excitement: {
      size: 2.1,
      adventure: 5.7,
      inverseRisk: 0.8
    },
    intensity: {
      size: 2.4,
      adventure: 1.4,
      risk: 6
    },
    nausea: {
      size: 1.4,
      adventure: 1.6,
      risk: 4.8
    }
  },
  colours: {
    palettes: [
      { main: 6, additional: 14, support: 1, track: 0 },
      { main: 22, additional: 20, support: 18, track: 2 },
      { main: 21, additional: 23, support: 12, track: 0 },
      { main: 24, additional: 0, support: 0, track: 0 },
      { main: 13, additional: 27, support: 3, track: 2 },
      { main: 10, additional: 18, support: 4, track: 1 },
      { main: 30, additional: 8, support: 2, track: 0 },
      { main: 26, additional: 31, support: 17, track: 3 },
      { main: 15, additional: 11, support: 5, track: 1 },
      { main: 28, additional: 9, support: 16, track: 2 }
    ]
  }
} as const;
