/* eslint-disable @typescript-eslint/no-namespace */

namespace RctaiBuilder {
  const RIDE_OBJECT_AUTO_SELECT = 65535;

  interface OpenRCT2SocketState {
    buffer: string;
  }

  export class OpenRCT2Adapter implements RctaiBuilder.BuilderAdapter {
    private readonly rideObjectCache: Record<string, RctaiBuilder.ResolvedRideObject | null> = {};
    private readonly crashEvents: RctaiBuilder.RuntimeCrashEvent[] = [];

    executeAction(
      action: RctaiBuilder.GameActionName,
      args: Record<string, unknown>,
      callback: (result: RctaiBuilder.GameActionResultLike) => void
    ): void {
      try {
        context.executeAction(action, args, (result) => callback(result));
      } catch (error) {
        callback({
          error: 1,
          errorTitle: "Action failed",
          errorMessage: error instanceof Error ? error.message : "OpenRCT2 rejected action"
        });
      }
    }

    resolveRideObject(rideType: string, preferredObject: string | null): RctaiBuilder.ResolvedRideObject | null {
      const rideTypeId = RctaiBuilder.resolveRideTypeId(rideType);
      if (rideTypeId === null) {
        return null;
      }

      const cacheKey = rideObjectCacheKey(rideTypeId, preferredObject);
      const cached = this.rideObjectCache[cacheKey];
      if (cached !== undefined) {
        return cached;
      }

      if (preferredObject !== null) {
        const preferred = this.loadRideObject(preferredObject);
        if (preferred !== null && preferred.rideType.indexOf(rideTypeId) >= 0) {
          this.log(`[rctai-builder] loaded preferred ride object ${preferredObject} for ride type ${rideTypeId}`);
          return this.cacheRideObject(cacheKey, rideTypeId, RIDE_OBJECT_AUTO_SELECT);
        }
      }

      const objects = objectManager.getAllObjects("ride");
      let fallback: RideObject | null = null;
      for (const object of objects) {
        if (object.rideType.indexOf(rideTypeId) < 0) {
          continue;
        }
        if (fallback === null) {
          fallback = object;
        }
        if (preferredObject !== null && objectMatchesIdentifier(object, preferredObject)) {
          return this.cacheRideObject(cacheKey, rideTypeId, RIDE_OBJECT_AUTO_SELECT);
        }
      }

      if (fallback !== null) {
        return this.cacheRideObject(cacheKey, rideTypeId, RIDE_OBJECT_AUTO_SELECT);
      }

      const loaded = this.loadInstalledRideObject(rideTypeId, preferredObject);
      if (loaded !== null) {
        return this.cacheRideObject(cacheKey, rideTypeId, RIDE_OBJECT_AUTO_SELECT);
      }

      return this.cacheRideObject(cacheKey, rideTypeId, null);
    }

    resolveObject(type: RctaiBuilder.ObjectLookupType, identifier: string): number | null {
      const objects = objectManager.getAllObjects(type);
      for (const object of objects) {
        if (object.identifier === identifier || object.legacyIdentifier.trim() === identifier.trim()) {
          return object.index;
        }
      }
      return null;
    }

    resolvePathObjects(): RctaiBuilder.PathObjects {
      const surfaces = objectManager.getAllObjects("footpath_surface");
      const railings = objectManager.getAllObjects("footpath_railings");
      return {
        surfaceObject: surfaces[0]?.index ?? 0,
        railingsObject: railings[0]?.index ?? 0
      };
    }

    getTrackSegment(type: number): RctaiBuilder.TrackSegmentInfo | null {
      const segment = context.getTrackSegment(type);
      return segment === null
        ? null
        : {
            beginZ: segment.beginZ,
            endZ: segment.endZ,
            endX: segment.endX,
            endY: segment.endY,
            beginDirection: segment.beginDirection,
            endDirection: segment.endDirection,
            elements: segment.elements.map((element) => ({ x: element.x, y: element.y, z: element.z }))
          };
    }

    inspectTrackSegments(types: number[]): Record<string, RctaiBuilder.TrackSegmentInfo | null> {
      const result: Record<string, RctaiBuilder.TrackSegmentInfo | null> = {};
      for (const type of types) {
        result[String(type)] = this.getTrackSegment(type);
      }
      return result;
    }

    getSurfaceZ(x: number, y: number): number | null {
      try {
        const tile = map.getTile(x, y);
        for (const element of tile.elements) {
          if (element.type === "surface") {
            return element.baseZ;
          }
        }
      } catch {
        return null;
      }
      return null;
    }

    repairFootpathEdges(specs: RctaiBuilder.FootpathRepairSpec[]): number {
      let repaired = 0;
      for (const spec of specs) {
        const tile = map.getTile(spec.x, spec.y);
        for (const element of tile.elements) {
          if (element.type !== "footpath" || element.baseZ !== spec.z) {
            continue;
          }
          const slopeDirection = element.slopeDirection ?? null;
          if (slopeDirection !== spec.slopeDirection) {
            continue;
          }
          element.edges = spec.edges;
          element.corners = 0;
          element.isQueue = spec.isQueue === true;
          if (element.isQueue !== true) {
            element.queueBannerDirection = null;
          }
          repaired += 1;
          break;
        }
      }
      return repaired;
    }

    placeRawTrack(args: RctaiBuilder.RawTrackArgs): void {
      const tile = map.getTile(args.x, args.y);
      const element = tile.insertElement(tile.elements.length) as TrackElement;
      element.type = "track";
      element.baseZ = args.z;
      element.clearanceZ = args.clearanceZ;
      element.direction = args.direction as Direction;
      element.trackType = args.trackType;
      element.sequence = args.sequence;
      element.rideType = args.rideType;
      element.ride = args.ride;
      element.station = args.station;
      element.brakeBoosterSpeed = args.brakeBoosterSpeed;
      element.colourScheme = args.colourScheme;
      element.seatRotation = args.seatRotation;
    }

    clearPathsAndScenery(callback: (result: RctaiBuilder.GameActionResultLike) => void): void {
      try {
        for (let x = 0; x < map.size.x; x += 1) {
          for (let y = 0; y < map.size.y; y += 1) {
            const tile = map.getTile(x, y);
            for (let index = tile.numElements - 1; index >= 0; index -= 1) {
              const element = tile.getElement(index);
              if (isClearableTileElement(element)) {
                tile.removeElement(index);
              }
            }
          }
        }
        callback({});
      } catch (error) {
        callback({
          error: 1,
          errorTitle: "Clear failed",
          errorMessage: error instanceof Error ? error.message : "OpenRCT2 rejected tile cleanup"
        });
      }
    }

    getExistingRideIds(): number[] {
      return map.rides.map((ride) => ride.id);
    }

    inspectPark(): RctaiBuilder.ParkInspection {
      return {
        date: {
          ticksElapsed: date.ticksElapsed,
          monthsElapsed: date.monthsElapsed,
          monthProgress: date.monthProgress,
          day: date.day,
          month: date.month,
          year: date.year
        },
        map: {
          width: map.size.x,
          height: map.size.y
        },
        rides: map.rides.map((ride) => ({
          id: ride.id,
          name: ride.name,
          type: ride.type,
          classification: ride.classification,
          status: ride.status,
          stations: ride.stations
            .filter((station) => station.entrance !== null || station.exit !== null || station.start !== null || station.length > 0)
            .map((station) => ({
              entrance: station.entrance === null ? null : copyCoordD(station.entrance),
              exit: station.exit === null ? null : copyCoordD(station.exit),
              start: copyCoord(station.start),
              length: station.length
            }))
        })),
        footpaths: inspectFootpaths(),
        crashes: this.crashEvents.slice()
      };
    }

    inspectTracks(rideIds: number[] | null): RctaiBuilder.ParkInspectionTrack[] {
      const filter = rideIds === null ? null : new Set(rideIds);
      const tracks: RctaiBuilder.ParkInspectionTrack[] = [];
      for (let x = 0; x < map.size.x; x += 1) {
        for (let y = 0; y < map.size.y; y += 1) {
          const tile = map.getTile(x, y);
          for (let elementIndex = 0; elementIndex < tile.elements.length; elementIndex += 1) {
            const element = tile.elements[elementIndex];
            if (element === undefined || element.type !== "track" || (filter !== null && !filter.has(element.ride))) {
              continue;
            }
            tracks.push({
              x,
              y,
              z: element.baseZ,
              direction: element.direction,
              trackType: element.trackType,
              rideType: element.rideType,
              ride: element.ride,
              sequence: element.sequence,
              station: null,
              elementIndex
            });
          }
        }
      }
      return tracks;
    }

    inspectSurfaces(coords: RctaiBuilder.Coord[]): RctaiBuilder.ParkInspectionSurface[] {
      return coords.map((coord) => ({
        x: coord.x,
        y: coord.y,
        z: this.getSurfaceZ(coord.x, coord.y)
      }));
    }

    inspectTrackTraversals(rideIds: number[] | null): RctaiBuilder.ParkInspectionTrackTraversal[] {
      const filter = rideIds === null ? null : new Set(rideIds);
      const traversals: RctaiBuilder.ParkInspectionTrackTraversal[] = [];
      const expectedKeysByRide = trackTraversalKeysByRide();

      for (const ride of map.rides) {
        if (filter !== null && !filter.has(ride.id)) {
          continue;
        }

        const expectedKeys = expectedKeysByRide[ride.id] ?? [];
        const expectedSegments = expectedKeys.length;
        const stations = ride.stations
          .map((station, stationIndex) => ({ station, stationIndex }))
          .filter(({ station }) => station.start !== null && station.length > 0);

        if (stations.length === 0) {
          traversals.push({
            ride: ride.id,
            station: -1,
            closed: false,
            complete: expectedSegments === 0,
            steps: 0,
            expectedSegments,
            visitedSegments: 0,
            start: null,
            end: null,
            reason: expectedSegments === 0 ? null : "ride has track elements but no station start",
            visitedKeys: [],
            missingKeys: expectedKeys,
            unexpectedKeys: []
          });
          continue;
        }

        for (const { station, stationIndex } of stations) {
          traversals.push(inspectStationTraversal(ride.id, stationIndex, station.start, expectedKeys));
        }
      }

      return traversals;
    }

    resetRuntimeEvents(): void {
      this.crashEvents.length = 0;
    }

    recordCrash(event: VehicleCrashArgs): void {
      this.crashEvents.push({
        vehicleId: event.id,
        crashIntoType: event.crashIntoType,
        ticksElapsed: date.ticksElapsed,
        monthsElapsed: date.monthsElapsed,
        monthProgress: date.monthProgress
      });
    }

    setGameSpeed(speed: number, callback: (result: RctaiBuilder.GameActionResultLike) => void): void {
      this.executeAction("gamesetspeed", { speed }, callback);
    }

    savePark(name: string, callback: (result: RctaiBuilder.GameActionResultLike) => void): void {
      try {
        console.executeLegacy(`save_park ${name}`);
        callback({});
      } catch (error) {
        callback({
          error: 1,
          errorTitle: "Save failed",
          errorMessage: error instanceof Error ? error.message : "legacy save command failed"
        });
      }
    }

    log(message: string): void {
      console.log(message);
    }

    private cacheRideObject(
      cacheKey: string,
      rideTypeId: number,
      rideObjectIndex: number | null
    ): RctaiBuilder.ResolvedRideObject | null {
      const resolved = rideObjectIndex === null ? null : { rideTypeId, rideObjectIndex };
      this.rideObjectCache[cacheKey] = resolved;
      return resolved;
    }

    private loadInstalledRideObject(rideTypeId: number, preferredObject: string | null): RideObject | null {
      const preferred = preferredObject === null ? [] : [preferredObject];
      const initiallyLoaded = loadedRideObjectIdentifiers();
      const candidates = objectManager.installedObjects
        .filter((object) => object.type === "ride")
        .map((object) => object.identifier)
        .sort((left, right) => left.localeCompare(right));
      const identifiers = [...preferred, ...candidates].filter((identifier, index, all) => all.indexOf(identifier) === index);

      for (const identifier of identifiers) {
        const loaded = safeLoadObject(identifier);
        if (loaded === null) {
          continue;
        }
        if (isRideObject(loaded) && loaded.rideType.indexOf(rideTypeId) >= 0) {
          this.log(`[rctai-builder] loaded ride object ${identifier} for ride type ${rideTypeId}`);
          return loaded;
        }
        if (initiallyLoaded[identifier] !== true) {
          safeUnloadObject(identifier);
        }
      }

      return null;
    }

    private loadRideObject(identifier: string): RideObject | null {
      const loaded = safeLoadObject(identifier);
      if (loaded === null) {
        return null;
      }
      if (isRideObject(loaded)) {
        return loaded;
      }
      safeUnloadObject(identifier);
      return null;
    }
  }

  function rideObjectCacheKey(rideTypeId: number, preferredObject: string | null): string {
    return `${rideTypeId}:${preferredObject ?? "*"}`;
  }

  function objectMatchesIdentifier(object: LoadedObject, identifier: string): boolean {
    return object.installedObject.identifier === identifier || object.installedObject.legacyIdentifier?.trim() === identifier.trim();
  }

  function isRideObject(object: LoadedObject): object is RideObject {
    return object.type === "ride" && Array.isArray((object as RideObject).rideType);
  }

  function loadedRideObjectIdentifiers(): Record<string, boolean> {
    const identifiers: Record<string, boolean> = {};
    for (const object of objectManager.getAllObjects("ride")) {
      identifiers[object.installedObject.identifier] = true;
    }
    return identifiers;
  }

  function isClearableTileElement(element: TileElement): boolean {
    return (
      element.type === "track" ||
      element.type === "footpath" ||
      element.type === "small_scenery" ||
      element.type === "wall" ||
      element.type === "large_scenery" ||
      element.type === "banner"
    );
  }

  function safeLoadObject(identifier: string): LoadedObject | null {
    try {
      return objectManager.load(identifier);
    } catch {
      return null;
    }
  }

  function safeUnloadObject(identifier: string): void {
    try {
      objectManager.unload(identifier);
    } catch {
      // Best-effort cleanup of rejected candidates while scanning installed ride objects.
    }
  }

  function inspectFootpaths(): RctaiBuilder.ParkInspectionFootpath[] {
    const footpaths: RctaiBuilder.ParkInspectionFootpath[] = [];
    for (let x = 0; x < map.size.x; x += 1) {
      for (let y = 0; y < map.size.y; y += 1) {
        const tile = map.getTile(x, y);
        for (const element of tile.elements) {
          if (element.type === "footpath") {
            footpaths.push({
              x,
              y,
              z: element.baseZ,
              edges: element.edges,
              corners: element.corners,
              slopeDirection: element.slopeDirection,
              isQueue: element.isQueue,
              queueBannerDirection: element.queueBannerDirection,
              ride: element.ride,
              station: element.station
            });
          }
        }
      }
    }
    return footpaths;
  }

  function trackTraversalKeysByRide(): Record<number, string[]> {
    const keys: Record<number, string[]> = {};
    for (let x = 0; x < map.size.x; x += 1) {
      for (let y = 0; y < map.size.y; y += 1) {
        const tile = map.getTile(x, y);
        for (const element of tile.elements) {
          if (element.type === "track" && element.sequence === 0) {
            const segment = context.getTrackSegment(element.trackType);
            if (segment === null) {
              continue;
            }
            const rideKeys = keys[element.ride] ?? [];
            rideKeys.push(trackElementTraversalKey(x, y, element));
            keys[element.ride] = rideKeys;
          }
        }
      }
    }
    for (const rideKeys of Object.values(keys)) {
      rideKeys.sort((left, right) => left.localeCompare(right));
    }
    return keys;
  }

  function inspectStationTraversal(
    rideId: number,
    stationIndex: number,
    stationStart: CoordsXYZ | null,
    expectedKeys: string[]
  ): RctaiBuilder.ParkInspectionTrackTraversal {
    const expectedSegments = expectedKeys.length;
    const iteratorStart = firstUsableTrackIterator(rideId, stationStart);
    if (iteratorStart === null) {
      return {
        ride: rideId,
        station: stationIndex,
        closed: false,
        complete: false,
        steps: 0,
        expectedSegments,
        visitedSegments: 0,
        start: copyCoord(stationStart),
        end: null,
        reason: "OpenRCT2 did not create a track iterator for any sequence-0 track element",
        visitedKeys: [],
        missingKeys: expectedKeys,
        unexpectedKeys: []
      };
    }

    const iterator = iteratorStart.iterator;
    const startKey = trackIteratorKey(iterator);
    const start = copyCoordD(iterator.position);
    const visited = new Set<string>();
    const visitedKeys: string[] = [];
    const maxSteps = Math.max(expectedSegments * 4 + 8, 64);
    let end: RctaiBuilder.CoordD | null = null;
    let closed = false;
    let reason: string | null = null;
    let repeatKey: string | null = null;
    let repeatFirstSeen: number | null = null;
    let repeatAt: number | null = null;

    for (let step = 0; step < maxSteps; step += 1) {
      const key = trackIteratorKey(iterator);
      if (visited.has(key)) {
        closed = key === startKey;
        repeatKey = key;
        repeatFirstSeen = [...visited].indexOf(key);
        repeatAt = step;
        reason = closed ? null : "traversal reached a repeated non-start segment";
        break;
      }

      visited.add(key);
      visitedKeys.push(key);
      end = copyCoordD(iterator.position);
      if (!iterator.next()) {
        reason = "OpenRCT2 track iterator reached an open end";
        break;
      }
    }

    if (!closed && reason === null) {
      reason = "OpenRCT2 track iterator exceeded the expected circuit length";
    }

    const expected = new Set(expectedKeys);
    const missingKeys = expectedKeys.filter((key) => !visited.has(key));
    const unexpectedKeys = visitedKeys.filter((key) => !expected.has(key));
    const complete = missingKeys.length === 0 && unexpectedKeys.length === 0;
    if (closed && !complete && reason === null) {
      reason = "OpenRCT2 track iterator did not cover exactly the placed sequence-0 track elements";
    }

    return {
      ride: rideId,
      station: stationIndex,
      closed,
      complete,
      steps: visited.size,
      expectedSegments,
      visitedSegments: visited.size,
      start,
      end,
      reason,
      repeatKey,
      repeatFirstSeen,
      repeatAt,
      visitedKeys,
      missingKeys,
      unexpectedKeys
    };
  }

  function firstUsableTrackIterator(
    rideId: number,
    stationStart: CoordsXYZ | null
  ): { iterator: TrackIterator; location: { x: number; y: number; elementIndex: number } } | null {
    const candidates = uniqueTrackElementLocations([
      findTrackElementAt(stationStart, rideId),
      ...findTrackSequenceStartElements(rideId)
    ]);

    for (const location of candidates) {
      const iterator = getTrackIteratorAt(location);
      if (iterator !== null && iterator.segment !== null) {
        return { iterator, location };
      }
    }

    return null;
  }

  function findTrackSequenceStartElements(rideId: number): Array<{ x: number; y: number; elementIndex: number }> {
    const locations: Array<{ x: number; y: number; elementIndex: number }> = [];
    for (let x = 0; x < map.size.x; x += 1) {
      for (let y = 0; y < map.size.y; y += 1) {
        const tile = map.getTile(x, y);
        for (let elementIndex = 0; elementIndex < tile.elements.length; elementIndex += 1) {
          const element = tile.elements[elementIndex];
          if (element !== undefined && element.type === "track" && element.ride === rideId && element.sequence === 0) {
            locations.push({ x, y, elementIndex });
          }
        }
      }
    }
    return locations;
  }

  function uniqueTrackElementLocations(
    locations: Array<{ x: number; y: number; elementIndex: number } | null>
  ): Array<{ x: number; y: number; elementIndex: number }> {
    const seen: Record<string, boolean> = {};
    const result: Array<{ x: number; y: number; elementIndex: number }> = [];
    for (const location of locations) {
      if (location === null) {
        continue;
      }
      const key = `${location.x},${location.y},${location.elementIndex}`;
      if (seen[key] === true) {
        continue;
      }
      seen[key] = true;
      result.push(location);
    }
    return result;
  }

  function getTrackIteratorAt(location: { x: number; y: number; elementIndex: number }): TrackIterator | null {
    try {
      const tileIterator = map.getTrackIterator({ x: location.x, y: location.y }, location.elementIndex);
      if (tileIterator !== null) {
        return tileIterator;
      }
    } catch {
      // Try world coordinates below.
    }

    try {
      return map.getTrackIterator({ x: location.x * 32, y: location.y * 32 }, location.elementIndex);
    } catch {
      return null;
    }
  }

  function findTrackElementAt(coord: CoordsXYZ | null, rideId: number): { x: number; y: number; elementIndex: number } | null {
    if (coord === null) {
      return null;
    }

    const x = coord.x >= map.size.x ? Math.floor(coord.x / 32) : coord.x;
    const y = coord.y >= map.size.y ? Math.floor(coord.y / 32) : coord.y;
    const tile = map.getTile(x, y);
    let fallback: { x: number; y: number; elementIndex: number } | null = null;

    for (let elementIndex = 0; elementIndex < tile.elements.length; elementIndex += 1) {
      const element = tile.elements[elementIndex];
      if (element === undefined || element.type !== "track" || element.ride !== rideId) {
        continue;
      }
      const location = { x, y, elementIndex };
      if (fallback === null) {
        fallback = location;
      }
      if (element.sequence === 0 && element.baseZ === coord.z) {
        return location;
      }
    }

    return fallback;
  }

  function trackIteratorKey(iterator: TrackIterator): string {
    const position = iterator.position;
    return [
      position.x,
      position.y,
      position.z,
      position.direction,
      iterator.segment?.type ?? "none"
    ].join(",");
  }

  function trackElementTraversalKey(x: number, y: number, element: TrackElement): string {
    return [
      x * 32,
      y * 32,
      element.baseZ,
      element.direction,
      element.trackType
    ].join(",");
  }

  function copyCoord(coord: CoordsXYZ | null): RctaiBuilder.CoordD | null {
    if (coord === null) {
      return null;
    }
    return { x: coord.x, y: coord.y, z: coord.z };
  }

  function copyCoordD(coord: CoordsXYZD | null): RctaiBuilder.CoordD | null {
    if (coord === null) {
      return null;
    }
    return { x: coord.x, y: coord.y, z: coord.z, direction: coord.direction };
  }

  export function startOpenRCT2Server(port = RctaiBuilder.DEFAULT_PORT): RctaiBuilder.BuildController {
    const adapter = new OpenRCT2Adapter();
    const controller = new RctaiBuilder.BuildController(adapter);
    const listener = network.createListener();

    listener.on("connection", (socket) => {
      const state: OpenRCT2SocketState = { buffer: "" };
      socket.setNoDelay(true);
      socket.on("data", (data) => {
        state.buffer += data;
        const parsed = RctaiBuilder.parseHttpRequest(state.buffer);
        if (!parsed.ok && parsed.incomplete === true) {
          return;
        }

        const response = parsed.ok && parsed.request !== undefined
          ? RctaiBuilder.routeHttpRequest(parsed.request, controller)
          : { status: parsed.status ?? 400, body: { error: parsed.error ?? "malformed request" } };

        socket.end(RctaiBuilder.formatHttpResponse(response));
      });
      socket.on("error", (errorString) => {
        adapter.log(`[rctai-builder] socket error: ${errorString}`);
      });
    });

    listener.listen(port, "127.0.0.1");
    context.subscribe("interval.tick", () => {
      controller.tick();
    });
    context.subscribe("vehicle.crash", (event) => {
      adapter.recordCrash(event);
      adapter.log(`[rctai-builder] vehicle crash: ${event.id} into ${event.crashIntoType}`);
    });
    adapter.log(`[rctai-builder] listening on 127.0.0.1:${port}`);
    return controller;
  }
}

(globalThis as { RctaiBuilder?: typeof RctaiBuilder }).RctaiBuilder = RctaiBuilder;

if (typeof registerPlugin !== "undefined") {
  registerPlugin({
    name: "RCTAI Builder",
    version: RctaiBuilder.VERSION,
    authors: "RCTAI",
    type: "local",
    licence: "MIT",
    targetApiVersion: 66,
    main() {
      const configuredPort = context.sharedStorage.get<number>("rctai.builder.port", RctaiBuilder.DEFAULT_PORT);
      RctaiBuilder.startOpenRCT2Server(configuredPort);
    }
  });
}
