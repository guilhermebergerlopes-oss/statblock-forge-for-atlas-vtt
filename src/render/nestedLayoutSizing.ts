export interface NestedLayoutInlineInsets {
  fallbackStart?: number;
  fallbackEnd?: number;
  paddingStart?: number;
  paddingEnd?: number;
  borderStart?: number;
  borderEnd?: number;
}

export interface NestedLayoutInlineBleeds {
  start: number;
  end: number;
}

/**
 * Combines explicit Forge appearance insets with the actual computed padding
 * and border of the active theme. Explicit values are needed for Forge's
 * pseudo-element border frame, which is not exposed as the block's CSS border.
 */
export function resolveNestedLayoutInlineBleeds(insets: NestedLayoutInlineInsets): NestedLayoutInlineBleeds {
  const nonNegative = (value: number | undefined): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
  return {
    start: Math.max(
      nonNegative(insets.fallbackStart),
      nonNegative(insets.paddingStart) + nonNegative(insets.borderStart),
    ),
    end: Math.max(
      nonNegative(insets.fallbackEnd),
      nonNegative(insets.paddingEnd) + nonNegative(insets.borderEnd),
    ),
  };
}
