/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */

namespace RctaiBuilder {
  export const VERSION = "0.0.0";
  export const DEFAULT_PORT = 6427;
  export const TILE_UNITS = 32;
  export const DEFAULT_Z = 14;

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
    | "clearscenery"
    | "footpathadditionplace"
    | "footpathplace"
    | "largesceneryplace"
    | "parksetname"
    | "ridedemolish"
    | "ridecreate"
    | "rideentranceexitplace"
    | "ridesetappearance"
    | "ridesetname"
    | "ridesetstatus"
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

  export interface BuilderAdapter {
    executeAction(
      action: GameActionName,
      args: Record<string, unknown>,
      callback: (result: GameActionResultLike) => void
    ): void;
    resolveRideObject(rideType: string, preferredObject: string | null): ResolvedRideObject | null;
    resolveObject(type: ObjectLookupType, identifier: string): number | null;
    resolvePathObjects(): PathObjects;
    getExistingRideIds(): number[];
    savePark(name: string, callback: (result: GameActionResultLike) => void): void;
    log(message: string): void;
  }

  export type ObjectLookupType = "small_scenery" | "large_scenery" | "wall" | "footpath_addition";

  export interface BuildStatus {
    queuedJobs: number;
    activeJob: string | null;
    activeStep: string | null;
    pendingAction: boolean;
    completedJobs: number;
    failedActions: number;
  }
}
