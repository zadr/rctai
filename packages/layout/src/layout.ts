import type {
  ClassifiedRide,
  Coord,
  LayoutInput,
  LayoutOptions,
  LaidOutRide,
  ParkPath,
  ParkPlan,
  WorkModelMinimal
} from "./types.js";

const MIN_PARK_SIZE = 16;
const PARK_GRID = 4;
const LEFT_MARGIN = 6;
const RIGHT_MARGIN = 6;
const TOP_MARGIN = 12;
const BOTTOM_MARGIN = 6;
const COLUMN_GAP = 2;
const ROW_GAP = 2;

interface OrderedRide<Ride extends ClassifiedRide> {
  ride: Ride;
  inputIndex: number;
  orderIndex: number;
  cell: PackingCell;
}

interface PackingCell {
  width: number;
  height: number;
  padding: number;
}

interface PlacedRide<Ride extends ClassifiedRide> extends OrderedRide<Ride> {
  position: Coord;
}

export function layoutPark<Ride extends ClassifiedRide>(
  input: LayoutInput<Ride>
): ParkPlan<LaidOutRide<Ride>> {
  ensureUniqueRideIds(input.rides);

  const orderedRides = orderRides(input.rides, input.workModel).map((entry) => ({
    ...entry,
    cell: cellForRide(entry.ride)
  }));
  const placedRides = packRides(orderedRides);
  const laidOutRides = placedRides.map((entry) =>
    withLayoutFields(entry.ride, entry.position, rotationForRide())
  );
  const size = parkSizeFor(laidOutRides);
  const entrance = entranceFor(size.width);
  const paths = pathsForChronologicalSpine(laidOutRides, entrance);

  return {
    schemaVersion: 1,
    park: {
      name: parkNameFor(input),
      size,
      baseScenario: input.baseScenario ?? null,
      entrance
    },
    rides: laidOutRides,
    paths,
    scenery: []
  };
}

export function layoutRides<Ride extends ClassifiedRide>(
  rides: readonly Ride[],
  options: LayoutOptions = {}
): ParkPlan<LaidOutRide<Ride>> {
  return layoutPark({ rides, ...options });
}

function orderRides<Ride extends ClassifiedRide>(
  rides: readonly Ride[],
  workModel: WorkModelMinimal | undefined
): Array<Omit<OrderedRide<Ride>, "cell">> {
  const mergeOrder = mergeOrderFor(workModel);
  const fallbackStart = mergeOrder.size;

  return rides
    .map((ride, inputIndex) => ({
      ride,
      inputIndex,
      orderIndex: mergeOrder.get(ride.id) ?? fallbackStart + inputIndex
    }))
    .sort((left, right) => {
      if (left.orderIndex !== right.orderIndex) {
        return left.orderIndex - right.orderIndex;
      }

      if (left.inputIndex !== right.inputIndex) {
        return left.inputIndex - right.inputIndex;
      }

      return left.ride.id.localeCompare(right.ride.id);
    });
}

function mergeOrderFor(workModel: WorkModelMinimal | undefined): Map<string, number> {
  const prs = workModel?.prs ?? [];
  const ordered = prs
    .map((pr, index) => ({
      id: pr.id,
      index,
      timestamp: timestampFor(pr.mergedAt) ?? timestampFor(pr.createdAt) ?? Number.POSITIVE_INFINITY
    }))
    .sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp;
      }

      if (left.index !== right.index) {
        return left.index - right.index;
      }

      return left.id.localeCompare(right.id);
    });
  const result = new Map<string, number>();

  ordered.forEach((entry, index) => {
    result.set(entry.id, index);
  });

  return result;
}

function timestampFor(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function packRides<Ride extends ClassifiedRide>(rides: readonly OrderedRide<Ride>[]): PlacedRide<Ride>[] {
  if (rides.length === 0) {
    return [];
  }

  const targetWidth = targetShelfWidth(rides.map((entry) => entry.cell));
  const placed: PlacedRide<Ride>[] = [];
  let cursorX = 0;
  let cursorY = 0;
  let shelfHeight = 0;

  for (const entry of rides) {
    if (cursorX > 0 && cursorX + entry.cell.width > targetWidth) {
      cursorX = 0;
      cursorY += shelfHeight + ROW_GAP;
      shelfHeight = 0;
    }

    placed.push({
      ...entry,
      position: {
        x: LEFT_MARGIN + cursorX + entry.cell.padding,
        y: TOP_MARGIN + cursorY + entry.cell.padding
      }
    });

    cursorX += entry.cell.width + COLUMN_GAP;
    shelfHeight = Math.max(shelfHeight, entry.cell.height);
  }

  return placed;
}

function targetShelfWidth(cells: readonly PackingCell[]): number {
  const totalArea = cells.reduce((sum, cell) => sum + cell.width * cell.height, 0);
  const widest = cells.reduce((max, cell) => Math.max(max, cell.width), 0);
  const target = Math.ceil(Math.sqrt(totalArea) * 1.55);

  return Math.max(MIN_PARK_SIZE, widest, target);
}

function cellForRide(ride: ClassifiedRide): PackingCell {
  const footprint = validatedFootprint(ride);
  const size = sizeAxisForRide(ride);
  const padding = 2 + Math.round(size * 3);
  const sizeSlack = Math.round(size * 2);

  return {
    width: footprint.w + padding * 2 + sizeSlack,
    height: footprint.h + padding * 2 + Math.round(size),
    padding
  };
}

function validatedFootprint(ride: ClassifiedRide): { w: number; h: number } {
  const { w, h } = ride.footprint;

  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
    throw new Error(`Ride ${ride.id} has an invalid footprint ${JSON.stringify(ride.footprint)}`);
  }

  return { w, h };
}

function sizeAxisForRide(ride: ClassifiedRide): number {
  const size = ride.axes?.size;

  if (typeof size === "number" && Number.isFinite(size)) {
    return clamp(size);
  }

  const footprintArea = ride.footprint.w * ride.footprint.h;
  return clamp((Math.sqrt(footprintArea) - 1) / 15);
}

function parkSizeFor(rides: readonly LaidOutRide[]): { width: number; height: number } {
  const maxRideX = rides.reduce((max, ride) => Math.max(max, ride.position.x + ride.footprint.w), 0);
  const maxRideY = rides.reduce((max, ride) => Math.max(max, ride.position.y + ride.footprint.h), 0);
  const width = roundParkExtent(maxRideX + RIGHT_MARGIN);
  const height = roundParkExtent(maxRideY + BOTTOM_MARGIN);

  return { width, height };
}

function entranceFor(parkWidth: number): { x: number; y: number; direction: number } {
  return {
    x: Math.max(1, Math.min(parkWidth - 2, Math.floor(parkWidth / 2))),
    y: 2,
    direction: 2
  };
}

function pathsForChronologicalSpine(
  rides: readonly LaidOutRide[],
  entrance: Coord
): ParkPath[] {
  const paths: ParkPath[] = [];
  let previousId = "entrance";
  let previousCoord: Coord = { x: entrance.x, y: entrance.y };

  rides.forEach((ride, index) => {
    const toCoord = connectorForRide(ride);
    const waypoints = waypointsBetween(previousCoord, toCoord, index);
    const path: ParkPath =
      waypoints.length > 0
        ? { from: previousId, to: ride.id, waypoints }
        : { from: previousId, to: ride.id };

    paths.push(path);
    previousId = ride.id;
    previousCoord = toCoord;
  });

  return paths;
}

function connectorForRide(ride: LaidOutRide): Coord {
  return {
    x: ride.position.x + Math.floor(ride.footprint.w / 2),
    y: ride.position.y + Math.floor(ride.footprint.h / 2)
  };
}

function waypointsBetween(from: Coord, to: Coord, index: number): Coord[] {
  if (from.x === to.x || from.y === to.y) {
    return [];
  }

  const waypoint = index % 2 === 0 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };

  if (sameCoord(waypoint, from) || sameCoord(waypoint, to)) {
    return [];
  }

  return [waypoint];
}

function withLayoutFields<Ride extends ClassifiedRide>(
  ride: Ride,
  position: Coord,
  rotation: number
): LaidOutRide<Ride> {
  const { position: _position, rotation: _rotation, ...rideFields } = ride;
  void _position;
  void _rotation;

  return {
    ...rideFields,
    position,
    rotation
  } as LaidOutRide<Ride>;
}

function rotationForRide(): number {
  return 0;
}

function parkNameFor(input: LayoutInput): string {
  const explicit = input.parkName?.trim();

  if (explicit && explicit.length > 0) {
    return explicit;
  }

  const repoName = input.workModel?.repo?.name?.trim();

  if (repoName && repoName.length > 0) {
    return `rctai: ${repoName}`;
  }

  return "rctai park";
}

function ensureUniqueRideIds(rides: readonly ClassifiedRide[]): void {
  const seen = new Set<string>();

  for (const ride of rides) {
    if (seen.has(ride.id)) {
      throw new Error(`Duplicate ride id: ${ride.id}`);
    }

    seen.add(ride.id);
  }
}

function roundParkExtent(value: number): number {
  return Math.max(MIN_PARK_SIZE, Math.ceil(value / PARK_GRID) * PARK_GRID);
}

function sameCoord(left: Coord, right: Coord): boolean {
  return left.x === right.x && left.y === right.y;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
