import { scorePreviewGrid } from '../render/previewValueModel.ts';
import { isRecord, type ForgeField } from '../templates/forgeTemplate.ts';
import { updateInlineScoreCellValue } from './inlineScoresFieldEditorModel.ts';

export const INLINE_SCORES_MAX_ROWS = 100;
export const INLINE_SCORES_MAX_COLUMNS = 12;

export type InlineScoresTableEdit =
  | { type: 'set-header'; column: number; value: string }
  | { type: 'set-cell'; row: number; column: number; value: string }
  | { type: 'add-row'; index?: number }
  | { type: 'duplicate-row'; index: number }
  | { type: 'remove-row'; index: number }
  | { type: 'add-column'; index?: number }
  | { type: 'duplicate-column'; index: number }
  | { type: 'remove-column'; index: number }
  | { type: 'move-row'; from: number; to: number }
  | { type: 'move-column'; from: number; to: number }
  | { type: 'sort-rows'; column: number; direction: 1 | -1 }
  | { type: 'paste'; row: number; column: number; cells: string[][] };

/** Atlas parses a typed cell as a number when the text is numeric, regardless of its previous value type. */
export function parseAtlasScoresCellDraft(raw: string): unknown {
  const text = raw.trim();
  if (!text) return null;
  const normalized = text.replace(/−/g, '-').replace(/,/g, '.');
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric;
  }
  return text;
}

function move<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
}

function structuredGrid(rawValue: unknown, columns: string[], rows: unknown[][]): unknown {
  const metadata = isRecord(rawValue) ? { ...rawValue } : {};
  return { ...metadata, columns: [...columns], rows: rows.map((row) => [...row]) };
}

function validIndex(index: number, length: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < length;
}

function isEmptyCell(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

const tableCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareTableCells(left: unknown, right: unknown): number {
  const leftEmpty = isEmptyCell(left);
  const rightEmpty = isEmptyCell(right);
  if (leftEmpty || rightEmpty) return Number(leftEmpty) - Number(rightEmpty);
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return tableCollator.compare(String(left), String(right));
}

/**
 * Apply an Atlas-like Scores table edit. Cell-only changes retain the existing
 * storage convention; structural changes use the supported {columns, rows}
 * shape and preserve unrelated metadata on an already structured value.
 */
export function updateInlineScoresTableValue(
  rawValue: unknown,
  field: ForgeField,
  edit: InlineScoresTableEdit,
): unknown {
  if (field.type !== 'scores') return rawValue;
  const grid = scorePreviewGrid(rawValue, field);
  const columns = [...grid.columns];
  const rows = grid.rows.map((row) => [...row]);
  if (columns.length === 0) return rawValue;

  switch (edit.type) {
    case 'set-header': {
      if (!validIndex(edit.column, columns.length) || grid.header === false) return rawValue;
      const name = edit.value.trim();
      if (columns[edit.column] === name) return rawValue;
      columns[edit.column] = name;
      return structuredGrid(rawValue, columns, rows);
    }
    case 'set-cell': {
      if (!validIndex(edit.row, rows.length) || !validIndex(edit.column, columns.length)) return rawValue;
      const previous = rows[edit.row]?.[edit.column];
      const next = parseAtlasScoresCellDraft(edit.value);
      if (Object.is(previous ?? null, next)) return rawValue;
      // Keep flat/nested arrays, named records, one-key record lists and
      // { columns, rows } values in their established shape for cell-only edits,
      // while storing the value parsed with Atlas' number-or-text rule.
      return updateInlineScoreCellValue(rawValue, field, edit.row, edit.column, edit.value, next);
    }
    case 'add-row': {
      if (rows.length >= INLINE_SCORES_MAX_ROWS) return rawValue;
      const at = edit.index === undefined ? rows.length : Math.max(0, Math.min(rows.length, Math.trunc(edit.index)));
      rows.splice(at, 0, Array.from({ length: columns.length }, () => null));
      return structuredGrid(rawValue, columns, rows);
    }
    case 'duplicate-row': {
      if (!validIndex(edit.index, rows.length) || rows.length >= INLINE_SCORES_MAX_ROWS) return rawValue;
      rows.splice(edit.index, 0, [...rows[edit.index]!]);
      return structuredGrid(rawValue, columns, rows);
    }
    case 'remove-row': {
      if (rows.length <= 1 || !validIndex(edit.index, rows.length)) return rawValue;
      rows.splice(edit.index, 1);
      return structuredGrid(rawValue, columns, rows);
    }
    case 'add-column': {
      if (columns.length >= INLINE_SCORES_MAX_COLUMNS) return rawValue;
      const at = edit.index === undefined ? columns.length : Math.max(0, Math.min(columns.length, Math.trunc(edit.index)));
      columns.splice(at, 0, `Column ${columns.length + 1}`);
      for (const row of rows) row.splice(at, 0, null);
      return structuredGrid(rawValue, columns, rows);
    }
    case 'duplicate-column': {
      if (!validIndex(edit.index, columns.length) || columns.length >= INLINE_SCORES_MAX_COLUMNS) return rawValue;
      columns.splice(edit.index, 0, columns[edit.index]!);
      for (const row of rows) row.splice(edit.index, 0, row[edit.index] ?? null);
      return structuredGrid(rawValue, columns, rows);
    }
    case 'remove-column': {
      if (columns.length <= 1 || !validIndex(edit.index, columns.length)) return rawValue;
      columns.splice(edit.index, 1);
      for (const row of rows) row.splice(edit.index, 1);
      return structuredGrid(rawValue, columns, rows);
    }
    case 'move-row': {
      if (!validIndex(edit.from, rows.length) || !validIndex(edit.to, rows.length) || edit.from === edit.to) return rawValue;
      return structuredGrid(rawValue, columns, move(rows, edit.from, edit.to));
    }
    case 'move-column': {
      if (!validIndex(edit.from, columns.length) || !validIndex(edit.to, columns.length) || edit.from === edit.to) return rawValue;
      return structuredGrid(rawValue, move(columns, edit.from, edit.to), rows.map((row) => move(row, edit.from, edit.to)));
    }
    case 'sort-rows': {
      if (!validIndex(edit.column, columns.length) || rows.length < 2) return rawValue;
      const sorted = rows
        .map((row, index) => ({ row, index }))
        .sort((left, right) => {
          const empty = Number(isEmptyCell(left.row[edit.column])) - Number(isEmptyCell(right.row[edit.column]));
          if (empty !== 0) return empty;
          return edit.direction * compareTableCells(left.row[edit.column], right.row[edit.column]) || left.index - right.index;
        })
        .map(({ row }) => row);
      if (sorted.every((row, index) => row === rows[index])) return rawValue;
      return structuredGrid(rawValue, columns, sorted);
    }
    case 'paste': {
      if (!validIndex(edit.row, rows.length) || !validIndex(edit.column, columns.length) || edit.cells.length === 0) return rawValue;
      const height = Math.min(edit.cells.length, INLINE_SCORES_MAX_ROWS - edit.row);
      const width = Math.min(Math.max(0, ...edit.cells.map((line) => line.length)), INLINE_SCORES_MAX_COLUMNS - edit.column);
      if (height <= 0 || width <= 0) return rawValue;
      while (rows.length < edit.row + height) rows.push(Array.from({ length: columns.length }, () => null));
      while (columns.length < edit.column + width) {
        columns.push(`Column ${columns.length + 1}`);
        for (const row of rows) row.push(null);
      }
      for (let rowOffset = 0; rowOffset < height; rowOffset += 1) {
        for (let columnOffset = 0; columnOffset < width; columnOffset += 1) {
          const text = edit.cells[rowOffset]?.[columnOffset];
          if (text === undefined) continue;
          const target = rows[edit.row + rowOffset];
          if (target) target[edit.column + columnOffset] = parseAtlasScoresCellDraft(text);
        }
      }
      return structuredGrid(rawValue, columns, rows);
    }
  }
}

/** Parses spreadsheet-style TSV text; one scalar is left to the input itself. */
export function parseInlineScoresClipboard(text: string): string[][] | null {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');
  if (!normalized.includes('\t') && !normalized.includes('\n')) return null;
  return normalized.split('\n').map((line) => line.split('\t'));
}
