import { DEFAULT_GRID_COLUMN_COUNT, MAX_GRID_COLUMN_COUNT, MAX_GRID_ROWS } from '../templates/layoutLimits.ts';

/** Exact rendered track geometry shared by Grid drag, resize and row sizing. */
export interface TemplateGridGeometry {
  columns: number;
  contentLeft: number;
  contentTop: number;
  contentWidth: number;
  columnWidths: number[];
  columnGap: number;
  rowHeight: number;
  rowGap: number;
}

function px(value: string | null | undefined, fallback = 0): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Computed Grid track lists are resolved to pixel lengths by Chromium/WebView.
 * Preserve their fractional values; clientWidth/clientHeight round them and can
 * otherwise make the Canvas guides, resize snapping and block bounds disagree.
 */
export function parseResolvedGridTracks(value: string): number[] {
  if (!value.trim()) return [];
  const tracks = value.trim().split(/\s+/).map((token) => {
    const match = token.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))px$/i);
    return match ? Number.parseFloat(match[1]) : Number.NaN;
  });
  return tracks.length > 0 && tracks.every((track) => Number.isFinite(track) && track > 0)
    ? tracks
    : [];
}

/**
 * Read the actual content-box origin and resolved track sizes of a CSS Grid.
 * Fallback math is used only for DOM test doubles or WebViews that do not expose
 * resolved pixel track lists.
 */
export function readTemplateGridGeometry(grid: HTMLElement): TemplateGridGeometry {
  const view = grid.ownerDocument?.defaultView;
  let computed: CSSStyleDeclaration | null = null;
  try {
    computed = view?.getComputedStyle?.(grid) ?? null;
  } catch {
    computed = null;
  }
  const inline = grid.style;
  const read = (property: string, customProperty: string, fallback = 0): number => {
    const computedValue = computed?.getPropertyValue(property);
    const inlineValue = inline?.getPropertyValue(customProperty);
    return px(computedValue || inlineValue, fallback);
  };
  const rect = grid.getBoundingClientRect();
  const borderLeft = read('border-left-width', '--forge-grid-border-left', 0);
  const borderRight = read('border-right-width', '--forge-grid-border-right', 0);
  const borderTop = read('border-top-width', '--forge-grid-border-top', 0);
  const paddingLeft = read('padding-left', '--forge-grid-padding-left', 0);
  const paddingRight = read('padding-right', '--forge-grid-padding-right', 0);
  const paddingTop = read('padding-top', '--forge-grid-padding-top', 0);
  const columnGap = read('column-gap', '--forge-preview-grid-gap', 8);
  const rowGap = read('row-gap', '--forge-preview-grid-row-gap', columnGap);
  const contentWidth = Math.max(0,
    rect.width - borderLeft - borderRight - paddingLeft - paddingRight,
  );

  const resolvedTracks = parseResolvedGridTracks(computed?.getPropertyValue('grid-template-columns') ?? '');
  const declaredColumns = Number.parseInt(grid.dataset.columnCount ?? '', 10);
  const columns = Number.isSafeInteger(declaredColumns) && declaredColumns >= 1 && declaredColumns <= MAX_GRID_COLUMN_COUNT
    ? declaredColumns
    : (resolvedTracks.length >= 1 && resolvedTracks.length <= MAX_GRID_COLUMN_COUNT
      ? resolvedTracks.length
      : DEFAULT_GRID_COLUMN_COUNT);
  const columnWidths = resolvedTracks.length === columns
    ? resolvedTracks
    : Array.from({ length: columns }, () => Math.max(
      1,
      (contentWidth - columnGap * (columns - 1)) / columns,
    ));

  const resolvedRowHeight = px(
    computed?.getPropertyValue('grid-auto-rows') || inline?.getPropertyValue('--forge-preview-grid-row-height'),
    0,
  );
  const rowHeight = resolvedRowHeight > 0 ? resolvedRowHeight : (columnWidths[0] ?? 1);

  return {
    columns,
    contentLeft: rect.left + borderLeft + paddingLeft,
    contentTop: rect.top + borderTop + paddingTop,
    contentWidth,
    columnWidths,
    columnGap,
    rowHeight,
    rowGap,
  };
}

/** One column's pitch, including the gap after it. */
export function templateGridColumnPitch(geometry: TemplateGridGeometry): number {
  return Math.max(1, (geometry.columnWidths[0] ?? 1) + geometry.columnGap);
}

/** Resolve a viewport point against the actual Grid tracks, assigning gaps to the preceding cell. */
export function templateGridCellAtPoint(
  geometry: TemplateGridGeometry,
  clientX: number,
  clientY: number,
): { column: number; row: number } {
  const x = Math.max(0, Number.isFinite(clientX) ? clientX - geometry.contentLeft : 0);
  const y = Math.max(0, Number.isFinite(clientY) ? clientY - geometry.contentTop : 0);
  let column = 0;
  let cursorX = 0;
  for (let index = 0; index < geometry.columnWidths.length; index += 1) {
    const trackEnd = cursorX + geometry.columnWidths[index];
    if (x < trackEnd + geometry.columnGap || index === geometry.columnWidths.length - 1) {
      column = index;
      break;
    }
    cursorX = trackEnd + geometry.columnGap;
  }
  const rowPitch = Math.max(1, geometry.rowHeight + geometry.rowGap);
  const row = Math.max(0, Math.min(MAX_GRID_ROWS - 1, Math.floor(y / rowPitch)));
  return { column, row };
}
