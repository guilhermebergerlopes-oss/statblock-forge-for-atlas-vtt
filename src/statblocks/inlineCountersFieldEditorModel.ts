import { isRecord, type ForgeField } from '../templates/forgeTemplate.ts';
import { presetCounterRegain } from './counterRegainModel.ts';

export interface InlineCounterRowState extends Record<string, unknown> {
  name: string;
  max: number;
  used: number;
  reset?: string | null;
  regain?: string;
}

/**
 * The configured Field preset is the source of truth for a Counter's visible
 * name. Stored statblock rows only own usage/recovery state, so renaming a
 * preset must be reflected even when an older statblock still stores its old
 * name. An empty preset name is meaningful and remains empty.
 */
export function normalizeLegacyCounterPresetName(name: string, _index: number, presetName: string | undefined): string {
  return presetName === undefined ? name : presetName;
}

function counterRowIsValid(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || (value.name !== undefined && typeof value.name !== 'string')) return false;
  if (!Number.isInteger(value.max) || Number(value.max) < 0) return false;
  const used = value.used === undefined ? 0 : value.used;
  if (!Number.isInteger(used) || Number(used) < 0 || Number(used) > Number(value.max)) return false;
  if (value.reset !== undefined && value.reset !== null && typeof value.reset !== 'string') return false;
  if (value.regain !== undefined && value.regain !== null && typeof value.regain !== 'string') return false;
  return true;
}

/**
 * Resolve the effective Counter rows in display order. Stored per-statblock
 * rows own usage and recovery state; configured Field rows own names. Rows
 * without a stored counterpart are materialized from the preset defaults.
 * Matching by index (rather than name) allows duplicate and blank names.
 */
export function resolveInlineCounterRows(rawValue: unknown, field?: ForgeField): InlineCounterRowState[] | null {
  const isEmpty = rawValue === undefined || rawValue === null || (Array.isArray(rawValue) && rawValue.length === 0);
  if (!isEmpty && !Array.isArray(rawValue)) return null;
  const ownRows = isEmpty
    ? []
    : (rawValue as unknown[]).map((item) => isRecord(item) ? { ...item } : item);
  if (ownRows.some((row) => !counterRowIsValid(row))) return null;

  const rawPresets = Array.isArray(field?.counterRows) ? field.counterRows.filter(isRecord) : [];
  if (rawPresets.some((row) => !counterRowIsValid({ ...row, used: 0, reset: null }))) return null;
  const presets = rawPresets.map((row): Record<string, unknown> => {
    const preset: Record<string, unknown> = { ...row, used: 0 };
    // Rest assignment is per character, never inherited from a template preset.
    delete preset.reset;
    const regain = presetCounterRegain(preset.regain);
    if (regain === null) delete preset.regain;
    else preset.regain = regain;
    return preset;
  });

  const count = Math.max(ownRows.length, presets.length);
  const rows: InlineCounterRowState[] = [];
  for (let index = 0; index < count; index += 1) {
    const own = ownRows[index];
    const preset = presets[index];
    if (!isRecord(own) && !preset) continue;
    const row: Record<string, unknown> = isRecord(own) ? { ...own } : { ...preset! };
    if (preset) row.name = String(preset.name ?? '');
    else row.name = String(row.name ?? '');
    if (!isRecord(own) && preset) row.used = 0;
    rows.push(row as InlineCounterRowState);
  }
  return rows;
}

/**
 * Update one displayed Counter row using the same effective order as the
 * renderer. The first edit materializes configured preset rows in the note.
 */
export function updateInlineCounterUsedValue(
  rawValue: unknown,
  field: ForgeField,
  displayedIndex: number,
  nextUsed: number,
): unknown {
  if (field.type !== 'counters' || displayedIndex < 0 || !Number.isInteger(displayedIndex)) return rawValue;
  const rows = resolveInlineCounterRows(rawValue, field);
  if (!rows) return rawValue;
  const visibleRows = rows.filter((row) => Number(row.max) > 0);
  const target = visibleRows[displayedIndex];
  if (!target) return rawValue;
  const maximum = Number(target.max);
  const used = Math.max(0, Math.min(maximum, Math.floor(Number.isFinite(nextUsed) ? nextUsed : 0)));
  if (target.used === used && Array.isArray(rawValue)) return rawValue;
  target.used = used;
  return rows;
}

/**
 * Update the per-statblock Rest button assigned to one displayed Counter row.
 * Choosing no Rest removes the optional property.
 */
export function updateInlineCounterResetValue(
  rawValue: unknown,
  field: ForgeField,
  displayedIndex: number,
  reset: string | null,
): unknown {
  if (field.type !== 'counters' || displayedIndex < 0 || !Number.isInteger(displayedIndex)) return rawValue;
  const rows = resolveInlineCounterRows(rawValue, field);
  if (!rows) return rawValue;
  const visibleRows = rows.filter((row) => Number(row.max) > 0);
  const target = visibleRows[displayedIndex];
  if (!target) return rawValue;
  const currentReset = typeof target.reset === 'string' ? target.reset : null;
  if (currentReset === reset && Array.isArray(rawValue)) return rawValue;
  if (reset === null) delete target.reset;
  else target.reset = reset;
  return rows;
}
