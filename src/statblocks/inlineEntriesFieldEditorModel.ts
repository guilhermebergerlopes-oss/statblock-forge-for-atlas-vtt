import {
  ABILITY_COUNTER_MAXES_KEY,
  DEFAULT_ABILITY_COUNTER_MAX,
  abilityPartsForField,
  type AbilityPart,
} from '../templates/abilityPartsModel.ts';
import {
  abilityCounterMaxForRow,
  defaultAbilityEntry,
  normalizeAbilityCounterMarks,
  serializeAbilityPartValue,
} from '../templates/abilityPartValues.ts';
import { isRecord, type ForgeField, type JsonRecord } from '../templates/forgeTemplate.ts';
import { releaseFieldCompendiumEntrySource } from './fieldCompendiumUsageModel.ts';

export interface InlineEntryDraft {
  name: string;
  text: string;
  parts: Record<string, string>;
  counterMarks: Record<string, boolean[]>;
  counterMaxes: Record<string, number>;
}

function entrySettings(field: ForgeField): JsonRecord {
  return isRecord(field.entry) ? field.entry : {};
}

export function inlineEntryNameKey(field: ForgeField): string {
  const value = entrySettings(field).nameKey;
  return typeof value === 'string' && value.trim() ? value : 'name';
}

export function inlineEntryTextKey(field: ForgeField): string {
  const value = entrySettings(field).textKey;
  return typeof value === 'string' && value.trim() ? value : 'desc';
}

function partDraftValue(part: AbilityPart, value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map((item) => String(item ?? '')).join('\n');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function inlineEntryDraftValue(field: ForgeField, rawEntry: unknown): InlineEntryDraft {
  // Atlas Entries may be stored as records, plain text, or positional lists
  // ([name, description...]). Read all three shapes the same way the Atlas
  // EntryLine/entryValues helpers do, so editing a legacy row does not erase
  // its visible content merely because it was not written as an object.
  const entry = isRecord(rawEntry) ? rawEntry : {};
  const parts: Record<string, string> = {};
  const counterMarks: Record<string, boolean[]> = {};
  const counterMaxes: Record<string, number> = {};
  for (const part of abilityPartsForField(field)) {
    if (part.type === 'counter') {
      const max = abilityCounterMaxForRow(entry, part);
      counterMaxes[part.key] = max;
      counterMarks[part.key] = normalizeAbilityCounterMarks(entry[part.key], max);
    } else {
      parts[part.key] = partDraftValue(part, entry[part.key]);
    }
  }
  const legacyName = Array.isArray(rawEntry) ? rawEntry[0] : undefined;
  const legacyText = Array.isArray(rawEntry)
    ? rawEntry.slice(1).map((item) => partDraftValue({ key: 'text', label: 'Text', type: 'text' }, item)).join('')
    : typeof rawEntry === 'string' ? rawEntry : undefined;
  const configuredTextKey = inlineEntryTextKey(field);
  const storedText = entry[configuredTextKey]
    ?? entry[configuredTextKey === 'desc' ? 'text' : 'desc']
    ?? entry.text
    ?? entry.description
    ?? legacyText;
  return {
    name: partDraftValue(
      { key: inlineEntryNameKey(field), label: 'Name', type: 'text' },
      entry[inlineEntryNameKey(field)] ?? entry.name ?? legacyName,
    ),
    text: partDraftValue(
      { key: inlineEntryTextKey(field), label: 'Description', type: 'text' },
      storedText,
    ),
    parts,
    counterMarks,
    counterMaxes,
  };
}

/** Build one edited Entries row, preserving unknown row properties and custom field keys. */
export function serializeInlineEntryDraft(
  field: ForgeField,
  previousEntry: unknown,
  draft: InlineEntryDraft,
): JsonRecord {
  const next: JsonRecord = isRecord(previousEntry)
    ? { ...previousEntry }
    : defaultAbilityEntry(abilityPartsForField(field), inlineEntryNameKey(field), inlineEntryTextKey(field));
  const name = draft.name.trim();
  const text = draft.text.trimEnd();
  const configuredNameKey = inlineEntryNameKey(field);
  const previous = isRecord(previousEntry) ? previousEntry : {};
  // Saving an actual edit turns the inserted copy into a statblock-only ability.
  // An unchanged edit never reaches this serializer, so it keeps its Compendium link.
  releaseFieldCompendiumEntrySource(next);
  const nameKey = Object.prototype.hasOwnProperty.call(previous, configuredNameKey)
    || configuredNameKey === 'name'
    ? configuredNameKey
    : Object.prototype.hasOwnProperty.call(previous, 'name') ? 'name' : configuredNameKey;
  if (name) next[nameKey] = name;
  else delete next[nameKey];
  const configuredTextKey = inlineEntryTextKey(field);
  const textKey = Object.prototype.hasOwnProperty.call(previous, configuredTextKey)
    || configuredTextKey === 'desc'
    ? configuredTextKey
    : Object.prototype.hasOwnProperty.call(previous, 'desc')
      ? 'desc'
      : Object.prototype.hasOwnProperty.call(previous, 'text')
        ? 'text'
        : configuredTextKey;
  if (text) next[textKey] = text;
  else delete next[textKey];

  for (const part of abilityPartsForField(field)) {
    if (part.type === 'counter') {
      const fallbackMax = Math.max(1, Math.min(12, Math.floor(Number(part.max) || DEFAULT_ABILITY_COUNTER_MAX)));
      const currentMax = abilityCounterMaxForRow(next, part);
      const maxCandidate = draft.counterMaxes[part.key] ?? currentMax;
      const maximum = Math.max(1, Math.min(12, Math.floor(Number(maxCandidate) || currentMax)));
      next[part.key] = normalizeAbilityCounterMarks(draft.counterMarks[part.key], maximum);
      const existingOverrides = isRecord(next[ABILITY_COUNTER_MAXES_KEY])
        ? { ...next[ABILITY_COUNTER_MAXES_KEY] }
        : {};
      if (maximum === fallbackMax) delete existingOverrides[part.key];
      else existingOverrides[part.key] = maximum;
      if (Object.keys(existingOverrides).length > 0) next[ABILITY_COUNTER_MAXES_KEY] = existingOverrides;
      else delete next[ABILITY_COUNTER_MAXES_KEY];
      continue;
    }
    const value = serializeAbilityPartValue(part, draft.parts[part.key] ?? '');
    if (value === undefined) delete next[part.key];
    else next[part.key] = value;
  }
  return next;
}

export function updateInlineEntriesValue(
  currentValue: unknown,
  field: ForgeField,
  index: number,
  draft: InlineEntryDraft,
): unknown[] {
  const rows = entryRows(currentValue);
  const next = serializeInlineEntryDraft(field, index >= 0 ? rows[index] : undefined, draft);
  if (index < 0 || index >= rows.length) rows.push(next);
  else rows[index] = next;
  return rows;
}

/** Insert a newly written Entry after the row being edited, as the Atlas pane does. */
export function insertInlineEntryValue(
  currentValue: unknown,
  field: ForgeField,
  afterIndex: number | null,
  draft: InlineEntryDraft,
): unknown[] {
  const rows = entryRows(currentValue);
  const next = serializeInlineEntryDraft(field, undefined, draft);
  const insertionIndex = afterIndex === null
    ? 0
    : Math.max(0, Math.min(rows.length, afterIndex + 1));
  rows.splice(insertionIndex, 0, next);
  return rows;
}

/** Move one Entry to its new visible position without rewriting the other rows. */
export function moveInlineEntryValue(currentValue: unknown, from: number, to: number): unknown[] {
  const rows = entryRows(currentValue);
  if (from < 0 || from >= rows.length || to < 0 || to >= rows.length || from === to) return rows;
  const [entry] = rows.splice(from, 1);
  if (entry === undefined) return rows;
  rows.splice(to, 0, entry);
  return rows;
}

export function removeInlineEntryValue(currentValue: unknown, index: number): unknown[] {
  const rows = entryRows(currentValue);
  if (index < 0 || index >= rows.length) return rows;
  return rows.filter((_row, rowIndex) => rowIndex !== index);
}

function entryRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return [...value];
  return value === undefined || value === null || value === '' ? [] : [value];
}
