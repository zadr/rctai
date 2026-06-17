/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */

namespace RctaiBuilder {
  export const VERSION = "0.0.0";
  export const DEFAULT_PORT = 6427;
  export const TILE_UNITS = 32;
  export const DEFAULT_Z = 16;

  export interface Coord {
    x: number;
    y: number;
  }

  export interface CoordD extends Coord {
    z?: number;
    direction?: number;
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
    rides: RidePlan[];
    paths?: PathPlan[];
    scenery?: SceneryPlan[];
  }

  export interface RidePlan {
    id: string;
    name: string;
    archetype: string;
    rideType: string;
    rideObject?: string | null;
    footprint: {
      w: number;
      h: number;
    };
    position: Coord;
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
    axes?: {
      size?: number;
      adventure?: number;
      risk?: number;
    };
    track?: TrackSegmentPlan[] | null;
  }

  export interface TrackSegmentPlan {
    type: number;
    brakeSpeed?: number;
    seatRotation?: number;
    colour?: number;
    chainLift?: boolean;
    inverted?: boolean;
    x?: number;
    y?: number;
    z?: number;
    clearanceZ?: number;
    direction?: number;
    sequence?: number | null;
    raw?: boolean;
  }

  export interface PathPlan {
    from: string;
    to: string;
    waypoints?: Coord[];
  }

  export interface SceneryPlan {
    object: string;
    position: Coord;
    kind?: "small" | "large" | "wall" | "footpath_addition";
  }

  export interface ValidationResult<T> {
    ok: boolean;
    value?: T;
    errors: string[];
  }

  export type GameActionName =
    | "cheatset"
    | "clearscenery"
    | "footpathadditionplace"
    | "footpathplace"
    | "gamesetspeed"
    | "landsetheight"
    | "landsetrights"
    | "largesceneryplace"
    | "mapchangesize"
    | "parksetname"
    | "ridedemolish"
    | "ridecreate"
    | "rideentranceexitplace"
    | "ridesetappearance"
    | "ridesetname"
    | "ridesetstatus"
    | "ridesetvehicle"
    | "smallsceneryplace"
    | "trackplace"
    | "wallplace";

  export interface GameActionResultLike {
    error?: number;
    errorTitle?: string;
    errorMessage?: string;
    ride?: number;
    cost?: number;
    position?: {
      x: number;
      y: number;
      z: number;
    };
  }

  export interface ResolvedRideObject {
    rideTypeId: number;
    rideObjectIndex: number;
  }

  export interface PathObjects {
    surfaceObject: number;
    railingsObject: number;
  }

  export interface TrackCursor {
    x: number;
    y: number;
    z: number;
    direction: number;
  }

  export interface TrackSegmentInfo {
    beginZ: number;
    endZ: number;
    endX: number;
    endY: number;
    beginDirection: number;
    endDirection: number;
  }

  export interface RuntimeCrashEvent {
    vehicleId: number;
    crashIntoType: string;
    ticksElapsed: number;
    monthsElapsed: number;
    monthProgress: number;
  }

  export interface ParkInspection {
    date: {
      ticksElapsed: number;
      monthsElapsed: number;
      monthProgress: number;
      day: number;
      month: number;
      year: number;
    };
    map: {
      width: number;
      height: number;
    };
    rides: ParkInspectionRide[];
    footpaths: ParkInspectionFootpath[];
    crashes: RuntimeCrashEvent[];
  }

  export interface ParkInspectionRide {
    id: number;
    name: string;
    type: number;
    classification: string;
    status: string;
    vehicles?: number[];
    stations: ParkInspectionStation[];
  }

  export interface ParkInspectionStation {
    entrance: CoordD | null;
    exit: CoordD | null;
    start: CoordD | null;
    length: number;
  }

  export interface ParkInspectionFootpath {
    x: number;
    y: number;
    z: number;
    direction?: number;
    slopeDirection?: number | null;
    isQueue?: boolean;
    ride?: number | null;
    station?: number | null;
  }

  export interface ParkInspectionTrack {
    x: number;
    y: number;
    z: number;
    direction: number;
    trackType: number;
    rideType: number;
    ride: number;
    sequence: number | null;
    station: number | null;
    elementIndex?: number;
  }

  export interface ParkInspectionTrackTraversal {
    ride: number;
    station: number;
    closed: boolean;
    complete: boolean;
    steps: number;
    expectedSegments: number;
    visitedSegments: number;
    start: CoordD | null;
    end: CoordD | null;
    reason: string | null;
    repeatKey?: string | null;
    repeatFirstSeen?: number | null;
    repeatAt?: number | null;
    visitedKeys?: string[];
    missingKeys?: string[];
    unexpectedKeys?: string[];
  }

  export interface BuilderAdapter {
    executeAction(
      action: GameActionName,
      args: Record<string, unknown>,
      callback: (result: GameActionResultLike) => void
    ): void;
    resolveRideObject(rideType: string, preferredObject: string | null): ResolvedRideObject | null;
    resolveObject(type: ObjectLookupType, identifier: string): number | null;
    resolvePathObjects(): PathObjects;
    getTrackSegment(type: number): TrackSegmentInfo | null;
    inspectTrackSegments(types: number[]): Record<string, TrackSegmentInfo | null>;
    getSurfaceZ(x: number, y: number): number | null;
    placeRawTrack(args: RawTrackArgs): void;
    clearPathsAndScenery(callback: (result: GameActionResultLike) => void): void;
    getExistingRideIds(): number[];
    inspectPark(): ParkInspection;
    inspectTracks(rideIds: number[] | null): ParkInspectionTrack[];
    inspectTrackTraversals(rideIds: number[] | null): ParkInspectionTrackTraversal[];
    resetRuntimeEvents(): void;
    setGameSpeed(speed: number, callback: (result: GameActionResultLike) => void): void;
    savePark(name: string, callback: (result: GameActionResultLike) => void): void;
    log(message: string): void;
  }

  export interface RawTrackArgs {
    x: number;
    y: number;
    z: number;
    clearanceZ: number;
    direction: number;
    ride: number;
    rideType: number;
    trackType: number;
    sequence: number | null;
    station: number | null;
    brakeBoosterSpeed: number | null;
    colourScheme: number | null;
    seatRotation: number | null;
  }

  export type ObjectLookupType = "small_scenery" | "large_scenery" | "wall" | "footpath_addition";

  export interface BuildStatus {
    queuedJobs: number;
    activeJob: string | null;
    activeStep: string | null;
    pendingAction: boolean;
    completedJobs: number;
    failedActions: number;
    criticalFailedActions: number;
    failedActionDescriptions: string[];
  }
}
