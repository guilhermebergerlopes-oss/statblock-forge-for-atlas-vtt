/**
 * Value defaults and serialization for Ability Parts.
 *
 * Values follow the Atlas Entries shape: numbers become numbers when the whole
 * input is numeric, lists become arrays, choices remain a comma-separated
 * line, and Counters are boolean arrays. Per-row Counter maximum overrides
 * live on the entry record under Atlas's dedicated override property.
 */
import {
  ABILITY_COUNTER_MAXES_KEY,
  DEFAULT_ABILITY_COUNTER_MAX,
  MAX_ABILITY_COUNTER_MAX,
  MIN_ABILITY_COUNTER_MAX,
  type AbilityPart,
} from './abilityPartsModel.ts';
import { isRecord, type JsonRecord } from './forgeTemplate.ts';

export type AbilityPartStoredValue = string | number | boolean | null | AbilityPartStoredValue[] | { [key: string]: AbilityPartStoredValue };

function boundedMax(value: unknown, fallback = DEFAULT_ABILITY_COUNTER_MAX): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(MIN_ABILITY_COUNTER_MAX, Math.min(MAX_ABILITY_COUNTER_MAX, numeric));
}

/** Counter marks are always a fixed-length boolean array for the selected maximum. */
export function normalizeAbilityCounterMarks(value: unknown, max: number): boolean[] {
  const length = boundedMax(max);
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length }, (_, index) => source[index] === true);
}

/** Default row value for one Part, suitable for a newly created ability line. */
export function defaultAbilityPartValue(part: { type: string; max?: number }): AbilityPartStoredValue {
  if (part.type === 'counter') return normalizeAbilityCounterMarks([], boundedMax(part.max));
  if (part.type === 'list') return [];
  if (part.type === 'number') return '';
  if (part.type === 'choice') return '';
  return '';
}

/** Defaults for a complete ability line, keyed by the Part keys. */
export function defaultAbilityPartValues(
  parts: readonly { key: string; type: string; max?: number }[],
  rowMaxOverrides: Readonly<Record<string, number>> = {},
): Record<string, AbilityPartStoredValue> {
  return Object.fromEntries(parts.map((part) => [
    part.key, part.type === 'counter'
      ? normalizeAbilityCounterMarks([], rowMaxOverrides[part.key] ?? part.max ?? DEFAULT_ABILITY_COUNTER_MAX)
      : defaultAbilityPartValue(part),
  ]));
}

export function splitAbilityPartListText(text: string): string[] {
  const closing: string[] = [];
  const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  const parts: string[] = [];
  let current = '';
  for (const char of text) {
    if (pairs[char]) closing.push(pairs[char] as string);
    else if (char === closing[closing.length - 1]) closing.pop();
    if ((char === ',' || char === '\n') && closing.length === 0) {
      const item = current.trim();
      if (item) parts.push(item);
      current = '';
    } else current += char;
  }
  const last = current.trim();
  if (last) parts.push(last);
  return parts;
}

/** Typed input to the value stored in the entry JSON. Undefined means the Part is blank. */
export function serializeAbilityPartValue(part: AbilityPart, raw: unknown): AbilityPartStoredValue | undefined {
  if (part.type === 'counter') {
    if (!Array.isArray(raw) || !raw.every((mark) => typeof mark === 'boolean')) return undefined;
    return normalizeAbilityCounterMarks(raw, boundedMax(part.max));
  }
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const text = String(raw).trim();
  if (!text) return undefined;
  if (part.type === 'number') {
    const normalized = text.replace(/[\u2212\u2013]/g, '-');
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
      const numeric = Number(normalized);
      if (Number.isFinite(numeric)) return numeric;
    }
    return text;
  }
  if (part.type === 'list') return splitAbilityPartListText(text);
  // Text, dice and Choice are stored as the line the user typed. A Choice
  // with `several` is still one line (for example "Common, Elvish").
  return text;
}

/** New entry defaults, including each Counter's default all-unmarked row. */
export function defaultAbilityEntry(
  parts: readonly AbilityPart[],
  nameKey = 'name',
  textKey = 'desc',
  rowMaxOverrides: Readonly<Record<string, number>> = {},
): Record<string, AbilityPartStoredValue> {
  const result: Record<string, AbilityPartStoredValue> = { [nameKey]: '', [textKey]: '' };
  Object.assign(result, defaultAbilityPartValues(parts, rowMaxOverrides));
  return result;
}

function counterOverrides(entry: JsonRecord): JsonRecord {
  const value = entry[ABILITY_COUNTER_MAXES_KEY];
  return isRecord(value) ? value : {};
}

/** Reads a row-specific override, falling back to the Part's template maximum. */
export function abilityCounterMaxForRow(entry: JsonRecord, part: AbilityPart): number {
  const override = counterOverrides(entry)[part.key];
  return boundedMax(override, boundedMax(part.max));
}

/** Writes a row-specific maximum and trims marks beyond it without touching other entry values. */
export function withAbilityCounterMaxForRow(entry: JsonRecord, part: AbilityPart, rawMax: number): JsonRecord {
  const max = boundedMax(rawMax, boundedMax(part.max));
  const overrides = { ...counterOverrides(entry), [part.key]: max };
  const currentMarks = entry[part.key];
  return {
    ...entry,
    [part.key]: normalizeAbilityCounterMarks(currentMarks, max),
    [ABILITY_COUNTER_MAXES_KEY]: overrides,
  };
}

/** Serializes Part values into a new entry while preserving other existing properties. */
export function serializeAbilityEntryParts(
  existing: JsonRecord,
  parts: readonly AbilityPart[],
  values: Readonly<Record<string, unknown>>,
): JsonRecord {
  const next: JsonRecord = { ...existing };
  for (const part of parts) {
    const raw = values[part.key];
    const value = part.type === 'counter' && Array.isArray(raw)
      ? normalizeAbilityCounterMarks(raw, abilityCounterMaxForRow(existing, part))
      : serializeAbilityPartValue(part, raw);
    if (value === undefined) delete next[part.key];
    else next[part.key] = value;
  }
  return next;
}
