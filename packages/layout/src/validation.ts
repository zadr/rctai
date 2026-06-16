import AjvModule, { type ErrorObject } from "ajv";
import { join } from "node:path";

import { findRepoRoot, readJsonFile } from "./io.js";
import type { Coord, LaidOutRide, ParkPath, ParkPlan } from "./types.js";

const Ajv = AjvModule.default;

export interface Overlap {
  left: string;
  right: string;
}

export interface LayoutInspection {
  overlaps: Overlap[];
  disconnectedRideIds: string[];
  invalidPathRefs: string[];
  outOfBoundsRideIds: string[];
}

export class LayoutValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid park layout:\n${issues.map((issue) => `- ${issue}`).join("\n")}`);
    this.name = "LayoutValidationError";
    this.issues = issues;
  }
}

export function validateParkPlanSchema(plan: unknown, repoRoot = findRepoRoot()): asserts plan is ParkPlan {
  const schema = readJsonFile(join(repoRoot, "schemas", "park-plan.schema.json"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as Record<string, unknown>);

  if (!validate(plan)) {
    throw new Error(`Invalid park-plan output:\n${formatAjvErrors(validate.errors ?? [])}`);
  }
}

export function inspectLayout(plan: ParkPlan): LayoutInspection {
  return {
    overlaps: findOverlaps(plan.rides),
    disconnectedRideIds: disconnectedRideIds(plan.rides, plan.paths),
    invalidPathRefs: invalidPathRefs(plan.rides, plan.paths),
    outOfBoundsRideIds: outOfBoundsRideIds(plan)
  };
}

export function assertValidLayout(plan: ParkPlan): void {
  const inspection = inspectLayout(plan);
  const issues: string[] = [];

  for (const overlap of inspection.overlaps) {
    issues.push(`Ride bounding boxes overlap: ${overlap.left} and ${overlap.right}`);
  }

  for (const id of inspection.disconnectedRideIds) {
    issues.push(`Ride is not path-connected to the entrance: ${id}`);
  }

  for (const ref of inspection.invalidPathRefs) {
    issues.push(`Path references an unknown node: ${ref}`);
  }

  for (const id of inspection.outOfBoundsRideIds) {
    issues.push(`Ride is outside park bounds: ${id}`);
  }

  if (issues.length > 0) {
    throw new LayoutValidationError(issues);
  }
}

function findOverlaps(rides: readonly LaidOutRide[]): Overlap[] {
  const overlaps: Overlap[] = [];

  for (let leftIndex = 0; leftIndex < rides.length; leftIndex += 1) {
    const left = rides[leftIndex];

    if (!left) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < rides.length; rightIndex += 1) {
      const right = rides[rightIndex];

      if (!right) {
        continue;
      }

      if (boxesOverlap(left, right)) {
        overlaps.push({ left: left.id, right: right.id });
      }
    }
  }

  return overlaps;
}

function boxesOverlap(left: LaidOutRide, right: LaidOutRide): boolean {
  const leftMaxX = left.position.x + left.footprint.w;
  const leftMaxY = left.position.y + left.footprint.h;
  const rightMaxX = right.position.x + right.footprint.w;
  const rightMaxY = right.position.y + right.footprint.h;

  return (
    left.position.x < rightMaxX &&
    leftMaxX > right.position.x &&
    left.position.y < rightMaxY &&
    leftMaxY > right.position.y
  );
}

function disconnectedRideIds(rides: readonly LaidOutRide[], paths: readonly ParkPath[]): string[] {
  const rideIds = new Set(rides.map((ride) => ride.id));
  const graph = new Map<string, Set<string>>();

  graph.set("entrance", new Set());
  for (const id of rideIds) {
    graph.set(id, new Set());
  }

  for (const path of paths) {
    if (!graph.has(path.from) || !graph.has(path.to)) {
      continue;
    }

    addEdge(graph, path.from, path.to);
    addEdge(graph, path.to, path.from);
  }

  const visited = new Set<string>();
  const queue = ["entrance"];

  while (queue.length > 0) {
    const node = queue.shift();

    if (node === undefined || visited.has(node)) {
      continue;
    }

    visited.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!visited.has(next)) {
        queue.push(next);
      }
    }
  }

  return [...rideIds].filter((id) => !visited.has(id)).sort((left, right) => left.localeCompare(right));
}

function addEdge(graph: Map<string, Set<string>>, from: string, to: string): void {
  const neighbors = graph.get(from);

  if (neighbors) {
    neighbors.add(to);
  }
}

function invalidPathRefs(rides: readonly LaidOutRide[], paths: readonly ParkPath[]): string[] {
  const known = new Set(["entrance", ...rides.map((ride) => ride.id)]);
  const invalid = new Set<string>();

  for (const path of paths) {
    if (!known.has(path.from)) {
      invalid.add(path.from);
    }

    if (!known.has(path.to)) {
      invalid.add(path.to);
    }
  }

  return [...invalid].sort((left, right) => left.localeCompare(right));
}

function outOfBoundsRideIds(plan: ParkPlan): string[] {
  return plan.rides
    .filter((ride) => {
      const min: Coord = ride.position;
      const max: Coord = {
        x: ride.position.x + ride.footprint.w,
        y: ride.position.y + ride.footprint.h
      };

      return (
        min.x < 0 ||
        min.y < 0 ||
        max.x > plan.park.size.width ||
        max.y > plan.park.size.height
      );
    })
    .map((ride) => ride.id)
    .sort((left, right) => left.localeCompare(right));
}

function formatAjvErrors(errors: ErrorObject[]): string {
  if (errors.length === 0) {
    return "schema validation failed without a detailed error";
  }

  return errors
    .map((error) => {
      const location = error.instancePath === "" ? "/" : error.instancePath;
      return `- ${location} ${error.message ?? "is invalid"}`;
    })
    .join("\n");
}
