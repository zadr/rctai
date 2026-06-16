export function clamp(value: number, min = 0, max = 1): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * clamp(t);
}

export function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

export function stableHash(input: string): number {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function shorten(input: string, maxLength: number): string {
  const singleLine = input.replace(/\s+/g, " ").trim();

  if (singleLine.length <= maxLength) {
    return singleLine;
  }

  const suffix = "...";
  const hardLimit = Math.max(0, maxLength - suffix.length);
  const sliced = singleLine.slice(0, hardLimit).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  const candidate = lastSpace >= Math.floor(hardLimit * 0.6) ? sliced.slice(0, lastSpace) : sliced;

  return `${candidate}${suffix}`;
}
