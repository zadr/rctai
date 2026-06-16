const RCT_COLOURS = [
  "#1b1d22",
  "#8f969d",
  "#f7f7f2",
  "#6e2e8d",
  "#9b58cf",
  "#c083f2",
  "#234f9f",
  "#4a8edb",
  "#7bd1ec",
  "#1b9a96",
  "#1f7a3a",
  "#69b34c",
  "#9bd9a8",
  "#f2d43d",
  "#ffd866",
  "#e89a28",
  "#c95c1f",
  "#cf3238",
  "#8e2428",
  "#e577a8",
  "#c23b8f",
  "#8f5d3a",
  "#c6935b",
  "#5c3c2f",
  "#efe1b0",
  "#d6c8a4",
  "#2f6f7f",
  "#38485c",
  "#5e6f8d",
  "#7e8f57",
  "#b9653f",
  "#e0ece7"
] as const;

export function paletteColour(index: number | undefined, fallback: string): string {
  if (typeof index !== "number" || !Number.isFinite(index)) {
    return fallback;
  }

  const wrapped = ((Math.trunc(index) % RCT_COLOURS.length) + RCT_COLOURS.length) % RCT_COLOURS.length;
  return RCT_COLOURS[wrapped] ?? fallback;
}
