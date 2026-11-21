/**
 * Backward-compatible value conversion for existing Atlas-origin statblock
 * notes. This module does not create or export Atlas templates or statblocks.
 * Counter Ability Part values are stored as readable text in those legacy
 * notes and restored to Forge boolean marks when imported.
 */
import { abilityCounterMaxForRow, normalizeAbilityCounterMarks } from '../templates/abilityPartValues.ts';
import {
  ABILITY_COUNTER_MAXES_KEY,
  DEFAULT_ABILITY_COUNTER_MAX,
  MAX_ABILITY_COUNTER_MAX,
  MIN_ABILITY_COUNTER_MAX,
  abilityPartsForField,
  type AbilityPart,
} from '../templates/abilityPartsModel.ts';
import { isRecord, type ForgeField, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';

export interface AtlasStatblockDataProjection {
  data: JsonRecord;
  convertedCounters: number;
}

function clampCounterMax(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(MIN_ABILITY_COUNTER_MAX, Math.min(MAX_ABILITY_COUNTER_MAX, numeric));
}

function counterParts(field: ForgeField): AbilityPart[] {
  if (field.type !== 'entries') return [];
  return abilityPartsForField(field).filter((part) => part.type === 'counter');
}

function entriesAsList(value: unknown): { rows: unknown[]; wasArray: boolean } | null {
  if (Array.isArray(value)) return { rows: value, wasArray: true };
  if (isRecord(value)) return { rows: [value], wasArray: false };
  return null;
}

function isBooleanMarks(value: unknown): value is boolean[] {
  return Array.isArray(value) && value.every((mark) => typeof mark === 'boolean');
}

function marksToLegacyNoteText(marks: readonly boolean[], max: number, look: AbilityPart['look']): string {
  const safe = normalizeAbilityCounterMarks(marks, max);
  const used = safe.filter(Boolean).length;
  const isPrefix = safe.every((mark, index) => mark === (index < used));
  if (isPrefix) return `${used}/${max}`;
  const [filled, empty] = look === 'checkboxes' ? ['☑', '☐'] : ['●', '○'];
  return safe.map((mark) => mark ? filled : empty).join('');
}

interface ParsedAtlasCounterText {
  marks: boolean[];
  max: number;
}

function parseLegacyNoteCounterText(value: unknown): ParsedAtlasCounterText | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  const ratio = /^(\d{1,2})\s*\/\s*(\d{1,2})$/.exec(text);
  if (ratio) {
    const used = Number(ratio[1]);
    const max = Number(ratio[2]);
    if (!Number.isInteger(used) || !Number.isInteger(max)
      || max < MIN_ABILITY_COUNTER_MAX || max > MAX_ABILITY_COUNTER_MAX || used < 0 || used > max) return null;
    return { marks: Array.from({ length: max }, (_, index) => index < used), max };
  }

  if (/^[●○]{1,12}$/u.test(text)) {
    return { marks: Array.from(text, (mark) => mark === '●'), max: Array.from(text).length };
  }
  if (/^[☑☐]{1,12}$/u.test(text)) {
    return { marks: Array.from(text, (mark) => mark === '☑'), max: Array.from(text).length };
  }
  return null;
}

function cloneEntryRows(
  value: unknown,
  transform: (entry: JsonRecord) => JsonRecord,
): { value: unknown; changed: number } {
  const list = entriesAsList(value);
  if (!list) return { value, changed: 0 };
  let changed = 0;
  const rows = list.rows.map((row) => {
    if (!isRecord(row)) return row;
    const next = transform(row);
    if (next !== row) changed += 1;
    return next;
  });
  if (changed === 0) return { value, changed: 0 };
  return { value: list.wasArray ? rows : rows[0], changed };
}

function formatCounterPartForLegacyNote(entry: JsonRecord, part: AbilityPart): JsonRecord {
  const value = entry[part.key];
  if (value === undefined || value === null || value === '') return entry;
  let marks: boolean[] | null = null;
  let max = abilityCounterMaxForRow(entry, part);

  if (isBooleanMarks(value)) {
    marks = value;
  } else {
    const parsed = parseLegacyNoteCounterText(value);
    if (parsed) {
      marks = parsed.marks;
      max = parsed.max;
    }
  }
  if (!marks) return entry;

  return { ...entry, [part.key]: marksToLegacyNoteText(marks, max, part.look) };
}

/** Converts Forge Counter marks to the legacy textual representation used by existing Atlas-origin notes. */
export function projectForgeStatblockDataForLegacyNote(
  template: ForgeTemplate,
  source: JsonRecord,
): AtlasStatblockDataProjection {
  const data: JsonRecord = { ...source };
  let convertedCounters = 0;
  for (const field of template.fields) {
    const parts = counterParts(field);
    if (parts.length === 0 || !Object.prototype.hasOwnProperty.call(data, field.key)) continue;
    const projected = cloneEntryRows(data[field.key], (entry) => {
      let next = entry;
      for (const part of parts) {
        const before = next[part.key];
        next = formatCounterPartForLegacyNote(next, part);
        if (next !== entry && next[part.key] !== before) convertedCounters += 1;
      }
      if (parts.length > 0 && Object.prototype.hasOwnProperty.call(next, ABILITY_COUNTER_MAXES_KEY)) {
        next = { ...next };
        delete next[ABILITY_COUNTER_MAXES_KEY];
      }
      return next;
    });
    data[field.key] = projected.value;
  }
  return { data, convertedCounters };
}

/** Restores legacy textual Counter values to Forge boolean-mark representation. */
export function restoreForgeStatblockDataFromLegacyNote(
  template: ForgeTemplate,
  source: JsonRecord,
): JsonRecord {
  const data: JsonRecord = { ...source };
  for (const field of template.fields) {
    const parts = counterParts(field);
    if (parts.length === 0 || !Object.prototype.hasOwnProperty.call(data, field.key)) continue;
    const restored = cloneEntryRows(data[field.key], (entry) => {
      let next = entry;
      let overrides = isRecord(next[ABILITY_COUNTER_MAXES_KEY])
        ? { ...(next[ABILITY_COUNTER_MAXES_KEY] as JsonRecord) }
        : {};
      let changed = false;
      for (const part of parts) {
        const value = next[part.key];
        if (isBooleanMarks(value)) continue;
        const parsed = parseLegacyNoteCounterText(value);
        if (!parsed) continue;
        next = { ...next, [part.key]: parsed.marks };
        const defaultMax = clampCounterMax(part.max ?? DEFAULT_ABILITY_COUNTER_MAX, DEFAULT_ABILITY_COUNTER_MAX);
        if (parsed.max !== defaultMax) overrides[part.key] = parsed.max;
        else delete overrides[part.key];
        changed = true;
      }
      if (!changed) return entry;
      if (Object.keys(overrides).length > 0) next[ABILITY_COUNTER_MAXES_KEY] = overrides;
      else delete next[ABILITY_COUNTER_MAXES_KEY];
      return next;
    });
    data[field.key] = restored.value;
  }
  return data;
}
