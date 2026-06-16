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

export interface RideColours {
  main?: number;
  additional?: number;
  support?: number;
  track?: number;
}

export interface RideIntensity {
  excitement?: number;
  intensity?: number;
  nausea?: number;
}

export interface RideAxes {
  size?: number;
  adventure?: number;
  risk?: number;
}

export interface TrackSegment {
  type: number;
  brakeSpeed?: number;
  seatRotation?: number;
  colour?: number;
}

export interface ClassifiedRide {
  id: string;
  name: string;
  archetype: Archetype;
  rideType: string;
  rideObject?: string | null;
  footprint: Footprint;
  position?: Coord;
  rotation?: number;
  colours?: RideColours;
  intensity?: RideIntensity;
  sign?: string;
  axes?: RideAxes;
  track?: TrackSegment[] | null;
  [key: string]: unknown;
}

export type LaidOutRide<Ride extends ClassifiedRide = ClassifiedRide> = Omit<
  Ride,
  "position" | "rotation"
> & {
  id: string;
  name: string;
  archetype: Archetype;
  rideType: string;
  rideObject?: string | null;
  footprint: Footprint;
  colours?: RideColours;
  intensity?: RideIntensity;
  sign?: string;
  axes?: RideAxes;
  track?: TrackSegment[] | null;
  position: Coord;
  rotation: number;
};

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

export interface ParkPlan<Ride extends LaidOutRide = LaidOutRide> {
  schemaVersion: 1;
  park: {
    name: string;
    size: {
      width: number;
      height: number;
    };
    baseScenario: string | null;
    entrance: CoordD;
  };
  rides: Ride[];
  paths: ParkPath[];
  scenery: Scenery[];
}

export interface WorkModelPr {
  id: string;
  createdAt?: string | null;
  mergedAt?: string | null;
}

export interface WorkModelMinimal {
  repo?: {
    name?: string;
  };
  prs?: WorkModelPr[];
}

export interface LayoutOptions {
  workModel?: WorkModelMinimal;
  parkName?: string;
  baseScenario?: string | null;
}

export interface LayoutInput<Ride extends ClassifiedRide = ClassifiedRide> extends LayoutOptions {
  rides: readonly Ride[];
}
