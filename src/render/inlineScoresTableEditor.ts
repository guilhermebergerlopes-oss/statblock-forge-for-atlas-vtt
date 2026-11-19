import { scorePreviewGrid } from './previewValueModel.ts';
import type { ForgeField, JsonRecord } from '../templates/forgeTemplate.ts';
import {
  INLINE_SCORES_MAX_COLUMNS,
  INLINE_SCORES_MAX_ROWS,
  parseInlineScoresClipboard,
  updateInlineScoresTableValue,
  type InlineScoresTableEdit,
} from '../statblocks/inlineScoresTableModel.ts';
import {
  inlineScoresCellMenu,
  inlineScoresColumnHandleMenu,
  inlineScoresRowMenu,
} from '../statblocks/inlineScoresTableMenuModel.ts';
import { openInlineScoresTableContextMenu } from './inlineScoresTableContextMenu.ts';
import { appendForgeStatblockDiceText } from './statblockDiceLinkElement.ts';

export interface InlineScoresTableRuntime {
  readonly isSaving: boolean;
  readonly language: 'en' | 'pt-BR';
  setBaseValue(fieldKey: string, value: unknown): Promise<void>;
  subscribeAll(update: () => void): void;
  navigate(fieldKey: string, step: 1 | -1): Promise<void>;
}

export interface InlineScoresDerivedColumn {
  label: string;
  values: string[];
}

export interface InlineScoresTableOptions {
  field: ForgeField;
  sample: JsonRecord;
  signed: boolean;
  runtime: InlineScoresTableRuntime;
  look?: 'grid' | 'lines';
  perLine?: number;
  /** Whole-number cells roll as bonuses when the Scores block opts in. */
  rollable?: boolean;
  /** Calculated cells may be rollable independently for migrated legacy Table blocks. */
  derivedRollable?: boolean;
  derived?: () => InlineScoresDerivedColumn[];
}

interface CellAt {
  row: number;
  column: number;
}

interface TableSelection {
  axis: 'row' | 'column';
  index: number;
}

interface ActiveCell extends CellAt {
  initial: string;
  input: HTMLTextAreaElement | null;
}

type CaretStart = 'all' | 'start' | 'end' | number;

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function sameCell(a: CellAt | null, b: CellAt): boolean {
  return a !== null && a.row === b.row && a.column === b.column;
}

function cellText(value: unknown, signed: boolean): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && Number.isFinite(value)) return signed && value > 0 ? `+${value}` : String(value);
  return String(value);
}

function editText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function selectedCell(selected: TableSelection | null, row: number, column: number, rowCount: number, columnCount: number): string {
  if (!selected) return '';
  const matches = selected.axis === 'row' ? selected.index === row : selected.index === column;
  if (!matches) return '';
  const rowSelected = selected.axis === 'row';
  const columnSelected = selected.axis === 'column';
  const top = rowSelected || row === -1 || row === 0;
  const bottom = rowSelected || row === rowCount - 1;
  const start = rowSelected || columnSelected || column === 0;
  const end = rowSelected || columnSelected || column === columnCount - 1;
  return ` is-selected${top ? ' is-top' : ''}${bottom ? ' is-bottom' : ''}${start ? ' is-start' : ''}${end ? ' is-end' : ''}`;
}

function parseCellAddress(target: EventTarget | null, frame: HTMLElement): CellAt | null {
  const candidate = target instanceof Element ? target.closest<HTMLElement>('[data-table-row][data-table-col]') : null;
  if (!candidate || !frame.contains(candidate)) return null;
  const row = Number(candidate.dataset.tableRow);
  const column = Number(candidate.dataset.tableCol);
  return Number.isInteger(row) && Number.isInteger(column) ? { row, column } : null;
}

function caretInCell(event: MouseEvent, cell: HTMLElement | null, textLength: number): CaretStart {
  if (!cell) return 'end';
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const position = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = position ? null : doc.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = position?.offsetNode ?? range?.startContainer ?? null;
  const offset = position?.offset ?? range?.startOffset ?? textLength;
  if (!node || node.nodeType !== Node.TEXT_NODE || !cell.contains(node)) return 'end';
  return Math.max(0, Math.min(textLength, offset));
}

function readCell(grid: ReturnType<typeof scorePreviewGrid>, at: CellAt): unknown {
  return at.row === -1 ? grid.columns[at.column] : grid.rows[at.row]?.[at.column];
}

function walkCells(grid: ReturnType<typeof scorePreviewGrid>, headerEditable: boolean): CellAt[] {
  const result: CellAt[] = [];
  if (grid.header && headerEditable) grid.columns.forEach((_column, column) => result.push({ row: -1, column }));
  grid.rows.forEach((row, rowIndex) => row.forEach((_cell, column) => result.push({ row: rowIndex, column })));
  return result;
}

function nextCell(grid: ReturnType<typeof scorePreviewGrid>, at: CellAt, step: 1 | -1, headerEditable: boolean): CellAt | null {
  const cells = walkCells(grid, headerEditable);
  const index = cells.findIndex((cell) => sameCell(at, cell));
  return index < 0 ? null : cells[index + step] ?? null;
}

function cellOver(grid: ReturnType<typeof scorePreviewGrid>, at: CellAt, step: 1 | -1, headerEditable: boolean): CellAt | null {
  const headerRow = grid.header && headerEditable ? -1 : 0;
  const row = at.row + step;
  if (row < headerRow || row >= grid.rows.length) return null;
  return { row, column: at.column };
}

function cellBeside(grid: ReturnType<typeof scorePreviewGrid>, at: CellAt, step: 1 | -1): CellAt | null {
  const column = at.column + step;
  if (column < 0 || column >= grid.columns.length) return null;
  return { row: at.row, column };
}

function atVerticalEdge(input: HTMLTextAreaElement, step: 1 | -1): boolean {
  const lineHeight = Number.parseFloat(getComputedStyle(input).lineHeight) || input.clientHeight || 1;
  if (input.scrollHeight <= lineHeight * 1.5) return true;
  return step < 0 ? input.selectionStart === 0 : input.selectionEnd === input.value.length;
}

/**
 * Atlas-like live editor for a Scores grid. The input occupies the table cell
 * itself; the table remains mounted in the same position and writes only when
 * a cell is left, pasted, or a table command is completed.
 */
export function renderInlineScoresTable(options: InlineScoresTableOptions): HTMLElement {
  const { field, sample, runtime, signed } = options;
  const wrapper = node('div', 'statblock-forge__preview-scores atlas-sb-sheet-table is-editable');
  const actions = node('div', 'statblock-forge__inline-scores-table-actions');
  const room = node('div', 'atlas-sb-sheet-table__room');
  const frame = node('div', 'atlas-sb-sheet-table__frame');
  frame.tabIndex = -1;
  frame.setAttribute('data-table-live', '');
  frame.dataset.forgeTableField = field.key;
  frame.setAttribute('role', options.look === 'lines' ? 'group' : 'grid');
  frame.setAttribute('aria-label', field.label || field.key);
  room.append(frame);
  wrapper.append(actions, room);

  const rowsAllowed = field.addRows !== false;
  const columnsAllowed = field.addColumns !== false;
  let active: ActiveCell | null = null;
  let selected: TableSelection | null = null;
  let pendingCommit: Promise<boolean> | null = null;
  let navigating = false;
  let writing = false;
  let refreshPending = false;
  let closeContextMenu: (() => void) | null = null;

  const grid = (): ReturnType<typeof scorePreviewGrid> => scorePreviewGrid(sample[field.key], field);
  const focusBlock = (): void => {
    const block = frame.closest<HTMLElement>('.atlas-sb-item[data-block-id]');
    if (block) block.focus({ preventScroll: true });
    else frame.focus({ preventScroll: true });
  };

  const setValue = async (edit: InlineScoresTableEdit): Promise<boolean> => {
    if (runtime.isSaving) return false;
    const current = sample[field.key];
    const next = updateInlineScoresTableValue(current, field, edit);
    if (Object.is(current, next)) return false;
    writing = true;
    try {
      await runtime.setBaseValue(field.key, next);
      return true;
    } finally {
      writing = false;
      if (refreshPending) refreshPending = false;
    }
  };

  const draw = (): void => {
    closeContextMenu?.();
    closeContextMenu = null;
    const current = grid();
    frame.replaceChildren();
    actions.replaceChildren();
    frame.classList.toggle('has-selection', selected !== null);
    const table = node('table', 'statblock-forge__preview-score-table atlas-sb-sheet-table__grid');
    table.setAttribute('aria-label', field.label || field.key);
    const derived = options.derived?.() ?? [];
    const derivedCount = derived.length;
    const headerEditable = columnsAllowed && options.look !== 'lines';

    const addColumnHandle = (cell: HTMLTableCellElement, column: number): void => {
      if (!columnsAllowed && !rowsAllowed) return;
      const handle = node('button', 'atlas-sb-sheet-table__handle atlas-sb-sheet-table__handle--column', '↕');
      handle.type = 'button';
      handle.tabIndex = -1;
      handle.dataset.tableHandle = 'column';
      handle.dataset.index = String(column);
      handle.setAttribute('aria-label', `${runtime.language === 'pt-BR' ? 'Selecionar coluna' : 'Select column'} ${column + 1}`);
      if (selected?.axis === 'column' && selected.index === column) handle.dataset.selected = 'true';
      handle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void commitActive().then((saved) => {
          if (!saved) return;
          selected = { axis: 'column', index: column };
          draw();
          frame.focus({ preventScroll: true });
        });
      });
      cell.append(handle);
    };

    const addRowHandle = (cell: HTMLTableCellElement, row: number): void => {
      if (!rowsAllowed) return;
      const handle = node('button', 'atlas-sb-sheet-table__handle atlas-sb-sheet-table__handle--row', '⋮');
      handle.type = 'button';
      handle.tabIndex = -1;
      handle.dataset.tableHandle = 'row';
      handle.dataset.index = String(row);
      handle.setAttribute('aria-label', `${runtime.language === 'pt-BR' ? 'Selecionar linha' : 'Select row'} ${row + 1}`);
      if (selected?.axis === 'row' && selected.index === row) handle.dataset.selected = 'true';
      handle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void commitActive().then((saved) => {
          if (!saved) return;
          selected = { axis: 'row', index: row };
          draw();
          frame.focus({ preventScroll: true });
        });
      });
      cell.append(handle);
    };

    const makeCell = (tag: 'th' | 'td', at: CellAt, text: string, align: string, canType: boolean): HTMLTableCellElement => {
      const atlasCellClass = tag === 'th'
        ? 'atlas-sb-sheet-table__name'
        : `atlas-sb-sheet-table__cell${options.look === 'lines' ? ' atlas-sb-score' : ''}`;
      const cell = node(tag, `${tag === 'th' ? 'statblock-forge__preview-score-header' : 'statblock-forge__preview-score-cell'} ${atlasCellClass}${selectedCell(selected, at.row, at.column, current.rows.length, current.columns.length)}`);
      cell.dataset.tableRow = String(at.row);
      cell.dataset.tableCol = String(at.column);
      cell.setAttribute('role', at.row < 0 ? 'columnheader' : 'gridcell');
      if (tag === 'th') cell.scope = 'col';
      if (align === 'center' || align === 'end') cell.style.textAlign = align === 'end' ? 'right' : 'center';
      const typing = node('span', 'atlas-sb-sheet-table__typing');
      const editing = active;
      if (editing && sameCell(editing, at) && canType) {
        cell.classList.add('is-typing');
        const input = node('textarea', 'atlas-sb-sheet-table__input atlas-sb-pane-input');
        input.rows = 1;
        input.value = editing.initial;
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.setAttribute('aria-label', at.row < 0
          ? `${field.label || field.key}, ${runtime.language === 'pt-BR' ? 'cabeçalho' : 'column name'} ${at.column + 1}`
          : `${field.label || field.key}, ${at.row + 1}:${at.column + 1}`);
        const sizer = node('span', 'atlas-sb-sheet-table__sizer');
        sizer.textContent = `${input.value}\u200b`;
        typing.append(sizer, input);
        editing.input = input;
        input.addEventListener('input', () => {
          sizer.textContent = `${input.value}\u200b`;
          input.style.height = 'auto';
          input.style.height = `${Math.max(input.scrollHeight, 20)}px`;
        });
        input.addEventListener('keydown', (event) => {
          if (event.isComposing) return;
          if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
            event.preventDefault();
            event.stopPropagation();
            const rect = input.getBoundingClientRect();
            void openTableMenu(at, { x: rect.left, y: rect.bottom });
            return;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            active = null;
            draw();
            focusBlock();
            return;
          }
          if (event.key === 'Tab') {
            const step: 1 | -1 = event.shiftKey ? -1 : 1;
            const next = nextCell(grid(), at, step, headerEditable);
            if (next) {
              event.preventDefault();
              event.stopPropagation();
              void navigateTo(next, event.shiftKey ? 'end' : 'start');
            } else if (step > 0 && rowsAllowed && options.look !== 'lines' && at.row >= 0
              && grid().rows.length < INLINE_SCORES_MAX_ROWS) {
              event.preventDefault();
              event.stopPropagation();
              void insertRowAndOpen(grid().rows.length, 0);
            } else {
              // Match Atlas EditableTable: leave the current cell and hand the
              // next/previous Field to the shared pane navigation controller.
              event.preventDefault();
              event.stopPropagation();
              void commitActive().then((saved) => {
                if (saved) return runtime.navigate(field.key, step);
                return undefined;
              });
            }
            return;
          }
          if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            event.stopPropagation();
            const step: 1 | -1 = event.shiftKey ? -1 : 1;
            const next = options.look === 'lines'
              ? cellBeside(grid(), at, step)
              : cellOver(grid(), at, step, headerEditable);
            if (next) void navigateTo(next, event.shiftKey ? 'end' : 'start');
            else if (step > 0 && rowsAllowed && options.look !== 'lines' && at.row >= 0
              && grid().rows.length < INLINE_SCORES_MAX_ROWS) void insertRowAndOpen(at.row + 1, at.column);
            else if (step > 0) void finishAndFocus();
            return;
          }
          if (event.key.startsWith('Arrow') && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey
            && input.selectionStart === input.selectionEnd) {
            const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
            if (!vertical && options.look === 'lines') return;
            const step: 1 | -1 = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
            const atEdge = vertical
              ? atVerticalEdge(input, step)
              : (step < 0 ? input.selectionStart === 0 : input.selectionEnd === input.value.length);
            if (atEdge) {
              const next = options.look === 'lines'
                ? cellBeside(grid(), at, step)
                : vertical ? cellOver(grid(), at, step, headerEditable) : cellBeside(grid(), at, step);
              if (next) {
                event.preventDefault();
                event.stopPropagation();
                void navigateTo(next, step < 0 ? 'end' : 'start');
              }
            }
            return;
          }
        });
        input.addEventListener('paste', (event) => {
          const cells = parseInlineScoresClipboard(event.clipboardData?.getData('text/plain') ?? '');
          if (!cells) return;
          event.preventDefault();
          event.stopPropagation();
          void commitActive().then(async (saved) => {
            if (!saved) return;
            const targetRow = at.row < 0 ? 0 : at.row;
            const didPaste = await setValue({ type: 'paste', row: targetRow, column: at.column, cells });
            if (didPaste) draw();
          });
        });
        input.addEventListener('blur', () => {
          if (navigating) return;
          queueMicrotask(() => {
            if (navigating || !active || !sameCell(active, at)) return;
            if (frame.contains(document.activeElement)) return;
            void commitActive();
          });
        });
      } else {
        const rest = node('span', 'atlas-sb-sheet-table__rest');
        if (at.row >= 0 && options.rollable) {
          const rollName = current.columns[at.column]?.trim();
          if (rollName) cell.dataset.rollName = rollName;
        }
        if (at.row >= 0) appendForgeStatblockDiceText(rest, text, options.rollable === true);
        else rest.textContent = text || '\u200b';
        typing.append(rest);
      }
      cell.append(typing);
      return cell;
    };

    if (options.look === 'lines' && current.rows.length > 0) {
      const lines = node('div', `statblock-forge__preview-score-lines atlas-sb-scores atlas-sb-scores--table${current.rows.length > 1 ? ' is-records' : ''}`);
      const itemCount = current.rows.length > 1 ? current.rows.length : current.columns.length;
      const perLine = Math.max(1, Math.min(itemCount, Math.floor(Number(options.perLine) || 1)));
      lines.style.gridTemplateColumns = `repeat(${perLine}, minmax(0, 1fr))`;

      const appendRecord = (rowIndex: number, columnIndexes: number[], record?: boolean): void => {
        const linesTable = node('table', 'statblock-forge__preview-score-lines-table atlas-sb-score-group');
        if (derived.some((column) => column.label)) {
          const head = node('thead');
          const headerRow = node('tr');
          headerRow.append(node('td', 'statblock-forge__preview-score-corner', ''), node('td', 'statblock-forge__preview-score-corner', ''));
          derived.forEach((column) => headerRow.append(node('th', 'statblock-forge__preview-score-derived-heading', column.label)));
          head.append(headerRow);
          linesTable.append(head);
        }
        const body = node('tbody');
        columnIndexes.forEach((columnIndex) => {
          const row = node('tr');
          const label = node('th', 'atlas-sb-score-label', current.columns[columnIndex] || `${runtime.language === 'pt-BR' ? 'Coluna' : 'Column'} ${columnIndex + 1}`);
          label.scope = 'row';
          addColumnHandle(label, columnIndex);
          const cell = makeCell('td', { row: rowIndex, column: columnIndex }, cellText(current.rows[rowIndex]?.[columnIndex], signed), current.align[columnIndex] ?? 'start', true);
          if (columnIndex === 0) addRowHandle(cell, rowIndex);
          row.append(label, cell);
          derived.forEach((column) => {
            const derivedCell = node('td', 'statblock-forge__preview-score-derived atlas-sb-score-column');
            const value = column.values[columnIndex] || '—';
            const rollName = current.columns[columnIndex]?.trim();
            if ((options.derivedRollable ?? options.rollable === true) && rollName) derivedCell.dataset.rollName = rollName;
            const content = node('span', '');
            appendForgeStatblockDiceText(content, value, options.derivedRollable ?? options.rollable === true);
            derivedCell.append(content);
            row.append(derivedCell);
          });
          body.append(row);
        });
        linesTable.append(body);
        if (record) linesTable.classList.add('is-record');
        lines.append(linesTable);
      };

      if (current.rows.length === 1) {
        const groups = Array.from({ length: perLine }, (_item, groupIndex) =>
          current.columns.map((_column, index) => index).filter((index) => index % perLine === groupIndex));
        groups.forEach((indices) => appendRecord(0, indices));
      } else {
        current.rows.forEach((_row, rowIndex) => {
          appendRecord(rowIndex, current.columns.map((_column, index) => index), true);
        });
      }
      frame.append(lines);
    } else {
      if (current.header && current.columns.length > 0) {
        const head = node('thead');
        const row = node('tr');
        current.columns.forEach((column, columnIndex) => {
          const cell = makeCell('th', { row: -1, column: columnIndex }, column || `Column ${columnIndex + 1}`, current.align[columnIndex] ?? 'start', headerEditable);
          if (!column) cell.classList.add('is-unnamed');
          addColumnHandle(cell, columnIndex);
          row.append(cell);
        });
        if (derivedCount > 0) for (const column of derived) row.append(node('th', 'statblock-forge__preview-score-derived-heading', column.label));
        head.append(row);
        table.append(head);
      }

      const body = node('tbody');
      current.rows.forEach((dataRow, rowIndex) => {
        const row = node('tr');
        current.columns.forEach((_column, columnIndex) => {
          const cell = makeCell('td', { row: rowIndex, column: columnIndex }, cellText(dataRow[columnIndex], signed), current.align[columnIndex] ?? 'start', true);
          if (columnIndex === 0) addRowHandle(cell, rowIndex);
          if (!current.header && rowIndex === 0) addColumnHandle(cell, columnIndex);
          row.append(cell);
        });
        if (derivedCount > 0) {
          derived.forEach((column, columnIndex) => {
            const derivedCell = node('td', 'statblock-forge__preview-score-derived');
            const value = column.values[rowIndex] || '—';
            const rollName = current.columns[columnIndex]?.trim();
            if ((options.derivedRollable ?? options.rollable === true) && rollName) derivedCell.dataset.rollName = rollName;
            const content = node('span', '');
            appendForgeStatblockDiceText(content, value, options.derivedRollable ?? options.rollable === true);
            derivedCell.append(content);
            row.append(derivedCell);
          });
        }
        body.append(row);
      });
      table.append(body);
      frame.append(table);

    }
    if (rowsAllowed) {
      const addRow = node('button', 'statblock-forge__inline-scores-table-action', runtime.language === 'pt-BR' ? '＋ Adicionar linha' : '＋ Add row');
      addRow.type = 'button';
      addRow.disabled = current.rows.length >= INLINE_SCORES_MAX_ROWS;
      addRow.addEventListener('click', () => { void insertRowAndOpen(grid().rows.length, 0); });
      actions.append(addRow);
    }
    if (columnsAllowed) {
      const addColumn = node('button', 'statblock-forge__inline-scores-table-action', runtime.language === 'pt-BR' ? '＋ Adicionar coluna' : '＋ Add column');
      addColumn.type = 'button';
      addColumn.disabled = current.columns.length >= INLINE_SCORES_MAX_COLUMNS;
      addColumn.addEventListener('click', () => { void insertColumnAndOpen(grid().columns.length); });
      actions.append(addColumn);
    }
    actions.hidden = actions.childElementCount === 0;

    if (options.look === 'lines') {
      frame.removeAttribute('aria-rowcount');
      frame.removeAttribute('aria-colcount');
    } else {
      frame.setAttribute('aria-rowcount', String(current.rows.length + (current.header ? 1 : 0)));
      frame.setAttribute('aria-colcount', String(current.columns.length + derivedCount));
    }
  };

  const commitActive = (): Promise<boolean> => {
    if (!active) return Promise.resolve(true);
    if (pendingCommit) return pendingCommit;
    const target = active;
    const input = target.input;
    const text = input?.value ?? target.initial;
    const current = grid();
    const previous = readCell(current, target);
    if (text === editText(previous)) {
      active = null;
      draw();
      return Promise.resolve(true);
    }
    const edit: InlineScoresTableEdit = target.row < 0
      ? { type: 'set-header', column: target.column, value: text }
      : { type: 'set-cell', row: target.row, column: target.column, value: text };
    const next = updateInlineScoresTableValue(sample[field.key], field, edit);
    if (Object.is(next, sample[field.key])) {
      active = null;
      draw();
      return Promise.resolve(true);
    }
    if (input) input.disabled = true;
    writing = true;
    pendingCommit = runtime.setBaseValue(field.key, next).then(() => {
      active = null;
      draw();
      return true;
    }).catch((error: unknown) => {
      if (input?.isConnected) {
        input.disabled = false;
        input.setAttribute('aria-invalid', 'true');
        input.title = error instanceof Error ? error.message : String(error);
        input.focus();
      }
      return false;
    }).finally(() => {
      writing = false;
      pendingCommit = null;
      if (refreshPending && !active) {
        refreshPending = false;
        draw();
      }
    });
    return pendingCommit;
  };

  const openCell = async (at: CellAt, caret: CaretStart = 'all'): Promise<void> => {
    if (active && sameCell(active, at)) return;
    if (!(await commitActive())) return;
    const current = grid();
    if (at.row < -1 || at.row >= current.rows.length || at.column < 0 || at.column >= current.columns.length) return;
    if (at.row === -1 && (!current.header || !columnsAllowed)) return;
    const value = readCell(current, at);
    active = { ...at, initial: at.row < 0 ? String(value ?? '') : editText(value), input: null };
    draw();
    const input = frame.querySelector<HTMLTextAreaElement>('textarea.atlas-sb-sheet-table__input');
    if (!input) return;
    active.input = input;
    input.focus({ preventScroll: true });
    if (caret === 'all') input.select();
    else {
      const position = typeof caret === 'number' ? Math.max(0, Math.min(input.value.length, caret))
        : caret === 'end' ? input.value.length : 0;
      input.setSelectionRange(position, position);
    }
  };

  const navigateTo = async (at: CellAt | null, caret: 'start' | 'end'): Promise<void> => {
    navigating = true;
    try {
      if (at) await openCell(at, caret);
      else await finishAndFocus();
    } finally {
      navigating = false;
    }
  };

  const finishAndFocus = async (): Promise<void> => {
    if (await commitActive()) focusBlock();
  };

  const applyTableEdit = async (edit: InlineScoresTableEdit, then?: CellAt): Promise<void> => {
    if (!(await commitActive())) return;
    const changed = await setValue(edit);
    if (!changed) return;
    selected = null;
    draw();
    if (then) await openCell(then, 'all');
    else frame.focus({ preventScroll: true });
  };

  const openTableMenu = async (target: CellAt | TableSelection, point: { x: number; y: number }): Promise<boolean> => {
    if (!(await commitActive())) return false;
    const current = grid();
    const menuState = {
      rowCount: current.rows.length,
      columnCount: current.columns.length,
      rowsAllowed,
      columnsAllowed,
      language: runtime.language,
    };
    const isSelection = 'axis' in target;
    const actions = isSelection
      ? target.axis === 'row'
        ? inlineScoresRowMenu(menuState, target.index)
        : inlineScoresColumnHandleMenu(menuState, target.index)
      : inlineScoresCellMenu(menuState, target);
    if (actions.length === 0) return false;

    closeContextMenu?.();
    closeContextMenu = null;
    selected = isSelection ? target : null;
    draw();
    closeContextMenu = openInlineScoresTableContextMenu({
      actions,
      point,
      returnFocus: frame,
      run: async (edit) => {
        const selectionAfter = edit.type === 'move-row'
          ? { axis: 'row' as const, index: edit.to }
          : edit.type === 'move-column'
            ? { axis: 'column' as const, index: edit.to }
            : null;
        const before = sample[field.key];
        await applyTableEdit(edit);
        if (Object.is(before, sample[field.key])) return;
        selected = selectionAfter;
        draw();
        frame.focus({ preventScroll: true });
      },
    });
    return true;
  };

  const insertRowAndOpen = async (index: number, column: number): Promise<void> => {
    if (!rowsAllowed || grid().rows.length >= INLINE_SCORES_MAX_ROWS) return;
    await applyTableEdit({ type: 'add-row', index }, { row: index, column: Math.min(column, grid().columns.length - 1) });
  };

  const insertColumnAndOpen = async (index: number): Promise<void> => {
    if (!columnsAllowed || grid().columns.length >= INLINE_SCORES_MAX_COLUMNS) return;
    const target = { row: grid().header && options.look !== 'lines' ? -1 : 0, column: index };
    await applyTableEdit({ type: 'add-column', index }, target);
  };

  frame.addEventListener('forge:focus-table', (event) => {
    const detail = (event as CustomEvent<{ direction?: number }>).detail;
    const direction = detail?.direction === -1 ? -1 : 1;
    const headerEditable = columnsAllowed && options.look !== 'lines';
    const cells = walkCells(grid(), headerEditable);
    const target = direction > 0 ? cells[0] : cells[cells.length - 1];
    if (target) void openCell(target, direction > 0 ? 'start' : 'end');
    else focusBlock();
  });

  frame.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('button, textarea, .statblock-forge__dice-link')) return;
    const at = parseCellAddress(event.target, frame);
    if (!at) return;
    const cell = target.closest<HTMLElement>('[data-table-row][data-table-col]');
    const currentValue = readCell(grid(), at);
    const start = caretInCell(event, cell, editText(currentValue).length);
    event.stopPropagation();
    void openCell(at, start);
  });

  frame.addEventListener('contextmenu', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('.statblock-forge__dice-link')) return;
    const handle = target.closest<HTMLElement>('[data-table-handle]');
    const axis = handle?.dataset.tableHandle;
    const index = Number(handle?.dataset.index);
    const picked: TableSelection | null = handle && (axis === 'row' || axis === 'column') && Number.isInteger(index)
      ? { axis, index }
      : null;
    const at = picked ?? parseCellAddress(event.target, frame);
    if (!at) return;
    event.preventDefault();
    event.stopPropagation();
    void openTableMenu(at, { x: event.clientX, y: event.clientY });
  });

  frame.addEventListener('keydown', (event) => {
    if (!selected || event.target !== frame) return;
    const { axis, index } = selected;
    if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) {
      event.preventDefault();
      event.stopPropagation();
      const rect = frame.getBoundingClientRect();
      void openTableMenu(selected, { x: rect.left, y: rect.bottom });
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      selected = null;
      draw();
      focusBlock();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const at = axis === 'row'
        ? { row: index, column: 0 }
        : { row: grid().header && columnsAllowed && options.look !== 'lines' ? -1 : 0, column: index };
      selected = null;
      void openCell(at, 'all');
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (axis === 'row' && rowsAllowed && grid().rows.length > 1) void applyTableEdit({ type: 'remove-row', index });
      else if (axis === 'column' && columnsAllowed && grid().columns.length > 1) void applyTableEdit({ type: 'remove-column', index });
      else {
        selected = null;
        draw();
      }
      return;
    }
    if (event.altKey && axis === 'row' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const to = index + (event.key === 'ArrowUp' ? -1 : 1);
      if (to >= 0 && to < grid().rows.length) {
        event.preventDefault();
        void applyTableEdit({ type: 'move-row', from: index, to });
      }
    } else if (event.altKey && axis === 'column' && columnsAllowed && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      const to = index + (event.key === 'ArrowLeft' ? -1 : 1);
      if (to >= 0 && to < grid().columns.length) {
        event.preventDefault();
        void applyTableEdit({ type: 'move-column', from: index, to });
      }
    }
  });

  draw();
  runtime.subscribeAll(() => {
    if (writing || active) {
      refreshPending = true;
      return;
    }
    draw();
  });
  return wrapper;
}
