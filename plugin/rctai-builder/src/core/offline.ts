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
}
