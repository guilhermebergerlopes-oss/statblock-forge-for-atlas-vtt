/**
 * Drag-and-drop behavior for the template Canvas.
 *
 * This module owns drag payloads, drop-target feedback, pointer-to-layout
 * resolution, and applying a dropped block/Field to the layout tree. The
 * TemplateEditorView remains responsible for selection, sidebar state,
 * rendering, and user-facing error notices.
 */
import {
  addLayoutBlock,
  findLayoutBlock,
  findLayoutParentId,
  moveLayoutBlockTo,
  type LayoutBlockType,
} from '../templates/layoutEditorModel.ts';
import { clearGridPlacementAnchors, packPhysicalGrid } from '../templates/gridLayout.ts';
import { DEFAULT_GRID_COLUMN_COUNT, GRID_COLUMN_COUNT, MAX_BLOCK_ROWS, MAX_GRID_COLUMN_COUNT, MAX_GRID_ROWS } from '../templates/layoutLimits.ts';
import { readTemplateGridGeometry, templateGridCellAtPoint } from './templateGridGeometry.ts';
import {
  FIELD_TO_BLOCK,
  isRecord,
  type ForgeBlock,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from '../templates/forgeTemplate.ts';

export const CANVAS_BLOCK_DRAG_TYPE = 'application/x-statblock-forge-block';
export const CANVAS_FIELD_DRAG_TYPE = 'application/x-statblock-forge-field';
const BLOCK_DRAG_FALLBACK = 'forge-block:';
const FIELD_DRAG_FALLBACK = 'forge-field:';

export interface CanvasDropLocation {
  parentId: string | null;
  index: number;
  position: 'append' | 'inside' | 'before' | 'after';
  axis: 'x' | 'y' | 'none';
  /** Absolute cell requested by a manual drop in a Grid while Dense is off. */
  gridColumn?: number;
  gridRow?: number;
}

export interface CanvasDragPayload {
  blockId: string;
  fieldKey: string;
}

export interface CanvasDropPoint {
  clientX: number;
  clientY: number;
}

export interface CanvasDropEvent {
  target: HTMLElement | null;
  payload: CanvasDragPayload;
  location: CanvasDropLocation;
}

/** Attach the standard Forge block drag payload to a rendered Canvas node. */
export function attachCanvasBlockDragSource(node: HTMLElement, blockId: string): void {
  node.addEventListener('dragstart', (event) => {
    // Nested Canvas controls (e.g. the Section selector handle) can cancel
    // their own native drag gesture without starting a block drag.
    if (event.defaultPrevented) return;
    const target = event.target as HTMLElement | null;
    if (node.classList.contains('is-resizing') || target?.closest('.statblock-forge__resize-handle')) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!event.dataTransfer) return;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(CANVAS_BLOCK_DRAG_TYPE, blockId);
    event.dataTransfer.setData('text/plain', `${BLOCK_DRAG_FALLBACK}${blockId}`);
    node.classList.add('is-dragging');
  });
  node.addEventListener('dragend', () => node.classList.remove('is-dragging'));
}

/** Attach the standard Forge Field drag payload to a Field palette chip. */
export function attachCanvasFieldDragSource(node: HTMLElement, fieldKey: string): void {
  node.addEventListener('dragstart', (event) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData(CANVAS_FIELD_DRAG_TYPE, fieldKey);
    event.dataTransfer.setData('text/plain', `${FIELD_DRAG_FALLBACK}${fieldKey}`);
    node.classList.add('is-dragging');
  });
  node.addEventListener('dragend', () => node.classList.remove('is-dragging'));
}

/** Read custom MIME payloads first, with text/plain fallbacks for WebViews. */
export function readCanvasDragPayload(dataTransfer: DataTransfer | null): CanvasDragPayload {
  if (!dataTransfer) return { blockId: '', fieldKey: '' };
  const blockId = dataTransfer.getData(CANVAS_BLOCK_DRAG_TYPE);
  const fieldKey = dataTransfer.getData(CANVAS_FIELD_DRAG_TYPE);
  if (blockId || fieldKey) return { blockId, fieldKey };

  const fallback = dataTransfer.getData('text/plain');
  if (fallback.startsWith(BLOCK_DRAG_FALLBACK)) {
    return { blockId: fallback.slice(BLOCK_DRAG_FALLBACK.length), fieldKey: '' };
  }
  if (fallback.startsWith(FIELD_DRAG_FALLBACK)) {
    return { blockId: '', fieldKey: fallback.slice(FIELD_DRAG_FALLBACK.length) };
  }
  return { blockId: '', fieldKey: '' };
}

function layoutSiblings(template: ForgeTemplate, parentId: string | null): ForgeBlock[] {
  if (!parentId) return template.layout.blocks;
  const parent = findLayoutBlock(template, parentId);
  return parent && Array.isArray(parent.blocks)
    ? parent.blocks.filter(isRecord) as ForgeBlock[]
    : [];
}

/** Read the concrete cell under the pointer from the browser-resolved Grid tracks. */
function gridCellAtPointer(grid: HTMLElement, point: CanvasDropPoint): { column: number; row: number } | null {
  const rect = grid.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return null;
  const geometry = readTemplateGridGeometry(grid);
  const cell = templateGridCellAtPoint(geometry, point.clientX, point.clientY);
  return cell;
}

function directGridParent(node: HTMLElement): HTMLElement | null {
  const parent = node.parentElement;
  return parent?.matches?.('.statblock-forge__preview-grid') ? parent : null;
}

/** Resolve a pointer location into an insertion point in the nested layout tree. */
export function resolveCanvasDropLocation(
  template: ForgeTemplate,
  target: HTMLElement | null,
  point: CanvasDropPoint,
): CanvasDropLocation {
  if (!target) {
    return { parentId: null, index: template.layout.blocks.length, position: 'append', axis: 'none' };
  }

  const blockId = target.dataset.blockId;
  const block = blockId ? findLayoutBlock(template, blockId) : null;
  if (!block || !blockId) {
    // Dropping on unused space inside a Grid is a real positional edit too;
    // resolve its owning Section from the Grid metadata instead of appending.
    if (target.matches?.('.statblock-forge__preview-grid')) {
      const parentId = target.dataset.parentId || null;
      const siblings = layoutSiblings(template, parentId);
      const cell = gridCellAtPointer(target, point);
      return {
        parentId,
        index: siblings.length,
        position: 'append',
        axis: 'none',
        ...(cell ? { gridColumn: cell.column, gridRow: cell.row } : {}),
      };
    }
    return { parentId: null, index: template.layout.blocks.length, position: 'append', axis: 'none' };
  }

  const rect = target.getBoundingClientRect();
  const ratioX = rect.width > 0 ? (point.clientX - rect.left) / rect.width : 0.5;
  const ratioY = rect.height > 0 ? (point.clientY - rect.top) / rect.height : 0.5;
  const isContainer = ['section', 'row', 'tabs'].includes(block.type) && Array.isArray(block.blocks);
  if (isContainer && ratioX > 0.22 && ratioX < 0.78 && ratioY > 0.22 && ratioY < 0.78) {
    return {
      parentId: block.id,
      index: Array.isArray(block.blocks) ? block.blocks.length : 0,
      position: 'inside',
      axis: 'none',
    };
  }

  const parentId = findLayoutParentId(template, block.id);
  const siblings = layoutSiblings(template, parentId);
  const targetIndex = siblings.findIndex((item) => item.id === block.id);
  // Grid drops use the closest edge, so left/right placement works as well as
  // top/bottom placement. Flex rows naturally prefer their horizontal edge.
  const horizontalDistance = Math.abs(ratioX - 0.5);
  const verticalDistance = Math.abs(ratioY - 0.5);
  const horizontal = horizontalDistance >= verticalDistance;
  const after = horizontal ? ratioX >= 0.5 : ratioY >= 0.5;
  const location: CanvasDropLocation = {
    parentId,
    index: Math.max(0, targetIndex + (after ? 1 : 0)),
    position: after ? 'after' : 'before',
    axis: horizontal ? 'x' : 'y',
  };
  // Only direct Grid children have independent x/y coordinates. Row children
  // use flex ordering and Tabs children represent tab Sections, so both keep
  // their existing before/after semantics.
  const grid = directGridParent(target);
  const cell = grid ? gridCellAtPointer(grid, point) : null;
  if (cell) {
    location.gridColumn = cell.column;
    location.gridRow = cell.row;
  }
  return location;
}

/** Find the first placed block that directly references a template Field. */
export function findFirstBlockForField(template: ForgeTemplate, fieldKey: string): ForgeBlock | null {
  const visit = (blocks: ForgeBlock[]): ForgeBlock | null => {
    for (const block of blocks) {
      if (block.field === fieldKey || (Array.isArray(block.fields) && block.fields.includes(fieldKey))) return block;
      if (Array.isArray(block.blocks)) {
        const found = visit(block.blocks.filter(isRecord) as ForgeBlock[]);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(template.layout.blocks);
}

function addFieldAtCanvasLocation(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  fieldKey: string,
  parentId: string | null,
  index: number,
  activeTabsById: Map<string, string>,
): ForgeBlock {
  const field = template.fields.find((item) => item.key === fieldKey);
  if (!field) throw new Error('Field not found.');

  const category = layout.fieldKinds?.[fieldKey];
  // Most categories are data families whose concrete Field type determines
  // the matching Canvas block. Metric remains a presentation preset that
  // intentionally overrides the normal Stat block for numeric Fields.
  const blockType = category === 'metric' ? 'metric' : FIELD_TO_BLOCK[field.type] ?? 'text';

  if (parentId) {
    const parent = findLayoutBlock(template, parentId);
    if (parent?.type === 'tabs') {
      const sectionBlock = addLayoutBlock(template, layout, 'section', null, parentId);
      sectionBlock.heading = field.label.trim() || field.key;
      moveLayoutBlockTo(template, sectionBlock.id, parentId, index);
      activeTabsById.set(parentId, sectionBlock.id);
      return addLayoutBlock(template, layout, blockType as LayoutBlockType, fieldKey, sectionBlock.id);
    }
  }

  const block = addLayoutBlock(template, layout, blockType as LayoutBlockType, fieldKey, parentId);
  moveLayoutBlockTo(template, block.id, parentId, index);
  return block;
}

function directSiblingArray(template: ForgeTemplate, parentId: string | null): ForgeBlock[] | null {
  if (!parentId) return template.layout.blocks;
  const parent = findLayoutBlock(template, parentId);
  if (parent?.type !== 'section' || !Array.isArray(parent.blocks)) return null;
  return parent.blocks as ForgeBlock[];
}

/**
 * Applies an explicit cell drop in sparse mode. The moved block is inserted
 * before the earliest block occupying the requested rectangle; later blocks
 * then follow the sparse collision rule and are pushed down in their columns.
 */
function applySparseGridPosition(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
  location: CanvasDropLocation,
): boolean {
  if (layout.dense || !Number.isSafeInteger(location.gridColumn) || !Number.isSafeInteger(location.gridRow)) return false;
  const destination = directSiblingArray(template, location.parentId);
  if (!destination) return false;
  const block = findLayoutBlock(template, blockId);
  if (!block) return false;

  const sourceParentId = findLayoutParentId(template, blockId);
  const source = directSiblingArray(template, sourceParentId);
  if (!source) return false;
  const sourceIndex = source.findIndex((item) => item.id === blockId);
  if (sourceIndex < 0) return false;

  const remainingDestination = destination.filter((item) => item.id !== blockId);
  const metadata = layout.blocks[blockId] ?? { span: 12, rows: 1, appearance: {} };
  // Nested Grids use the same global coordinate system as the root Grid.
  const columns = Math.max(4, Math.min(MAX_GRID_COLUMN_COUNT, layout.columns || DEFAULT_GRID_COLUMN_COUNT));
  const logicalSpan = Math.max(1, Math.min(GRID_COLUMN_COUNT, Number.isSafeInteger(metadata.span) ? metadata.span : GRID_COLUMN_COUNT));
  const span = Math.max(1, Math.min(columns, Math.round(logicalSpan * columns / GRID_COLUMN_COUNT)));
  const rows = Math.max(1, Math.min(MAX_BLOCK_ROWS, Number.isSafeInteger(metadata.rows) ? metadata.rows : 1));
  const column = Math.max(0, Math.min(columns - span, location.gridColumn as number));
  const row = Math.max(0, Math.min(MAX_GRID_ROWS - rows, location.gridRow as number));

  const placements = packPhysicalGrid(
    remainingDestination,
    { ...layout, dense: false },
    false,
    template.sample as Record<string, unknown> | undefined,
  );
  const placementById = new Map(placements.map((placement, index) => [placement.id, { ...placement, index }]));
  let firstCollision = -1;
  for (const sibling of remainingDestination) {
    const placement = placementById.get(sibling.id);
    if (!placement) continue;
    const overlaps = column < placement.x + placement.span
      && column + span > placement.x
      && row < placement.y + placement.rows
      && row + rows > placement.y;
    if (overlaps && (firstCollision < 0 || placement.index < firstCollision)) firstCollision = placement.index;
  }

  const desiredIndex = firstCollision >= 0
    ? firstCollision
    : Math.max(0, Math.min(remainingDestination.length, location.index));
  const sameParent = sourceParentId === location.parentId;
  const insertionArgument = desiredIndex + (sameParent && sourceIndex < desiredIndex ? 1 : 0);
  const alreadyAtIndex = sameParent && sourceIndex === desiredIndex;
  const moved = alreadyAtIndex || moveLayoutBlockTo(template, blockId, location.parentId, insertionArgument);
  if (!moved) return false;

  const stableMetadata = layout.blocks[blockId] ?? { span, rows, appearance: {} };
  layout.blocks[blockId] = {
    ...stableMetadata,
    anchorColumn: column,
    anchorRow: row,
    anchorColumns: columns,
  };
  packPhysicalGrid(
    directSiblingArray(template, location.parentId) ?? [],
    { ...layout, dense: false },
    false,
    template.sample as Record<string, unknown> | undefined,
  );
  return true;
}

/** Apply a resolved Canvas drop and return the block that should become selected. */
export function applyCanvasDrop(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  activeTabsById: Map<string, string>,
  payload: CanvasDragPayload,
  location: CanvasDropLocation,
): ForgeBlock | null {
  if (payload.blockId) {
    const previousParentId = findLayoutParentId(template, payload.blockId);
    if (applySparseGridPosition(template, layout, payload.blockId, location)) {
      return findLayoutBlock(template, payload.blockId);
    }
    const moved = moveLayoutBlockTo(template, payload.blockId, location.parentId, location.index);
    if (moved) {
      // Structural moves and Row/Tabs ordering still rebase only the affected
      // sibling groups. Direct Grid drops in sparse mode keep explicit cells.
      clearGridPlacementAnchors(layoutSiblings(template, previousParentId), layout);
      if (location.parentId !== previousParentId) {
        clearGridPlacementAnchors(layoutSiblings(template, location.parentId), layout);
      }
    }
    return findLayoutBlock(template, payload.blockId);
  }
  if (!payload.fieldKey) return null;

  const field = template.fields.find((item) => item.key === payload.fieldKey);
  if (!field) throw new Error('Field not found.');
  const existing = findFirstBlockForField(template, payload.fieldKey);
  if (existing && location.parentId && findLayoutBlock(template, location.parentId)?.type === 'tabs'
    && existing.type !== 'section') {
    const sectionBlock = addLayoutBlock(template, layout, 'section', null, location.parentId);
    sectionBlock.heading = field.label.trim() || field.key;
    moveLayoutBlockTo(template, sectionBlock.id, location.parentId, location.index);
    activeTabsById.set(location.parentId, sectionBlock.id);
    moveLayoutBlockTo(template, existing.id, sectionBlock.id, 0);
    return existing;
  }

  if (existing) {
    if (applySparseGridPosition(template, layout, existing.id, location)) return existing;
    const previousParentId = findLayoutParentId(template, existing.id);
    const moved = moveLayoutBlockTo(template, existing.id, location.parentId, location.index);
    if (moved) {
      clearGridPlacementAnchors(layoutSiblings(template, previousParentId), layout);
      if (location.parentId !== previousParentId) {
        clearGridPlacementAnchors(layoutSiblings(template, location.parentId), layout);
      }
    }
    return existing;
  }

  const added = addFieldAtCanvasLocation(
    template,
    layout,
    payload.fieldKey,
    location.parentId,
    location.index,
    activeTabsById,
  );
  applySparseGridPosition(template, layout, added.id, location);
  return added;
}

function closestBlockTarget(event: DragEvent): HTMLElement | null {
  const target = event.target as Element | null;
  return target && typeof target.closest === 'function'
    ? target.closest<HTMLElement>('[data-block-id]')
    : null;
}

function closestGridTarget(event: DragEvent): HTMLElement | null {
  const target = event.target as Element | null;
  return target && typeof target.closest === 'function'
    ? target.closest<HTMLElement>('.statblock-forge__preview-grid')
    : null;
}

/** Attach Canvas drop-zone feedback and dispatch resolved drops to the view. */
export function attachTemplateCanvasDropZone(
  dropzone: HTMLElement,
  template: ForgeTemplate,
  onDrop: (drop: CanvasDropEvent) => void,
): () => void {
  let highlighted: HTMLElement | null = null;

  const clearHighlight = (): void => {
    highlighted?.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after', 'is-drop-inside');
    if (highlighted) {
      delete highlighted.dataset.dropPosition;
      delete highlighted.dataset.dropAxis;
    }
    highlighted = null;
    dropzone.classList.remove('is-drop-active');
  };

  const handleDragOver = (event: DragEvent): void => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = Array.from(event.dataTransfer.types).includes(CANVAS_BLOCK_DRAG_TYPE)
        ? 'move'
        : 'copy';
    }
    const target = closestBlockTarget(event);
    const gridTarget = target ? null : closestGridTarget(event);
    if (highlighted && highlighted !== target) {
      highlighted.classList.remove('is-drop-target', 'is-drop-before', 'is-drop-after', 'is-drop-inside');
      delete highlighted.dataset.dropPosition;
      delete highlighted.dataset.dropAxis;
    }
    highlighted = target;
    if (highlighted) {
      const location = resolveCanvasDropLocation(template, highlighted, event);
      highlighted.dataset.dropPosition = location.position;
      highlighted.dataset.dropAxis = location.axis;
      highlighted.classList.add('is-drop-target', `is-drop-${location.position}`);
    }
    dropzone.classList.toggle('is-drop-active', !target && !gridTarget);
  };

  const handleDragLeave = (event: DragEvent): void => {
    if (event.relatedTarget instanceof Node && dropzone.contains(event.relatedTarget)) return;
    clearHighlight();
  };

  const handleDrop = (event: DragEvent): void => {
    event.preventDefault();
    const target = closestBlockTarget(event);
    const gridTarget = target ? null : closestGridTarget(event);
    clearHighlight();
    const payload = readCanvasDragPayload(event.dataTransfer);
    if (!payload.blockId && !payload.fieldKey) return;
    if (payload.blockId && target?.dataset.blockId === payload.blockId) return;
    const location = resolveCanvasDropLocation(template, target ?? gridTarget, event);
    onDrop({ target, payload, location });
  };

  dropzone.addEventListener('dragover', handleDragOver);
  dropzone.addEventListener('dragleave', handleDragLeave);
  dropzone.addEventListener('drop', handleDrop);

  return () => {
    dropzone.removeEventListener('dragover', handleDragOver);
    dropzone.removeEventListener('dragleave', handleDragLeave);
    dropzone.removeEventListener('drop', handleDrop);
    clearHighlight();
  };
}
