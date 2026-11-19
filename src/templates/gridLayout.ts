import type { ForgeBlock, ForgeLayoutDocument, GridPlacement } from './forgeTemplate.ts';
import {
  DEFAULT_GRID_COLUMN_COUNT,
  GRID_COLUMN_COUNT,
  MAX_BLOCK_ROWS,
  MAX_GRID_COLUMN_COUNT,
  MAX_GRID_ROWS,
} from './layoutLimits.ts';


/** Toggle the persisted Dense setting on the canonical Forge layout object. */
export function toggleDenseLayout(layout: Pick<ForgeLayoutDocument, 'dense'>): boolean {
  layout.dense = layout.dense !== true;
  return layout.dense;
}

/**
 * Captures visible positions before Dense Layout is disabled.
 * Every Grid in the layout tree uses the same global column coordinate system;
 * being nested inside a narrower Section or Row child does not create a new
 * proportional grid or rescale the saved columns.
 */
export function captureGridPlacementAnchors(
  blocks: readonly ForgeBlock[],
  layout: ForgeLayoutDocument,
  sample?: Readonly<Record<string, unknown>>,
): void {
  const denseLayout: ForgeLayoutDocument = { ...layout, dense: true, blocks: { ...layout.blocks } };
  const globalColumns = clamp(layout.columns, 4, MAX_GRID_COLUMN_COUNT, DEFAULT_GRID_COLUMN_COUNT);

  const captureNested = (block: ForgeBlock): void => {
    if (!Array.isArray(block.blocks)) return;
    const nested = block.blocks.filter((item): item is ForgeBlock =>
      Boolean(item && typeof item === 'object' && 'id' in item && 'type' in item),
    );
    if (block.type === 'section') {
      captureGrid(nested);
      return;
    }
    if (block.type === 'tabs') {
      for (const section of nested) {
        if (section.type === 'section' && Array.isArray(section.blocks)) {
          captureGrid(section.blocks.filter((item): item is ForgeBlock =>
            Boolean(item && typeof item === 'object' && 'id' in item && 'type' in item),
          ));
        }
      }
      return;
    }
    if (block.type === 'row') {
      // Row children are flex items, but structural descendants inside them
      // still use the same global grid as the root statblock.
      for (const child of nested) captureNested(child);
    }
  };

  const captureGrid = (siblings: readonly ForgeBlock[]): void => {
    const placements = packPhysicalGrid(siblings, denseLayout, false, sample);
    for (const placement of placements) {
      const metadata = layout.blocks[placement.id] ?? {
        span: placement.span, rows: placement.rows, appearance: {},
      };
      layout.blocks[placement.id] = {
        ...metadata,
        anchorColumn: placement.x,
        anchorRow: placement.y,
        anchorColumns: globalColumns,
      };
    }
    for (const block of siblings) captureNested(block);
  };

  captureGrid(blocks);
}

/** Clears only the sibling group's saved positions after an explicit reorder. */
export function clearGridPlacementAnchors(blocks: readonly ForgeBlock[], layout: ForgeLayoutDocument): void {
  for (const block of blocks) {
    const metadata = layout.blocks[block.id];
    if (metadata) {
      delete metadata.anchorColumn;
      delete metadata.anchorRow;
      delete metadata.anchorColumns;
    }
  }
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function cellMask(x: number, span: number): number {
  return ((1 << span) - 1) << x;
}

/**
 * Returns the square side length shared by every cell in a fixed-column Grid.
 * The configured track gaps are excluded from the usable width before each
 * column's width is calculated, so the resulting row tracks match it exactly.
 */
export function gridCellSize(containerWidth: number, columnGap = 8, columns = GRID_COLUMN_COUNT): number {
  const safeColumns = clamp(columns, 1, 64, GRID_COLUMN_COUNT);
  const safeWidth = Number.isFinite(containerWidth) ? Math.max(0, containerWidth) : 0;
  const safeGap = Number.isFinite(columnGap) ? Math.max(0, columnGap) : 0;
  const usableWidth = Math.max(0, safeWidth - (safeColumns - 1) * safeGap);
  return Math.max(1, usableWidth / safeColumns);
}

/**
 * Segment tree storing the bitwise OR of occupied columns over row ranges.
 * This keeps collision checks fast even for blocks thousands of rows tall.
 */
class RowMaskTree {
  private readonly size: number;
  // A configurable Grid can use up to 24 tracks, so 16-bit masks are too small.
  private readonly nodes: Uint32Array;
  private readonly lazy: Uint32Array;

  constructor(maxRows: number) {
    let size = 1;
    while (size < maxRows) size *= 2;
    this.size = size;
    this.nodes = new Uint32Array(size * 2);
    this.lazy = new Uint32Array(size * 2);
  }

  add(start: number, end: number, mask: number): void {
    this.update(1, 0, this.size, start, end, mask);
  }

  query(start: number, end: number): number {
    return this.queryRange(1, 0, this.size, start, end);
  }

  private apply(node: number, mask: number): void {
    this.nodes[node] = (this.nodes[node] ?? 0) | mask;
    this.lazy[node] = (this.lazy[node] ?? 0) | mask;
  }

  private push(node: number): void {
    const pending = this.lazy[node] ?? 0;
    if (pending === 0) return;
    this.apply(node * 2, pending);
    this.apply(node * 2 + 1, pending);
    this.lazy[node] = 0;
  }

  private update(node: number, left: number, right: number, start: number, end: number, mask: number): void {
    if (start <= left && right <= end) {
      this.apply(node, mask);
      return;
    }
    this.push(node);
    const middle = (left + right) >> 1;
    if (start < middle) this.update(node * 2, left, middle, start, end, mask);
    if (end > middle) this.update(node * 2 + 1, middle, right, start, end, mask);
    this.nodes[node] = (this.nodes[node * 2] ?? 0) | (this.nodes[node * 2 + 1] ?? 0);
  }

  private queryRange(node: number, left: number, right: number, start: number, end: number): number {
    if (start <= left && right <= end) return this.nodes[node] ?? 0;
    this.push(node);
    const middle = (left + right) >> 1;
    let result = 0;
    if (start < middle) result |= this.queryRange(node * 2, left, middle, start, end);
    if (end > middle) result |= this.queryRange(node * 2 + 1, middle, right, start, end);
    return result;
  }
}


/** Converts an intrinsic content height into a number of equal-height Grid rows. */
export function rowsRequiredForContent(
  contentHeight: number,
  rowHeight: number,
  rowGap = 8,
  minimumRows = 1,
): number {
  const safeRowHeight = Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : 56;
  const safeGap = Number.isFinite(rowGap) && rowGap >= 0 ? rowGap : 8;
  const safeMinimum = Number.isFinite(minimumRows) ? Math.max(1, Math.floor(minimumRows)) : 1;
  if (!Number.isFinite(contentHeight) || contentHeight <= 0) return safeMinimum;
  return Math.max(safeMinimum, Math.ceil((contentHeight + safeGap) / (safeRowHeight + safeGap)));
}

/**
 * Measures intrinsic overflow relative to the block's saved Grid allocation.
 * DOM scrollHeight/clientHeight are integer CSS-pixel values, while square Grid
 * tracks are often fractional. Measuring only their difference avoids treating
 * subpixel track rounding as genuine content overflow.
 */
export function rowsRequiredForContentOverflow(
  overflowHeight: number,
  rowHeight: number,
  rowGap = 8,
  minimumRows = 1,
): number {
  const safeRowHeight = Number.isFinite(rowHeight) && rowHeight > 0 ? rowHeight : 56;
  const safeGap = Number.isFinite(rowGap) && rowGap >= 0 ? rowGap : 8;
  const safeMinimum = Number.isFinite(minimumRows) ? Math.max(1, Math.floor(minimumRows)) : 1;
  const safeOverflow = Number.isFinite(overflowHeight) ? Math.max(0, overflowHeight) : 0;
  const allocatedHeight = safeMinimum * safeRowHeight + (safeMinimum - 1) * safeGap;
  return rowsRequiredForContent(allocatedHeight + safeOverflow, safeRowHeight, safeGap, safeMinimum);
}

function childBlocksOf(block: ForgeBlock): ForgeBlock[] {
  if (!Array.isArray(block.blocks)) return [];
  return block.blocks.filter((child): child is ForgeBlock =>
    Boolean(child && typeof child === 'object' && 'id' in child && 'type' in child),
  );
}

function blockLabelIsHidden(block: ForgeBlock): boolean {
  return block.labelPlacement === 'none' || block.label === '';
}

/** Mirrors the renderer's readablePreviewValue check without formatting the value. */
function hasReadableValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasReadableValue);
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .some(([key, item]) => key !== '_atlasCounterMaxes' && hasReadableValue(item));
  }
  return String(value).length > 0;
}

/** Whether a Section heading will actually be present in the rendered preview. */
function sectionHasRenderedHeading(
  block: ForgeBlock,
  sectionInsideTabs: boolean,
  sample?: Readonly<Record<string, unknown>>,
): boolean {
  if (sectionInsideTabs || blockLabelIsHidden(block)) return false;
  if (typeof block.heading === 'string' && block.heading.trim().length > 0) return true;
  if (typeof block.headingField !== 'string' || !block.headingField.trim()) return false;
  // Layout-only operations that do not have a sample stay conservative. The
  // canonical renderer always supplies one, so empty dynamic headings do not
  // reserve a row that is not visible in the actual statblock.
  return sample ? hasReadableValue(sample[block.headingField]) : true;
}

/** Tabs renders only its fixed heading; headingField is not a Tabs title source. */
function tabsHasRenderedHeading(block: ForgeBlock): boolean {
  return !blockLabelIsHidden(block)
    && typeof block.heading === 'string'
    && block.heading.trim().length > 0;
}

/** True when any nested child is omitted from the visible statblock layout. */
function hasOmittedDescendant(block: ForgeBlock, omittedIds: ReadonlySet<string>): boolean {
  return childBlocksOf(block).some((child) => omittedIds.has(child.id) || hasOmittedDescendant(child, omittedIds));
}

/**
 * Split a Row's children into the same 12-part lines used by its flex layout.
 * Row children are allowed to wrap; treating the whole Row as one line makes
 * its parent reserve too little height and lets later siblings paint over the
 * wrapped children. Keeping this grouping pure also lets the renderer use the
 * exact same line breaks when calculating each child's width.
 */
export function groupRowChildrenBySpan(
  children: readonly ForgeBlock[],
  layout: ForgeLayoutDocument,
): ForgeBlock[][] {
  const lines: ForgeBlock[][] = [];
  let currentLine: ForgeBlock[] = [];
  let currentSpan = 0;

  for (const child of children) {
    const span = clamp(layout.blocks[child.id]?.span, 1, GRID_COLUMN_COUNT, 6);
    if (currentLine.length > 0 && currentSpan + span > GRID_COLUMN_COUNT) {
      lines.push(currentLine);
      currentLine = [];
      currentSpan = 0;
    }
    currentLine.push(child);
    currentSpan += span;
  }

  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

/** Required Grid-track height for each visual line in a Row. */
export function requiredRowsForRowLines(
  lines: readonly (readonly ForgeBlock[])[],
  layout: ForgeLayoutDocument,
  omittedIds: ReadonlySet<string> = new Set(),
  sample?: Readonly<Record<string, unknown>>,
): number[] {
  return lines.map((line) => line.reduce((tallest, child) => {
    if (omittedIds.has(child.id)) return tallest;
    return Math.max(tallest, requiredRowsForBlock(child, layout, false, omittedIds, sample));
  }, 0));
}

/**
 * Minimum Grid rows required to contain a block's structural children.
 *
 * Structural containers reserve enough rows for their complete nested layout.
 * Nested Grids always use the same global column count as the root statblock;
 * their cells are never rescaled to the physical span of their parent block.
 * This keeps parent row allocations at least as large as the rows occupied by
 * their descendants, preventing nested content from painting over siblings.
 */
export function requiredRowsForBlock(
  block: ForgeBlock,
  layout: ForgeLayoutDocument,
  sectionInsideTabs = false,
  omittedIds: ReadonlySet<string> = new Set(),
  sample?: Readonly<Record<string, unknown>>,
): number {
  const metadataRows = clamp(layout.blocks[block.id]?.rows, 1, MAX_BLOCK_ROWS, 1);
  const allChildren = childBlocksOf(block);
  const children = allChildren.filter((child) => !omittedIds.has(child.id));
  // Keep the same global grid inside every structural block. The parent may
  // be visually narrower, but nested spans still use the same 12-part system.
  if (block.type === 'section') {
    const descendantsChanged = hasOmittedDescendant(block, omittedIds);
    const headingRows = sectionHasRenderedHeading(block, sectionInsideTabs, sample) ? 1 : 0;
    if (children.length === 0) {
      // A genuinely empty Section keeps its placeholder height. If original
      // children were folded/hidden, shrink to the heading instead of leaving
      // the saved full-content allocation behind.
      if (allChildren.length > 0 && descendantsChanged) {
        return Math.max(1, 1 + headingRows);
      }
      return Math.max(metadataRows, 2 + headingRows);
    }
    const placements = descendantsChanged
      ? packVisibleGrid(allChildren, layout, omittedIds, sample)
      : packPhysicalGrid(children, layout, false, sample);
    const contentBottom = placements.reduce((bottom, placement) =>
      Math.max(bottom, placement.y + placement.rows), 1);
    return Math.max(descendantsChanged ? 1 : metadataRows, contentBottom + headingRows);
  }

  if (block.type === 'row') {
    if (allChildren.length === 0) return Math.max(metadataRows, 2);
    // Keep the original flex-line grouping: removing an item must not cause
    // neighboring blocks to jump sideways or be regrouped into another line.
    const lines = groupRowChildrenBySpan(allChildren, layout);
    const requiredLineRows = requiredRowsForRowLines(lines, layout, omittedIds, sample)
      .reduce((totalRows, lineRows) => totalRows + lineRows, 0);
    // If any descendant is omitted, discard the old content allocation and
    // measure only the visible children. Truly empty Rows keep their placeholder.
    const descendantsChanged = hasOmittedDescendant(block, omittedIds);
    return Math.max(descendantsChanged ? 1 : metadataRows, requiredLineRows || (descendantsChanged ? 1 : 2));
  }

  if (block.type === 'tabs') {
    const sections = children.filter((child) => child.type === 'section');
    const invalidChildren = children.some((child) => child.type !== 'section');
    const descendantsChanged = hasOmittedDescendant(block, omittedIds);
    if (sections.length === 0) {
      // The empty Tabs prompt has the same 6.5rem minimum as other containers,
      // unless all original panels were removed from the player-facing view.
      if (allChildren.length > 0 && descendantsChanged) return 1;
      return Math.max(metadataRows, 2 + (tabsHasRenderedHeading(block) ? 1 : 0) + (invalidChildren ? 1 : 0));
    }
    const tallestTab = sections.reduce((tallest, section) =>
      Math.max(tallest, requiredRowsForBlock(section, layout, true, omittedIds, sample)), 1);
    // A populated Tabs needs one row for its tab strip and, optionally, one
    // more for its own visible fixed heading. Invalid legacy children also render a warning.
    const required = tallestTab + 1 + (tabsHasRenderedHeading(block) ? 1 : 0) + (invalidChildren ? 1 : 0);
    return Math.max(descendantsChanged ? 1 : metadataRows, required);
  }

  return metadataRows;
}

/**
 * Packs the visible subset of a sibling Grid after folded Sections or player-hidden
 * blocks have been removed. The original full layout is measured first, then only
 * vertical space released above a block is reclaimed. X coordinates never change,
 * so blocks beside a folded/hidden block stay in their original columns.
 */
export function packVisibleGrid(
  blocks: readonly ForgeBlock[],
  layout: ForgeLayoutDocument,
  omittedIds: ReadonlySet<string>,
  sample?: Readonly<Record<string, unknown>>,
): GridPlacement[] {
  if (omittedIds.size === 0) return packPhysicalGrid(blocks, layout, false, sample);

  const baselineLayout: ForgeLayoutDocument = {
    ...layout,
    blocks: Object.fromEntries(Object.entries(layout.blocks).map(([id, value]) => [id, { ...value }])),
  };
  const baseline = packPhysicalGrid(blocks, baselineLayout, false, sample);
  const baselineById = new Map(baseline.map((placement) => [placement.id, placement]));
  const removedRows = new Map<string, number>();
  for (const block of blocks) {
    const placement = baselineById.get(block.id);
    if (!placement) continue;
    const visibleRows = omittedIds.has(block.id)
      ? 0
      : requiredRowsForBlock(block, layout, false, omittedIds, sample);
    removedRows.set(block.id, Math.max(0, placement.rows - visibleRows));
  }

  const columns = clamp(layout.columns, 4, MAX_GRID_COLUMN_COUNT, DEFAULT_GRID_COLUMN_COUNT);
  const occupiedRows = new RowMaskTree(MAX_GRID_ROWS);
  const placements: GridPlacement[] = [];
  const isFree = (x: number, y: number, span: number, rows: number): boolean =>
    x >= 0 && x + span <= columns && y >= 0 && y + rows <= MAX_GRID_ROWS
    && (occupiedRows.query(y, y + rows) & cellMask(x, span)) === 0;
  const occupy = (x: number, y: number, span: number, rows: number): void => {
    occupiedRows.add(y, y + rows, cellMask(x, span));
  };

  for (const block of blocks) {
    if (omittedIds.has(block.id)) continue;
    const original = baselineById.get(block.id);
    if (!original) continue;
    const rows = Math.max(1, requiredRowsForBlock(block, layout, false, omittedIds, sample));
    let releasedRowsAbove = 0;
    for (const previous of blocks) {
      if (previous.id === block.id) break;
      const previousPlacement = baselineById.get(previous.id);
      const released = removedRows.get(previous.id) ?? 0;
      if (!previousPlacement || released <= 0) continue;
      const isAbove = previousPlacement.y + previousPlacement.rows <= original.y;
      const overlapsColumns = previousPlacement.x < original.x + original.span
        && original.x < previousPlacement.x + previousPlacement.span;
      if (isAbove && overlapsColumns) releasedRowsAbove += released;
    }

    const firstCandidateY = Math.max(0, original.y - releasedRowsAbove);
    let y = original.y;
    // Reclaim as much released vertical space as possible, but never move a
    // block sideways or across another visible block.
    for (let candidate = firstCandidateY; candidate <= original.y; candidate += 1) {
      if (isFree(original.x, candidate, original.span, rows)) {
        y = candidate;
        break;
      }
    }
    while (!isFree(original.x, y, original.span, rows)) {
      y += 1;
      if (y + rows > MAX_GRID_ROWS) {
        throw new Error(`Não foi possível reposicionar o bloco ${block.id} após recolher conteúdo.`);
      }
    }
    occupy(original.x, y, original.span, rows);
    placements.push({ id: block.id, x: original.x, y, span: original.span, rows });
  }
  return placements;
}

/**
 * Places sibling blocks in the statblock's global fixed-column grid. Persisted
 * spans retain a 12-part logical scale and map proportionally to the configured
 * physical column count at every nesting level.
 * Dense movement is physical: the entire unchanged rectangle must be able to
 * travel cell by cell around obstacles. Blocks never overlap, rotate or shrink.
 */
export function packPhysicalGrid(
  blocks: readonly ForgeBlock[],
  layout: ForgeLayoutDocument,
  sectionInsideTabs = false,
  sample?: Readonly<Record<string, unknown>>,
): GridPlacement[] {
  const columns = clamp(layout.columns, 4, MAX_GRID_COLUMN_COUNT, DEFAULT_GRID_COLUMN_COUNT);
  const occupiedRows = new RowMaskTree(MAX_GRID_ROWS);
  const placements: GridPlacement[] = [];
  const seenIds = new Set<string>();
  let cursorX = 0;
  let cursorY = 0;
  let highestOccupiedRow = -1;

  const isFree = (x: number, y: number, span: number, rows: number): boolean => {
    if (x < 0 || x + span > columns || y < 0 || y + rows > MAX_GRID_ROWS) return false;
    return (occupiedRows.query(y, y + rows) & cellMask(x, span)) === 0;
  };

  const occupy = (x: number, y: number, span: number, rows: number): void => {
    occupiedRows.add(y, y + rows, cellMask(x, span));
    highestOccupiedRow = Math.max(highestOccupiedRow, y + rows - 1);
  };

  for (const block of blocks) {
    if (!block.id || seenIds.has(block.id)) {
      throw new Error(`O layout contém um ID de bloco vazio ou duplicado: ${block.id || '(vazio)'}`);
    }
    seenIds.add(block.id);

    const metadata = layout.blocks[block.id];
    // Persisted spans map to the same global 12-part coordinate system at
    // every level; nested containers do not rescale them to their own width.
    const logicalSpan = clamp(metadata?.span, 1, GRID_COLUMN_COUNT, GRID_COLUMN_COUNT);
    const span = clamp(Math.round(logicalSpan * columns / GRID_COLUMN_COUNT), 1, columns, 1);
    // Structural blocks reserve enough parent-grid space for their complete
    // nested layout, while preserving any larger user-configured row span.
    const rows = requiredRowsForBlock(block, layout, sectionInsideTabs, new Set(), sample);
    const hasStableAnchor = !layout.dense
      && Number.isSafeInteger(metadata?.anchorColumn)
      && Number.isSafeInteger(metadata?.anchorRow);

    const anchorColumns = clamp(metadata?.anchorColumns, 4, MAX_GRID_COLUMN_COUNT, DEFAULT_GRID_COLUMN_COUNT);
    const scaledAnchorColumn = hasStableAnchor
      ? Math.round((metadata?.anchorColumn ?? 0) * columns / anchorColumns)
      : 0;
    let startX = hasStableAnchor
      ? clamp(scaledAnchorColumn, 0, columns - span, 0)
      : cursorX;
    let startY = hasStableAnchor
      ? clamp(metadata?.anchorRow, 0, MAX_GRID_ROWS - rows, 0)
      : cursorY;
    let attempts = 0;
    while (!isFree(startX, startY, span, rows)) {
      if (hasStableAnchor) {
        // Sparse mode preserves the saved column. An occupied anchor can only
        // push the block downward; it cannot pull it sideways into a gap.
        startY += 1;
        if (startY + rows > MAX_GRID_ROWS) {
          throw new Error(`Não foi possível manter o bloco ${block.id} dentro dos limites da grade.`);
        }
      } else {
        // First layout pass (or a newly added block) follows ordinary source
        // flow. Its resolved position is saved below as the new stable anchor.
        startX += 1;
        if (startX + span > columns) {
          startX = 0;
          startY += 1;
        }
      }
      attempts += 1;
      if (attempts > (hasStableAnchor ? MAX_GRID_ROWS : MAX_GRID_ROWS * columns)) {
        throw new Error(`Não foi possível posicionar o bloco ${block.id} na grade.`);
      }
    }

    let finalX = startX;
    let finalY = startY;
    if (layout.dense && (startX > 0 || startY > 0)) {
      const maxSearchY = Math.min(
        MAX_GRID_ROWS - rows,
        Math.max(startY, highestOccupiedRow + rows + 1),
      );
      const totalStates = (maxSearchY + 1) * columns;
      const visited = new Uint8Array(totalStates);
      const queue: number[] = [startY * columns + startX];
      visited[queue[0]!] = 1;
      const best = { x: startX, y: startY };

      for (let index = 0; index < queue.length; index += 1) {
        const state = queue[index]!;
        const y = Math.floor(state / columns);
        const x = state % columns;
        if (y < best.y || (y === best.y && x < best.x)) {
          best.x = x;
          best.y = y;
          if (best.x === 0 && best.y === 0) break;
        }

        const neighbours = [
          { x, y: y - 1 },
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y + 1 },
        ];
        for (const next of neighbours) {
          if (next.y < 0 || next.y > maxSearchY || !isFree(next.x, next.y, span, rows)) continue;
          const key = next.y * columns + next.x;
          if (visited[key]) continue;
          visited[key] = 1;
          queue.push(key);
        }
      }
      finalX = best.x;
      finalY = best.y;
    }

    occupy(finalX, finalY, span, rows);
    placements.push({ id: block.id, x: finalX, y: finalY, span, rows });

    if (!layout.dense) {
      // Persist the resolved position. If a collision pushed the block down,
      // the new row becomes its anchor so later shrinkage does not pull it up.
      const stableMetadata = layout.blocks[block.id] ?? {
        span, rows, appearance: {},
      };
      layout.blocks[block.id] = {
        ...stableMetadata,
        anchorColumn: finalX,
        anchorRow: finalY,
        anchorColumns: columns,
      };
    }

    // Continue source flow from the position actually occupied, so a newly
    // inserted block starts after the last placed sibling rather than its old
    // pre-collision cursor.
    cursorX = layout.dense ? startX + span : finalX + span;
    cursorY = layout.dense ? startY : finalY;
    if (cursorX >= columns) {
      cursorX = 0;
      cursorY += 1;
    }
  }

  return placements;
}
