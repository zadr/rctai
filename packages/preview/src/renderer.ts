import { paletteColour } from "./palette.js";
import type { Coord, ParkPath, ParkPlan, Ride, RideAxes, RideColours } from "./types.js";

const TILE_WIDTH = 16;
const TILE_HEIGHT = 8;
const LEFT_MARGIN = 88;
const TOP_MARGIN = 128;
const RIGHT_MARGIN = 36;
const BOTTOM_MARGIN = 80;
const LEGEND_WIDTH = 430;

interface ScreenPoint {
  x: number;
  y: number;
}

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

interface Layout {
  width: number;
  height: number;
  legendX: number;
  originX: number;
  originY: number;
  iso(x: number, y: number, z?: number): ScreenPoint;
}

interface ResolvedRideColours {
  main: string;
  additional: string;
  support: string;
  track: string;
}

export function renderParkPlanToSvg(plan: ParkPlan): string {
  const layout = createLayout(plan);
  const output: string[] = [];

  output.push('<?xml version="1.0" encoding="UTF-8"?>');
  output.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" role="img" aria-labelledby="preview-title preview-desc">`
  );
  output.push(`<title id="preview-title">${escapeXml(plan.park.name)} preview</title>`);
  output.push(
    `<desc id="preview-desc">Deterministic isometric preview for ${escapeXml(plan.park.name)} with ${plan.rides.length} rendered rides.</desc>`
  );
  output.push(renderStyles());
  output.push(`<rect class="background" width="${layout.width}" height="${layout.height}"/>`);
  output.push(renderPark(plan, layout));
  output.push(renderPaths(plan, layout));
  output.push(renderEntrance(plan, layout));
  output.push(renderRides(plan, layout));
  output.push(renderLegend(plan, layout));
  output.push("</svg>");

  return `${output.join("\n")}\n`;
}

function createLayout(plan: ParkPlan): Layout {
  const parkWidth = plan.park.size.width;
  const parkHeight = plan.park.size.height;
  const corners = [
    rawIso(0, 0),
    rawIso(parkWidth, 0),
    rawIso(parkWidth, parkHeight),
    rawIso(0, parkHeight)
  ];
  const bounds = boundsForPoints(corners);
  const mapWidth = Math.ceil(bounds.maxX - bounds.minX + LEFT_MARGIN + RIGHT_MARGIN);
  const mapHeight = Math.ceil(bounds.maxY - bounds.minY + TOP_MARGIN + BOTTOM_MARGIN);
  const legendHeight = 120 + plan.rides.length * 82;
  const originX = LEFT_MARGIN - bounds.minX;
  const originY = TOP_MARGIN - bounds.minY;
  const width = mapWidth + LEGEND_WIDTH;
  const height = Math.max(mapHeight, legendHeight);

  return {
    width,
    height,
    legendX: mapWidth,
    originX,
    originY,
    iso(x: number, y: number, z = 0): ScreenPoint {
      const point = rawIso(x, y, z);
      return { x: originX + point.x, y: originY + point.y };
    }
  };
}

function rawIso(x: number, y: number, z = 0): ScreenPoint {
  return {
    x: (x - y) * (TILE_WIDTH / 2),
    y: (x + y) * (TILE_HEIGHT / 2) - z
  };
}

function renderStyles(): string {
  return `<style>
    .background { fill: #f4f0df; }
    .park-shadow { fill: #6a6f45; opacity: 0.22; }
    .park-base { fill: #b9d98c; stroke: #486a32; stroke-width: 2; }
    .grid-line { stroke: #6f9655; stroke-width: 0.75; opacity: 0.32; vector-effect: non-scaling-stroke; }
    .grid-major { stroke-width: 1.25; opacity: 0.45; }
    .path-shadow { fill: none; stroke: #735f35; stroke-width: 11; stroke-linecap: round; stroke-linejoin: round; opacity: 0.25; }
    .path-main { fill: none; stroke: #d9bf77; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
    .ride-shadow { fill: #2a2a2a; opacity: 0.18; }
    .ride-base { stroke-width: 2; }
    .support { stroke-linecap: round; opacity: 0.82; }
    .track-line { fill: none; stroke-linecap: round; stroke-linejoin: round; }
    .badge-text, .ride-chip, .legend, .entrance-label { font-family: Inter, Avenir, Helvetica, Arial, sans-serif; }
    .badge-text { font-size: 11px; font-weight: 700; }
    .ride-chip { font-size: 10px; font-weight: 700; fill: #17210f; paint-order: stroke; stroke: #f4f0df; stroke-width: 3px; stroke-linejoin: round; }
    .legend text { fill: #263127; }
    .legend-title { font-size: 20px; font-weight: 800; }
    .legend-subtitle { font-size: 12px; fill: #526050; }
    .legend-sign { font-size: 12px; font-weight: 700; }
    .legend-meta { font-size: 11px; fill: #526050; }
    .legend-panel { fill: #fffaf0; stroke: #d3c6a3; stroke-width: 1.25; }
    .entrance-label { font-size: 11px; font-weight: 800; fill: #263127; }
  </style>`;
}

function renderPark(plan: ParkPlan, layout: Layout): string {
  const width = plan.park.size.width;
  const height = plan.park.size.height;
  const parkPoints = polygonPoints([
    layout.iso(0, 0),
    layout.iso(width, 0),
    layout.iso(width, height),
    layout.iso(0, height)
  ]);
  const lines: string[] = [];

  lines.push(`<g class="park">`);
  lines.push(`<polygon class="park-shadow" points="${parkPoints}" transform="translate(0 10)"/>`);
  lines.push(`<polygon class="park-base" points="${parkPoints}"/>`);

  for (let x = 0; x <= width; x += 4) {
    const start = layout.iso(x, 0);
    const end = layout.iso(x, height);
    const major = x % 16 === 0 ? " grid-major" : "";
    lines.push(`<line class="grid-line${major}" x1="${fmt(start.x)}" y1="${fmt(start.y)}" x2="${fmt(end.x)}" y2="${fmt(end.y)}"/>`);
  }

  for (let y = 0; y <= height; y += 4) {
    const start = layout.iso(0, y);
    const end = layout.iso(width, y);
    const major = y % 16 === 0 ? " grid-major" : "";
    lines.push(`<line class="grid-line${major}" x1="${fmt(start.x)}" y1="${fmt(start.y)}" x2="${fmt(end.x)}" y2="${fmt(end.y)}"/>`);
  }

  lines.push(`</g>`);
  return lines.join("\n");
}

function renderPaths(plan: ParkPlan, layout: Layout): string {
  const paths = plan.paths ?? [];
  const ridesById = new Map(plan.rides.map((ride) => [ride.id, ride]));
  const lines: string[] = [];

  lines.push(`<g class="paths">`);
  paths.forEach((path, index) => {
    const route = routeForPath(path, ridesById, plan.park.entrance, index);
    if (route.length < 2) {
      return;
    }

    const points = route.map((point) => layout.iso(point.x, point.y));
    const pointText = polygonPoints(points);
    lines.push(`<polyline class="path-shadow" points="${pointText}"/>`);
    lines.push(`<polyline class="path-main" points="${pointText}"/>`);
  });
  lines.push(`</g>`);

  return lines.join("\n");
}

function renderEntrance(plan: ParkPlan, layout: Layout): string {
  const entrance = plan.park.entrance;
  const base = layout.iso(entrance.x, entrance.y);
  const left = layout.iso(entrance.x - 0.9, entrance.y + 0.2);
  const right = layout.iso(entrance.x + 0.9, entrance.y - 0.2);
  const topY = base.y - 34;

  return `<g class="entrance">
    <line x1="${fmt(left.x)}" y1="${fmt(left.y)}" x2="${fmt(left.x)}" y2="${fmt(topY)}" stroke="#6c4a2b" stroke-width="5" stroke-linecap="round"/>
    <line x1="${fmt(right.x)}" y1="${fmt(right.y)}" x2="${fmt(right.x)}" y2="${fmt(topY)}" stroke="#6c4a2b" stroke-width="5" stroke-linecap="round"/>
    <path d="M ${fmt(left.x)} ${fmt(topY)} Q ${fmt(base.x)} ${fmt(topY - 18)} ${fmt(right.x)} ${fmt(topY)}" fill="none" stroke="#c83c32" stroke-width="5" stroke-linecap="round"/>
    <text class="entrance-label" x="${fmt(base.x)}" y="${fmt(topY - 23)}" text-anchor="middle">ENTRANCE</text>
  </g>`;
}

function renderRides(plan: ParkPlan, layout: Layout): string {
  const sorted = plan.rides
    .map((ride, index) => ({ ride, index }))
    .sort((left, right) => {
      const leftDepth = rideDepth(left.ride);
      const rightDepth = rideDepth(right.ride);
      return leftDepth === rightDepth ? left.index - right.index : leftDepth - rightDepth;
    });

  return `<g class="rides">
${sorted.map(({ ride }) => renderRide(ride, layout)).join("\n")}
</g>`;
}

function renderRide(ride: Ride, layout: Layout): string {
  const colours = resolveRideColours(ride.colours);
  const basePoints = rideFootprintPoints(ride, layout);
  const baseText = polygonPoints(basePoints);
  const opacity = ride.archetype === "stall" ? 0.34 : 0.2;
  const lines: string[] = [];

  lines.push(`<g class="ride ${escapeAttribute(ride.archetype)}" id="${escapeAttribute(svgId(ride.id))}">`);
  lines.push(`<title>${escapeXml(tooltipForRide(ride))}</title>`);
  lines.push(`<desc>${escapeXml(descriptionForRide(ride))}</desc>`);
  lines.push(`<polygon class="ride-shadow" points="${baseText}" transform="translate(0 7)"/>`);
  lines.push(
    `<polygon class="ride-base" points="${baseText}" fill="${colours.main}" fill-opacity="${opacity}" stroke="${colours.main}"/>`
  );
  lines.push(renderGlyph(ride, layout, colours));
  lines.push(renderBadges(ride, layout));
  lines.push(renderRideChip(ride, layout));
  lines.push(`</g>`);

  return lines.join("\n");
}

function renderGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  switch (ride.archetype) {
    case "drop_thrill":
      return renderDropTowerGlyph(ride, layout, colours);
    case "stall":
      return renderStallGlyph(ride, layout, colours);
    case "transport":
      return renderTransportGlyph(ride, layout, colours);
    case "water_flume":
      return renderWaterGlyph(ride, layout, colours);
    case "compact_thrill_coaster":
    case "looping_coaster":
    case "mega_coaster":
      return renderCoasterGlyph(ride, layout, colours);
    case "dark_long":
      return renderDarkRideGlyph(ride, layout, colours);
    case "gentle_micro":
    case "spinning_compact":
      return renderGentleGlyph(ride, layout, colours);
  }
}

function renderCoasterGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const bounds = rideBounds(ride, layout);
  const scale = Math.max(0.65, Math.min(1.55, (ride.footprint.w + ride.footprint.h) / 16));
  const high = 28 + axisValue(ride.axes, "size") * 38;
  const p0 = ridePoint(ride, layout, 0.12, 0.7, 8);
  const p1 = ridePoint(ride, layout, 0.28, 0.28, high);
  const p2 = ridePoint(ride, layout, 0.4, 0.72, 12);
  const p3 = ridePoint(ride, layout, 0.6, 0.34, high * 0.72);
  const p4 = ridePoint(ride, layout, 0.88, 0.62, 12);
  const riserPoints = [p0, p1, p3, p4];
  const loopA = ridePoint(ride, layout, 0.47, 0.46, 28 + high * 0.2);
  const loopB = ridePoint(ride, layout, 0.68, 0.5, 22 + high * 0.16);
  const loopRadius = Math.max(12, Math.min(26, (bounds.maxX - bounds.minX) * 0.075 * scale));
  const mega = ride.archetype === "mega_coaster";
  const trackPath = [
    `M ${pointText(p0)}`,
    `C ${pointText(ridePoint(ride, layout, 0.18, 0.55, high * 0.35))} ${pointText(ridePoint(ride, layout, 0.22, 0.35, high))} ${pointText(p1)}`,
    `C ${pointText(ridePoint(ride, layout, 0.34, 0.18, high * 0.95))} ${pointText(ridePoint(ride, layout, 0.38, 0.7, 20))} ${pointText(p2)}`,
    `C ${pointText(ridePoint(ride, layout, 0.48, 0.88, 10))} ${pointText(ridePoint(ride, layout, 0.55, 0.22, high * 0.8))} ${pointText(p3)}`,
    `C ${pointText(ridePoint(ride, layout, 0.72, 0.25, high * 0.45))} ${pointText(ridePoint(ride, layout, 0.82, 0.45, 20))} ${pointText(p4)}`
  ].join(" ");
  const supports = riserPoints
    .map((point, index) => {
      const fractions = [0.12, 0.28, 0.6, 0.88] as const;
      const fy = [0.7, 0.28, 0.34, 0.62] as const;
      const ground = ridePoint(ride, layout, fractions[index] ?? 0.5, fy[index] ?? 0.5);
      return `<line class="support" x1="${fmt(ground.x)}" y1="${fmt(ground.y)}" x2="${fmt(point.x)}" y2="${fmt(point.y)}" stroke="${colours.support}" stroke-width="3"/>`;
    })
    .join("\n");
  const secondLoop = mega
    ? `<ellipse cx="${fmt(loopB.x)}" cy="${fmt(loopB.y)}" rx="${fmt(loopRadius * 0.9)}" ry="${fmt(loopRadius * 1.45)}" fill="none" stroke="${colours.additional}" stroke-width="3.5"/>`
    : "";

  return `<g class="coaster-glyph">
    ${supports}
    <path class="track-line" d="${trackPath}" stroke="${colours.support}" stroke-width="${mega ? 8 : 6}" opacity="0.34"/>
    <path class="track-line" d="${trackPath}" stroke="${colours.track}" stroke-width="${mega ? 5 : 4}"/>
    <path class="track-line" d="${trackPath}" stroke="${colours.additional}" stroke-width="1.5" opacity="0.8"/>
    <ellipse cx="${fmt(loopA.x)}" cy="${fmt(loopA.y)}" rx="${fmt(loopRadius)}" ry="${fmt(loopRadius * 1.5)}" fill="none" stroke="${colours.track}" stroke-width="${mega ? 4.5 : 3.5}"/>
    ${secondLoop}
  </g>`;
}

function renderDropTowerGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const risk = axisValue(ride.axes, "risk");
  const size = axisValue(ride.axes, "size");
  const height = 54 + Math.max(risk, size) * 60;
  const base = ridePoint(ride, layout, 0.5, 0.5);
  const top = ridePoint(ride, layout, 0.5, 0.5, height);
  const cabinY = top.y + height * 0.34;

  return `<g class="drop-glyph">
    <ellipse cx="${fmt(base.x)}" cy="${fmt(base.y + 3)}" rx="20" ry="8" fill="${colours.main}" fill-opacity="0.28" stroke="${colours.main}" stroke-width="2"/>
    <line class="support" x1="${fmt(base.x)}" y1="${fmt(base.y)}" x2="${fmt(top.x)}" y2="${fmt(top.y)}" stroke="${colours.support}" stroke-width="9"/>
    <line class="support" x1="${fmt(base.x)}" y1="${fmt(base.y)}" x2="${fmt(top.x)}" y2="${fmt(top.y)}" stroke="${colours.track}" stroke-width="4"/>
    <rect x="${fmt(base.x - 17)}" y="${fmt(cabinY - 9)}" width="34" height="18" rx="2" fill="${colours.main}" stroke="#1b1d22" stroke-width="1.5"/>
    <line x1="${fmt(top.x - 13)}" y1="${fmt(top.y + 2)}" x2="${fmt(top.x + 13)}" y2="${fmt(top.y + 2)}" stroke="${colours.additional}" stroke-width="5" stroke-linecap="round"/>
  </g>`;
}

function renderStallGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const center = ridePoint(ride, layout, 0.5, 0.5);
  const bodyWidth = 30;
  const bodyHeight = 22;
  const roofHeight = 13;
  const x = center.x - bodyWidth / 2;
  const y = center.y - bodyHeight - 3;

  return `<g class="stall-glyph">
    <rect x="${fmt(x)}" y="${fmt(y)}" width="${bodyWidth}" height="${bodyHeight}" fill="#fff6df" stroke="${colours.support}" stroke-width="1.5"/>
    <path d="M ${fmt(x - 4)} ${fmt(y)} L ${fmt(center.x)} ${fmt(y - roofHeight)} L ${fmt(x + bodyWidth + 4)} ${fmt(y)} Z" fill="${colours.main}" stroke="#1b1d22" stroke-width="1.3"/>
    <path d="M ${fmt(x)} ${fmt(y + 7)} h ${bodyWidth}" stroke="${colours.additional}" stroke-width="4" stroke-dasharray="5 4"/>
    <rect x="${fmt(center.x - 4)}" y="${fmt(y + 10)}" width="8" height="12" fill="${colours.support}" opacity="0.75"/>
  </g>`;
}

function renderTransportGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const railPoints = [
    ridePoint(ride, layout, 0.08, 0.62, 5),
    ridePoint(ride, layout, 0.26, 0.28, 5),
    ridePoint(ride, layout, 0.72, 0.24, 5),
    ridePoint(ride, layout, 0.92, 0.58, 5),
    ridePoint(ride, layout, 0.48, 0.82, 5)
  ];
  const path = polylinePath(railPoints);
  const sleepers = railPoints
    .slice(0, -1)
    .map((point, index) => {
      const next = railPoints[index + 1];
      if (!next) {
        return "";
      }
      const mid = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
      return `<line x1="${fmt(mid.x - 5)}" y1="${fmt(mid.y - 3)}" x2="${fmt(mid.x + 5)}" y2="${fmt(mid.y + 3)}" stroke="${colours.support}" stroke-width="2" stroke-linecap="round"/>`;
    })
    .join("\n");

  return `<g class="transport-glyph">
    ${sleepers}
    <path class="track-line" d="${path}" stroke="${colours.support}" stroke-width="7" opacity="0.35"/>
    <path class="track-line" d="${path}" stroke="${colours.track}" stroke-width="2.5" transform="translate(0 -3)"/>
    <path class="track-line" d="${path}" stroke="${colours.track}" stroke-width="2.5" transform="translate(0 3)"/>
    <rect x="${fmt((railPoints[2]?.x ?? 0) - 12)}" y="${fmt((railPoints[2]?.y ?? 0) - 12)}" width="24" height="12" rx="2" fill="${colours.main}" stroke="#1b1d22" stroke-width="1.2"/>
  </g>`;
}

function renderWaterGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const points = [
    ridePoint(ride, layout, 0.1, 0.5, 4),
    ridePoint(ride, layout, 0.28, 0.22, 4),
    ridePoint(ride, layout, 0.52, 0.7, 4),
    ridePoint(ride, layout, 0.75, 0.3, 4),
    ridePoint(ride, layout, 0.92, 0.58, 4)
  ];
  const boat = ridePoint(ride, layout, 0.52, 0.7, 9);

  return `<g class="water-glyph">
    <path class="track-line" d="${polylinePath(points)}" stroke="#3d9bd3" stroke-width="11" opacity="0.72"/>
    <path class="track-line" d="${polylinePath(points)}" stroke="#d6f3ff" stroke-width="3" opacity="0.9"/>
    <path d="M ${fmt(boat.x - 14)} ${fmt(boat.y)} L ${fmt(boat.x + 14)} ${fmt(boat.y)} L ${fmt(boat.x + 8)} ${fmt(boat.y + 9)} L ${fmt(boat.x - 8)} ${fmt(boat.y + 9)} Z" fill="${colours.main}" stroke="#1b1d22" stroke-width="1.2"/>
  </g>`;
}

function renderDarkRideGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const bounds = rideBounds(ride, layout);
  const width = Math.max(44, (bounds.maxX - bounds.minX) * 0.38);
  const height = Math.max(30, (bounds.maxY - bounds.minY) * 0.72);
  const center = ridePoint(ride, layout, 0.5, 0.5, 8);

  return `<g class="dark-glyph">
    <rect x="${fmt(center.x - width / 2)}" y="${fmt(center.y - height)}" width="${fmt(width)}" height="${fmt(height)}" rx="3" fill="${colours.main}" stroke="${colours.support}" stroke-width="2"/>
    <path d="M ${fmt(center.x - width / 2)} ${fmt(center.y - height)} L ${fmt(center.x)} ${fmt(center.y - height - 18)} L ${fmt(center.x + width / 2)} ${fmt(center.y - height)}" fill="none" stroke="${colours.additional}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="${fmt(center.x - 10)}" cy="${fmt(center.y - height / 2)}" r="3" fill="#fff6a8"/>
    <circle cx="${fmt(center.x + 12)}" cy="${fmt(center.y - height / 2 - 7)}" r="2.5" fill="#fff6a8"/>
  </g>`;
}

function renderGentleGlyph(ride: Ride, layout: Layout, colours: ResolvedRideColours): string {
  const bounds = rideBounds(ride, layout);
  const center = ridePoint(ride, layout, 0.5, 0.5, 8);
  const radius = Math.max(16, Math.min(34, (bounds.maxX - bounds.minX) * 0.18));
  const spiral = spiralPath(center, radius);
  const armA = ridePoint(ride, layout, 0.22, 0.48, 8);
  const armB = ridePoint(ride, layout, 0.78, 0.52, 8);
  const armC = ridePoint(ride, layout, 0.52, 0.24, 8);
  const armD = ridePoint(ride, layout, 0.48, 0.78, 8);

  return `<g class="gentle-glyph">
    <ellipse cx="${fmt(center.x)}" cy="${fmt(center.y + 3)}" rx="${fmt(radius + 6)}" ry="${fmt((radius + 6) * 0.48)}" fill="${colours.additional}" fill-opacity="0.22" stroke="${colours.additional}" stroke-width="2"/>
    <line x1="${fmt(armA.x)}" y1="${fmt(armA.y)}" x2="${fmt(armB.x)}" y2="${fmt(armB.y)}" stroke="${colours.support}" stroke-width="4" stroke-linecap="round"/>
    <line x1="${fmt(armC.x)}" y1="${fmt(armC.y)}" x2="${fmt(armD.x)}" y2="${fmt(armD.y)}" stroke="${colours.support}" stroke-width="4" stroke-linecap="round"/>
    <path class="track-line" d="${spiral}" stroke="${colours.track}" stroke-width="4"/>
    <circle cx="${fmt(center.x)}" cy="${fmt(center.y)}" r="5" fill="${colours.main}" stroke="#1b1d22" stroke-width="1.2"/>
  </g>`;
}

function renderBadges(ride: Ride, layout: Layout): string {
  const labels = badgeLabels(ride);
  if (labels.length === 0) {
    return "";
  }

  const z = badgeZForRide(ride);
  const anchor = ridePoint(ride, layout, 0.5, 0.42, z);
  const badges = labels.map((label, index) => {
    const width = label.length * 7 + 16;
    const x = anchor.x - width / 2;
    const y = anchor.y - 18 - index * 18;
    const risky = label === "RISKY";
    const fill = risky ? "#b73535" : "#f1c847";
    const textFill = risky ? "#fff7ee" : "#26210b";

    return `<g class="badge">
      <rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(width)}" height="15" rx="2" fill="${fill}" stroke="#1b1d22" stroke-width="1"/>
      <text class="badge-text" x="${fmt(anchor.x)}" y="${fmt(y + 11)}" text-anchor="middle" fill="${textFill}">${label}</text>
    </g>`;
  });

  return badges.join("\n");
}

function renderRideChip(ride: Ride, layout: Layout): string {
  const center = ridePoint(ride, layout, 0.5, 0.86, 2);
  return `<text class="ride-chip" x="${fmt(center.x)}" y="${fmt(center.y + 18)}" text-anchor="middle">${escapeXml(ride.id)}</text>`;
}

function renderLegend(plan: ParkPlan, layout: Layout): string {
  const x = layout.legendX + 22;
  const y = 26;
  const width = LEGEND_WIDTH - 44;
  const height = Math.max(220, layout.height - 52);
  const lines: string[] = [];
  let cursor = y + 36;

  lines.push(`<g class="legend">`);
  lines.push(`<rect class="legend-panel" x="${x}" y="${y}" width="${width}" height="${height}" rx="6"/>`);
  lines.push(`<text class="legend-title" x="${x + 18}" y="${cursor}">${escapeXml(plan.park.name)}</text>`);
  cursor += 20;
  lines.push(
    `<text class="legend-subtitle" x="${x + 18}" y="${cursor}">${plan.park.size.width}x${plan.park.size.height} park | ${plan.rides.length} rides | axes: size / adventure / risk</text>`
  );
  cursor += 28;

  for (const ride of plan.rides) {
    const colours = resolveRideColours(ride.colours);
    const signLines = wrapText(ride.sign ?? ride.name, 43).slice(0, 2);
    const axes = axesText(ride.axes);
    const archetype = `${ride.archetype} | ${ride.rideType}`;

    lines.push(`<g class="legend-item">`);
    lines.push(`<rect x="${x + 18}" y="${cursor - 10}" width="14" height="14" fill="${colours.main}" stroke="#1b1d22" stroke-width="1"/>`);
    signLines.forEach((line, index) => {
      lines.push(
        `<text class="legend-sign" x="${x + 40}" y="${cursor + index * 14}">${escapeXml(line)}</text>`
      );
    });
    cursor += signLines.length * 14 + 4;
    lines.push(`<text class="legend-meta" x="${x + 40}" y="${cursor}">${escapeXml(archetype)}</text>`);
    cursor += 14;
    lines.push(`<text class="legend-meta" x="${x + 40}" y="${cursor}">${escapeXml(axes)}</text>`);
    cursor += 28;
    lines.push(`</g>`);
  }

  lines.push(`</g>`);
  return lines.join("\n");
}

function routeForPath(path: ParkPath, ridesById: Map<string, Ride>, entrance: Coord, index: number): Coord[] {
  const from = coordForNode(path.from, ridesById, entrance);
  const to = coordForNode(path.to, ridesById, entrance);

  if (!from || !to) {
    return [];
  }

  if (path.waypoints && path.waypoints.length > 0) {
    return [from, ...path.waypoints, to];
  }

  const mid = index % 2 === 0 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
  if (sameCoord(mid, from) || sameCoord(mid, to)) {
    return [from, to];
  }

  return [from, mid, to];
}

function coordForNode(id: string, ridesById: Map<string, Ride>, entrance: Coord): Coord | undefined {
  if (id === "entrance") {
    return { x: entrance.x, y: entrance.y };
  }

  const ride = ridesById.get(id);
  if (!ride) {
    return undefined;
  }

  return {
    x: ride.position.x + ride.footprint.w / 2,
    y: ride.position.y + ride.footprint.h / 2
  };
}

function rideDepth(ride: Ride): number {
  return ride.position.x + ride.position.y + ride.footprint.w + ride.footprint.h;
}

function rideFootprintPoints(ride: Ride, layout: Layout): ScreenPoint[] {
  const x = ride.position.x;
  const y = ride.position.y;
  const w = ride.footprint.w;
  const h = ride.footprint.h;

  return [layout.iso(x, y), layout.iso(x + w, y), layout.iso(x + w, y + h), layout.iso(x, y + h)];
}

function ridePoint(ride: Ride, layout: Layout, fx: number, fy: number, z = 0): ScreenPoint {
  return layout.iso(ride.position.x + ride.footprint.w * fx, ride.position.y + ride.footprint.h * fy, z);
}

function rideBounds(ride: Ride, layout: Layout): Bounds {
  return boundsForPoints(rideFootprintPoints(ride, layout));
}

function boundsForPoints(points: ScreenPoint[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, minY, maxX, maxY };
}

function polygonPoints(points: ScreenPoint[]): string {
  return points.map((point) => `${fmt(point.x)},${fmt(point.y)}`).join(" ");
}

function pointText(point: ScreenPoint): string {
  return `${fmt(point.x)} ${fmt(point.y)}`;
}

function polylinePath(points: ScreenPoint[]): string {
  const first = points[0];
  if (!first) {
    return "";
  }

  return [`M ${pointText(first)}`, ...points.slice(1).map((point) => `L ${pointText(point)}`)].join(" ");
}

function spiralPath(center: ScreenPoint, radius: number): string {
  const points: ScreenPoint[] = [];
  const steps = 28;

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps;
    const angle = progress * Math.PI * 4.8;
    const currentRadius = radius * (1 - progress * 0.72);
    points.push({
      x: center.x + Math.cos(angle) * currentRadius,
      y: center.y + Math.sin(angle) * currentRadius * 0.58
    });
  }

  return polylinePath(points);
}

function resolveRideColours(colours: RideColours | undefined): ResolvedRideColours {
  const main = paletteColour(colours?.main, "#4a8edb");
  const additional = paletteColour(colours?.additional, "#ffd866");
  const support = paletteColour(colours?.support, "#8f969d");
  const track = paletteColour(colours?.track ?? colours?.main, "#1b1d22");

  return { main, additional, support, track };
}

function badgeLabels(ride: Ride): string[] {
  const sign = (ride.sign ?? "").toUpperCase();
  const labels: string[] = [];
  const showpiece = sign.includes("SHOWPIECE") || (axisValue(ride.axes, "size") >= 0.9 && axisValue(ride.axes, "adventure") >= 0.7);
  const risky = sign.includes("RISKY") || axisValue(ride.axes, "risk") >= 0.8;

  if (showpiece) {
    labels.push("SHOWPIECE");
  }

  if (risky) {
    labels.push("RISKY");
  }

  return labels;
}

function badgeZForRide(ride: Ride): number {
  switch (ride.archetype) {
    case "drop_thrill":
      return 98;
    case "mega_coaster":
      return 74;
    case "looping_coaster":
    case "compact_thrill_coaster":
      return 56;
    case "stall":
      return 34;
    case "transport":
    case "water_flume":
    case "dark_long":
    case "gentle_micro":
    case "spinning_compact":
      return 32;
  }
}

function tooltipForRide(ride: Ride): string {
  return `${ride.sign ?? ride.name}
${ride.archetype} / ${ride.rideType}
Axes: ${axesText(ride.axes)}`;
}

function descriptionForRide(ride: Ride): string {
  return `${ride.id}: ${ride.name}. ${axesText(ride.axes)}.`;
}

function axesText(axes: RideAxes | undefined): string {
  return `size ${axisLabel(axes?.size)} / adventure ${axisLabel(axes?.adventure)} / risk ${axisLabel(axes?.risk)}`;
}

function axisLabel(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "n/a";
  }

  return value.toFixed(2);
}

function axisValue(axes: RideAxes | undefined, key: keyof RideAxes): number {
  const value = axes?.[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function wrapText(text: string, maxCharacters: number): string[] {
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length === 0) {
      current = word;
    } else if (`${current} ${word}`.length <= maxCharacters) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [text];
}

function sameCoord(left: Coord, right: Coord): boolean {
  return left.x === right.x && left.y === right.y;
}

function svgId(id: string): string {
  const clean = id.replace(/[^A-Za-z0-9_-]/g, "-");
  return `ride-${clean.length > 0 ? clean : "unknown"}`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    switch (character) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}

function escapeAttribute(value: string): string {
  return escapeXml(value);
}

function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const stable = Object.is(rounded, -0) ? 0 : rounded;

  if (Number.isInteger(stable)) {
    return String(stable);
  }

  return stable.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
