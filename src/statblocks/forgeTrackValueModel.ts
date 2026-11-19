/** Normalized visual values for Forge Boxes/Gauge tracks. */
export interface ForgeTrackValues {
  maximum: number;
  current: number;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Resolve a Track without treating an explicit zero as a missing value.
 * A Number Field may legitimately have a maximum of zero; callers must not
 * force that value to one, which would fabricate a box and change its meaning.
 */
export function forgeTrackValues(
  maximumValue: unknown,
  currentValue: unknown,
  counts: 'down' | 'up',
  fallbackMaximum = 5,
): ForgeTrackValues {
  const maximumSource = maximumValue ?? currentValue ?? fallbackMaximum;
  const parsedMaximum = finiteNumber(maximumSource);
  const maximum = Math.max(0, Math.min(1000, Math.floor(parsedMaximum ?? fallbackMaximum)));
  const currentSource = currentValue ?? (counts === 'down' ? maximum : 0);
  const parsedCurrent = finiteNumber(currentSource);
  const current = Math.max(0, Math.min(maximum, Math.floor(parsedCurrent ?? (counts === 'down' ? maximum : 0))));
  return { maximum, current };
}
