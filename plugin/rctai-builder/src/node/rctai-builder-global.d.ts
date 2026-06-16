declare namespace RctaiBuilder {
  interface ParkPlan {
    schemaVersion: 1;
    park: {
      name: string;
      size: {
        width: number;
        height: number;
      };
      entrance: {
        x: number;
        y: number;
      };
    };
    rides: unknown[];
    paths?: unknown[];
    scenery?: unknown[];
  }

  interface ValidationResult<T> {
    ok: boolean;
    value?: T;
    errors: string[];
  }

  interface OfflineRunResult {
    status: {
      queuedJobs: number;
      activeJob: string | null;
      activeStep: string | null;
      pendingAction: boolean;
      completedJobs: number;
      failedActions: number;
    };
    actions: unknown[];
    logs: string[];
  }

  function validatePlanShape(input: unknown): ValidationResult<ParkPlan>;
  function runOfflinePlan(plan: ParkPlan, maxTicks?: number): OfflineRunResult;
}
