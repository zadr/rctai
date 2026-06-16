/* eslint-disable @typescript-eslint/no-namespace, @typescript-eslint/no-unused-vars */

namespace RctaiBuilder {
  const RIDE_TYPE_IDS: Record<string, number> = {
    air_powered_vertical_coaster: 75,
    alpine_coaster: 98,
    boat_hire: 8,
    bobsleigh_coaster: 13,
    car_ride: 11,
    cash_machine: 45,
    chairlift: 18,
    circus: 49,
    classic_mini_rc: 95,
    classic_stand_up_rc: 100,
    classic_wooden_rc: 99,
    classic_wooden_twister_rc: 102,
    compact_inverted_coaster: 73,
    corkscrew_rc: 19,
    crooked_house: 71,
    dinghy_slide: 16,
    dodgems: 25,
    drink_stall: 30,
    enterprise: 81,
    ferris_wheel: 37,
    first_aid: 48,
    flying_rc: 57,
    flying_saucers: 70,
    food_stall: 28,
    ghost_train: 50,
    giga_coaster: 68,
    giga_rc: 68,
    go_karts: 22,
    haunted_house: 47,
    heartline_twister_coaster: 66,
    hybrid_coaster: 96,
    hyper_twister: 92,
    hypercoaster: 91,
    information_kiosk: 35,
    inverted_hairpin_coaster: 76,
    inverted_impulse_coaster: 86,
    inverted_rc: 3,
    junior_rc: 4,
    launched_freefall: 12,
    lay_down_rc: 62,
    lift: 43,
    lim_launched_rc: 90,
    log_flume: 23,
    looping_rc: 15,
    lsm_launched_rc: 101,
    magic_carpet: 77,
    maze: 20,
    merry_go_round: 33,
    mine_ride: 88,
    mine_train_rc: 17,
    mini_golf: 67,
    mini_helicopters: 61,
    mini_rc: 87,
    mini_suspended_coaster: 7,
    miniature_railway: 5,
    monorail: 6,
    monorail_cycles: 72,
    monster_trucks: 93,
    motion_simulator: 38,
    multi_dimension_rc: 55,
    observation_tower: 14,
    reverse_freefall_rc: 42,
    reverser_rc: 65,
    river_rafts: 79,
    river_rapids: 24,
    roto_drop: 69,
    side_friction_rc: 53,
    single_rail_rc: 97,
    space_rings: 41,
    spinning_wild_mouse: 94,
    spiral_rc: 0,
    spiral_slide: 21,
    splash_boats: 60,
    stand_up_rc: 1,
    steel_wild_mouse: 54,
    steeplechase: 10,
    submarine_ride: 78,
    suspended_monorail: 63,
    suspended_swinging_coaster: 2,
    swinging_inverter_ship: 27,
    swinging_ship: 26,
    toilets: 36,
    top_spin: 40,
    twist: 46,
    twister_rc: 51,
    vertical_drop_rc: 44,
    virginia_reel: 59,
    water_coaster: 74,
    wooden_rc: 52,
    wooden_wild_mouse: 9
  };

  const RIDE_APPEARANCE_TRACK_MAIN = 0;
  const RIDE_APPEARANCE_TRACK_ADDITIONAL = 1;
  const RIDE_APPEARANCE_TRACK_SUPPORTS = 2;
  const CHEAT_SANDBOX_MODE = 0;
  const CHEAT_DISABLE_CLEARANCE_CHECKS = 1;
  const CHEAT_DISABLE_SUPPORT_LIMITS = 2;
  const CHEAT_NO_MONEY = 15;
  const CHEAT_SET_MONEY = 17;
  const CHEAT_ENABLE_ALL_DRAWABLE_TRACK_PIECES = 45;
  const CHEAT_ALLOW_TRACK_PLACE_INVALID_HEIGHTS = 48;
  const TRACK_PLACE_FLAG_CHAIN_LIFT = 1 << 0;
  const TRACK_PLACE_FLAG_INVERTED = 1 << 1;
  const LAND_SET_OWNERSHIP = 4;
  const OWNERSHIP_OWNED = 1 << 5;
  const FLAT_LAND_STYLE = 0;

  export function createBuildSteps(plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep[] {
    const steps: RctaiBuilder.QueuedStep[] = [
      RctaiBuilder.createGameActionStep("enable sandbox mode", "cheatset", () => ({
        type: CHEAT_SANDBOX_MODE,
        param1: 1,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("enable no-money build mode", "cheatset", () => ({
        type: CHEAT_NO_MONEY,
        param1: 1,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("disable clearance checks", "cheatset", () => ({
        type: CHEAT_DISABLE_CLEARANCE_CHECKS,
        param1: 1,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("disable support limits", "cheatset", () => ({
        type: CHEAT_DISABLE_SUPPORT_LIMITS,
        param1: 1,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("enable drawable track pieces", "cheatset", () => ({
        type: CHEAT_ENABLE_ALL_DRAWABLE_TRACK_PIECES,
        param1: 1,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("allow generated track heights", "cheatset", () => ({
        type: CHEAT_ALLOW_TRACK_PLACE_INVALID_HEIGHTS,
        param1: 1,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("fund park build", "cheatset", () => ({
        type: CHEAT_SET_MONEY,
        param1: 10_000_000,
        param2: 0
      })),
      RctaiBuilder.createGameActionStep("resize map", "mapchangesize", () => ({
        targetSizeX: Math.max(plan.park.size.width, 64),
        targetSizeY: Math.max(plan.park.size.height, 64),
        shiftX: 0,
        shiftY: 0
      })),
      RctaiBuilder.createGameActionStep("claim plan land", "landsetrights", () => ({
        x1: 0,
        y1: 0,
        x2: tileToGame(Math.max(plan.park.size.width - 1, 0)),
        y2: tileToGame(Math.max(plan.park.size.height - 1, 0)),
        setting: LAND_SET_OWNERSHIP,
        ownership: OWNERSHIP_OWNED
      })),
      ...createTerrainPrepSteps(plan),
      RctaiBuilder.createGameActionStep("set park name", "parksetname", () => ({ name: plan.park.name }))
    ];

    for (const ride of plan.rides) {
      steps.push(...createRideSteps(ride, plan));
    }

    for (const path of plan.paths ?? []) {
      steps.push(...createPathSteps(path, plan));
    }

    for (const scenery of plan.scenery ?? []) {
      steps.push(createSceneryStep(scenery, plan));
    }

    return steps;
  }

  export function createClearSteps(adapter: RctaiBuilder.BuilderAdapter): RctaiBuilder.QueuedStep[] {
    const steps: RctaiBuilder.QueuedStep[] = [];
    for (const rideId of adapter.getExistingRideIds()) {
      steps.push(
        RctaiBuilder.createGameActionStep(`demolish ride ${rideId}`, "ridedemolish", () => ({
          ride: rideId,
          modifyType: 0
        }))
      );
    }
    steps.push(
      RctaiBuilder.createGameActionStep("clear paths and scenery", "clearscenery", () => ({
        itemsToClear: 1 | 2 | 4
      }))
    );
    return steps;
  }

  export function createSaveStep(name: string): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createAdapterStep(`save park ${name}`, (adapter, _state, done) => {
      adapter.savePark(sanitizeSaveName(name), done);
    });
  }

  export function resolveRideTypeId(rideType: string): number | null {
    const normalized = normalizeIdentifier(rideType);
    return RIDE_TYPE_IDS[normalized] ?? null;
  }

  export function normalizeIdentifier(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  export function tileToGame(value: number): number {
    return value * RctaiBuilder.TILE_UNITS;
  }

  function createRideSteps(ride: RctaiBuilder.RidePlan, plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep[] {
    const steps: RctaiBuilder.QueuedStep[] = [];
    const buildZ = planBuildZ(plan);

    steps.push(
      RctaiBuilder.createGameActionStep(
        `create ride ${ride.id}`,
        "ridecreate",
        (adapter, state) => {
          const resolved = adapter.resolveRideObject(ride.rideType, ride.rideObject ?? null);
          if (resolved === null) {
            adapter.log(`[rctai-builder] no loaded ride object for ${ride.id} (${ride.rideType})`);
            return null;
          }
          state.rideTypes[ride.id] = resolved.rideTypeId;
          return {
            rideType: resolved.rideTypeId,
            rideObject: resolved.rideObjectIndex,
            entranceObject: 0,
            colour1: 0,
            colour2: 0,
            inspectionInterval: 2
          };
        },
        (result, state) => {
          if (typeof result.ride === "number") {
            state.rideIds[ride.id] = result.ride;
          }
        },
        { critical: true, rideId: ride.id }
      )
    );

    const track = ride.track ?? null;
    const isRawVisualRide = track?.some((segment) => segment.raw === true) ?? false;
    if (track !== null && track.length > 0) {
      for (let index = 0; index < track.length; index += 1) {
        const segment = track[index];
        if (segment !== undefined) {
          steps.push(createTrackStep(ride, segment, index, buildZ));
        }
      }
    } else {
      steps.push(createTrackStep(ride, { type: 0 }, 0, buildZ));
    }

    if (!isRawVisualRide) {
      steps.push(createEntranceExitStep(ride, false, buildZ), createEntranceExitStep(ride, true, buildZ));
    }

    steps.push(
      createNameStep(ride),
      createAppearanceStep(ride, RIDE_APPEARANCE_TRACK_MAIN, ride.colours?.track ?? ride.colours?.main ?? 0, "track main"),
      createAppearanceStep(
        ride,
        RIDE_APPEARANCE_TRACK_ADDITIONAL,
        ride.colours?.additional ?? ride.colours?.main ?? 0,
        "track additional"
      ),
      createAppearanceStep(ride, RIDE_APPEARANCE_TRACK_SUPPORTS, ride.colours?.support ?? 0, "supports")
    );

    if (!isRawVisualRide) {
      steps.push(
        RctaiBuilder.createGameActionStep(
          `open ride ${ride.id}`,
          "ridesetstatus",
          (_adapter, state) => {
            if (state.failedRideIds[ride.id] === true) {
              return null;
            }
            const rideId = state.rideIds[ride.id];
            return rideId === undefined ? null : { ride: rideId, status: 1 };
          },
          undefined,
          { critical: true, rideId: ride.id }
        )
      );
    }

    return steps;
  }

  function createTrackStep(
    ride: RctaiBuilder.RidePlan,
    segment: RctaiBuilder.TrackSegmentPlan,
    index: number,
    buildZ: number
  ): RctaiBuilder.QueuedStep {
    if (segment.raw === true) {
      return createRawTrackStep(ride, segment, index, buildZ);
    }

    return RctaiBuilder.createAdapterStep(`place track ${ride.id} #${index}`, (adapter, state, done) => {
      if (state.failedRideIds[ride.id] === true) {
        adapter.log(`[rctai-builder] skipped failed ride: place track ${ride.id} #${index}`);
        done({});
        return;
      }

      const rideId = state.rideIds[ride.id];
      const rideType = state.rideTypes[ride.id] ?? RctaiBuilder.resolveRideTypeId(ride.rideType);
      if (rideId === undefined || rideType === null) {
        adapter.log(`[rctai-builder] skipped: place track ${ride.id} #${index}`);
        done({});
        return;
      }

      const trackInfo = adapter.getTrackSegment(segment.type);
      const cursor = trackCursorForSegment(ride, segment, state, buildZ);
      const z = cursor.z - (trackInfo?.beginZ ?? 0);
      const nextCursor = advanceTrackCursor(cursor, trackInfo);

      adapter.executeAction("trackplace", {
        x: cursor.x,
        y: cursor.y,
        z,
        direction: normalizeDirection(cursor.direction),
        ride: rideId,
        trackType: segment.type,
        rideType,
        brakeSpeed: segment.brakeSpeed ?? 0,
        colour: segment.colour ?? ride.colours?.track ?? ride.colours?.main ?? 0,
        seatRotation: segment.seatRotation ?? 0,
        trackPlaceFlags: trackPlaceFlagsForSegment(segment),
        isFromTrackDesign: true
      }, (result) => {
        if (result.error === undefined || result.error === 0) {
          state.trackCursors[ride.id] = nextCursor;
        }
        done(result);
      });
    }, { critical: true, rideId: ride.id });
  }

  function createRawTrackStep(
    ride: RctaiBuilder.RidePlan,
    segment: RctaiBuilder.TrackSegmentPlan,
    index: number,
    buildZ: number
  ): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createAdapterStep(`insert raw track ${ride.id} #${index}`, (adapter, state, done) => {
      if (state.failedRideIds[ride.id] === true) {
        done({});
        return;
      }

      const rideId = state.rideIds[ride.id];
      const rideType = state.rideTypes[ride.id] ?? RctaiBuilder.resolveRideTypeId(ride.rideType);
      if (rideId === undefined || rideType === null) {
        done({});
        return;
      }

      const width = Math.max(ride.footprint.w, 1);
      const localX = segment.x ?? index % width;
      const localY = segment.y ?? Math.floor(index / width);
      const z = segment.z ?? buildZ;
      const direction = normalizeDirection(segment.direction ?? ride.rotation ?? 0);
      adapter.placeRawTrack({
        x: ride.position.x + localX,
        y: ride.position.y + localY,
        z,
        clearanceZ: segment.clearanceZ ?? z + 16,
        direction,
        ride: rideId,
        rideType,
        trackType: segment.type,
        sequence: segment.sequence ?? 0,
        station: segment.type === 1 || segment.type === 2 || segment.type === 3 ? 0 : null,
        brakeBoosterSpeed: segment.brakeSpeed ?? null,
        colourScheme: segment.colour ?? ride.colours?.track ?? ride.colours?.main ?? null,
        seatRotation: segment.seatRotation ?? null
      });
      done({});
    });
  }

  function createEntranceExitStep(ride: RctaiBuilder.RidePlan, isExit: boolean, buildZ: number): RctaiBuilder.QueuedStep {
    const label = isExit ? "exit" : "entrance";
    return RctaiBuilder.createGameActionStep(`place ${label} ${ride.id}`, "rideentranceexitplace", (_adapter, state) => {
      if (state.failedRideIds[ride.id] === true) {
        return null;
      }
      const rideId = state.rideIds[ride.id];
      if (rideId === undefined) {
        return null;
      }

      const exitOffset = entranceExitOffset(ride, isExit);
      return {
        x: tileToGame(ride.position.x + exitOffset.x),
        y: tileToGame(ride.position.y + exitOffset.y),
        z: exitOffset.z ?? buildZ,
        direction: normalizeDirection(exitOffset.direction ?? ride.rotation ?? 0),
        ride: rideId,
        station: 0,
        isExit
      };
    }, undefined, { critical: true, rideId: ride.id });
  }

  function createNameStep(ride: RctaiBuilder.RidePlan): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createGameActionStep(`name ride ${ride.id}`, "ridesetname", (_adapter, state) => {
      const rideId = state.rideIds[ride.id];
      return rideId === undefined
        ? null
        : {
            ride: rideId,
            name: truncateName(`${ride.id} ${ride.sign ?? ride.name}`)
          };
    });
  }

  function createAppearanceStep(
    ride: RctaiBuilder.RidePlan,
    type: number,
    value: number,
    label: string
  ): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createGameActionStep(`set ${label} colour ${ride.id}`, "ridesetappearance", (_adapter, state) => {
      const rideId = state.rideIds[ride.id];
      return rideId === undefined
        ? null
        : {
            ride: rideId,
            type,
            value,
            index: 0
          };
    });
  }

  function createPathSteps(path: RctaiBuilder.PathPlan, plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep[] {
    const coords = expandPath(path, plan);
    return coords.map((coord, index) =>
      RctaiBuilder.createGameActionStep(`place path ${path.from}->${path.to} #${index}`, "footpathplace", (adapter, state) => {
        const key = `${coord.x},${coord.y}`;
        if (state.pathTiles[key] === true) {
          return null;
        }
        state.pathTiles[key] = true;
        const objects = adapter.resolvePathObjects();
        return {
          x: tileToGame(coord.x),
          y: tileToGame(coord.y),
          z: planBuildZ(plan),
          direction: 255,
          object: objects.surfaceObject,
          railingsObject: objects.railingsObject,
          slopeType: 0,
          slopeDirection: 0,
          constructFlags: 0
        };
      }, undefined, { critical: true })
    );
  }

  function createTerrainPrepSteps(plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep[] {
    if (plan.park.entrance.z !== undefined) {
      return [];
    }
    const landHeightUnits = RctaiBuilder.DEFAULT_Z / 8;
    return terrainCoordsForPlan(plan).map((coord) =>
      RctaiBuilder.createGameActionStep(`flatten tile ${coord.x},${coord.y}`, "landsetheight", () => ({
        x: tileToGame(coord.x),
        y: tileToGame(coord.y),
        height: landHeightUnits,
        style: FLAT_LAND_STYLE
      }))
    );
  }

  function createSceneryStep(scenery: RctaiBuilder.SceneryPlan, plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep {
    const kind = scenery.kind ?? "small";
    const action = sceneryAction(kind);
    return RctaiBuilder.createGameActionStep(`place ${kind} scenery ${scenery.object}`, action, (adapter) => {
      const object = adapter.resolveObject(sceneryObjectType(kind), scenery.object);
      if (object === null) {
        adapter.log(`[rctai-builder] no loaded scenery object for ${scenery.object}`);
        return null;
      }

      const baseArgs = {
        x: tileToGame(scenery.position.x),
        y: tileToGame(scenery.position.y),
        z: planBuildZ(plan),
        object
      };

      if (kind === "footpath_addition") {
        return baseArgs;
      }

      if (kind === "wall") {
        return {
          ...baseArgs,
          edge: 0,
          primaryColour: 0,
          secondaryColour: 0,
          tertiaryColour: 0
        };
      }

      if (kind === "large") {
        return {
          ...baseArgs,
          direction: 0,
          primaryColour: 0,
          secondaryColour: 0,
          tertiaryColour: 0
        };
      }

      return {
        ...baseArgs,
        direction: 0,
        quadrant: 0,
        primaryColour: 0,
        secondaryColour: 0,
        tertiaryColour: 0
      };
    });
  }

  function planBuildZ(plan: RctaiBuilder.ParkPlan): number {
    return plan.park.entrance.z ?? RctaiBuilder.DEFAULT_Z;
  }

  function trackCursorForSegment(
    ride: RctaiBuilder.RidePlan,
    segment: RctaiBuilder.TrackSegmentPlan,
    state: RctaiBuilder.JobState,
    buildZ: number
  ): RctaiBuilder.TrackCursor {
    const previous = state.trackCursors[ride.id];
    const hasExplicitOrigin =
      segment.x !== undefined || segment.y !== undefined || segment.z !== undefined || segment.direction !== undefined;
    if (previous !== undefined && !hasExplicitOrigin) {
      return previous;
    }

    return {
      x: tileToGame(ride.position.x + (segment.x ?? 0)),
      y: tileToGame(ride.position.y + (segment.y ?? 0)),
      z: segment.z ?? buildZ,
      direction: normalizeDirection(segment.direction ?? ride.rotation ?? 0)
    };
  }

  function advanceTrackCursor(
    cursor: RctaiBuilder.TrackCursor,
    trackInfo: RctaiBuilder.TrackSegmentInfo | null
  ): RctaiBuilder.TrackCursor {
    if (trackInfo === null) {
      const delta = directionDelta(cursor.direction);
      return {
        x: cursor.x + delta.x,
        y: cursor.y + delta.y,
        z: cursor.z,
        direction: normalizeDirection(cursor.direction)
      };
    }

    const rotated = rotateDelta(trackInfo.endX, trackInfo.endY, cursor.direction);
    const direction = normalizeDirection(cursor.direction + trackInfo.endDirection - trackInfo.beginDirection);
    let x = cursor.x + rotated.x;
    let y = cursor.y + rotated.y;
    if ((trackInfo.endDirection & 4) !== 4) {
      const delta = directionDelta(direction);
      x += delta.x;
      y += delta.y;
    }

    return {
      x,
      y,
      z: cursor.z - trackInfo.beginZ + trackInfo.endZ,
      direction
    };
  }

  function rotateDelta(x: number, y: number, direction: number): RctaiBuilder.Coord {
    switch (direction & 3) {
      case 1:
        return { x: y, y: -x };
      case 2:
        return { x: -x, y: -y };
      case 3:
        return { x: -y, y: x };
      default:
        return { x, y };
    }
  }

  function directionDelta(direction: number): RctaiBuilder.Coord {
    switch (direction & 3) {
      case 0:
        return { x: -RctaiBuilder.TILE_UNITS, y: 0 };
      case 1:
        return { x: 0, y: RctaiBuilder.TILE_UNITS };
      case 2:
        return { x: RctaiBuilder.TILE_UNITS, y: 0 };
      case 3:
        return { x: 0, y: -RctaiBuilder.TILE_UNITS };
      default:
        return { x: 0, y: 0 };
    }
  }

  function trackPlaceFlagsForSegment(segment: RctaiBuilder.TrackSegmentPlan): number {
    let flags = 0;
    if (segment.chainLift === true) {
      flags |= TRACK_PLACE_FLAG_CHAIN_LIFT;
    }
    if (segment.inverted === true) {
      flags |= TRACK_PLACE_FLAG_INVERTED;
    }
    return flags;
  }

  function expandPath(path: RctaiBuilder.PathPlan, plan: RctaiBuilder.ParkPlan): RctaiBuilder.Coord[] {
    if (path.waypoints !== undefined && path.waypoints.length > 0) {
      return path.waypoints;
    }

    const start = endpointFor(path.from, plan);
    const end = endpointFor(path.to, plan);
    if (start === null || end === null) {
      return [];
    }

    const coords: RctaiBuilder.Coord[] = [];
    const stepX = start.x <= end.x ? 1 : -1;
    for (let x = start.x; x !== end.x; x += stepX) {
      coords.push({ x, y: start.y });
    }

    const stepY = start.y <= end.y ? 1 : -1;
    for (let y = start.y; y !== end.y; y += stepY) {
      coords.push({ x: end.x, y });
    }
    coords.push(end);
    return dedupeCoords(coords);
  }

  function endpointFor(id: string, plan: RctaiBuilder.ParkPlan): RctaiBuilder.Coord | null {
    if (id === "entrance") {
      return { x: plan.park.entrance.x, y: plan.park.entrance.y };
    }
    const ride = plan.rides.find((candidate) => candidate.id === id);
    if (ride === undefined) {
      return null;
    }
    return {
      x: ride.position.x + Math.floor(ride.footprint.w / 2),
      y: ride.position.y + ride.footprint.h + 1
    };
  }

  function entranceExitOffset(ride: RctaiBuilder.RidePlan, isExit: boolean): RctaiBuilder.CoordD {
    const stationOffset = stationEntranceExitOffset(ride, isExit);
    if (stationOffset !== null) {
      return stationOffset;
    }

    if (!isExit) {
      return { x: 0, y: ride.footprint.h };
    }
    if (ride.footprint.w <= 1) {
      return { x: 1, y: ride.footprint.h };
    }
    return { x: Math.max(ride.footprint.w - 1, 0), y: ride.footprint.h };
  }

  function stationEntranceExitOffset(ride: RctaiBuilder.RidePlan, isExit: boolean): RctaiBuilder.CoordD | null {
    const track = ride.track ?? [];
    const stationSegments = track.filter((segment) => segment.type === 1 || segment.type === 2 || segment.type === 3);
    const stationIndex = isExit ? stationSegments.length - 1 : 0;
    const station = stationSegments[stationIndex];
    if (station === undefined) {
      return null;
    }

    const stationOrigin = stationSegments[0];
    const direction = normalizeDirection(station.direction ?? stationOrigin?.direction ?? ride.rotation ?? 0);
    const stationStep = directionTileDelta(direction);
    const side = stationSideOffset(direction, isExit);
    const sideDirection = directionFromTileDelta(side);
    const offset: RctaiBuilder.CoordD = {
      x: (station.x ?? (stationOrigin?.x ?? 0) + stationStep.x * stationIndex) + side.x,
      y: (station.y ?? (stationOrigin?.y ?? 0) + stationStep.y * stationIndex) + side.y,
      direction: normalizeDirection(sideDirection + 2)
    };
    if (station.z !== undefined) {
      offset.z = station.z;
    }
    return offset;
  }

  function stationSideOffset(direction: number, isExit: boolean): RctaiBuilder.Coord {
    if (direction === 0) {
      return { x: 0, y: isExit ? -1 : 1 };
    }
    if (direction === 1) {
      return { x: isExit ? 1 : -1, y: 0 };
    }
    if (direction === 2) {
      return { x: 0, y: isExit ? 1 : -1 };
    }
    return { x: isExit ? -1 : 1, y: 0 };
  }

  function directionTileDelta(direction: number): RctaiBuilder.Coord {
    const delta = directionDelta(direction);
    return { x: delta.x / RctaiBuilder.TILE_UNITS, y: delta.y / RctaiBuilder.TILE_UNITS };
  }

  function directionFromTileDelta(delta: RctaiBuilder.Coord): number {
    if (delta.x < 0) {
      return 0;
    }
    if (delta.y > 0) {
      return 1;
    }
    if (delta.x > 0) {
      return 2;
    }
    if (delta.y < 0) {
      return 3;
    }
    return 0;
  }

  function dedupeCoords(coords: RctaiBuilder.Coord[]): RctaiBuilder.Coord[] {
    const result: RctaiBuilder.Coord[] = [];
    let previous: RctaiBuilder.Coord | null = null;
    for (const coord of coords) {
      if (previous === null || previous.x !== coord.x || previous.y !== coord.y) {
        result.push(coord);
        previous = coord;
      }
    }
    return result;
  }

  function terrainCoordsForPlan(plan: RctaiBuilder.ParkPlan): RctaiBuilder.Coord[] {
    const coords = new Set<string>();
    const add = (x: number, y: number): void => {
      if (x >= 1 && y >= 1 && x < plan.park.size.width - 1 && y < plan.park.size.height - 1) {
        coords.add(`${x},${y}`);
      }
    };

    add(plan.park.entrance.x, plan.park.entrance.y);
    for (const ride of plan.rides) {
      for (let x = ride.position.x - 1; x <= ride.position.x + ride.footprint.w + 1; x += 1) {
        for (let y = ride.position.y - 1; y <= ride.position.y + ride.footprint.h + 3; y += 1) {
          add(x, y);
        }
      }
    }

    for (const path of plan.paths ?? []) {
      for (const coord of expandPath(path, plan)) {
        add(coord.x, coord.y);
      }
    }

    return Array.from(coords)
      .map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x: x ?? 0, y: y ?? 0 };
      })
      .sort((left, right) => left.y - right.y || left.x - right.x);
  }

  function sceneryAction(kind: RctaiBuilder.SceneryPlan["kind"]): RctaiBuilder.GameActionName {
    if (kind === "large") {
      return "largesceneryplace";
    }
    if (kind === "wall") {
      return "wallplace";
    }
    if (kind === "footpath_addition") {
      return "footpathadditionplace";
    }
    return "smallsceneryplace";
  }

  function sceneryObjectType(kind: RctaiBuilder.SceneryPlan["kind"]): RctaiBuilder.ObjectLookupType {
    if (kind === "large") {
      return "large_scenery";
    }
    if (kind === "wall") {
      return "wall";
    }
    if (kind === "footpath_addition") {
      return "footpath_addition";
    }
    return "small_scenery";
  }

  function truncateName(name: string): string {
    return name.length > 32 ? name.slice(0, 32) : name;
  }

  function normalizeDirection(value: number): number {
    return ((value % 4) + 4) % 4;
  }

  function sanitizeSaveName(name: string): string {
    const trimmed = name.trim().replace(/[^A-Za-z0-9._ -]+/g, "_");
    return trimmed.length === 0 ? "rctai-park" : trimmed;
  }
}
