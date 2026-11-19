import { scorePreviewGrid } from '../render/previewValueModel.ts';
import { isRecord, type ForgeField } from '../templates/forgeTemplate.ts';

/** Parse a Scores cell while preserving its existing scalar type where possible. */
export function parseInlineScoreCellDraft(raw: string, previousValue: unknown): unknown {
  if (raw === '') return null;
  if (typeof previousValue === 'number') {
    const normalized = raw.trim().includes(',') && !raw.trim().includes('.')
      ? raw.trim().replace(',', '.')
      : raw.trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : raw;
  }
  return raw;
}

function cloneAndSetRow(rows: unknown[], rowIndex: number, columnIndex: number, value: unknown): unknown[] {
  const next = rows.map((row) => Array.isArray(row) ? [...row] : row);
  const row = next[rowIndex];
  if (Array.isArray(row)) row[columnIndex] = value;
  else if (row !== undefined && columnIndex === 0) next[rowIndex] = value;
  else if (row !== undefined) next[rowIndex] = [row, ...Array.from({ length: Math.max(0, columnIndex - 1) }, () => null), value];
  else next[rowIndex] = Array.from({ length: columnIndex + 1 }, (_item, index) => index === columnIndex ? value : null);
  return next;
}

function findObjectKey(record: Record<string, unknown>, candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, candidate)) return candidate;
  }
  const lower = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));
  for (const candidate of candidates) {
    const key = lower.get(candidate.toLowerCase());
    if (key !== undefined) return key;
  }
  return undefined;
}

/**
 * Return an updated Scores Field value without needlessly changing its storage
 * convention. Supported shapes mirror scorePreviewGrid: nested/flat arrays,
 * named-value records, one-key record lists and { columns, rows } tables.
 */
export function updateInlineScoreCellValue(
  rawValue: unknown,
  field: ForgeField,
  rowIndex: number,
  columnIndex: number,
  draft: string,
  parsedValue?: unknown,
): unknown {
  if (field.type !== 'scores' || rowIndex < 0 || columnIndex < 0) return rawValue;
  const grid = scorePreviewGrid(rawValue, field);
  const previous = grid.rows[rowIndex]?.[columnIndex];
  if (rowIndex >= grid.rows.length || columnIndex >= grid.columns.length) return rawValue;
  const value = parsedValue === undefined ? parseInlineScoreCellDraft(draft, previous) : parsedValue;
  const slotKeys = Array.isArray(field.slotKeys) ? field.slotKeys.filter((item): item is string => typeof item === 'string') : [];
  const visibleColumn = grid.columns[columnIndex] ?? '';
  const candidates = [slotKeys[columnIndex] ?? '', visibleColumn, String(columnIndex)].filter(Boolean);
  const fallbackKey = (slotKeys[columnIndex] ?? visibleColumn) || String(columnIndex);

  if (isRecord(rawValue) && Array.isArray(rawValue.rows)) {
    const rawRows = rawValue.rows;
    const nextRows = rawRows.length === 0
      ? grid.rows.map((row, index) => row.map((cell, cellIndex) => index === rowIndex && cellIndex === columnIndex ? value : cell))
      : rawRows.some(Array.isArray)
        ? cloneAndSetRow(rawRows, rowIndex, columnIndex, value)
        : rowIndex === 0
          ? rawRows.map((_item, index) => index === columnIndex ? value : rawRows[index])
          : cloneAndSetRow(rawRows, rowIndex, columnIndex, value);
    return { ...rawValue, rows: nextRows };
  }

  if (Array.isArray(rawValue) && rawValue.length > 0) {
    if (rawValue.length > 0 && rawValue.every(isRecord)) {
      const next = rawValue.map((item) => ({ ...item }));
      const target = next.find((item) => findObjectKey(item, candidates) !== undefined);
      if (target) {
        const key = findObjectKey(target, candidates);
        if (key) target[key] = value;
      } else {
        next.push({ [fallbackKey]: value });
      }
      return next;
    }
    if (rawValue.some(Array.isArray)) return cloneAndSetRow(rawValue, rowIndex, columnIndex, value);
    if (rowIndex !== 0) return rawValue;
    const next = [...rawValue];
    next[columnIndex] = value;
    return next;
  }

  if (isRecord(rawValue)) {
    const key = findObjectKey(rawValue, candidates) ?? fallbackKey;
    return { ...rawValue, [key]: value };
  }

  // No statblock-specific value exists yet: materialize the effective grid
  // (which may come from template defaults) as ordinary rows in the note.
  const nextRows = grid.rows.map((row) => [...row]);
  if (!nextRows[rowIndex]) nextRows[rowIndex] = [];
  nextRows[rowIndex]![columnIndex] = value;
  return nextRows;
}
