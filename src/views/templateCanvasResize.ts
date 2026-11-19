/** Geometry helpers for the Canvas resize handle. Kept DOM-free for regression tests. */

function finiteNonNegative(value: number, fallback = 0): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Signed edge-scroll speed for an active resize gesture, in pixels per 60 Hz
 * frame. The speed ramps up quadratically as the pointer approaches/leaves
 * the scroll viewport edge, avoiding an abrupt jump when it first enters the
 * edge zone. A zero result means that autoscroll should pause.
 */
export function resizeAutoScrollSpeed(
  pointerY: number,
  viewportTop: number,
  viewportBottom: number,
  edgeSize = 56,
  maxSpeed = 16,
): number {
  if (![pointerY, viewportTop, viewportBottom, edgeSize, maxSpeed].every(Number.isFinite)) return 0;
  const viewportHeight = viewportBottom - viewportTop;
  if (viewportHeight <= 0 || edgeSize <= 0 || maxSpeed <= 0) return 0;

  const edge = Math.min(edgeSize, viewportHeight / 2);
  if (pointerY < viewportTop + edge) {
    const progress = Math.max(0, Math.min(1, (viewportTop + edge - pointerY) / edge));
    return -Math.max(1, Math.ceil(progress * progress * maxSpeed));
  }
  if (pointerY > viewportBottom - edge) {
    const progress = Math.max(0, Math.min(1, (pointerY - (viewportBottom - edge)) / edge));
    return Math.max(1, Math.ceil(progress * progress * maxSpeed));
  }
  return 0;
}

/** Exact border-box height for N equal Grid tracks and the gaps between them. */
export function resizeRowsMinHeight(rows: number, rowHeight: number, rowGap: number): string {
  const safeRows = clampInteger(rows, 1, 10_000);
  const safeHeight = Math.max(1, finiteNonNegative(rowHeight, 56));
  const safeGap = finiteNonNegative(rowGap);
  const height = safeRows * safeHeight + (safeRows - 1) * safeGap;
  return `${height.toFixed(3).replace(/\.?0+$/, '')}px`;
}

/** Distance between adjacent tracks in a CSS grid with equal-width columns. */
export function gridResizeColumnStep(containerWidth: number, columnGap: number, columns = 12): number {
  const safeColumns = clampInteger(columns, 1, 64);
  const width = finiteNonNegative(containerWidth);
  const gap = finiteNonNegative(columnGap);
  return Math.max(1, (width + gap) / safeColumns);
}

/** Compute the new span for a block positioned in a fixed-column Grid. */
export function gridResizeSpanFromDelta(
  startSpan: number,
  _startColumn: number,
  deltaX: number,
  containerWidth: number,
  columnGap: number,
  columns = 12,
): number {
  const step = gridResizeColumnStep(containerWidth, columnGap, columns);
  return gridResizeSpanFromStep(startSpan, deltaX, step, columns);
}

/** Snap a resize gesture to a column pitch measured from the browser's actual Grid tracks. */
export function gridResizeSpanFromStep(
  startSpan: number,
  deltaX: number,
  columnStep: number,
  columns = 12,
): number {
  const safeColumns = clampInteger(columns, 1, 64);
  // A block may grow beyond the columns remaining to its right. The layout
  // packer repositions it into the next available row while keeping the total
  // grid width bounded by the configured column count.
  const safeStartSpan = clampInteger(startSpan, 1, safeColumns);
  const step = Math.max(1, finiteNonNegative(columnStep, 1));
  const delta = Number.isFinite(deltaX) ? deltaX : 0;
  return clampInteger(safeStartSpan + Math.round(delta / step), 1, safeColumns);
}

/**
 * Convert a horizontal pointer delta into the nearest Row span using the
 * exact width formula used by renderRow(). A Row child occupies span / 12 of
 * its line; it is not normalized against every child in the whole Row. The
 * sibling count and gap are supplied for the particular visual line so a
 * wrapped third/fourth child does not resize relative to blocks on other lines.
 */
export function rowResizeSpanFromDelta(
  startSpan: number,
  otherSpanTotal: number,
  deltaX: number,
  availableWidth: number,
  siblingCount = otherSpanTotal > 0 ? 2 : 1,
  columnGap = 0,
): number {
  const safeStart = clampInteger(startSpan, 1, 12);
  const others = finiteNonNegative(otherSpanTotal);
  const width = Math.max(1, finiteNonNegative(availableWidth, 1));
  const delta = Number.isFinite(deltaX) ? deltaX : 0;
  const count = clampInteger(siblingCount, 1, 256);
  const totalGap = Math.max(0, count - 1) * finiteNonNegative(columnGap);
  const maxSpan = Math.max(1, 12 - Math.min(11, Math.round(others)));
  const renderedWidth = (span: number): number =>
    (span / 12) * width - (others > 0 ? totalGap * span / (span + others) : 0);
  const targetWidth = renderedWidth(safeStart) + delta;

  let bestSpan = safeStart;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let candidate = 1; candidate <= maxSpan; candidate += 1) {
    const distance = Math.abs(renderedWidth(candidate) - targetWidth);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestSpan = candidate;
    }
  }
  return bestSpan;
}

/** CSS width identical to renderRow() for a given Row weight and sibling set. */
export function rowResizePreviewWidth(
  span: number,
  otherSpanTotal: number,
  siblingCount: number,
  columnGap: number,
): string {
  const safeSpan = clampInteger(span, 1, 12);
  const others = finiteNonNegative(otherSpanTotal);
  const totalSpan = Math.max(1, safeSpan + others);
  const totalGap = Math.max(0, clampInteger(siblingCount, 1, 256) - 1) * finiteNonNegative(columnGap);
  const gapShare = others > 0 ? (totalGap * safeSpan / totalSpan) : 0;
  return `calc(${((safeSpan / 12) * 100).toFixed(4)}% - ${gapShare.toFixed(3)}px)`;
}
