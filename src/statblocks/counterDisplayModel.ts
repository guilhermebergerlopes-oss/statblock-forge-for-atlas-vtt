/** Maximum Counter size that is displayed as individual pips before switching to a numeric stepper. */
export const COUNTER_PIP_DISPLAY_MAX = 10;

/** Counters larger than the pip limit use the compact numeric stepper. */
export function counterUsesNumericDisplay(maximum: number): boolean {
  return Number.isFinite(maximum) && maximum > COUNTER_PIP_DISPLAY_MAX;
}

/** Numeric values are mandatory for large Counters and optional for smaller ones. */
export function shouldShowCounterNumericValue(showCounterValue: boolean, maximum: number): boolean {
  return showCounterValue || counterUsesNumericDisplay(maximum);
}

/** Enable the Field option as soon as any configured Counter exceeds the pip limit. */
export function shouldEnableCounterNumericValues(rows: readonly unknown[]): boolean {
  return rows.some((row) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) return false;
    const maximum = (row as Record<string, unknown>).max;
    return typeof maximum === 'number' && counterUsesNumericDisplay(maximum);
  });
}
