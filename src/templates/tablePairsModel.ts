import type { ForgeField } from './forgeTemplate.ts';
import { inlinePairsFromValue } from '../statblocks/inlinePairsFieldEditorModel.ts';

export interface TablePairsColumn {
  key: string;
  label: string;
  /** Optional non-Pairs Field assigned to this Table slot. */
  fieldKey?: string;
}

export interface TablePairsCell {
  value: unknown;
  /** Pairs Field and item index are present when this cell belongs to a Pairs row. */
  pairFieldKey?: string;
  pairIndex?: number;
  /** Non-Pairs slot Field used as a fallback/value source for this cell. */
  fieldKey?: string;
}

export interface TablePairsRow {
  key: string;
  label: string;
  cells: TablePairsCell[];
}

export interface TablePairsModel {
  columns: TablePairsColumn[];
  rows: TablePairsRow[];
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

/**
 * A Pairs Field is a complete Table row: each named pair contributes one
 * column. Other Fields occupy named column slots and provide a fallback value
 * when a Pairs row does not contain that column.
 */
export function buildTablePairsModel(
  pairFields: readonly ForgeField[],
  slotFields: readonly ForgeField[],
  sample: Record<string, unknown>,
): TablePairsModel {
  const pairRows = pairFields.map((field) => ({ field, pairs: inlinePairsFromValue(sample[field.key]) }));
  const columns: TablePairsColumn[] = [];
  const columnIndexes = new Map<string, number>();

  const addColumn = (key: string, label: string, fieldKey?: string): number => {
    const normalizedKey = normalized(key);
    const existing = columnIndexes.get(normalizedKey);
    if (existing !== undefined) {
      const column = columns[existing];
      if (column && !column.fieldKey && fieldKey) column.fieldKey = fieldKey;
      return existing;
    }
    const index = columns.length;
    columns.push({ key, label, ...(fieldKey ? { fieldKey } : {}) });
    columnIndexes.set(normalizedKey, index);
    return index;
  };

  for (const { pairs } of pairRows) {
    for (const pair of pairs) addColumn(pair.key, pair.key);
  }
  for (const field of slotFields) {
    const key = field.key;
    const label = field.label.trim() || field.key;
    const matching = columnIndexes.get(normalized(label)) ?? columnIndexes.get(normalized(key));
    if (matching !== undefined) {
      const column = columns[matching];
      if (column && !column.fieldKey) column.fieldKey = field.key;
    } else addColumn(key, label, field.key);
  }

  if (pairRows.length > 0) {
    const rows = pairRows.map(({ field, pairs }) => {
      const byColumn = new Map<string, { value: unknown; index: number }>();
      pairs.forEach((pair, index) => {
        const key = normalized(pair.key);
        if (!byColumn.has(key)) byColumn.set(key, { value: pair.value, index });
      });
      return {
        key: field.key,
        label: field.label.trim() || field.key,
        cells: columns.map((column) => {
          const pair = byColumn.get(normalized(column.key));
          if (pair) return { value: pair.value, pairFieldKey: field.key, pairIndex: pair.index };
          if (column.fieldKey) return { value: sample[column.fieldKey], fieldKey: column.fieldKey };
          return { value: null };
        }),
      };
    });
    return { columns, rows };
  }

  if (slotFields.length > 0) {
    const fieldsByKey = new Map(slotFields.map((field) => [field.key, field]));
    return {
      columns,
      rows: [{
        key: 'table-slots',
        label: 'Values',
        cells: columns.map((column) => {
          const field = column.fieldKey ? fieldsByKey.get(column.fieldKey) : undefined;
          return field ? { value: sample[field.key], fieldKey: field.key } : { value: null };
        }),
      }],
    };
  }

  return { columns, rows: [] };
}
