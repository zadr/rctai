/* eslint-disable @typescript-eslint/no-namespace */

namespace RctaiBuilder {
  export interface JobState {
    rideIds: Record<string, number>;
    rideTypes: Record<string, number>;
    trackCursors: Record<string, RctaiBuilder.TrackCursor>;
  }

  export interface QueuedStep {
    description: string;
    run(adapter: RctaiBuilder.BuilderAdapter, state: JobState, done: (result: RctaiBuilder.GameActionResultLike) => void): void;
    onSuccess?: (result: RctaiBuilder.GameActionResultLike, state: JobState) => void;
  }

  interface BuildJob {
    id: string;
    label: string;
    steps: QueuedStep[];
    state: JobState;
    cursor: number;
  }

  export class BuildController implements RctaiBuilder.BuildControllerPort {
    private readonly adapter: RctaiBuilder.BuilderAdapter;
    private readonly jobs: BuildJob[] = [];
    private active: BuildJob | null = null;
    private pendingStep: QueuedStep | null = null;
    private pending = false;
    private nextJobNumber = 1;
    private completedJobs = 0;
    private failedActions = 0;

    constructor(adapter: RctaiBuilder.BuilderAdapter) {
      this.adapter = adapter;
    }

    enqueueBuild(plan: RctaiBuilder.ParkPlan): string {
      const id = this.nextJobId("build");
      this.jobs.push({
        id,
        label: `build ${plan.park.name}`,
        steps: RctaiBuilder.createBuildSteps(plan),
        state: { rideIds: {}, rideTypes: {}, trackCursors: {} },
        cursor: 0
      });
      return id;
    }

    enqueueClear(): string {
      const id = this.nextJobId("clear");
      this.jobs.push({
        id,
        label: "clear park",
        steps: RctaiBuilder.createClearSteps(this.adapter),
        state: { rideIds: {}, rideTypes: {}, trackCursors: {} },
        cursor: 0
      });
      return id;
    }

    enqueueSave(name: string): string {
      const id = this.nextJobId("save");
      this.jobs.push({
        id,
        label: `save ${name}`,
        steps: [RctaiBuilder.createSaveStep(name)],
        state: { rideIds: {}, rideTypes: {}, trackCursors: {} },
        cursor: 0
      });
      return id;
    }

    tick(): void {
      if (this.pending) {
        return;
      }

      if (this.active === null) {
        this.active = this.jobs.shift() ?? null;
      }

      if (this.active === null) {
        return;
      }

      const step = this.active.steps[this.active.cursor];
      if (step === undefined) {
        this.adapter.log(`[rctai-builder] completed ${this.active.id}: ${this.active.label}`);
        this.completedJobs += 1;
        this.active = null;
        return;
      }

      this.pending = true;
      this.pendingStep = step;
      step.run(this.adapter, this.active.state, (result) => {
        this.handleStepResult(step, result);
      });
    }

    runUntilIdle(maxTicks = 10_000): RctaiBuilder.BuildStatus {
      for (let tick = 0; tick < maxTicks; tick += 1) {
        if (this.isIdle()) {
          return this.getStatus();
        }
        this.tick();
      }
      throw new Error(`builder queue did not drain after ${maxTicks} ticks`);
    }

    getStatus(): RctaiBuilder.BuildStatus {
      return {
        queuedJobs: this.jobs.length,
        activeJob: this.active?.id ?? null,
        activeStep: this.pendingStep?.description ?? null,
        pendingAction: this.pending,
        completedJobs: this.completedJobs,
        failedActions: this.failedActions
      };
    }

    private isIdle(): boolean {
      return this.active === null && this.jobs.length === 0 && !this.pending;
    }

    private handleStepResult(step: QueuedStep, result: RctaiBuilder.GameActionResultLike): void {
      const active = this.active;
      if (active === null) {
        this.pending = false;
        this.pendingStep = null;
        return;
      }

      if (result.error !== undefined && result.error !== 0) {
        this.failedActions += 1;
        this.adapter.log(
          `[rctai-builder] action failed; skipping: ${step.description}: ${RctaiBuilder.formatGameActionError(result)}`
        );
      } else {
        step.onSuccess?.(result, active.state);
      }

      active.cursor += 1;
      this.pending = false;
      this.pendingStep = null;
    }

    private nextJobId(prefix: string): string {
      const id = `${prefix}-${this.nextJobNumber}`;
      this.nextJobNumber += 1;
      return id;
    }
  }

  export function createGameActionStep(
    description: string,
    action: RctaiBuilder.GameActionName,
    argsFactory: (adapter: RctaiBuilder.BuilderAdapter, state: JobState) => Record<string, unknown> | null,
    onSuccess?: (result: RctaiBuilder.GameActionResultLike, state: JobState) => void
  ): QueuedStep {
    const step: QueuedStep = {
      description,
      run(adapter, state, done) {
        const args = argsFactory(adapter, state);
        if (args === null) {
          adapter.log(`[rctai-builder] skipped: ${description}`);
          done({});
          return;
        }
        adapter.executeAction(action, args, done);
      }
    };
    if (onSuccess !== undefined) {
      step.onSuccess = onSuccess;
    }
    return step;
  }

  export function createAdapterStep(
    description: string,
    run: (
      adapter: RctaiBuilder.BuilderAdapter,
      state: JobState,
      done: (result: RctaiBuilder.GameActionResultLike) => void
    ) => void
  ): QueuedStep {
    return { description, run };
  }

  export function formatGameActionError(result: RctaiBuilder.GameActionResultLike): string {
    const parts = [String(result.error ?? "unknown")];
    if (result.errorTitle !== undefined) {
      parts.push(result.errorTitle);
    }
    if (result.errorMessage !== undefined) {
      parts.push(result.errorMessage);
    }
    return parts.join(" - ");
  }
}
