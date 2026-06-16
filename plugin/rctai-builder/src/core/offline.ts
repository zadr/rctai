/* eslint-disable @typescript-eslint/no-namespace */

namespace RctaiBuilder {
  export interface OfflineRunResult {
    status: RctaiBuilder.BuildStatus;
    actions: OfflineActionRecord[];
    logs: string[];
  }

  export interface OfflineActionRecord {
    action: string;
    args: Record<string, unknown>;
  }

  export class FakeGameAdapter implements RctaiBuilder.BuilderAdapter {
    readonly actions: OfflineActionRecord[] = [];
    readonly logs: string[] = [];
    private nextRideId = 1;
    private readonly rideIds: number[] = [];

    executeAction(
      action: RctaiBuilder.GameActionName,
      args: Record<string, unknown>,
      callback: (result: RctaiBuilder.GameActionResultLike) => void
    ): void {
      this.actions.push({ action, args });

      if (action === "ridecreate") {
        const validationError = validateRideCreateArgs(args);
        if (validationError !== null) {
          callback({
            error: 1,
            errorTitle: "Invalid ridecreate",
            errorMessage: validationError
          });
          return;
        }

        const ride = this.nextRideId;
        this.nextRideId += 1;
        this.rideIds.push(ride);
        callback({ ride });
        return;
      }

      if (action === "ridedemolish" && typeof args.ride === "number") {
        const index = this.rideIds.indexOf(args.ride);
        if (index >= 0) {
          this.rideIds.splice(index, 1);
        }
      }

      callback({});
    }

    resolveRideObject(rideType: string, preferredObject: string | null): RctaiBuilder.ResolvedRideObject | null {
      const rideTypeId = RctaiBuilder.resolveRideTypeId(rideType);
      if (rideTypeId === null) {
        return null;
      }
      return {
        rideTypeId,
        rideObjectIndex: preferredObject === null ? 0 : stableIndex(preferredObject)
      };
    }

    resolveObject(_type: RctaiBuilder.ObjectLookupType, identifier: string): number | null {
      return stableIndex(identifier);
    }

    resolvePathObjects(): RctaiBuilder.PathObjects {
      return { surfaceObject: 0, railingsObject: 0 };
    }

    getTrackSegment(type: number): RctaiBuilder.TrackSegmentInfo | null {
      return getOfflineTrackSegment(type);
    }

    placeRawTrack(args: RctaiBuilder.RawTrackArgs): void {
      this.actions.push({ action: "rawtrack", args: args as unknown as Record<string, unknown> });
    }

    getExistingRideIds(): number[] {
      return [...this.rideIds];
    }

    savePark(name: string, callback: (result: RctaiBuilder.GameActionResultLike) => void): void {
      this.actions.push({ action: "save", args: { name } });
      callback({});
    }

    log(message: string): void {
      this.logs.push(message);
    }
  }

  export function runOfflinePlan(plan: RctaiBuilder.ParkPlan, maxTicks = 20_000): OfflineRunResult {
    const validation = RctaiBuilder.validatePlanShape(plan);
    if (!validation.ok || validation.value === undefined) {
      throw new Error(`invalid park plan: ${validation.errors.join("; ")}`);
    }

    const adapter = new FakeGameAdapter();
    const controller = new RctaiBuilder.BuildController(adapter);
    controller.enqueueBuild(validation.value);
    const status = controller.runUntilIdle(maxTicks);

    return {
      status,
      actions: adapter.actions,
      logs: adapter.logs
    };
  }

  function stableIndex(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash % 128;
  }

  function validateRideCreateArgs(args: Record<string, unknown>): string | null {
    const requiredNumbers = ["rideType", "rideObject", "entranceObject", "colour1", "colour2", "inspectionInterval"];
    for (const key of requiredNumbers) {
      if (typeof args[key] !== "number") {
        return `${key} must be a number`;
      }
    }

    if (args.colour1 !== 0 || args.colour2 !== 0) {
      return "ridecreate colour1/colour2 are colour preset indices and must use safe default 0";
    }

    return null;
  }

  function getOfflineTrackSegment(type: number): RctaiBuilder.TrackSegmentInfo | null {
    const straight = { beginZ: 0, endZ: 0, endX: 0, endY: 0, beginDirection: 0, endDirection: 0 };
    const oneTileTurnLeft = { beginZ: 0, endZ: 0, endX: 0, endY: 0, beginDirection: 0, endDirection: 3 };
    const oneTileTurnRight = { beginZ: 0, endZ: 0, endX: 0, endY: 0, beginDirection: 0, endDirection: 1 };
    const known: Record<number, RctaiBuilder.TrackSegmentInfo> = {
      0: straight,
      1: straight,
      2: straight,
      3: straight,
      4: { ...straight, endZ: 16 },
      6: { ...straight, endZ: 8 },
      9: { ...straight, beginZ: 0, endZ: 8 },
      10: { ...straight, beginZ: 16, endZ: 0 },
      12: { ...straight, beginZ: 8, endZ: 0 },
      15: { ...straight, beginZ: 8, endZ: 0 },
      16: { beginZ: 0, endZ: 0, endX: -64, endY: -64, beginDirection: 0, endDirection: 3 },
      17: { beginZ: 0, endZ: 0, endX: -64, endY: 64, beginDirection: 0, endDirection: 1 },
      22: { beginZ: 0, endZ: 0, endX: -64, endY: -64, beginDirection: 0, endDirection: 3 },
      23: { beginZ: 0, endZ: 0, endX: -64, endY: 64, beginDirection: 0, endDirection: 1 },
      40: { beginZ: 0, endZ: 0, endX: -64, endY: 0, beginDirection: 0, endDirection: 0 },
      41: { beginZ: 0, endZ: 0, endX: -64, endY: 0, beginDirection: 0, endDirection: 0 },
      42: { beginZ: 0, endZ: 0, endX: -32, endY: -32, beginDirection: 0, endDirection: 3 },
      43: { beginZ: 0, endZ: 0, endX: -32, endY: 32, beginDirection: 0, endDirection: 1 },
      50: oneTileTurnLeft,
      51: oneTileTurnRight,
      99: straight,
      100: straight,
      216: straight
    };
    return known[type] ?? straight;
  }
}
