import { loadRideProfiles } from "./io.js";
import type {
  Archetype,
  Axes,
  ClassifiedRide,
  ClassifierOptions,
  PullRequestWork,
  RideFamily,
  RideProfile,
  RideProfilesFile,
  WorkCategory,
  WorkModel
} from "./types.js";
import { clamp, lerp, roundTo, shorten, stableHash } from "./utils.js";
import { WEIGHTS } from "./weights.js";

const COASTER_CATEGORY = "rollerCoaster";

export function classifyWorkModel(workModel: WorkModel, options: ClassifierOptions = {}): ClassifiedRide[] {
  const rideProfiles = options.rideProfiles ?? loadRideProfiles();

  return workModel.prs.map((pr) => classifyPullRequest(workModel, pr, rideProfiles));
}

export function classifyPullRequest(
  workModel: WorkModel,
  pr: PullRequestWork,
  rideProfiles: RideProfilesFile
): ClassifiedRide {
  const axes = computeAxes(pr);
  const family = selectFamily(pr, axes);
  const profile = selectRideProfile(rideProfiles.rides, family, axes);
  const archetype = archetypeFor(family, profile);

  return {
    id: pr.id,
    name: shorten(pr.title, WEIGHTS.display.nameMaxLength),
    archetype,
    family,
    rideType: profile.name,
    rideObject: null,
    footprint: footprintFor(family, profile, axes),
    colours: coloursForAuthor(workModel.repo.name, pr),
    intensity: intensityFor(family, axes),
    sign: signFor(pr, family, axes),
    axes: roundAxes(axes),
    buildOut: {
      rideProfile: profile.name,
      trackGroups: [...profile.trackGroups],
      isCoaster: profile.buildOut.isCoaster,
      isTower: profile.buildOut.isTower,
      inversions: [...profile.buildOut.inversions],
      helices: [...profile.buildOut.helices],
      steepDrops: [...profile.buildOut.steepDrops],
      banking: [...profile.buildOut.banking],
      supportsLiftHill: profile.buildOut.supportsLiftHill
    },
    track: null
  };
}

export function computeAxes(pr: PullRequestWork): Axes {
  const churn = pr.additions + pr.deletions;
  const size = clamp(
    WEIGHTS.axis.size.churn * (Math.log2(1 + churn) / WEIGHTS.axis.size.churnLogDenominator) +
      WEIGHTS.axis.size.filesChanged *
        (Math.log2(1 + pr.filesChanged) / WEIGHTS.axis.size.filesLogDenominator) +
      WEIGHTS.axis.size.commits * (Math.log2(1 + pr.commits) / WEIGHTS.axis.size.commitsLogDenominator)
  );

  const adventure = clamp(categoryAdventure(pr) + newFilesBonus(pr) + languageBreadthBonus(pr));
  const risk = clamp(
    booleanRisk(pr.signals?.codeTouchedNoTests, WEIGHTS.axis.risk.codeTouchedNoTests) +
      booleanRisk(pr.signals?.netDeletion, WEIGHTS.axis.risk.netDeletion) +
      booleanRisk((pr.signals?.hotFiles?.length ?? 0) > 0, WEIGHTS.axis.risk.hotFilesPresent) +
      booleanRisk(size > 0.6 && (pr.signals?.reviewCount ?? 0) < 1, WEIGHTS.axis.risk.bigDiffNoReview) +
      booleanRisk(pr.signals?.hasRevert, WEIGHTS.axis.risk.hasRevert) +
      booleanRisk(pr.signals?.forcePush, WEIGHTS.axis.risk.forcePush) +
      sessionErrorPressure(pr) * WEIGHTS.axis.risk.sessionErrorPressure
  );

  return { size, adventure, risk };
}

export function selectFamily(pr: PullRequestWork, axes: Axes): RideFamily {
  const docs = categoryValue(pr, "docs");
  const chore = categoryValue(pr, "chore");
  const thresholds = WEIGHTS.selection.thresholds;

  if (docs >= thresholds.docsOrChoreStall || chore >= thresholds.docsOrChoreStall) {
    return "stall";
  }

  if (axes.adventure < thresholds.boringAdventure) {
    return axes.size >= thresholds.bigBoringSize ? "transport" : "gentle";
  }

  if (axes.size < thresholds.compactSize) {
    return axes.risk >= thresholds.riskyThrill ? "thrill" : "coaster:compact";
  }

  if (isConfigBuildDominant(pr) && axes.size >= thresholds.waterMinSize && axes.size < thresholds.waterMaxSize) {
    return "water";
  }

  return axes.size < thresholds.megaSize ? "coaster:mid" : "coaster:mega";
}

export function selectRideProfile(
  profiles: RideProfile[],
  family: RideFamily,
  axes: Axes
): RideProfile {
  const pool = ridePoolForFamily(profiles, family, axes);

  if (pool.length === 0) {
    throw new Error(`No ride profiles available for family ${family}`);
  }

  return [...pool].sort((left, right) => {
    const scoreDelta = rideDistance(left, axes) - rideDistance(right, axes);

    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return left.name.localeCompare(right.name);
  })[0] as RideProfile;
}

function ridePoolForFamily(profiles: RideProfile[], family: RideFamily, axes: Axes): RideProfile[] {
  if (family === "stall") {
    return profiles.filter((profile) => profile.category === "shop");
  }

  if (family === "gentle") {
    return profiles.filter((profile) => profile.category === "gentle");
  }

  if (family === "thrill") {
    const thrillProfiles = profiles.filter((profile) => profile.category === "thrill");

    if (axes.risk >= WEIGHTS.selection.thresholds.towerThrillRisk) {
      const towerProfiles = thrillProfiles.filter((profile) => profile.buildOut.isTower);

      if (towerProfiles.length > 0) {
        return towerProfiles;
      }
    }

    return thrillProfiles;
  }

  if (family === "transport") {
    return profiles.filter((profile) => profile.category === "transport" && !profile.buildOut.isTower);
  }

  if (family === "water") {
    return profiles.filter((profile) => profile.category === "water");
  }

  if (family === "coaster:compact") {
    return profiles.filter((profile) => profile.category === COASTER_CATEGORY && profile.axisProfile.size < 0.5);
  }

  if (family === "coaster:mid") {
    return profiles.filter(
      (profile) =>
        profile.category === COASTER_CATEGORY &&
        profile.axisProfile.size >= 0.5 &&
        profile.axisProfile.size <= WEIGHTS.selection.thresholds.megaSize
    );
  }

  return profiles.filter(
    (profile) =>
      profile.category === COASTER_CATEGORY && profile.axisProfile.size > WEIGHTS.selection.thresholds.megaSize
  );
}

function rideDistance(profile: RideProfile, axes: Axes): number {
  const distanceWeights = WEIGHTS.selection.distance;

  return (
    distanceWeights.size * (axes.size - profile.axisProfile.size) ** 2 +
    distanceWeights.adventure * (axes.adventure - profile.axisProfile.adventure) ** 2 +
    distanceWeights.risk * (axes.risk - profile.axisProfile.risk) ** 2
  );
}

function categoryAdventure(pr: PullRequestWork): number {
  return Object.entries(WEIGHTS.axis.adventure.categories).reduce((total, [category, weight]) => {
    return total + categoryValue(pr, category as WorkCategory) * weight;
  }, 0);
}

function newFilesBonus(pr: PullRequestWork): number {
  const filesChanged = Math.max(pr.filesChanged, 1);

  return WEIGHTS.axis.adventure.newFilesRatio * ((pr.newFiles ?? 0) / filesChanged);
}

function languageBreadthBonus(pr: PullRequestWork): number {
  const languageCount = Object.values(pr.languages ?? {}).filter((changedLines) => changedLines > 0).length;

  if (languageCount <= 1) {
    return 0;
  }

  const maxLanguages = WEIGHTS.axis.adventure.languageBreadthMaxLanguages;
  const breadth = (Math.min(languageCount, maxLanguages) - 1) / Math.max(maxLanguages - 1, 1);

  return WEIGHTS.axis.adventure.languageBreadth * breadth;
}

function categoryValue(pr: PullRequestWork, category: WorkCategory): number {
  return clamp(pr.categories?.[category] ?? 0);
}

function booleanRisk(value: boolean | undefined, weight: number): number {
  return value === true ? weight : 0;
}

function sessionErrorPressure(pr: PullRequestWork): number {
  const session = pr.session;

  if (session === null || session === undefined) {
    return 0;
  }

  return clamp(((session.errors ?? 0) + (session.retries ?? 0)) / Math.max(session.userTurns ?? 0, 1));
}

function isConfigBuildDominant(pr: PullRequestWork): boolean {
  const configBuild = categoryValue(pr, "config") + categoryValue(pr, "build");
  const featureWork =
    categoryValue(pr, "feature") +
    categoryValue(pr, "perf") +
    categoryValue(pr, "refactor") +
    categoryValue(pr, "test");
  const lowAdventureWork = categoryValue(pr, "docs") + categoryValue(pr, "chore");

  return (
    configBuild >= WEIGHTS.selection.thresholds.configBuildDominant &&
    configBuild >= featureWork &&
    configBuild >= lowAdventureWork
  );
}

function archetypeFor(family: RideFamily, profile: RideProfile): Archetype {
  if (family === "stall") {
    return "stall";
  }

  if (family === "transport") {
    return "transport";
  }

  if (family === "water") {
    return "water_flume";
  }

  if (family === "thrill") {
    return profile.buildOut.isTower ? "drop_thrill" : "spinning_compact";
  }

  if (family === "gentle") {
    return "gentle_micro";
  }

  if (family === "coaster:compact") {
    return profile.name.includes("spinning") ? "spinning_compact" : "compact_thrill_coaster";
  }

  if (family === "coaster:mid") {
    return profile.buildOut.inversions.length > 0 ? "looping_coaster" : "dark_long";
  }

  return "mega_coaster";
}

function footprintFor(family: RideFamily, profile: RideProfile, axes: Axes): { w: number; h: number } {
  if (family === "stall") {
    return { w: 1, h: 1 };
  }

  if (profile.buildOut.isTower) {
    return { w: 3, h: 3 };
  }

  if (family === "gentle" || family === "thrill") {
    const side = Math.round(lerp(2, 4, axes.size));
    return { w: side, h: side };
  }

  if (family === "water") {
    return {
      w: Math.round(lerp(6, 10, axes.size)),
      h: Math.round(lerp(5, 7, axes.size))
    };
  }

  if (family === "transport") {
    return {
      w: Math.round(lerp(10, 20, axes.size)),
      h: Math.round(lerp(4, 6, axes.size))
    };
  }

  if (family === "coaster:compact") {
    return { w: 5, h: 4 };
  }

  if (family === "coaster:mid") {
    return { w: 8, h: 6 };
  }

  return {
    w: Math.round(lerp(12, 16, axes.size)),
    h: Math.round(lerp(9, 12, axes.size))
  };
}

function coloursForAuthor(repoName: string, pr: PullRequestWork): ClassifiedRide["colours"] {
  const author = pr.author ?? "unknown";
  const seed = `${repoName}:${author}`;
  const paletteIndex = stableHash(seed) % WEIGHTS.colours.palettes.length;
  const palette = WEIGHTS.colours.palettes[paletteIndex];

  if (palette === undefined) {
    throw new Error("No colour palettes configured");
  }

  return { ...palette };
}

function intensityFor(family: RideFamily, axes: Axes): ClassifiedRide["intensity"] {
  if (family === "stall") {
    return { excitement: 0, intensity: 0, nausea: 0 };
  }

  const config = WEIGHTS.intensity;

  return {
    excitement: roundTo(
      clamp(
        config.nonStallBase +
          config.excitement.size * axes.size +
          config.excitement.adventure * axes.adventure +
          config.excitement.inverseRisk * (1 - axes.risk),
        0,
        10
      ),
      1
    ),
    intensity: roundTo(
      clamp(
        config.nonStallBase +
          config.intensity.size * axes.size +
          config.intensity.adventure * axes.adventure +
          config.intensity.risk * axes.risk,
        0,
        10
      ),
      1
    ),
    nausea: roundTo(
      clamp(
        config.nonStallBase +
          config.nausea.size * axes.size +
          config.nausea.adventure * axes.adventure +
          config.nausea.risk * axes.risk,
        0,
        10
      ),
      1
    )
  };
}

function signFor(pr: PullRequestWork, family: RideFamily, axes: Axes): string {
  const prLabel = pr.number === null || pr.number === undefined ? pr.id : `PR #${pr.number}`;
  const title = shorten(pr.title, WEIGHTS.display.signTitleMaxLength);
  const author = pr.author ?? "unknown";
  const tags: string[] = [];

  if (axes.risk >= WEIGHTS.display.riskyTagRisk) {
    tags.push("RISKY");
  }

  if (
    family === "coaster:mega" &&
    axes.size >= WEIGHTS.display.showpieceSize &&
    axes.adventure >= WEIGHTS.display.showpieceAdventure
  ) {
    tags.push("SHOWPIECE");
  }

  return [`${prLabel} - ${title} (${author})`, ...tags].join(" ");
}

function roundAxes(axes: Axes): Axes {
  return {
    size: roundTo(axes.size, 3),
    adventure: roundTo(axes.adventure, 3),
    risk: roundTo(axes.risk, 3)
  };
}
