import type { App, Component } from 'obsidian';
/**
 * Canvas preview composition for the Forge template editor.
 *
 * This module owns the visual surface only: the canonical statblock preview,
 * Grid guide overlay, restored Tabs selection, and empty-canvas placeholder.
 * The FileView coordinator continues to own toolbar state and interactive
 * drag/drop/resize handlers, supplied through a narrow callback.
 */
import { renderStatblockPreview } from '../render/statblockPreviewRenderer.ts';
import type { ScoreTableEdit } from '../templates/tableEditorModel.ts';
import type { ForgeLayoutDocument, ForgeTemplate } from '../templates/forgeTemplate.ts';
import type { ForgeLanguage } from '../i18n/localization.ts';
import { el } from './templateEditorDom.ts';
import { normalizeForgeSheetWidth } from '../templates/sheetWidth.ts';
import { readTemplateGridGeometry } from './templateGridGeometry.ts';

export interface TemplateCanvasSurfaceOptions {
  app: App;
  markdownComponent: Component;
  sourcePath?: string;
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  language: ForgeLanguage;
  resolveImage(path: string): string | undefined;
  onScoreTableEdit(blockId: string, edit: ScoreTableEdit): void;
  onImageFieldAction(fieldKey: string, socket: HTMLButtonElement): void;
  onImageBlockSelect(blockId: string): void;
  activeTabsById: ReadonlyMap<string, string>;
  expandedSectionIds: Set<string>;
  collapsedSectionIds: Set<string>;
  showGrid: boolean;
  attachInteractions(dropzone: HTMLElement, card: HTMLElement): void;
}

/** Restore the active tab buttons and panels after the preview renderer rebuilds the Canvas. */
export function restoreTemplateCanvasTabs(
  card: HTMLElement,
  activeTabsById: ReadonlyMap<string, string>,
): void {
  for (const [tabsId, activeTabId] of activeTabsById) {
    const tabsNode = Array.from(card.querySelectorAll<HTMLElement>('[data-block-id]'))
      .find((item) => item.dataset.blockId === tabsId);
    if (!tabsNode) continue;

    const tabs = Array.from(tabsNode.querySelectorAll<HTMLElement>('[data-tabs-block-id]'))
      .filter((item) => item.dataset.tabsBlockId === tabsId);
    if (!tabs.some((item) => item.dataset.tabBlockId === activeTabId)) continue;

    for (const tab of tabs) {
      const active = tab.dataset.tabBlockId === activeTabId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    }

    const panels = Array.from(tabsNode.querySelectorAll<HTMLElement>('[data-tab-panel-id]'))
      .filter((item) => item.dataset.tabsBlockId === tabsId);
    for (const panel of panels) panel.hidden = panel.dataset.tabPanelId !== activeTabId;
  }
}

function stylePixels(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Copy the Grid's resolved browser geometry into its overlay, rather than
 * recreating the 1fr calculation in a second independent CSS Grid. */
function syncCanvasGridOverlay(grid: HTMLElement, overlay: HTMLElement): void {
  const computed = grid.ownerDocument.defaultView?.getComputedStyle(grid);
  if (!computed) return;

  const geometry = readTemplateGridGeometry(grid);
  const paddingLeft = stylePixels(computed.paddingLeft);
  const paddingRight = stylePixels(computed.paddingRight);
  const paddingTop = stylePixels(computed.paddingTop);
  const paddingBottom = stylePixels(computed.paddingBottom);

  // An absolutely-positioned child uses the parent's padding box as its
  // containing block. Insets therefore begin at the content box after padding.
  overlay.style.left = `${paddingLeft}px`;
  overlay.style.right = `${paddingRight}px`;
  overlay.style.top = `${paddingTop}px`;
  overlay.style.bottom = `${paddingBottom}px`;
  overlay.style.setProperty('--forge-grid-overlay-row-height', `${geometry.rowHeight}px`);
  overlay.style.setProperty('--forge-grid-overlay-row-gap', `${geometry.rowGap}px`);
  const rowBoundary = geometry.rowGap > 0
    ? geometry.rowHeight + geometry.rowGap / 2
    : Math.max(0, geometry.rowHeight - 0.5);
  overlay.style.setProperty('--forge-grid-overlay-row-boundary', `${rowBoundary}px`);
  overlay.style.setProperty('--forge-grid-overlay-column-half-gap-negative', `${-geometry.columnGap / 2}px`);

  // Keep the column guides tied to the resolved track count instead of
  // assuming that a previously rendered overlay is still up to date. Query
  // by role because nested Grids also receive explicit row-guide elements.
  let columns = Array.from(overlay.querySelectorAll<HTMLElement>(
    ':scope > .statblock-forge__canvas-grid-column',
  ));
  while (columns.length < geometry.columnWidths.length) {
    const column = grid.ownerDocument.createElement('span');
    column.className = 'statblock-forge__canvas-grid-column';
    overlay.append(column);
    columns.push(column);
  }
  while (columns.length > geometry.columnWidths.length) {
    columns.pop()?.remove();
  }
  let cursor = 0;
  for (let index = 0; index < geometry.columnWidths.length; index += 1) {
    const column = columns[index];
    if (!column) continue;
    const width = geometry.columnWidths[index] ?? 0;
    column.style.left = `${cursor}px`;
    column.style.width = `${width}px`;
    cursor += width + (index < geometry.columnWidths.length - 1 ? geometry.columnGap : 0);
  }

  // The main Canvas keeps a continuous, high-level grid. Grids that belong to
  // Sections/Tab content use short dashed row guides so they read as local
  // block grids rather than a continuation of the page-wide coordinate grid.
  if (overlay.classList.contains('is-block-grid-overlay')) {
    const rowPitch = Math.max(1, geometry.rowHeight + geometry.rowGap);
    const overlayHeight = Math.max(0, grid.clientHeight - paddingTop - paddingBottom);
    const rowPositions: number[] = [];
    for (let top = rowBoundary; top < overlayHeight; top += rowPitch) rowPositions.push(top);
    let rows = Array.from(overlay.querySelectorAll<HTMLElement>(
      ':scope > .statblock-forge__canvas-grid-row',
    ));
    while (rows.length < rowPositions.length) {
      const row = grid.ownerDocument.createElement('span');
      row.className = 'statblock-forge__canvas-grid-row';
      overlay.append(row);
      rows.push(row);
    }
    while (rows.length > rowPositions.length) rows.pop()?.remove();
    rows.forEach((row, index) => { row.style.top = `${rowPositions[index] ?? 0}px`; });
  }

  overlay.style.visibility = geometry.contentWidth > 0 ? 'visible' : 'hidden';
}

/** Keep all guide positions exact when the Canvas is resized, Dense changes
 * gaps, or the root's shared square-row measurement updates nested Grids. */
function observeCanvasGridGeometry(
  card: HTMLElement,
  entries: ReadonlyArray<{ grid: HTMLElement; overlay: HTMLElement }>,
): void {
  const view = card.ownerDocument.defaultView;
  let frame: number | null = null;
  let disconnected = false;
  let resizeObserver: ResizeObserver | undefined;
  let mutationObserver: MutationObserver | undefined;

  const disconnect = (): void => {
    if (disconnected) return;
    disconnected = true;
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    if (frame !== null && view) view.cancelAnimationFrame(frame);
    frame = null;
  };

  const sync = (): void => {
    frame = null;
    if (!card.isConnected) {
      disconnect();
      return;
    }
    for (const entry of entries) syncCanvasGridOverlay(entry.grid, entry.overlay);
  };

  const schedule = (): void => {
    if (disconnected || frame !== null) return;
    if (view?.requestAnimationFrame) frame = view.requestAnimationFrame(sync);
    else sync();
  };

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(schedule);
    for (const { grid } of entries) resizeObserver.observe(grid);
  }
  if (typeof MutationObserver !== 'undefined') {
    mutationObserver = new MutationObserver((records) => {
      // Ignore selection/drag styling on blocks. Only Grid changes can alter
      // the resolved tracks copied into the background guides.
      if (records.some((record) => (record.target as Element).classList?.contains('statblock-forge__preview-grid'))) {
        schedule();
      }
    });
    mutationObserver.observe(card, {
      attributes: true,
      subtree: true,
      attributeFilter: ['class', 'style', 'data-column-count'],
    });
  }
  schedule();
}

/** Build the visible Canvas surface while leaving interactions with the FileView coordinator. */
export function renderTemplateCanvasSurface(options: TemplateCanvasSurfaceOptions): HTMLElement {
  const {
    app,
    markdownComponent,
    sourcePath,
    template,
    layout,
    language,
    resolveImage,
    onScoreTableEdit,
    onImageFieldAction,
    onImageBlockSelect,
    activeTabsById,
    expandedSectionIds,
    collapsedSectionIds,
    showGrid,
    attachInteractions,
  } = options;
  const dropzone = el('div', 'statblock-forge__canvas-dropzone');
  const card = renderStatblockPreview({
    app,
    markdownComponent,
    sourcePath,
    template,
    layout,
    language,
    resolveImage,
    onScoreTableEdit,
    onImageFieldAction,
    onImageBlockSelect,
    interactiveCounters: true,
    // Authors see the same footer controls for collapsed Sections as players,
    // but still retain access to Fields marked Hidden in the editor.
    foldSectionsIntoFooter: true,
    expandedSectionIds,
    collapsedSectionIds,
  });
  card.classList.add('statblock-forge__canvas-sheet');
  card.style.setProperty('--statblock-forge-sheet-width', `${normalizeForgeSheetWidth(layout.sheetWidth)}px`);

  if (showGrid) {
    // Every Section owns an independent Grid with the template's configured
    // track count. Draw guides on each
    // actual Grid instead of only over the root Canvas, so nested blocks use
    // the same visual coordinate system as their own placement calculations.
    // Tabs' outer panels only contain a full-width Section wrapper; the real
    // editable Grid is inside that Section, so avoid drawing a redundant layer.
    const grids = Array.from(card.querySelectorAll<HTMLElement>(
      '.statblock-forge__preview-grid:not(.statblock-forge__preview-tab-panel):not(.is-row)',
    ));
    const overlays: Array<{ grid: HTMLElement; overlay: HTMLElement }> = [];
    for (const grid of grids) {
      grid.classList.add('has-canvas-grid-overlay');
      const gridOverlay = el(
        'div',
        `statblock-forge__canvas-grid-overlay ${grid.classList.contains('is-root') ? 'is-main-grid-overlay' : 'is-block-grid-overlay'}`,
      );
      gridOverlay.setAttribute('aria-hidden', 'true');
      const geometry = readTemplateGridGeometry(grid);
      for (let column = 0; column < geometry.columns; column += 1) {
        gridOverlay.append(el('span', 'statblock-forge__canvas-grid-column'));
      }
      grid.prepend(gridOverlay);
      overlays.push({ grid, overlay: gridOverlay });
    }
    observeCanvasGridGeometry(card, overlays);
  }

  restoreTemplateCanvasTabs(card, activeTabsById);
  dropzone.append(card);
  attachInteractions(dropzone, card);

  if (template.layout.blocks.length === 0) {
    dropzone.classList.add('is-empty');
    dropzone.setAttribute(
      'aria-label',
      'Empty canvas.',
    );
    const empty = el('div', 'statblock-forge__canvas-empty');
    empty.append(el('strong', '', 'No blocks placed'));
    dropzone.append(empty);
  }

  return dropzone;
}
