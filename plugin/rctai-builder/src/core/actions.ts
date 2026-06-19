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
  const PARK_PARAMETER_OPEN = 1;
  const PATH_FLAT = 0;
  const PATH_SLOPED = 1;
  const PATH_HEIGHT_STEP = 16;
  const PATH_ENDPOINT_LANDING_TILES = 1;
  const ENTRANCE_SPINE_FLAT_RADIUS = 1;
  const FOOTPRINT_SURFACE_CLEARANCE = 16;
  const GENERATED_TRACK_SURFACE_CLEARANCE = 32;
  const MAX_BUILD_Z = 248 * 8;
  const RIDE_SET_VEHICLE_NUM_TRAINS = 0;
  const SINGLE_TRAIN_COUNT = 1;
  const SIMPLE_SOLID_RIDE_TYPES = new Set([
    "dodgems",
    "drink_stall",
    "enterprise",
    "ferris_wheel",
    "food_stall",
    "haunted_house",
    "information_kiosk",
    "launched_freefall",
    "magic_carpet",
    "merry_go_round",
    "motion_simulator",
    "observation_tower",
    "roto_drop",
    "space_rings",
    "spiral_slide",
    "swinging_ship",
    "toilets",
    "top_spin",
    "twist"
  ]);
  const SHOP_FACILITY_RIDE_TYPES = new Set(["drink_stall", "food_stall", "information_kiosk", "toilets"]);

  export function createBuildSteps(plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep[] {
    const resolvePathNetwork = createPathNetworkResolver(plan);
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
      ...createHeightResolutionSteps(plan),
      RctaiBuilder.createGameActionStep("set park name", "parksetname", () => ({ name: plan.park.name }))
    ];

    for (const ride of plan.rides) {
      steps.push(...createRideSteps(ride, plan, resolvePathNetwork));
    }

    for (const path of plan.paths ?? []) {
      steps.push(...createPathSteps(path, plan, resolvePathNetwork));
    }
    steps.push(createRepairPathEdgesStep(plan, resolvePathNetwork));

    for (const scenery of plan.scenery ?? []) {
      steps.push(createSceneryStep(scenery, plan));
    }

    for (const ride of plan.rides) {
      if (!isRawVisualRide(ride)) {
        if (hasGeneratedTrack(ride)) {
          steps.push(createSingleTrainStep(ride));
        }
        steps.push(createOpenRideStep(ride));
      }
    }
    steps.push(createOpenParkStep());

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
      RctaiBuilder.createAdapterStep(
        "clear paths, track, and scenery",
        (adapter, _state, done) => adapter.clearPathsAndScenery(done),
        { critical: true }
      )
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

  function createRideSteps(
    ride: RctaiBuilder.RidePlan,
    plan: RctaiBuilder.ParkPlan,
    resolvePathNetwork: PathNetworkResolver
  ): RctaiBuilder.QueuedStep[] {
    const steps: RctaiBuilder.QueuedStep[] = [];
    const fallbackBuildZ = planBuildZ(plan);

    steps.push(createRideCreateStep(ride));

    const track = ride.track ?? null;
    if (track !== null && track.length > 0) {
      for (let index = 0; index < track.length; index += 1) {
        const segment = track[index];
        if (segment !== undefined) {
          steps.push(createTrackStep(ride, segment, index, fallbackBuildZ));
        }
      }
    } else {
      steps.push(createTrackStep(ride, { type: 0 }, 0, fallbackBuildZ));
    }

    if (!isRawVisualRide(ride)) {
      steps.push(
        createEntranceExitStep(ride, false, fallbackBuildZ, plan, resolvePathNetwork),
        createEntranceExitStep(ride, true, fallbackBuildZ, plan, resolvePathNetwork)
      );
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

    return steps;
  }

  function isRawVisualRide(ride: RctaiBuilder.RidePlan): boolean {
    const track = ride.track ?? null;
    return track?.some((segment) => segment.raw === true) ?? false;
  }

  function hasGeneratedTrack(ride: RctaiBuilder.RidePlan): boolean {
    const track = ride.track ?? null;
    return track !== null && track.length > 0 && !isRawVisualRide(ride);
  }

  function createRideCreateStep(ride: RctaiBuilder.RidePlan): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createAdapterStep(`create ride ${ride.id}`, (adapter, state, done) => {
      const resolved = adapter.resolveRideObject(ride.rideType, ride.rideObject ?? null);
      if (resolved === null) {
        done({
          error: 1,
          errorTitle: "Ride object unavailable",
          errorMessage: `No loaded or installed ride object supports ${ride.id} (${ride.rideType})`
        });
        return;
      }

      state.rideTypes[ride.id] = resolved.rideTypeId;
      adapter.executeAction(
        "ridecreate",
        {
          rideType: resolved.rideTypeId,
          rideObject: resolved.rideObjectIndex,
          entranceObject: 0,
          colour1: 0,
          colour2: 0,
          inspectionInterval: 2
        },
        (result) => {
          if (result.error !== undefined && result.error !== 0) {
            done(result);
            return;
          }
          if (typeof result.ride !== "number") {
            done({
              error: 1,
              errorTitle: "Ride create failed",
              errorMessage: `OpenRCT2 did not return a ride id for ${ride.id}`
            });
            return;
          }
          state.rideIds[ride.id] = result.ride;
          done(result);
        }
      );
    }, { critical: true, rideId: ride.id });
  }

  function createOpenRideStep(ride: RctaiBuilder.RidePlan): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createAdapterStep(`open ride ${ride.id}`, (adapter, state, done) => {
      if (state.failedRideIds[ride.id] === true) {
        done({});
        return;
      }
      const rideId = state.rideIds[ride.id];
      if (rideId === undefined) {
        done({
          error: 1,
          errorTitle: "Ride missing",
          errorMessage: `No OpenRCT2 ride id exists for ${ride.id}`
        });
        return;
      }
      adapter.executeAction("ridesetstatus", { ride: rideId, status: 1 }, done);
    }, { critical: true, rideId: ride.id });
  }

  function createOpenParkStep(): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createGameActionStep(
      "open park",
      "parksetparameter",
      () => ({
        parameter: PARK_PARAMETER_OPEN,
        value: 0
      }),
      undefined,
      { critical: true }
    );
  }

  function createSingleTrainStep(ride: RctaiBuilder.RidePlan): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createAdapterStep(`set single train ${ride.id}`, (adapter, state, done) => {
      if (state.failedRideIds[ride.id] === true) {
        done({});
        return;
      }
      const rideId = state.rideIds[ride.id];
      if (rideId === undefined) {
        done({
          error: 1,
          errorTitle: "Ride missing",
          errorMessage: `No OpenRCT2 ride id exists for ${ride.id}`
        });
        return;
      }
      adapter.executeAction(
        "ridesetvehicle",
        {
          ride: rideId,
          type: RIDE_SET_VEHICLE_NUM_TRAINS,
          value: SINGLE_TRAIN_COUNT,
          colour: 0
        },
        done
      );
    }, { critical: true, rideId: ride.id });
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
      const cursor = trackCursorForSegment(ride, segment, state, rideBuildZ(ride, state, buildZ));
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
      const z = segment.z ?? rideBuildZ(ride, state, buildZ);
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

  function createEntranceExitStep(
    ride: RctaiBuilder.RidePlan,
    isExit: boolean,
    buildZ: number,
    plan: RctaiBuilder.ParkPlan,
    resolvePathNetwork: PathNetworkResolver
  ): RctaiBuilder.QueuedStep {
    const label = isExit ? "exit" : "entrance";
    return RctaiBuilder.createGameActionStep(`place ${label} ${ride.id}`, "rideentranceexitplace", (adapter, state) => {
      if (state.failedRideIds[ride.id] === true) {
        return null;
      }
      const rideId = state.rideIds[ride.id];
      if (rideId === undefined) {
        return null;
      }

      const exitOffset = entranceExitOffset(ride, isExit);
      const direction = normalizeDirection(exitOffset.direction ?? ride.rotation ?? 0);
      return {
        x: tileToGame(ride.position.x + exitOffset.x),
        y: tileToGame(ride.position.y + exitOffset.y),
        z: entranceExitBuildZ(ride, exitOffset, direction, buildZ, plan, adapter, state, resolvePathNetwork),
        direction,
        ride: rideId,
        station: 0,
        isExit
      };
    }, undefined, { critical: true, rideId: ride.id });
  }

  function entranceExitBuildZ(
    ride: RctaiBuilder.RidePlan,
    offset: RctaiBuilder.CoordD,
    direction: number,
    buildZ: number,
    plan: RctaiBuilder.ParkPlan,
    adapter: RctaiBuilder.BuilderAdapter,
    state: RctaiBuilder.JobState,
    resolvePathNetwork: PathNetworkResolver
  ): number {
    if (offset.z !== undefined) {
      return offset.z;
    }

    const delta = directionTileDelta(direction);
    const accessCoord = {
      x: ride.position.x + offset.x - delta.x,
      y: ride.position.y + offset.y - delta.y
    };
    const accessPath = resolvePathNetwork(adapter, state).get(pathCoordKey(accessCoord));
    return accessPath === undefined ? rideBuildZ(ride, state, buildZ) : pathSpecEdgeZ(accessPath, direction);
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

  function createPathSteps(
    path: RctaiBuilder.PathPlan,
    plan: RctaiBuilder.ParkPlan,
    resolvePathNetwork: PathNetworkResolver
  ): RctaiBuilder.QueuedStep[] {
    const coords = expandPath(path, plan);
    let cachedSpecs: PathTileBuildSpec[] | null = null;
    const resolveSpecs = (adapter: RctaiBuilder.BuilderAdapter, state: RctaiBuilder.JobState): PathTileBuildSpec[] => {
      if (cachedSpecs === null) {
        const spineProfile = createEntranceSpineProfile(plan, adapter, state);
        cachedSpecs = createPathTileSpecs(path, coords, plan, adapter, state, spineProfile).map((spec) => {
          return resolvePathNetwork(adapter, state).get(pathCoordKey(spec.coord)) ?? spec;
        });
      }
      return cachedSpecs;
    };

    return coords.map((_coord, index) =>
      RctaiBuilder.createGameActionStep(`place path ${path.from}->${path.to} #${index}`, "footpathplace", (adapter, state) => {
        const spec = resolveSpecs(adapter, state)[index];
        if (spec === undefined) {
          return null;
        }
        const key = pathTileBuildSpecKey(spec);
        if (state.pathTiles[key] === true) {
          return null;
        }
        state.pathTiles[key] = true;
        const objects = adapter.resolvePathObjects();
        return {
          x: tileToGame(spec.coord.x),
          y: tileToGame(spec.coord.y),
          z: spec.z,
          direction: 255,
          object: objects.surfaceObject,
          railingsObject: objects.railingsObject,
          slopeType: spec.slopeType,
          slopeDirection: spec.slopeDirection,
          constructFlags: 0
        };
      }, undefined, { critical: true })
    );
  }

  function createRepairPathEdgesStep(
    plan: RctaiBuilder.ParkPlan,
    resolvePathNetwork: PathNetworkResolver
  ): RctaiBuilder.QueuedStep {
    return RctaiBuilder.createAdapterStep("repair path edge masks", (adapter, state, done) => {
      const specs = [...resolvePathNetwork(adapter, state).values()].map((spec) => ({
        x: spec.coord.x,
        y: spec.coord.y,
        z: spec.z,
        edges: spec.edges,
        slopeDirection: spec.slopeType === PATH_SLOPED ? spec.slopeDirection : null,
        isQueue: spec.isQueue
      }));
      const repaired = adapter.repairFootpathEdges(specs);
      adapter.log(`[rctai-builder] repaired ${repaired}/${specs.length} path edge masks`);
      if (repaired !== specs.length) {
        done({
          error: 1,
          errorTitle: "Path edge repair failed",
          errorMessage: `OpenRCT2 repaired ${repaired}/${specs.length} planned path edge masks`
        });
        return;
      }
      done({});
    }, { critical: true });
  }

  function createHeightResolutionSteps(plan: RctaiBuilder.ParkPlan): RctaiBuilder.QueuedStep[] {
    const steps: RctaiBuilder.QueuedStep[] = [
      RctaiBuilder.createAdapterStep("resolve entrance height", (adapter, state, done) => {
        state.anchorBuildZ.entrance = resolveEntranceBuildZ(adapter, plan);
        done({});
      })
    ];

    for (const ride of plan.rides) {
      steps.push(
        RctaiBuilder.createAdapterStep(`resolve ride height ${ride.id}`, (adapter, state, done) => {
          state.anchorBuildZ[ride.id] = resolveRideBuildZ(adapter, ride, plan);
          done({});
        })
      );
    }

    return steps;
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

  interface PathTileBuildSpec {
    coord: RctaiBuilder.Coord;
    z: number;
    slopeType: number;
    slopeDirection: number;
  }

  interface PathNetworkBuildSpec extends PathTileBuildSpec {
    edges: number;
    isQueue: boolean;
  }

  interface EntranceSpineProfile {
    rowY: number;
    zByX: Map<number, number>;
  }

  interface PathEndpointZOverrides {
    startZ?: number;
    endZ?: number;
  }

  interface PathJoinerInfo {
    directions: Set<number>;
    isEndpoint: boolean;
  }

  type PathNetworkResolver = (
    adapter: RctaiBuilder.BuilderAdapter,
    state: RctaiBuilder.JobState
  ) => Map<string, PathNetworkBuildSpec>;

  function resolveEntranceBuildZ(adapter: RctaiBuilder.BuilderAdapter, plan: RctaiBuilder.ParkPlan): number {
    const terrainZ = surfaceBuildZ(adapter, plan.park.entrance);
    return clampBuildZ(Math.max(plan.park.entrance.z ?? RctaiBuilder.DEFAULT_Z, terrainZ ?? RctaiBuilder.DEFAULT_Z));
  }

  function resolveRideBuildZ(
    adapter: RctaiBuilder.BuilderAdapter,
    ride: RctaiBuilder.RidePlan,
    plan: RctaiBuilder.ParkPlan
  ): number {
    const explicit = explicitRideOriginZ(ride);
    const surfaceMax = maxSurfaceZ(adapter, rideTerrainCoords(ride, plan));
    const clearance = hasGeneratedTrack(ride) ? GENERATED_TRACK_SURFACE_CLEARANCE : FOOTPRINT_SURFACE_CLEARANCE;
    const terrainZ = surfaceMax === null ? null : alignBuildZ(surfaceMax + clearance);
    return clampBuildZ(Math.max(explicit ?? planBuildZ(plan), terrainZ ?? RctaiBuilder.DEFAULT_Z));
  }

  function rideBuildZ(ride: RctaiBuilder.RidePlan, state: RctaiBuilder.JobState, fallbackBuildZ: number): number {
    return state.anchorBuildZ[ride.id] ?? explicitRideOriginZ(ride) ?? fallbackBuildZ;
  }

  function anchorBuildZ(id: string, plan: RctaiBuilder.ParkPlan, state: RctaiBuilder.JobState): number {
    if (id === "entrance") {
      return state.anchorBuildZ.entrance ?? planBuildZ(plan);
    }
    const ride = plan.rides.find((candidate) => candidate.id === id);
    if (ride === undefined) {
      return planBuildZ(plan);
    }
    return rideBuildZ(ride, state, planBuildZ(plan));
  }

  function explicitRideOriginZ(ride: RctaiBuilder.RidePlan): number | null {
    const track = ride.track ?? [];
    for (const segment of track) {
      if (segment.z !== undefined) {
        return segment.z;
      }
    }
    return null;
  }

  function createPathTileSpecs(
    path: RctaiBuilder.PathPlan,
    coords: RctaiBuilder.Coord[],
    plan: RctaiBuilder.ParkPlan,
    adapter: RctaiBuilder.BuilderAdapter,
    state: RctaiBuilder.JobState,
    spineProfile?: EntranceSpineProfile,
    zOverrides?: PathEndpointZOverrides,
    flatJoiners: ReadonlySet<string> = new Set()
  ): PathTileBuildSpec[] {
    const startZ = zOverrides?.startZ ?? anchorBuildZ(path.from, plan, state);
    const endZ = zOverrides?.endZ ?? anchorBuildZ(path.to, plan, state);
    const profile = pathZProfileForPath(
      path,
      coords,
      startZ,
      endZ,
      adapter,
      plan,
      spineProfile,
      flatJoiners
    );
    return coords.map((coord, index) => ({
      coord,
      z: profile[index] ?? planBuildZ(plan),
      ...pathSlopeForTile(coords, profile, index, flatJoiners)
    }));
  }

  function createPathNetworkResolver(plan: RctaiBuilder.ParkPlan): PathNetworkResolver {
    let cached: Map<string, PathNetworkBuildSpec> | null = null;
    return (adapter, state) => {
      if (cached === null) {
        cached = createPathNetworkSpecs(plan, adapter, state);
      }
      return cached;
    };
  }

  function createPathNetworkSpecs(
    plan: RctaiBuilder.ParkPlan,
    adapter: RctaiBuilder.BuilderAdapter,
    state: RctaiBuilder.JobState
  ): Map<string, PathNetworkBuildSpec> {
    const spineProfile = createEntranceSpineProfile(plan, adapter, state);
    const flatJoiners = flatPathJoinerSet(plan);
    const byKey = new Map<string, PathNetworkBuildSpec>();
    for (const path of plan.paths ?? []) {
      const coords = expandPath(path, plan);
      const specs = createPathTileSpecs(
        path,
        coords,
        plan,
        adapter,
        state,
        spineProfile,
        pathEndpointZOverrides(coords, byKey),
        flatJoiners
      );
      for (const spec of specs) {
        const key = pathCoordKey(spec.coord);
        const existing = byKey.get(key);
        byKey.set(key, mergePathNetworkSpec(existing, spec));
      }
    }

    normalizePathNetworkSpecs(plan, state, byKey, flatJoiners);

    const byXY = new Map<string, PathNetworkBuildSpec[]>();
    for (const spec of byKey.values()) {
      const key = pathCoordKey(spec.coord);
      const candidates = byXY.get(key) ?? [];
      candidates.push(spec);
      byXY.set(key, candidates);
    }

    for (const spec of byKey.values()) {
      let edges = 0;
      for (let direction = 0; direction < 4; direction += 1) {
        const delta = directionTileDelta(direction);
        const candidates = byXY.get(pathCoordKey({ x: spec.coord.x + delta.x, y: spec.coord.y + delta.y })) ?? [];
        if (candidates.some((candidate) => pathSpecsConnect(spec, candidate, direction))) {
          edges |= 1 << direction;
        }
      }
      spec.edges = edges;
    }

    addRideAccessPathEdges(byXY, plan, state);

    return byKey;
  }

  function mergePathNetworkSpec(
    existing: PathNetworkBuildSpec | undefined,
    spec: PathTileBuildSpec
  ): PathNetworkBuildSpec {
    if (existing === undefined) {
      return { ...spec, edges: 0, isQueue: false };
    }
    return {
      ...existing,
      z: Math.max(existing.z, spec.z),
      slopeType: existing.slopeType === PATH_FLAT || spec.slopeType === PATH_FLAT ? PATH_FLAT : existing.slopeType,
      slopeDirection: existing.slopeDirection
    };
  }

  function normalizePathNetworkSpecs(
    plan: RctaiBuilder.ParkPlan,
    state: RctaiBuilder.JobState,
    byKey: Map<string, PathNetworkBuildSpec>,
    flatJoiners: ReadonlySet<string>
  ): void {
    const adjacency = pathNetworkAdjacency(plan);
    const fixedZ = fixedPathZMap(plan, state);
    const maxZ = pathNetworkMaxZ(adjacency, fixedZ, flatJoiners);
    for (let pass = 0; pass < byKey.size; pass += 1) {
      let changed = false;
      changed = applyPathNetworkZBounds(byKey, fixedZ, maxZ) || changed;
      for (const [key, spec] of byKey) {
        const neighbors = pathNetworkNeighbors(key, adjacency, byKey);
        if (flatJoiners.has(key)) {
          for (const neighbor of neighbors) {
            changed = raisePathNetworkSpec(spec, neighbor.z, fixedZ, maxZ) || changed;
          }
          continue;
        }

        const higherNeighbors = neighbors.filter((neighbor) => neighbor.z > spec.z);
        if (higherNeighbors.length > 1) {
          const target = Math.max(...higherNeighbors.map((neighbor) => neighbor.z));
          changed = raisePathNetworkSpec(spec, target, fixedZ, maxZ) || changed;
        }
      }

      for (const [key, spec] of byKey) {
        for (const neighborKey of adjacency.get(key) ?? []) {
          if (key >= neighborKey) {
            continue;
          }
          const neighbor = byKey.get(neighborKey);
          if (neighbor === undefined) {
            continue;
          }
          const high = spec.z >= neighbor.z ? spec : neighbor;
          const low = spec.z >= neighbor.z ? neighbor : spec;
          if (high.z > low.z + PATH_HEIGHT_STEP) {
            const lowKey = pathCoordKey(low.coord);
            const target = flatJoiners.has(lowKey) ? high.z : high.z - PATH_HEIGHT_STEP;
            changed = raisePathNetworkSpec(low, target, fixedZ, maxZ) || changed;
            if (high.z > low.z + PATH_HEIGHT_STEP) {
              const loweredTarget = flatJoiners.has(lowKey) ? low.z : low.z + PATH_HEIGHT_STEP;
              changed = lowerPathNetworkSpec(high, loweredTarget, fixedZ, maxZ) || changed;
            }
          }
        }
      }

      if (!changed) {
        break;
      }
    }
    applyPathNetworkZBounds(byKey, fixedZ, maxZ);

    for (const [key, spec] of byKey) {
      spec.slopeType = PATH_FLAT;
      spec.slopeDirection = 0;
      if (flatJoiners.has(key)) {
        continue;
      }
      const higherNeighbor = pathNetworkNeighbors(key, adjacency, byKey).find(
        (neighbor) => neighbor.z === spec.z + PATH_HEIGHT_STEP
      );
      if (higherNeighbor !== undefined) {
        spec.slopeType = PATH_SLOPED;
        spec.slopeDirection = directionBetweenTiles(spec.coord, higherNeighbor.coord);
      }
    }
  }

  function fixedPathZMap(plan: RctaiBuilder.ParkPlan, state: RctaiBuilder.JobState): Map<string, number> {
    const fixed = new Map<string, number>();
    fixed.set(pathCoordKey(plan.park.entrance), anchorBuildZ("entrance", plan, state));

    for (const ride of plan.rides) {
      if (isRawVisualRide(ride)) {
        continue;
      }
      for (const isExit of [false, true]) {
        const offset = entranceExitOffset(ride, isExit);
        const direction = normalizeDirection(offset.direction ?? ride.rotation ?? 0);
        const delta = directionTileDelta(direction);
        const coord = {
          x: ride.position.x + offset.x - delta.x,
          y: ride.position.y + offset.y - delta.y
        };
        fixed.set(pathCoordKey(coord), offset.z ?? rideBuildZ(ride, state, planBuildZ(plan)));
      }
    }

    return fixed;
  }

  function pathNetworkMaxZ(
    adjacency: Map<string, Set<string>>,
    fixedZ: ReadonlyMap<string, number>,
    flatJoiners: ReadonlySet<string>
  ): Map<string, number> {
    const maxZ = new Map<string, number>(fixedZ);
    const queue = [...fixedZ.keys()].sort();
    while (queue.length > 0) {
      const key = queue.shift();
      if (key === undefined) {
        continue;
      }
      const z = maxZ.get(key);
      if (z === undefined) {
        continue;
      }
      const neighborMax = z + (flatJoiners.has(key) ? 0 : PATH_HEIGHT_STEP);
      for (const neighborKey of adjacency.get(key) ?? []) {
        const existing = maxZ.get(neighborKey);
        if (existing === undefined || neighborMax < existing) {
          maxZ.set(neighborKey, neighborMax);
          queue.push(neighborKey);
        }
      }
    }
    return maxZ;
  }

  function applyPathNetworkZBounds(
    byKey: Map<string, PathNetworkBuildSpec>,
    fixedZ: ReadonlyMap<string, number>,
    maxZ: ReadonlyMap<string, number>
  ): boolean {
    let changed = false;
    for (const [key, spec] of byKey) {
      const fixed = fixedZ.get(key);
      const bounded = fixed ?? Math.min(spec.z, maxZ.get(key) ?? spec.z);
      if (spec.z !== bounded) {
        spec.z = bounded;
        changed = true;
      }
    }
    return changed;
  }

  function pathNetworkAdjacency(plan: RctaiBuilder.ParkPlan): Map<string, Set<string>> {
    const adjacency = new Map<string, Set<string>>();
    for (const path of plan.paths ?? []) {
      const coords = expandPath(path, plan);
      for (let index = 0; index < coords.length - 1; index += 1) {
        const current = coords[index];
        const next = coords[index + 1];
        if (current === undefined || next === undefined) {
          continue;
        }
        addPathNetworkNeighbor(adjacency, pathCoordKey(current), pathCoordKey(next));
        addPathNetworkNeighbor(adjacency, pathCoordKey(next), pathCoordKey(current));
      }
    }
    return adjacency;
  }

  function addPathNetworkNeighbor(adjacency: Map<string, Set<string>>, key: string, neighborKey: string): void {
    const neighbors = adjacency.get(key) ?? new Set<string>();
    neighbors.add(neighborKey);
    adjacency.set(key, neighbors);
  }

  function pathNetworkNeighbors(
    key: string,
    adjacency: Map<string, Set<string>>,
    byKey: Map<string, PathNetworkBuildSpec>
  ): PathNetworkBuildSpec[] {
    return [...(adjacency.get(key) ?? [])]
      .map((neighborKey) => byKey.get(neighborKey))
      .filter((neighbor): neighbor is PathNetworkBuildSpec => neighbor !== undefined);
  }

  function raisePathNetworkSpec(
    spec: PathNetworkBuildSpec,
    z: number,
    fixedZ: ReadonlyMap<string, number>,
    maxZ: ReadonlyMap<string, number>
  ): boolean {
    const key = pathCoordKey(spec.coord);
    if (fixedZ.has(key)) {
      return false;
    }
    const nextZ = Math.min(clampBuildZ(z), maxZ.get(key) ?? MAX_BUILD_Z);
    if (nextZ <= spec.z) {
      return false;
    }
    spec.z = nextZ;
    return true;
  }

  function lowerPathNetworkSpec(
    spec: PathNetworkBuildSpec,
    z: number,
    fixedZ: ReadonlyMap<string, number>,
    maxZ: ReadonlyMap<string, number>
  ): boolean {
    const key = pathCoordKey(spec.coord);
    if (fixedZ.has(key)) {
      return false;
    }
    const nextZ = Math.min(clampBuildZ(z), maxZ.get(key) ?? MAX_BUILD_Z);
    if (nextZ >= spec.z) {
      return false;
    }
    spec.z = nextZ;
    return true;
  }

  function flatPathJoinerSet(plan: RctaiBuilder.ParkPlan): Set<string> {
    const byCoord = new Map<string, PathJoinerInfo>();
    for (const path of plan.paths ?? []) {
      const coords = expandPath(path, plan);
      for (let index = 0; index < coords.length; index += 1) {
        const coord = coords[index];
        if (coord === undefined) {
          continue;
        }
        const key = pathCoordKey(coord);
        const info = byCoord.get(key) ?? { directions: new Set<number>(), isEndpoint: false };
        info.isEndpoint = info.isEndpoint || index === 0 || index === coords.length - 1;

        const previous = coords[index - 1];
        const next = coords[index + 1];
        if (previous !== undefined) {
          info.directions.add(directionBetweenTiles(coord, previous));
        }
        if (next !== undefined) {
          info.directions.add(directionBetweenTiles(coord, next));
        }
        byCoord.set(key, info);
      }
    }

    const flatJoiners = new Set<string>();
    for (const [key, info] of byCoord) {
      if (info.isEndpoint || !isStraightThroughPath(info.directions)) {
        flatJoiners.add(key);
      }
    }
    return flatJoiners;
  }

  function isStraightThroughPath(directions: ReadonlySet<number>): boolean {
    if (directions.size !== 2) {
      return false;
    }
    const directionList = [...directions];
    const first = directionList[0];
    const second = directionList[1];
    return first !== undefined && second !== undefined && normalizeDirection(first + 2) === normalizeDirection(second);
  }

  function pathEndpointZOverrides(
    coords: RctaiBuilder.Coord[],
    existingSpecs: Map<string, PathNetworkBuildSpec>
  ): PathEndpointZOverrides {
    const first = coords[0];
    const last = coords[coords.length - 1];
    const startZ = first === undefined ? undefined : existingSpecs.get(pathCoordKey(first))?.z;
    const endZ = last === undefined ? undefined : existingSpecs.get(pathCoordKey(last))?.z;
    const overrides: PathEndpointZOverrides = {};
    if (startZ !== undefined) {
      overrides.startZ = startZ;
    }
    if (endZ !== undefined) {
      overrides.endZ = endZ;
    }
    return overrides;
  }

  function addRideAccessPathEdges(
    byXY: Map<string, PathNetworkBuildSpec[]>,
    plan: RctaiBuilder.ParkPlan,
    state: RctaiBuilder.JobState
  ): void {
    for (const ride of plan.rides) {
      if (isRawVisualRide(ride)) {
        continue;
      }
      for (const isExit of [false, true]) {
        const offset = entranceExitOffset(ride, isExit);
        const direction = normalizeDirection(offset.direction ?? ride.rotation ?? 0);
        const delta = directionTileDelta(direction);
        const coord = {
          x: ride.position.x + offset.x - delta.x,
          y: ride.position.y + offset.y - delta.y
        };
        const z = offset.z ?? rideBuildZ(ride, state, planBuildZ(plan));
        const candidates = byXY.get(pathCoordKey(coord)) ?? [];
        for (const spec of candidates) {
          if (offset.z === undefined || pathSpecEdgeZ(spec, direction) === z) {
            spec.edges |= 1 << direction;
          }
        }
      }
    }
  }

  function pathSpecsConnect(from: PathTileBuildSpec, to: PathTileBuildSpec, direction: number): boolean {
    return pathSpecEdgeZ(from, direction) === pathSpecEdgeZ(to, normalizeDirection(direction + 2));
  }

  function pathCoordKey(coord: RctaiBuilder.Coord): string {
    return `${coord.x},${coord.y}`;
  }

  function pathSpecEdgeZ(spec: PathTileBuildSpec, direction: number): number {
    if (spec.slopeType !== PATH_SLOPED) {
      return spec.z;
    }
    return normalizeDirection(spec.slopeDirection) === normalizeDirection(direction) ? spec.z + PATH_HEIGHT_STEP : spec.z;
  }

  function createEntranceSpineProfile(
    plan: RctaiBuilder.ParkPlan,
    adapter: RctaiBuilder.BuilderAdapter,
    state: RctaiBuilder.JobState
  ): EntranceSpineProfile {
    const rowY = plan.park.entrance.y;
    const entranceX = plan.park.entrance.x;
    const entranceZ = anchorBuildZ("entrance", plan, state);
    const minimumByX = new Map<number, number>();

    const requireAtLeast = (x: number, z: number): void => {
      const existing = minimumByX.get(x);
      minimumByX.set(x, clampBuildZ(Math.max(existing ?? RctaiBuilder.DEFAULT_Z, z)));
    };
    const requireSurface = (coord: RctaiBuilder.Coord): void => {
      requireAtLeast(coord.x, surfaceBuildZ(adapter, coord) ?? RctaiBuilder.DEFAULT_Z);
    };

    for (const path of plan.paths ?? []) {
      if (path.from !== "entrance") {
        continue;
      }
      const coords = expandPath(path, plan);
      if (coords.length === 0 || coords[0]?.x !== entranceX || coords[0]?.y !== rowY) {
        continue;
      }

      let index = 0;
      while (index < coords.length && coords[index]?.y === rowY) {
        requireSurface(coords[index] ?? plan.park.entrance);
        index += 1;
      }

      const branchRoot = coords[index - 1];
      const firstBranchTile = coords[index];
      if (branchRoot !== undefined && firstBranchTile !== undefined) {
        requireAtLeast(branchRoot.x, surfaceBuildZ(adapter, firstBranchTile) ?? RctaiBuilder.DEFAULT_Z);
      }
    }

    requireAtLeast(entranceX, entranceZ);
    const zByX = createFlatEntranceSpineProfile(minimumByX, entranceX, entranceZ);
    smoothSpineProfile(zByX, minimumByX, entranceX, entranceZ);
    zByX.set(entranceX, entranceZ);
    return { rowY, zByX };
  }

  function createFlatEntranceSpineProfile(
    minimumByX: Map<number, number>,
    entranceX: number,
    entranceZ: number
  ): Map<number, number> {
    const spineZ = Math.max(entranceZ, ...minimumByX.values());
    const zByX = new Map<number, number>();
    for (const [x, minimum] of minimumByX) {
      const rampSteps = Math.max(0, Math.abs(x - entranceX) - ENTRANCE_SPINE_FLAT_RADIUS);
      const rampZ = entranceZ + PATH_HEIGHT_STEP * rampSteps;
      zByX.set(x, clampBuildZ(Math.max(minimum, Math.min(spineZ, rampZ))));
    }
    return zByX;
  }

  function smoothSpineProfile(
    zByX: Map<number, number>,
    minimumByX: Map<number, number>,
    entranceX: number,
    entranceZ: number
  ): void {
    const xs = [...zByX.keys()].sort((left, right) => left - right);
    for (let pass = 0; pass < xs.length * 2; pass += 1) {
      let changed = false;
      for (let index = 1; index < xs.length; index += 1) {
        const leftX = xs[index - 1] ?? entranceX;
        const rightX = xs[index] ?? entranceX;
        if (rightX !== leftX + 1) {
          continue;
        }
        changed = raiseLowerSpineNeighbor(zByX, minimumByX, entranceX, entranceZ, leftX, rightX) || changed;
        changed = raiseLowerSpineNeighbor(zByX, minimumByX, entranceX, entranceZ, rightX, leftX) || changed;
      }
      if (!changed) {
        return;
      }
    }
  }

  function raiseLowerSpineNeighbor(
    zByX: Map<number, number>,
    minimumByX: Map<number, number>,
    entranceX: number,
    entranceZ: number,
    highX: number,
    lowX: number
  ): boolean {
    const highZ = zByX.get(highX);
    const lowZ = zByX.get(lowX);
    if (highZ === undefined || lowZ === undefined || highZ <= lowZ + PATH_HEIGHT_STEP) {
      return false;
    }
    if (Math.abs(lowX - entranceX) <= ENTRANCE_SPINE_FLAT_RADIUS) {
      zByX.set(lowX, entranceZ);
      return false;
    }
    const raised = clampBuildZ(Math.max(minimumByX.get(lowX) ?? RctaiBuilder.DEFAULT_Z, highZ - PATH_HEIGHT_STEP));
    if (raised === lowZ) {
      return false;
    }
    zByX.set(lowX, raised);
    return true;
  }

  function pathZProfileForPath(
    path: RctaiBuilder.PathPlan,
    coords: RctaiBuilder.Coord[],
    startZ: number,
    endZ: number,
    adapter: RctaiBuilder.BuilderAdapter,
    plan: RctaiBuilder.ParkPlan,
    spineProfile?: EntranceSpineProfile,
    flatJoiners: ReadonlySet<string> = new Set()
  ): number[] {
    if (spineProfile === undefined || path.from !== "entrance" || coords[0]?.x !== plan.park.entrance.x) {
      return pathZProfile(coords, startZ, endZ, adapter, flatJoiners);
    }

    let rowEnd = -1;
    while (rowEnd + 1 < coords.length) {
      const coord = coords[rowEnd + 1];
      if (coord === undefined || coord.y !== spineProfile.rowY || !spineProfile.zByX.has(coord.x)) {
        break;
      }
      rowEnd += 1;
    }

    if (rowEnd < 0 || rowEnd >= coords.length - 1) {
      return pathZProfile(coords, startZ, endZ, adapter, flatJoiners);
    }

    const profile = pathZProfile(coords, startZ, endZ, adapter, flatJoiners);
    for (let index = 0; index <= rowEnd; index += 1) {
      const coord = coords[index];
      const z = coord === undefined ? undefined : spineProfile.zByX.get(coord.x);
      if (z !== undefined) {
        profile[index] = z;
      }
    }

    if (rowEnd < coords.length - 1) {
      const branchCoords = coords.slice(rowEnd);
      const branchStart = profile[rowEnd] ?? startZ;
      const branchProfile = pathZProfile(branchCoords, branchStart, endZ, adapter, flatJoiners);
      for (let index = 0; index < branchProfile.length; index += 1) {
        profile[rowEnd + index] = branchProfile[index] ?? branchStart;
      }
    }

    return profile;
  }

  function pathZProfile(
    coords: RctaiBuilder.Coord[],
    startZ: number,
    endZ: number,
    adapter: RctaiBuilder.BuilderAdapter,
    flatJoiners: ReadonlySet<string> = new Set()
  ): number[] {
    if (coords.length === 0) {
      return [];
    }
    if (coords.length === 1) {
      return [clampBuildZ(startZ)];
    }

    const start = clampBuildZ(startZ);
    const end = clampBuildZ(endZ);
    const landingTiles = endpointLandingTiles(coords.length, start, end);
    const base = directZProfile(coords.length, start, end, landingTiles);
    const lastIndex = coords.length - 1;
    const maxFeasible = coords.map((_coord, index) =>
      Math.min(
        start + PATH_HEIGHT_STEP * Math.max(0, index - landingTiles),
        end + PATH_HEIGHT_STEP * Math.max(0, lastIndex - landingTiles - index)
      )
    );
    const minimum = coords.map((coord, index) => {
      const terrainZ = surfaceBuildZ(adapter, coord) ?? RctaiBuilder.DEFAULT_Z;
      return Math.max(base[index] ?? start, terrainZ);
    });
    const profile = minimum.map((required, index) => {
      return clampBuildZ(Math.min(required, maxFeasible[index] ?? required));
    });
    profile[0] = start;
    profile[lastIndex] = end;

    enforceWalkablePathProfile(coords, profile, minimum, maxFeasible, start, end, landingTiles, flatJoiners);
    smoothPathSlopeProfile(profile, minimum, maxFeasible);
    enforceWalkablePathProfile(coords, profile, minimum, maxFeasible, start, end, landingTiles, flatJoiners);
    enforceWalkablePathProfile(coords, profile, minimum, maxFeasible, start, end, landingTiles, flatJoiners);

    return profile.map(clampBuildZ);
  }

  function enforceWalkablePathProfile(
    coords: RctaiBuilder.Coord[],
    profile: number[],
    minimum: number[],
    maxFeasible: number[],
    start: number,
    end: number,
    landingTiles: number,
    flatJoiners: ReadonlySet<string>
  ): void {
    enforceEndpointLandings(profile, minimum, maxFeasible, start, end, landingTiles);
    enforceStartRowLanding(coords, profile, minimum, maxFeasible, start);
    enforceTurnLandings(coords, profile, minimum, maxFeasible);
    enforceFlatJoinerLandings(coords, profile, minimum, maxFeasible, flatJoiners);
    enforcePathStepLimits(profile, maxFeasible, start, end);
  }

  function endpointLandingTiles(length: number, start: number, end: number): number {
    if (length >= PATH_ENDPOINT_LANDING_TILES * 2 + 2) {
      return PATH_ENDPOINT_LANDING_TILES;
    }
    return length >= PATH_ENDPOINT_LANDING_TILES * 2 + 1 && start === end ? PATH_ENDPOINT_LANDING_TILES : 0;
  }

  function enforceEndpointLandings(
    profile: number[],
    minimum: number[],
    maxFeasible: number[],
    start: number,
    end: number,
    landingTiles: number
  ): void {
    if (landingTiles === 0) {
      return;
    }
    for (let index = 0; index <= landingTiles; index += 1) {
      if ((minimum[index] ?? start) <= start && (maxFeasible[index] ?? start) >= start) {
        profile[index] = start;
      }
    }

    const lastIndex = profile.length - 1;
    for (let index = lastIndex - landingTiles; index <= lastIndex; index += 1) {
      if ((minimum[index] ?? end) <= end && (maxFeasible[index] ?? end) >= end) {
        profile[index] = end;
      }
    }
  }

  function enforceTurnLandings(
    coords: RctaiBuilder.Coord[],
    profile: number[],
    minimum: number[],
    maxFeasible: number[]
  ): void {
    for (let index = 1; index < coords.length - 1; index += 1) {
      const previous = coords[index - 1];
      const current = coords[index];
      const next = coords[index + 1];
      const after = coords[index + 2];
      if (previous === undefined || current === undefined || next === undefined || after === undefined) {
        continue;
      }
      const incoming = directionBetweenTiles(previous, current);
      const outgoing = directionBetweenTiles(current, next);
      if (incoming === outgoing) {
        continue;
      }

      const landingZ = sharedLandingZ(profile, minimum, maxFeasible, index, index + 1);
      if (landingZ === null) {
        continue;
      }
      const afterTurnIndex = index + 1;
      profile[index] = landingZ;
      profile[afterTurnIndex] = landingZ;
    }
  }

  function enforceFlatJoinerLandings(
    coords: RctaiBuilder.Coord[],
    profile: number[],
    minimum: number[],
    maxFeasible: number[],
    flatJoiners: ReadonlySet<string>
  ): void {
    for (let pass = 0; pass < coords.length; pass += 1) {
      let changed = false;
      for (let index = 0; index < coords.length; index += 1) {
        if (!isFlatJoiner(coords, index, flatJoiners)) {
          continue;
        }
        for (const neighborIndex of [index - 1, index + 1]) {
          if (neighborIndex < 0 || neighborIndex >= coords.length) {
            continue;
          }
          if (isFlatJoiner(coords, neighborIndex, flatJoiners)) {
            const landingZ = sharedLandingZ(profile, minimum, maxFeasible, index, neighborIndex);
            if (landingZ !== null) {
              changed = setProfileHeight(profile, index, landingZ) || changed;
              changed = setProfileHeight(profile, neighborIndex, landingZ) || changed;
            }
            continue;
          }

          const joinerZ = profile[index] ?? RctaiBuilder.DEFAULT_Z;
          const neighborZ = profile[neighborIndex] ?? joinerZ;
          if (neighborZ > joinerZ && setProfileHeightIfFeasible(profile, minimum, maxFeasible, index, neighborZ)) {
            changed = true;
          }
        }
      }
      if (!changed) {
        return;
      }
    }
  }

  function enforceStartRowLanding(
    coords: RctaiBuilder.Coord[],
    profile: number[],
    minimum: number[],
    maxFeasible: number[],
    start: number
  ): void {
    const first = coords[0];
    const second = coords[1];
    if (first === undefined || second === undefined || first.y !== second.y) {
      return;
    }

    let index = 0;
    while (index < coords.length && coords[index]?.y === first.y) {
      setProfileHeightIfFeasible(profile, minimum, maxFeasible, index, start);
      index += 1;
    }
    if (index < coords.length) {
      setProfileHeightIfFeasible(profile, minimum, maxFeasible, index, start);
    }
  }

  function setProfileHeightIfFeasible(
    profile: number[],
    minimum: number[],
    maxFeasible: number[],
    index: number,
    z: number
  ): boolean {
    if ((minimum[index] ?? z) <= z && (maxFeasible[index] ?? z) >= z) {
      if (profile[index] === z) {
        return false;
      }
      profile[index] = z;
      return true;
    }
    return false;
  }

  function setProfileHeight(profile: number[], index: number, z: number): boolean {
    if (profile[index] === z) {
      return false;
    }
    profile[index] = z;
    return true;
  }

  function sharedLandingZ(
    profile: number[],
    minimum: number[],
    maxFeasible: number[],
    leftIndex: number,
    rightIndex: number
  ): number | null {
    const lower = Math.max(
      minimum[leftIndex] ?? RctaiBuilder.DEFAULT_Z,
      minimum[rightIndex] ?? RctaiBuilder.DEFAULT_Z
    );
    const upper = Math.min(
      maxFeasible[leftIndex] ?? MAX_BUILD_Z,
      maxFeasible[rightIndex] ?? MAX_BUILD_Z
    );
    if (lower > upper) {
      return null;
    }
    const preferred = Math.max(
      profile[leftIndex] ?? lower,
      profile[rightIndex] ?? lower
    );
    return clampBuildZ(Math.max(lower, Math.min(upper, preferred)));
  }

  function enforcePathStepLimits(profile: number[], maxFeasible: number[], start: number, end: number): void {
    const lastIndex = profile.length - 1;
    for (let pass = 0; pass < profile.length; pass += 1) {
      for (let index = 1; index < lastIndex; index += 1) {
        const needed = (profile[index - 1] ?? start) - PATH_HEIGHT_STEP;
        if ((profile[index] ?? start) < needed) {
          profile[index] = Math.min(needed, maxFeasible[index] ?? needed);
        }
      }
      for (let index = lastIndex - 1; index > 0; index -= 1) {
        const needed = (profile[index + 1] ?? end) - PATH_HEIGHT_STEP;
        if ((profile[index] ?? end) < needed) {
          profile[index] = Math.min(needed, maxFeasible[index] ?? needed);
        }
      }
    }
  }

  function smoothPathSlopeProfile(profile: number[], minimum: number[], maxFeasible: number[]): void {
    const lastIndex = profile.length - 1;
    for (let pass = 0; pass < profile.length; pass += 1) {
      let changed = false;
      for (let index = 1; index < lastIndex; index += 1) {
        const previous = profile[index - 1] ?? profile[index] ?? RctaiBuilder.DEFAULT_Z;
        const current = profile[index] ?? previous;
        const next = profile[index + 1] ?? current;
        const lowerNeighbor = Math.min(previous, next);
        if (current < lowerNeighbor) {
          const raised = Math.min(maxFeasible[index] ?? lowerNeighbor, lowerNeighbor);
          if (raised > current) {
            profile[index] = raised;
            changed = true;
          }
          continue;
        }

        const higherNeighbor = Math.max(previous, next);
        if (current > higherNeighbor) {
          const lowered = Math.max(minimum[index] ?? current, higherNeighbor);
          if (lowered < current) {
            profile[index] = lowered;
            changed = true;
            continue;
          }
          if (previous < current && (maxFeasible[index - 1] ?? previous) >= current) {
            profile[index - 1] = current;
            changed = true;
          }
          if (next < current && (maxFeasible[index + 1] ?? next) >= current) {
            profile[index + 1] = current;
            changed = true;
          }
        }
      }
      if (!changed) {
        return;
      }
    }
  }

  function directZProfile(length: number, start: number, end: number, landingTiles = 0): number[] {
    if (landingTiles === 0) {
      return directZSpan(length, start, end);
    }

    const profile = new Array<number>(length);
    const firstIndex = landingTiles;
    const lastIndex = length - 1 - landingTiles;
    const span = directZSpan(lastIndex - firstIndex + 1, start, end);
    for (let index = 0; index < length; index += 1) {
      if (index <= firstIndex) {
        profile[index] = start;
      } else if (index >= lastIndex) {
        profile[index] = end;
      } else {
        profile[index] = span[index - firstIndex] ?? start;
      }
    }
    return profile;
  }

  function directZSpan(length: number, start: number, end: number): number[] {
    const profile = [start];
    for (let index = 1; index < length; index += 1) {
      const remainingSteps = length - 1 - index;
      const previous = profile[index - 1] ?? start;
      if (previous < end - PATH_HEIGHT_STEP * remainingSteps) {
        profile.push(previous + PATH_HEIGHT_STEP);
      } else if (previous > end + PATH_HEIGHT_STEP * remainingSteps) {
        profile.push(previous - PATH_HEIGHT_STEP);
      } else {
        profile.push(previous);
      }
    }
    profile[length - 1] = end;
    return profile;
  }

  function pathSlopeForTile(
    coords: RctaiBuilder.Coord[],
    profile: number[],
    index: number,
    flatJoiners: ReadonlySet<string> = new Set()
  ): Pick<PathTileBuildSpec, "slopeType" | "slopeDirection"> {
    const coord = coords[index];
    if (isFlatJoiner(coords, index, flatJoiners) || isPathTurnTile(coords, index)) {
      return { slopeType: PATH_FLAT, slopeDirection: 0 };
    }

    const z = profile[index];
    const next = coords[index + 1];
    const nextZ = profile[index + 1];
    if (coord !== undefined && next !== undefined && nextZ === (z ?? 0) + PATH_HEIGHT_STEP) {
      return { slopeType: PATH_SLOPED, slopeDirection: directionBetweenTiles(coord, next) };
    }

    const previous = coords[index - 1];
    const previousZ = profile[index - 1];
    if (coord !== undefined && previous !== undefined && previousZ === (z ?? 0) + PATH_HEIGHT_STEP) {
      return { slopeType: PATH_SLOPED, slopeDirection: directionBetweenTiles(coord, previous) };
    }

    return { slopeType: PATH_FLAT, slopeDirection: 0 };
  }

  function isFlatJoiner(
    coords: RctaiBuilder.Coord[],
    index: number,
    flatJoiners: ReadonlySet<string>
  ): boolean {
    const coord = coords[index];
    return coord !== undefined && flatJoiners.has(pathCoordKey(coord));
  }

  function isPathTurnTile(coords: RctaiBuilder.Coord[], index: number): boolean {
    const previous = coords[index - 1];
    const current = coords[index];
    const next = coords[index + 1];
    if (previous === undefined || current === undefined || next === undefined) {
      return false;
    }
    return directionBetweenTiles(previous, current) !== directionBetweenTiles(current, next);
  }

  function pathTileBuildSpecKey(spec: PathTileBuildSpec): string {
    return `${spec.coord.x},${spec.coord.y},${spec.z}`;
  }

  function directionBetweenTiles(from: RctaiBuilder.Coord, to: RctaiBuilder.Coord): number {
    return directionFromTileDelta({ x: to.x - from.x, y: to.y - from.y });
  }

  function surfaceBuildZ(adapter: RctaiBuilder.BuilderAdapter, coord: RctaiBuilder.Coord): number | null {
    const surfaceZ = adapter.getSurfaceZ(coord.x, coord.y);
    return surfaceZ === null ? null : alignBuildZ(surfaceZ + FOOTPRINT_SURFACE_CLEARANCE);
  }

  function maxSurfaceZ(adapter: RctaiBuilder.BuilderAdapter, coords: RctaiBuilder.Coord[]): number | null {
    let result: number | null = null;
    for (const coord of coords) {
      const surfaceZ = adapter.getSurfaceZ(coord.x, coord.y);
      if (surfaceZ !== null) {
        result = Math.max(result ?? surfaceZ, surfaceZ);
      }
    }
    return result;
  }

  function alignBuildZ(value: number): number {
    return Math.ceil(value / PATH_HEIGHT_STEP) * PATH_HEIGHT_STEP;
  }

  function clampBuildZ(value: number): number {
    return Math.max(RctaiBuilder.DEFAULT_Z, Math.min(MAX_BUILD_Z, alignBuildZ(value)));
  }

  function planBuildZ(plan: RctaiBuilder.ParkPlan): number {
    return clampBuildZ(plan.park.entrance.z ?? RctaiBuilder.DEFAULT_Z);
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

    if (isShopFacilityRide(ride)) {
      return shopFacilityAccessOffset(fallbackRideBodyBounds(ride), normalizeDirection(ride.rotation ?? 1), isExit);
    }
    return sideAccessOffset(fallbackRideBodyBounds(ride), normalizeDirection(ride.rotation ?? 1), isExit);
  }

  interface BodyBounds {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  function fallbackRideBodyBounds(ride: RctaiBuilder.RidePlan): BodyBounds {
    const first = ride.track?.[0];
    const origin = {
      x: first?.x ?? Math.floor(ride.footprint.w / 2),
      y: first?.y ?? Math.floor(ride.footprint.h / 2)
    };
    const direction = normalizeDirection(first?.direction ?? ride.rotation ?? 0);
    switch (first?.type) {
      case 66:
      case 266:
        return { x: origin.x - 1, y: origin.y - 1, w: 3, h: 3 };
      case 258:
        return rotatedBoxBounds(origin, { w: 2, h: 2 }, direction);
      case 259:
        return rotatedBoxBounds(origin, { w: 4, h: 4 }, direction);
      case 257:
      case 265:
        return rotatedLineBounds(origin, 4, direction);
      case 261:
        return rotatedLineBounds(origin, 5, direction);
      case 262:
      case 264:
        return { x: origin.x, y: origin.y, w: 1, h: 1 };
      default:
        return { x: 0, y: 0, w: ride.footprint.w, h: ride.footprint.h };
    }
  }

  function rotatedBoxBounds(origin: RctaiBuilder.Coord, size: { w: number; h: number }, direction: number): BodyBounds {
    if (direction === 0) {
      return { x: origin.x, y: origin.y, w: size.w, h: size.h };
    }
    if (direction === 1) {
      return { x: origin.x, y: origin.y - size.h + 1, w: size.h, h: size.w };
    }
    if (direction === 2) {
      return { x: origin.x - size.w + 1, y: origin.y - size.h + 1, w: size.w, h: size.h };
    }
    return { x: origin.x - size.w + 1, y: origin.y, w: size.h, h: size.w };
  }

  function rotatedLineBounds(origin: RctaiBuilder.Coord, length: number, direction: number): BodyBounds {
    const before = Math.floor((length - 1) / 2);
    const after = length - before - 1;
    if (direction === 0) {
      return { x: origin.x - before, y: origin.y, w: length, h: 1 };
    }
    if (direction === 1) {
      return { x: origin.x, y: origin.y - before, w: 1, h: length };
    }
    if (direction === 2) {
      return { x: origin.x - after, y: origin.y, w: length, h: 1 };
    }
    return { x: origin.x, y: origin.y - after, w: 1, h: length };
  }

  function sideAccessOffset(
    bounds: BodyBounds,
    side: number,
    isExit: boolean
  ): RctaiBuilder.CoordD {
    const horizontal = side === 1 || side === 3;
    const span = horizontal ? bounds.w : bounds.h;
    if (isExit && span <= 1) {
      return perpendicularExitAccessOffset(bounds, side);
    }
    const along = isExit ? Math.max(span - 1, 1) : 0;
    if (side === 0) {
      return { x: bounds.x - 1, y: bounds.y + along, direction: 2 };
    }
    if (side === 1) {
      return { x: bounds.x + along, y: bounds.y + bounds.h, direction: 3 };
    }
    if (side === 2) {
      return { x: bounds.x + bounds.w, y: bounds.y + along, direction: 0 };
    }
    return { x: bounds.x + along, y: bounds.y - 1, direction: 1 };
  }

  function shopFacilityAccessOffset(bounds: BodyBounds, side: number, isExit: boolean): RctaiBuilder.CoordD {
    return bodyEdgeAccessOffset(bounds, normalizeDirection(side + (isExit ? 1 : 0)));
  }

  function bodyEdgeAccessOffset(bounds: BodyBounds, side: number): RctaiBuilder.CoordD {
    if (side === 0) {
      return { x: bounds.x, y: bounds.y, direction: 2 };
    }
    if (side === 1) {
      return { x: bounds.x, y: bounds.y + bounds.h - 1, direction: 3 };
    }
    if (side === 2) {
      return { x: bounds.x + bounds.w - 1, y: bounds.y, direction: 0 };
    }
    return { x: bounds.x, y: bounds.y, direction: 1 };
  }

  function perpendicularExitAccessOffset(bounds: BodyBounds, side: number): RctaiBuilder.CoordD {
    if (side === 0) {
      return { x: bounds.x, y: bounds.y - 1, direction: 1 };
    }
    if (side === 1) {
      return { x: bounds.x + bounds.w, y: bounds.y + bounds.h - 1, direction: 0 };
    }
    if (side === 2) {
      return { x: bounds.x + bounds.w - 1, y: bounds.y - 1, direction: 1 };
    }
    return { x: bounds.x + bounds.w, y: bounds.y, direction: 0 };
  }

  function isSimpleSolidRide(ride: RctaiBuilder.RidePlan): boolean {
    return SIMPLE_SOLID_RIDE_TYPES.has(ride.rideType);
  }

  function isShopFacilityRide(ride: RctaiBuilder.RidePlan): boolean {
    return SHOP_FACILITY_RIDE_TYPES.has(ride.rideType);
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

  function rideTerrainCoords(ride: RctaiBuilder.RidePlan, plan: RctaiBuilder.ParkPlan): RctaiBuilder.Coord[] {
    const coords: RctaiBuilder.Coord[] = [];
    for (let x = ride.position.x - 1; x <= ride.position.x + ride.footprint.w + 1; x += 1) {
      for (let y = ride.position.y - 1; y <= ride.position.y + ride.footprint.h + 3; y += 1) {
        if (x >= 1 && y >= 1 && x < plan.park.size.width - 1 && y < plan.park.size.height - 1) {
          coords.push({ x, y });
        }
      }
    }
    return coords;
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
