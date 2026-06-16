import { canonicalRideType, loadRideProfiles, resolveRideProfile } from "./profiles.js";
import { TrackElemType, type TrackElementName } from "./track-elements.js";
import type {
  Axes,
  FirstDropKind,
  GeneratedRideKind,
  ParkPlan,
  RideFamily,
  RideProfile,
  RideProfileBuildOut,
  RideTrackMetadata,
  TrackgenInput,
  TrackgenOptions,
  TrackgenResult,
  TrackgenRide,
  TrackSegment
} from "./types.js";

const HINT_SCHEMA_NOTE =
  "park-plan.schema.json has no explicit fields for tower height, tower mode, transport loop length, or flat-ride size hints; @rctai/trackgen returns those hints in metadata only.";

const FAMILY_BY_ARCHETYPE: Record<TrackgenRide["archetype"], RideFamily> = {
  gentle_micro: "gentle",
  drop_thrill: "thrill",
  spinning_compact: "thrill",
  compact_thrill_coaster: "coaster:compact",
  transport: "transport",
  dark_long: "coaster:mid",
  looping_coaster: "coaster:mid",
  mega_coaster: "coaster:mega",
  water_flume: "water",
  stall: "stall"
};

const INVERSION_PRIORITY = [
  "verticalLoop",
  "corkscrew",
  "halfLoop",
  "barrelRoll",
  "diveLoop",
  "zeroGRoll",
  "quarterLoop"
] as const;

type InversionPriorityGroup = (typeof INVERSION_PRIORITY)[number];

interface ResolvedRide {
  ride: TrackgenRide;
  profile: RideProfile;
  family: RideFamily;
  axes: Axes;
  buildOut: RideProfileBuildOut;
  trackGroups: Set<string>;
  buildOutSource: "ride" | "profile";
}

interface CircuitResult {
  track: TrackSegment[];
  metadata: Omit<
    RideTrackMetadata,
    | "rideId"
    | "rideType"
    | "resolvedRideType"
    | "family"
    | "category"
    | "kind"
    | "buildOutSource"
    | "trackSegmentCount"
  >;
}

export function generateTracks(input: ParkPlan, options?: TrackgenOptions): TrackgenResult<ParkPlan>;
export function generateTracks(input: TrackgenRide[], options?: TrackgenOptions): TrackgenResult<TrackgenRide[]>;
export function generateTracks(input: TrackgenInput, options?: TrackgenOptions): TrackgenResult<TrackgenInput>;
export function generateTracks(input: TrackgenInput, options: TrackgenOptions = {}): TrackgenResult<TrackgenInput> {
  return Array.isArray(input) ? generateTracksForRides(input, options) : generateTracksForParkPlan(input, options);
}

export function generateTracksForParkPlan(plan: ParkPlan, options: TrackgenOptions = {}): TrackgenResult<ParkPlan> {
  const generated = generateTracksForRides(plan.rides, options);

  return {
    output: {
      ...plan,
      rides: generated.output
    },
    metadata: generated.metadata,
    specChangeNotes: generated.specChangeNotes
  };
}

export function generateTracksForRides(
  rides: TrackgenRide[],
  options: TrackgenOptions = {}
): TrackgenResult<TrackgenRide[]> {
  const profiles = options.rideProfiles ?? loadRideProfiles(options.repoRoot);
  const metadata: Record<string, RideTrackMetadata> = {};
  const specChangeNotes = new Set<string>();
  const output = rides.map((ride) => {
    const generated = generateTrackForRide(ride, profiles);
    metadata[ride.id] = generated.metadata;

    if (generated.metadata.kind !== "coaster" && generated.metadata.kind !== "water") {
      specChangeNotes.add(HINT_SCHEMA_NOTE);
    }

    return generated.ride;
  });

  return {
    output,
    metadata,
    specChangeNotes: [...specChangeNotes]
  };
}

function generateTrackForRide(
  ride: TrackgenRide,
  profiles: NonNullable<TrackgenOptions["rideProfiles"]>
): { ride: TrackgenRide; metadata: RideTrackMetadata } {
  const resolved = resolveRide(ride, profiles);
  const kind = generatedKind(resolved);
  const baseMetadata = {
    rideId: ride.id,
    rideType: ride.rideType,
    resolvedRideType: canonicalRideType(resolved.profile.name),
    family: resolved.family,
    category: resolved.profile.category,
    kind,
    buildOutSource: resolved.buildOutSource
  };

  if (kind === "tower") {
    const metadata = {
      ...baseMetadata,
      trackSegmentCount: 0,
      towerHeight: towerHeight(resolved.axes),
      towerMode: towerMode(resolved)
    };

    return { ride: { ...ride, track: null }, metadata };
  }

  if (kind === "transport") {
    const metadata = {
      ...baseMetadata,
      trackSegmentCount: 0,
      transportLoopLength: Math.round(lerp(12, 40, resolved.axes.size)),
      inversionGroups: []
    };

    return { ride: { ...ride, track: null }, metadata };
  }

  if (kind === "flat") {
    const metadata = {
      ...baseMetadata,
      trackSegmentCount: 0,
      flatFootprintHint: flatFootprintHint(resolved),
      inversionGroups: []
    };

    return { ride: { ...ride, track: null }, metadata };
  }

  const circuit = generateCircuitTrack(resolved, kind);
  const metadata = {
    ...baseMetadata,
    ...circuit.metadata,
    trackSegmentCount: circuit.track.length
  };

  return { ride: { ...ride, track: circuit.track }, metadata };
}

function resolveRide(ride: TrackgenRide, profiles: NonNullable<TrackgenOptions["rideProfiles"]>): ResolvedRide {
  const profile = resolveRideProfile(ride, profiles);
  const buildOutSource = ride.buildOut === undefined ? "profile" : "ride";
  const buildOut = ride.buildOut ?? profile.buildOut;
  const family = resolveFamily(ride, profile);
  const axes = normalizeAxes(ride.axes, profile.axisProfile);
  const trackGroups = new Set(buildOut.trackGroups ?? profile.trackGroups);

  return { ride, profile, family, axes, buildOut, trackGroups, buildOutSource };
}

function resolveFamily(ride: TrackgenRide, profile: RideProfile): RideFamily {
  if (ride.family !== undefined) {
    return ride.family;
  }

  if (ride.archetype in FAMILY_BY_ARCHETYPE) {
    return FAMILY_BY_ARCHETYPE[ride.archetype];
  }

  if (profile.category === "shop") {
    return "stall";
  }

  if (profile.category === "transport") {
    return "transport";
  }

  if (profile.category === "water") {
    return "water";
  }

  if (profile.category === "rollerCoaster") {
    if (profile.axisProfile.size >= 0.72) {
      return "coaster:mega";
    }

    return profile.axisProfile.size >= 0.5 ? "coaster:mid" : "coaster:compact";
  }

  return profile.category === "thrill" ? "thrill" : "gentle";
}

function generatedKind(resolved: ResolvedRide): GeneratedRideKind {
  if (isTowerLike(resolved)) {
    return "tower";
  }

  if (resolved.family === "transport" || resolved.profile.category === "transport") {
    return "transport";
  }

  if (resolved.family === "water" || resolved.profile.category === "water") {
    return "water";
  }

  if (resolved.family.startsWith("coaster:") || resolved.buildOut.isCoaster) {
    return "coaster";
  }

  return "flat";
}

function isTowerLike(resolved: ResolvedRide): boolean {
  return (
    resolved.buildOut.isTower ||
    resolved.trackGroups.has("tower") ||
    resolved.trackGroups.has("reverseFreefall") ||
    resolved.profile.name === "reverse_freefall_rc"
  );
}

function generateCircuitTrack(resolved: ResolvedRide, kind: "coaster" | "water"): CircuitResult {
  const track: TrackSegment[] = [];
  const { axes, buildOut } = resolved;
  const stationLength = 2 + Math.round(3 * axes.size);
  const liftHillSegments = buildOut.supportsLiftHill ? Math.round(lerp(2, 14, axes.size)) : 0;
  const firstDrop = chooseFirstDrop(resolved);
  const inversions = kind === "coaster" ? selectInversions(buildOut, axes.adventure) : [];
  const helixCount = buildOut.helices.length > 0 ? Math.round(2 * axes.size) : 0;
  const helices = selectHelices(buildOut, helixCount);
  const bankedTurnCount = buildOut.banking.length > 0 ? Math.round(2 + 4 * axes.size) : 0;
  const bankedTurns = selectBankedTurns(resolved, bankedTurnCount);
  const airtimeHillCount = airtimeBudget(resolved);
  const airtimeHills = selectAirtimeHills(resolved, airtimeHillCount);
  let brakeCount = 0;

  track.push(segment("beginStation"));

  for (let index = 0; index < stationLength; index += 1) {
    track.push(segment("middleStation"));
  }

  track.push(segment("endStation"));
  appendLiftHill(track, resolved, liftHillSegments);
  appendDrop(track, resolved, firstDrop);

  for (const inversion of inversions) {
    track.push(segment(inversion.element));
  }

  const fillerBlocks = Math.max(helices.length, bankedTurns.length, airtimeHills.length);

  for (let index = 0; index < fillerBlocks; index += 1) {
    const helix = helices[index];
    const airtimeHill = airtimeHills[index];
    const bankedTurn = bankedTurns[index];

    if (helix !== undefined) {
      track.push(segment(helix));
    }

    if (airtimeHill !== undefined) {
      track.push(segment(airtimeHill));
    }

    if (bankedTurn !== undefined) {
      track.push(segment(bankedTurn));
    }
  }

  if (supports(resolved, "blockBrakes")) {
    track.push(segment("blockBrakes", { brakeSpeed: brakeSpeed(axes.risk) }));
    brakeCount += 1;
  }

  appendReturnRun(track, resolved);

  if (supports(resolved, "brakes")) {
    track.push(segment("brakes", { brakeSpeed: brakeSpeed(axes.risk) }));
    brakeCount += 1;
  } else if (supports(resolved, "blockBrakes")) {
    track.push(segment("blockBrakes", { brakeSpeed: brakeSpeed(axes.risk) }));
    brakeCount += 1;
  }

  track.push(segment("beginStation"));

  return {
    track,
    metadata: {
      stationLength,
      liftHillSegments,
      firstDrop,
      inversionBudget: inversions.length,
      inversionGroups: inversions.map((inversion) => inversion.group),
      helixCount: helices.length,
      bankedTurnCount: bankedTurns.length,
      airtimeHillCount: airtimeHills.length,
      brakeCount
    }
  };
}

function appendLiftHill(track: TrackSegment[], resolved: ResolvedRide, liftHillSegments: number): void {
  if (liftHillSegments <= 0) {
    if (supports(resolved, "booster")) {
      track.push(segment("booster"));
    } else {
      track.push(segment("flat"));
    }

    return;
  }

  if (supports(resolved, "liftHillCable") && resolved.axes.size >= 0.82) {
    for (let index = 0; index < liftHillSegments; index += 1) {
      track.push(segment(index === 0 ? "cableLiftHill" : "up25"));
    }

    return;
  }

  if (supports(resolved, "poweredLift") && resolved.axes.size >= 0.75) {
    for (let index = 0; index < liftHillSegments; index += 1) {
      track.push(segment(index % 3 === 0 ? "poweredLift" : "up25"));
    }

    return;
  }

  track.push(segment("flatToUp25"));

  for (let index = 0; index < liftHillSegments; index += 1) {
    const useSteepLift = resolved.axes.size >= 0.7 && supports(resolved, "slopeSteepUp") && index > liftHillSegments / 2;
    track.push(segment(useSteepLift ? "up60" : "up25"));
  }

  track.push(segment(resolved.axes.size >= 0.7 && supports(resolved, "slopeSteepUp") ? "up60ToFlat" : "up25ToFlat"));
}

function chooseFirstDrop(resolved: ResolvedRide): FirstDropKind {
  if (!supports(resolved, "slope") && resolved.buildOut.steepDrops.length === 0) {
    return "flat";
  }

  if (
    resolved.axes.risk > 0.7 &&
    (resolved.buildOut.steepDrops.includes("slopeVertical") || resolved.buildOut.steepDrops.includes("curveVertical"))
  ) {
    return "down90";
  }

  if (resolved.axes.risk >= 0.4 && resolved.buildOut.steepDrops.length > 0) {
    return "down60";
  }

  return "down25";
}

function appendDrop(track: TrackSegment[], resolved: ResolvedRide, firstDrop: FirstDropKind): void {
  if (firstDrop === "flat") {
    track.push(segment("flat"));
    return;
  }

  if (firstDrop === "down90") {
    track.push(segment("down60ToDown90"));
    track.push(segment("down90"));
    track.push(segment("down90ToDown60"));
    return;
  }

  if (firstDrop === "down60") {
    track.push(segment("flatToDown60"));
    track.push(segment("down60"));
    track.push(segment("down60ToFlat"));
    return;
  }

  if (supports(resolved, "slope")) {
    track.push(segment("flatToDown25"));
    track.push(segment("down25"));
    track.push(segment("down25ToFlat"));
    return;
  }

  track.push(segment("down25"));
}

function selectInversions(
  buildOut: RideProfileBuildOut,
  adventure: number
): Array<{ group: InversionPriorityGroup; element: TrackElementName }> {
  const supported = new Set(buildOut.inversions);
  const supportedPriority = INVERSION_PRIORITY.filter((group) => supportsInversionGroup(supported, group));
  const inversionBudget = Math.round(adventure * Math.min(buildOut.inversions.length, 4));

  return supportedPriority.slice(0, inversionBudget).map((group, index) => ({
    group,
    element: inversionElementFor(supported, group, index)
  }));
}

function supportsInversionGroup(supported: Set<string>, group: InversionPriorityGroup): boolean {
  if (group === "corkscrew") {
    return supported.has("corkscrew") || supported.has("corkscrewLarge");
  }

  if (group === "halfLoop") {
    return supported.has("halfLoop") || supported.has("halfLoopMedium") || supported.has("halfLoopLarge");
  }

  if (group === "zeroGRoll") {
    return supported.has("zeroGRoll") || supported.has("zeroGRollLarge");
  }

  return supported.has(group);
}

function inversionElementFor(
  supported: Set<string>,
  group: InversionPriorityGroup,
  index: number
): TrackElementName {
  if (group === "verticalLoop") {
    return index % 2 === 0 ? "leftVerticalLoop" : "rightVerticalLoop";
  }

  if (group === "corkscrew") {
    if (supported.has("corkscrewLarge")) {
      return index % 2 === 0 ? "leftLargeCorkscrewUp" : "rightLargeCorkscrewDown";
    }

    return index % 2 === 0 ? "leftCorkscrewUp" : "rightCorkscrewDown";
  }

  if (group === "halfLoop") {
    if (supported.has("halfLoopLarge")) {
      return index % 2 === 0 ? "leftLargeHalfLoopUp" : "rightLargeHalfLoopDown";
    }

    if (supported.has("halfLoopMedium")) {
      return index % 2 === 0 ? "leftMediumHalfLoopUp" : "rightMediumHalfLoopDown";
    }

    return index % 2 === 0 ? "halfLoopUp" : "halfLoopDown";
  }

  if (group === "barrelRoll") {
    return index % 2 === 0 ? "leftBarrelRollUpToDown" : "rightBarrelRollDownToUp";
  }

  if (group === "diveLoop") {
    return index % 2 === 0 ? "leftEighthDiveLoopUpToOrthogonal" : "rightEighthDiveLoopDownToDiag";
  }

  if (group === "zeroGRoll") {
    if (supported.has("zeroGRollLarge")) {
      return index % 2 === 0 ? "leftLargeZeroGRollUp" : "rightLargeZeroGRollDown";
    }

    return index % 2 === 0 ? "leftZeroGRollUp" : "rightZeroGRollDown";
  }

  return index % 2 === 0 ? "up90ToInvertedFlatQuarterLoop" : "invertedFlatToDown90QuarterLoop";
}

function selectHelices(buildOut: RideProfileBuildOut, helixCount: number): TrackElementName[] {
  const supported = new Set(buildOut.helices);
  const candidates: Array<{ group: string; left: TrackElementName; right: TrackElementName }> = [
    { group: "helixUpBankedHalf", left: "leftHalfBankedHelixUpLarge", right: "rightHalfBankedHelixUpLarge" },
    { group: "helixDownBankedHalf", left: "leftHalfBankedHelixDownLarge", right: "rightHalfBankedHelixDownLarge" },
    { group: "helixUpBankedQuarter", left: "leftQuarterBankedHelixLargeUp", right: "rightQuarterBankedHelixLargeUp" },
    {
      group: "helixDownBankedQuarter",
      left: "leftQuarterBankedHelixLargeDown",
      right: "rightQuarterBankedHelixLargeDown"
    },
    { group: "helixUpUnbankedQuarter", left: "leftQuarterHelixLargeUp", right: "rightQuarterHelixLargeUp" },
    { group: "helixDownUnbankedQuarter", left: "leftQuarterHelixLargeDown", right: "rightQuarterHelixLargeDown" }
  ];
  const priority = candidates.filter((candidate) => supported.has(candidate.group));

  if (priority.length === 0) {
    return [];
  }

  return Array.from({ length: helixCount }, (_, index) => {
    const choice = priority[index % priority.length];

    if (choice === undefined) {
      return "flat";
    }

    return index % 2 === 0 ? choice.left : choice.right;
  });
}

function selectBankedTurns(resolved: ResolvedRide, bankedTurnCount: number): TrackElementName[] {
  if (bankedTurnCount <= 0) {
    return [];
  }

  if (resolved.axes.risk >= 0.65 && supportsBanking(resolved, "slopeRollBanking")) {
    return Array.from({ length: bankedTurnCount }, (_, index) =>
      index % 2 === 0 ? "leftBankedQuarterTurn5TileDown25" : "rightBankedQuarterTurn5TileUp25"
    );
  }

  if (supportsBanking(resolved, "slopeCurveBanked")) {
    return Array.from({ length: bankedTurnCount }, (_, index) =>
      index % 2 === 0 ? "leftBankedQuarterTurn5TileUp25" : "rightBankedQuarterTurn5TileDown25"
    );
  }

  if (supportsBanking(resolved, "flatRollBanking")) {
    return Array.from({ length: bankedTurnCount }, (_, index) =>
      index % 2 === 0 ? "bankedLeftQuarterTurn5Tiles" : "bankedRightQuarterTurn5Tiles"
    );
  }

  return [];
}

function airtimeBudget(resolved: ResolvedRide): number {
  if (!supports(resolved, "sBend") && !supports(resolved, "slope")) {
    return 0;
  }

  return Math.round(3 * resolved.axes.risk);
}

function selectAirtimeHills(resolved: ResolvedRide, hillCount: number): TrackElementName[] {
  if (hillCount <= 0) {
    return [];
  }

  if (supports(resolved, "sBend")) {
    return Array.from({ length: hillCount }, (_, index) => (index % 2 === 0 ? "sBendLeft" : "sBendRight"));
  }

  return Array.from({ length: hillCount }, (_, index) => (index % 2 === 0 ? "up25" : "down25"));
}

function appendReturnRun(track: TrackSegment[], resolved: ResolvedRide): void {
  const returnSegments = Math.max(4, Math.round(4 + 6 * resolved.axes.size));

  for (let index = 0; index < returnSegments; index += 1) {
    track.push(segment(index % 2 === 0 ? curveElement(resolved, index) : "flat"));
  }
}

function curveElement(resolved: ResolvedRide, index: number): TrackElementName {
  if (supports(resolved, "curve") || supports(resolved, "curveLarge")) {
    return index % 4 === 0 ? "leftQuarterTurn5Tiles" : "rightQuarterTurn5Tiles";
  }

  if (supports(resolved, "curveSmall")) {
    return index % 4 === 0 ? "leftQuarterTurn3Tiles" : "rightQuarterTurn3Tiles";
  }

  if (supports(resolved, "curveVerySmall")) {
    return index % 4 === 0 ? "leftQuarterTurn1Tile" : "rightQuarterTurn1Tile";
  }

  return "flat";
}

function supports(resolved: ResolvedRide, group: string): boolean {
  return resolved.trackGroups.has(group);
}

function supportsBanking(resolved: ResolvedRide, group: string): boolean {
  return resolved.buildOut.banking.includes(group);
}

function segment(name: TrackElementName, extra: Omit<TrackSegment, "type"> = {}): TrackSegment {
  return { type: TrackElemType[name], ...extra };
}

function normalizeAxes(axes: Partial<Axes> | undefined, fallback: Axes): Axes {
  return {
    size: clamp(axes?.size ?? fallback.size),
    adventure: clamp(axes?.adventure ?? fallback.adventure),
    risk: clamp(axes?.risk ?? fallback.risk)
  };
}

function towerHeight(axes: Axes): number {
  return Math.round(lerp(16, 64, Math.max(axes.size, axes.risk)));
}

function towerMode(resolved: ResolvedRide): string {
  if (resolved.trackGroups.has("reverseFreefall") || resolved.profile.name === "reverse_freefall_rc") {
    return resolved.axes.risk >= 0.7 ? "reverse-freefall-launch" : "reverse-freefall";
  }

  if (resolved.axes.risk >= 0.7) {
    return "launch-drop";
  }

  return resolved.axes.risk >= 0.4 ? "drop" : "observation";
}

function flatFootprintHint(resolved: ResolvedRide): { w: number; h: number } {
  if (resolved.profile.category === "shop") {
    return { w: 1, h: 1 };
  }

  if (resolved.profile.name === "maze") {
    const side = Math.round(lerp(2, 6, resolved.axes.size));
    return { w: side, h: side };
  }

  return resolved.ride.footprint;
}

function brakeSpeed(risk: number): number {
  return Math.round(4 + 8 * (1 - risk));
}

function lerp(min: number, max: number, value: number): number {
  return min + (max - min) * clamp(value);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
