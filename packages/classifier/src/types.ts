export type WorkCategory =
  | "feature"
  | "perf"
  | "refactor"
  | "test"
  | "build"
  | "config"
  | "chore"
  | "docs";

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
  number?: number | null;
  title: string;
  author?: string;
  state?: "open" | "merged" | "closed" | "synthetic";
  createdAt?: string | null;
  mergedAt?: string | null;
  durationHours?: number | null;
  commits: number;
  filesChanged: number;
  newFiles?: number;
  additions: number;
  deletions: number;
  languages?: Record<string, number>;
  categories?: Partial<Record<WorkCategory, number>>;
  signals?: {
    touchesTests?: boolean;
    touchesConfig?: boolean;
    touchesDocs?: boolean;
    codeTouchedNoTests?: boolean;
    hasRevert?: boolean;
    forcePush?: boolean;
    netDeletion?: boolean;
    hotFiles?: string[];
    reviewCount?: number;
    approvals?: number;
  };
  session?: {
    sessionId?: string;
    durationMinutes?: number;
    userTurns?: number;
    toolCalls?: number;
    edits?: number;
    bashCalls?: number;
    errors?: number;
    retries?: number;
  } | null;
}

export interface Axes {
  size: number;
  adventure: number;
  risk: number;
}

export type RideFamily =
  | "stall"
  | "gentle"
  | "thrill"
  | "transport"
  | "water"
  | "coaster:compact"
  | "coaster:mid"
  | "coaster:mega";

export type Archetype =
  | "gentle_micro"
  | "drop_thrill"
  | "spinning_compact"
  | "compact_thrill_coaster"
  | "transport"
  | "dark_long"
  | "looping_coaster"
  | "mega_coaster"
  | "water_flume"
  | "stall";

export interface RideProfilesFile {
  schemaVersion: number;
  count: number;
  inversionVocab: string[];
  rides: RideProfile[];
}

export interface RideProfile {
  name: string;
  category: "gentle" | "rollerCoaster" | "shop" | "thrill" | "transport" | "water";
  trackGroups: string[];
  hasInversions: boolean;
  hasGForces: boolean;
  ratingsMultipliers: [number, number, number] | null;
  heights: [number, number, number, number] | null;
  axisProfile: Axes;
  buildOut: RideProfileBuildOut;
}

export interface RideProfileBuildOut {
  isCoaster: boolean;
  isTower: boolean;
  inversions: string[];
  helices: string[];
  steepDrops: string[];
  banking: string[];
  supportsLiftHill: boolean;
}

export interface ClassifiedRide {
  id: string;
  name: string;
  archetype: Archetype;
  family: RideFamily;
  rideType: string;
  rideObject: null;
  footprint: { w: number; h: number };
  colours: {
    main: number;
    additional: number;
    support: number;
    track: number;
  };
  intensity: {
    excitement: number;
    intensity: number;
    nausea: number;
  };
  sign: string;
  axes: Axes;
  buildOut: RideProfileBuildOut & {
    rideProfile: string;
    trackGroups: string[];
  };
  track: null;
}

export interface ClassifierOptions {
  rideProfiles?: RideProfilesFile;
}
