/** Minimal contracts keep the viewport alignment algorithm independently testable. */
export interface ViewportAnchorTarget {
  getBoundingClientRect(): { top: number };
}

export interface VerticalScrollport {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  isConnected?: boolean;
}

/**
 * Move the nearest scrollports just enough to place a target at a viewport Y.
 * The delta is recalculated after every scroll because an inner scrollport may
 * be clamped at its beginning/end, leaving the outer scrollport to do the rest.
 * Returns the remaining pixel error after all scrollports have been tried.
 */
export function alignTargetAtViewportY(
  target: ViewportAnchorTarget,
  scrollports: readonly VerticalScrollport[],
  targetTop: number,
  tolerance = 0.75,
): number {
  for (const scrollport of scrollports) {
    if (scrollport.isConnected === false) continue;
    const beforeTop = target.getBoundingClientRect().top;
    const requiredDelta = beforeTop - targetTop;
    if (Math.abs(requiredDelta) <= tolerance) return requiredDelta;

    const maxScrollTop = Math.max(0, scrollport.scrollHeight - scrollport.clientHeight);
    if (maxScrollTop <= 0) continue;

    const previousScrollTop = scrollport.scrollTop;
    const nextScrollTop = Math.min(maxScrollTop, Math.max(0, previousScrollTop + requiredDelta));
    if (Math.abs(nextScrollTop - previousScrollTop) <= 0.01) continue;
    scrollport.scrollTop = nextScrollTop;
  }

  return target.getBoundingClientRect().top - targetTop;
}
