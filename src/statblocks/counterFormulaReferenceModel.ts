import type { ForgeField } from '../templates/forgeTemplate.ts';
import { resolveInlineCounterRows } from './inlineCountersFieldEditorModel.ts';

export interface CounterFormulaReferenceResult {
  /** True when this path uses the Counter reference grammar. */
  matched: boolean;
  /** Omitted when a recognized reference cannot be resolved safely. */
  value?: number | undefined;
}

const REMAINING_ALIASES = new Set(['remaining', 'current', 'available']);
const USED_ALIASES = new Set(['used', 'spent']);
const REMAINING_PERCENT_ALIASES = new Set([
  'percent', 'remainingpercent', 'currentpercent', 'availablepercent',
]);
const USED_PERCENT_ALIASES = new Set(['usedpercent', 'spentpercent']);

function normalizeProperty(value: string | undefined): string {
  return (value ?? '').toLowerCase().replace(/[_-]/g, '');
}

function safeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function safeSum(values: readonly number[]): number | undefined {
  return safeInteger(values.reduce((sum, value) => sum + value, 0));
}

function percentage(part: number | undefined, whole: number | undefined): number | undefined {
  if (part === undefined || whole === undefined || whole <= 0) return undefined;
  const result = (part / whole) * 100;
  return Number.isFinite(result) ? result : undefined;
}

function resolveCounterAggregate(
  rows: readonly InlineCounterRowState[],
  property: string,
): number | undefined {
  const visibleRows = rows.filter((row) => row.max > 0);
  const max = safeSum(visibleRows.map((row) => Number(row.max)));
  const used = safeSum(visibleRows.map((row) => Number(row.used ?? 0)));
  const remaining = max === undefined || used === undefined ? undefined : Math.max(0, max - used);

  if (property === 'count') return visibleRows.length;
  if (property === 'max') return max;
  if (USED_ALIASES.has(property)) return used;
  if (REMAINING_ALIASES.has(property)) return remaining;
  if (REMAINING_PERCENT_ALIASES.has(property)) return percentage(remaining, max);
  if (USED_PERCENT_ALIASES.has(property)) return percentage(used, max);
  if (property === 'isfull') return max !== undefined && max > 0 && used === 0 ? 1 : 0;
  if (property === 'isempty') return max !== undefined && max > 0 && remaining === 0 ? 1 : 0;
  return undefined;
}

/**
 * Resolve numeric formula paths for a Counter Field.
 *
 * Row paths are zero-based and follow the merged Template-preset/statblock
 * storage order. A row with max=0 remains addressable by its original index,
 * but it is excluded from aggregate totals because the renderer hides it.
 *
 * Supported paths:
 *   counter.0.max / .used / .spent / .remaining / .current / .available
 *   counter.0.percent / .remainingPercent / .usedPercent / .isFull / .isEmpty
 *   counter.total.<aggregate-property> or counter.<aggregate-property>
 *   where aggregate-property includes max, used, remaining, percentages,
 *   full/empty state, and count.
 */
export function resolveCounterFormulaReference(
  field: ForgeField,
  rawValue: unknown,
  path: readonly string[],
): CounterFormulaReferenceResult {
  if (field.type !== 'counters' || path.length === 0) return { matched: false };

  const rows = resolveInlineCounterRows(rawValue, field);
  if (!rows) return { matched: true };

  if (path.length === 1) {
    const property = normalizeProperty(path[0]);
    if (property === 'count' || property === 'max' || USED_ALIASES.has(property)
      || REMAINING_ALIASES.has(property) || REMAINING_PERCENT_ALIASES.has(property)
      || USED_PERCENT_ALIASES.has(property) || property === 'isfull' || property === 'isempty') {
      return { matched: true, value: resolveCounterAggregate(rows, property) };
    }
  }

  if (path.length === 2 && normalizeProperty(path[0]) === 'total') {
    const property = normalizeProperty(path[1]);
    if (property === 'count' || property === 'max' || USED_ALIASES.has(property)
      || REMAINING_ALIASES.has(property) || REMAINING_PERCENT_ALIASES.has(property)
      || USED_PERCENT_ALIASES.has(property) || property === 'isfull' || property === 'isempty') {
      return { matched: true, value: resolveCounterAggregate(rows, property) };
    }
    return { matched: false };
  }

  if (path.length !== 2 || !/^\d+$/.test(path[0] ?? '')) return { matched: false };
  const index = Number(path[0]);
  if (!Number.isSafeInteger(index) || index < 0 || index >= rows.length) return { matched: true };
  const row = rows[index];
  if (!row) return { matched: true };
  const property = normalizeProperty(path[1]);

  if (property === 'max') return { matched: true, value: safeInteger(row.max) };
  if (USED_ALIASES.has(property)) return { matched: true, value: safeInteger(row.used ?? 0) };
  if (REMAINING_ALIASES.has(property)) {
    const max = safeInteger(row.max);
    const used = safeInteger(row.used ?? 0);
    return { matched: true, value: max === undefined || used === undefined ? undefined : Math.max(0, max - used) };
  }
  if (REMAINING_PERCENT_ALIASES.has(property) || USED_PERCENT_ALIASES.has(property)) {
    const max = safeInteger(row.max);
    const used = safeInteger(row.used ?? 0);
    if (max === undefined || used === undefined || max <= 0) return { matched: true };
    const remaining = Math.max(0, max - used);
    return {
      matched: true,
      value: percentage(REMAINING_PERCENT_ALIASES.has(property) ? remaining : used, max),
    };
  }
  if (property === 'isfull' || property === 'isempty') {
    const max = safeInteger(row.max);
    const used = safeInteger(row.used ?? 0);
    if (max === undefined || used === undefined || max <= 0) return { matched: true };
    const remaining = Math.max(0, max - used);
    return { matched: true, value: property === 'isfull' ? Number(used === 0) : Number(remaining === 0) };
  }

  return { matched: false };
}
