import { isRecord } from '../templates/forgeTemplate.ts';

export const FORGE_TABLE_DATA_FORMAT = 'statblock-forge-table-rows-v1';
export const FORGE_TABLE_MAX_ROWS = 100;

/**
 * A Table row can be deleted only when it is a stored, manually-added row
 * beyond the rows supplied by Counter Fields. The first manual row is at
 * `counterRowCount` (not one row after it).
 */
export function isForgeTableRowDeletable(
  rowIndex: number,
  counterRowCount: number,
  storedExtraRowCount: number,
): boolean {
  return Number.isInteger(rowIndex)
    && Number.isInteger(counterRowCount)
    && Number.isInteger(storedExtraRowCount)
    && rowIndex > 0
    && rowIndex >= Math.max(0, counterRowCount)
    && rowIndex <= storedExtraRowCount;
}

export interface ForgeTableExtraRow {
  label: string;
  values: Record<string, unknown>;
}

export interface ForgeTableRowsData {
  format: typeof FORGE_TABLE_DATA_FORMAT;
  firstRowLabel: string;
  extraRows: ForgeTableExtraRow[];
  /** Preserve the old native Scores sample while the Forge-owned row model is introduced. */
  legacyValue?: unknown;
}

export type ForgeTableRowsEdit =
  | { type: 'add-row'; row?: number }
  | { type: 'remove-row'; row: number }
  | { type: 'set-row-label'; row: number; value: string }
  | { type: 'set-row-cell'; row: number; fieldKey: string; value: unknown };

function cloneRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

export function readForgeTableRows(raw: unknown): ForgeTableRowsData {
  if (!isRecord(raw) || raw.format !== FORGE_TABLE_DATA_FORMAT) {
    return {
      format: FORGE_TABLE_DATA_FORMAT,
      firstRowLabel: '',
      extraRows: [],
      ...(raw === undefined ? {} : { legacyValue: raw }),
    };
  }
  const extraRows = Array.isArray(raw.extraRows)
    ? raw.extraRows.filter(isRecord).map((row) => ({
      label: typeof row.label === 'string' ? row.label : '',
      values: cloneRecord(row.values),
    }))
    : [];
  return {
    format: FORGE_TABLE_DATA_FORMAT,
    firstRowLabel: typeof raw.firstRowLabel === 'string' ? raw.firstRowLabel : '',
    extraRows,
    ...(Object.prototype.hasOwnProperty.call(raw, 'legacyValue') ? { legacyValue: raw.legacyValue } : {}),
  };
}

export function updateForgeTableRows(raw: unknown, edit: ForgeTableRowsEdit): ForgeTableRowsData {
  const current = readForgeTableRows(raw);
  if (edit.type === 'add-row') {
    const targetRow = Number.isInteger(edit.row) && (edit.row ?? 0) > 0 ? edit.row! : current.extraRows.length + 1;
    if (targetRow >= FORGE_TABLE_MAX_ROWS || targetRow <= current.extraRows.length) return current;
    const extraRows = [...current.extraRows];
    while (extraRows.length < targetRow - 1) extraRows.push({ label: '', values: {} });
    extraRows.push({ label: '', values: {} });
    return { ...current, extraRows };
  }
  if (edit.type === 'remove-row') {
    if (!Number.isInteger(edit.row) || edit.row < 1 || edit.row > current.extraRows.length) return current;
    return { ...current, extraRows: current.extraRows.filter((_row, index) => index !== edit.row - 1) };
  }
  if (edit.type === 'set-row-label') {
    if (!Number.isInteger(edit.row) || edit.row < 0 || edit.row >= FORGE_TABLE_MAX_ROWS) return current;
    if (edit.row === 0) {
      if (current.firstRowLabel === edit.value) return current;
      return { ...current, firstRowLabel: edit.value };
    }
    const extraRows = [...current.extraRows];
    while (extraRows.length < edit.row) extraRows.push({ label: '', values: {} });
    const index = edit.row - 1;
    const previous = extraRows[index]!;
    if (previous.label === edit.value) return current;
    extraRows[index] = { ...previous, label: edit.value };
    return { ...current, extraRows };
  }
  if (!Number.isInteger(edit.row) || edit.row < 1 || edit.row >= FORGE_TABLE_MAX_ROWS || !edit.fieldKey) return current;
  const extraRows = [...current.extraRows];
  // Counter Fields can create implicit Table rows. Materialize an empty row
  // only when a user edits a normal Field cell on one of those rows.
  while (extraRows.length < edit.row) extraRows.push({ label: '', values: {} });
  const index = edit.row - 1;
  const previous = extraRows[index]!;
  if (Object.is(previous.values[edit.fieldKey], edit.value)) return current;
  extraRows[index] = { ...previous, values: { ...previous.values, [edit.fieldKey]: edit.value } };
  return { ...current, extraRows };
}

export function forgeTableRowLabel(raw: unknown, row: number): string {
  const current = readForgeTableRows(raw);
  if (row === 0) return current.firstRowLabel;
  return current.extraRows[row - 1]?.label ?? '';
}

export function forgeTableCellValue(raw: unknown, row: number, fieldKey: string): unknown {
  if (row === 0) return undefined;
  return readForgeTableRows(raw).extraRows[row - 1]?.values[fieldKey];
}
