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
            endDirection: segment.endDirection
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
            footpaths.push({ x, y });
          }
        }
      }
    }
    return footpaths;
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
