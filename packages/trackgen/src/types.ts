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

export type RideProfileCategory = "gentle" | "rollerCoaster" | "shop" | "thrill" | "transport" | "water";

export interface RideProfileBuildOut {
  isCoaster: boolean;
  isTower: boolean;
  inversions: string[];
  helices: string[];
  steepDrops: string[];
  banking: string[];
  supportsLiftHill: boolean;
  rideProfile?: string;
  trackGroups?: string[];
}

export interface RideProfile {
  name: string;
  category: RideProfileCategory;
  trackGroups: string[];
  hasInversions: boolean;
  hasGForces: boolean;
  ratingsMultipliers: [number, number, number] | null;
  heights: [number, number, number, number] | null;
  axisProfile: Axes;
  buildOut: RideProfileBuildOut;
}

export interface RideProfilesFile {
  schemaVersion: number;
  count: number;
  inversionVocab: string[];
  rides: RideProfile[];
}

export interface Coord {
  x: number;
  y: number;
}

export interface CoordD extends Coord {
  z?: number;
  direction?: number;
}

export interface Footprint {
  w: number;
  h: number;
}

export interface TrackSegment {
  type: number;
  brakeSpeed?: number;
  seatRotation?: number;
  colour?: number;
}

export interface TrackgenRide {
  id: string;
  name: string;
  archetype: Archetype;
  family?: RideFamily;
  rideType: string;
  rideObject?: string | null;
  footprint: Footprint;
  position?: Coord;
  rotation?: number;
  colours?: {
    main?: number;
    additional?: number;
    support?: number;
    track?: number;
  };
  intensity?: {
    excitement?: number;
    intensity?: number;
    nausea?: number;
  };
  sign?: string;
  axes?: Partial<Axes>;
  buildOut?: RideProfileBuildOut;
  track?: TrackSegment[] | null;
}

export interface ParkPath {
  from: string;
  to: string;
  waypoints?: Coord[];
}

export interface Scenery {
  object: string;
  position: Coord;
  kind?: "small" | "large" | "wall" | "footpath_addition";
}

export interface ParkPlan {
  schemaVersion: 1;
  park: {
    name: string;
    size: {
      width: number;
      height: number;
    };
    baseScenario?: string | null;
    entrance: CoordD;
  };
  rides: TrackgenRide[];
  paths?: ParkPath[];
  scenery?: Scenery[];
}

export type TrackgenInput = TrackgenRide[] | ParkPlan;

export type GeneratedRideKind = "coaster" | "water" | "transport" | "tower" | "flat";

export type FirstDropKind = "flat" | "down25" | "down60" | "down90";

export interface RideTrackMetadata {
  rideId: string;
  rideType: string;
  resolvedRideType: string;
  family: RideFamily;
  category: RideProfileCategory;
  kind: GeneratedRideKind;
  buildOutSource: "ride" | "profile";
  trackSegmentCount: number;
  stationLength?: number;
  liftHillSegments?: number;
  firstDrop?: FirstDropKind;
  inversionBudget?: number;
  inversionGroups?: string[];
  helixCount?: number;
  bankedTurnCount?: number;
  airtimeHillCount?: number;
  brakeCount?: number;
  towerHeight?: number;
  towerMode?: string;
  transportLoopLength?: number;
  flatFootprintHint?: Footprint;
}

export interface TrackgenOptions {
  repoRoot?: string;
  rideProfiles?: RideProfilesFile;
}

export interface TrackgenResult<TOutput> {
  output: TOutput;
  metadata: Record<string, RideTrackMetadata>;
  specChangeNotes: string[];
}
