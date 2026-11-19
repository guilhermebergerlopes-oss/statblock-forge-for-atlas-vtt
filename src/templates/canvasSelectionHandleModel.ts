/** Position a nested container's selection handle without covering its parent handle. */
export interface CanvasSelectionHandlePosition {
  topPx: number;
  rightPx: number;
}

const HANDLE_SIZE_PX = 16;
const HANDLE_GAP_PX = 2;
const HANDLE_EDGE_PX = 4;
const HANDLE_STEP_PX = HANDLE_SIZE_PX + HANDLE_GAP_PX;
const MAX_HANDLE_COLUMNS = 2;

export function canvasSelectionHandlePosition(
  nestingDepth: number,
  blockWidthPx: number,
): CanvasSelectionHandlePosition {
  const depth = Number.isFinite(nestingDepth) ? Math.max(0, Math.trunc(nestingDepth)) : 0;
  const width = Number.isFinite(blockWidthPx) ? Math.max(0, blockWidthPx) : 0;
  const availableColumns = width <= 0
    ? MAX_HANDLE_COLUMNS
    : Math.floor((width - HANDLE_EDGE_PX * 2 - HANDLE_SIZE_PX) / HANDLE_STEP_PX) + 1;
  const columns = Math.max(1, Math.min(MAX_HANDLE_COLUMNS, availableColumns));
  const column = depth % columns;
  const row = Math.floor(depth / columns);

  return {
    topPx: HANDLE_EDGE_PX + row * HANDLE_STEP_PX,
    rightPx: HANDLE_EDGE_PX + column * HANDLE_STEP_PX,
  };
}
