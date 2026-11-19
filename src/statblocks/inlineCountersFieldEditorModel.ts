import { isRecord, type ForgeField } from '../templates/forgeTemplate.ts';
import { presetCounterRegain } from './counterRegainModel.ts';

/** Replaces the old generated first-row label with its configured preset name. */
export function normalizeLegacyCounterPresetName(name: string, index: number, presetName: string | undefined): string {
  const legacyPlaceholder = index === 0 && (!name.trim() || /^counter\s+1$/i.test(name.trim()));
  return legacyPlaceholder && presetName?.trim() ? presetName : name;
}

function counterRowIsValid(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || typeof value.name !== 'string') return false;
  if (!Number.isInteger(value.max) || Number(value.max) < 0) return false;
  const used = value.used === undefined ? 0 : value.used;
  if (!Number.isInteger(used) || Number(used) < 0 || Number(used) > Number(value.max)) return false;
  if (value.reset !== undefined && value.reset !== null && typeof value.reset !== 'string') return false;
  if (value.regain !== undefined && value.regain !== null && typeof value.regain !== 'string') return false;
  return true;
}

/**
 * Update one displayed Counter row using the same effective row order as the
 * renderer: stored rows first, followed by any configured preset rows not
 * already represented in the stored value. The first edit materializes that
 * effective list, just as Atlas does when a preset counter is first changed.
 */
export function updateInlineCounterUsedValue(
  rawValue: unknown,
  field: ForgeField,
  displayedIndex: number,
  nextUsed: number,
): unknown {
  if (field.type !== 'counters' || displayedIndex < 0 || !Number.isInteger(displayedIndex)) return rawValue;

  const isEmpty = rawValue === undefined || rawValue === null || (Array.isArray(rawValue) && rawValue.length === 0);
  if (!isEmpty && !Array.isArray(rawValue)) return rawValue;
  let rows: Array<Record<string, unknown>> = isEmpty
    ? []
    : (rawValue as unknown[]).map((item) => isRecord(item) ? { ...item } : item as Record<string, unknown>);
  if (rows.some((row) => !counterRowIsValid(row))) return rawValue;

  const presetRows = Array.isArray(field.counterRows) ? field.counterRows.filter(isRecord) : [];
  if (presetRows.some((row) => !counterRowIsValid({ ...row, used: 0 }))) return rawValue;
  const presets: Array<Record<string, unknown>> = presetRows.map((row): Record<string, unknown> => {
    const preset: Record<string, unknown> = { ...row, used: 0 };
    // Rest assignment is per character, never inherited from a template preset.
    delete preset.reset;
    const regain = presetCounterRegain(preset.regain);
    if (regain === null) delete preset.regain;
    else preset.regain = regain;
    return preset;
  });
  rows = rows.map((row, index) => ({
    ...row,
    name: normalizeLegacyCounterPresetName(
      String(row.name ?? ''), index,
      typeof presets[index]?.name === 'string' ? String(presets[index]!.name) : undefined,
    ),
  }));
  const namesPreset = (row: Record<string, unknown>): boolean => presets.some((preset) =>
    String(preset.name).trim().toLowerCase() === String(row.name).trim().toLowerCase());
  const holds = (preset: Record<string, unknown>, index: number): boolean =>
    rows.some((row) => String(row.name).trim().toLowerCase() === String(preset.name).trim().toLowerCase())
    || (rows[index] !== undefined && !namesPreset(rows[index]!));

  presets.forEach((preset, index) => {
    if (Number(preset.max) > 0 && !holds(preset, index)) rows.push({ ...preset });
  });

  const visibleRows = rows.filter((row) => Number(row.max) > 0);
  const target = visibleRows[displayedIndex];
  if (!target) return rawValue;
  const maximum = Number(target.max);
  const used = Math.max(0, Math.min(maximum, Math.floor(Number.isFinite(nextUsed) ? nextUsed : 0)));
  target.used = used;
  return rows;
}

/**
 * Update the recovery button assigned to one displayed Counter row. The row's reset
 * value belongs to the statblock data (not the template preset) and stores the Rest
 * button ID, exactly as Atlas does. Choosing no Rest removes the optional property.
 */
export function updateInlineCounterResetValue(
  rawValue: unknown,
  field: ForgeField,
  displayedIndex: number,
  reset: string | null,
): unknown {
  if (field.type !== 'counters' || displayedIndex < 0 || !Number.isInteger(displayedIndex)) return rawValue;

  const isEmpty = rawValue === undefined || rawValue === null || (Array.isArray(rawValue) && rawValue.length === 0);
  if (!isEmpty && !Array.isArray(rawValue)) return rawValue;
  let rows: Array<Record<string, unknown>> = isEmpty
    ? []
    : (rawValue as unknown[]).map((item) => isRecord(item) ? { ...item } : item as Record<string, unknown>);
  if (rows.some((row) => !counterRowIsValid(row))) return rawValue;

  const presetRows = Array.isArray(field.counterRows) ? field.counterRows.filter(isRecord) : [];
  if (presetRows.some((row) => !counterRowIsValid({ ...row, used: 0 }))) return rawValue;
  const presets: Array<Record<string, unknown>> = presetRows.map((row): Record<string, unknown> => {
    const preset: Record<string, unknown> = { ...row, used: 0 };
    // Atlas template presets do not carry a character's per-row Rest choice.
    delete preset.reset;
    const regain = presetCounterRegain(preset.regain);
    if (regain === null) delete preset.regain;
    else preset.regain = regain;
    return preset;
  });
  rows = rows.map((row, index) => ({
    ...row,
    name: normalizeLegacyCounterPresetName(
      String(row.name ?? ''), index,
      typeof presets[index]?.name === 'string' ? String(presets[index]!.name) : undefined,
    ),
  }));
  const namesPreset = (row: Record<string, unknown>): boolean => presets.some((preset) =>
    String(preset.name).trim().toLowerCase() === String(row.name).trim().toLowerCase());
  const holds = (preset: Record<string, unknown>, index: number): boolean =>
    rows.some((row) => String(row.name).trim().toLowerCase() === String(preset.name).trim().toLowerCase())
    || (rows[index] !== undefined && !namesPreset(rows[index]!));

  presets.forEach((preset, index) => {
    if (Number(preset.max) > 0 && !holds(preset, index)) rows.push({ ...preset });
  });

  const visibleRows = rows.filter((row) => Number(row.max) > 0);
  const target = visibleRows[displayedIndex];
  if (!target) return rawValue;
  const currentReset = typeof target.reset === 'string' ? target.reset : null;
  if (currentReset === reset) return rawValue;
  if (reset === null) delete target.reset;
  else target.reset = reset;
  return rows;
}
