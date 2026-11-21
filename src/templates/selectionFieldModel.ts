import type { ForgeField } from './forgeTemplate.ts';

export interface SelectionOptionReference {
  key: string;
  value: string;
  index: number;
}

export interface SelectionFieldPick {
  option: string;
  /** True when this pick was entered by the user rather than configured in the Template. */
  custom?: boolean;
  /** A numbered option may be selected before a number is entered. */
  number?: number;
  /** The unit written with this pick, when one was stored explicitly. */
  unit?: string;
}

export interface SelectionFieldRead {
  picks: SelectionFieldPick[];
  /** Values that do not match a configured option; preserve them verbatim. */
  unread: string[];
}

function baseOptionKey(value: string, index: number): string {
  const normalized = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!normalized) return `option_${index + 1}`;
  return /^[a-z_]/.test(normalized) ? normalized : `option_${normalized}`.slice(0, 40);
}

/**
 * Creates stable formula-reference segments from the configured Selection
 * labels. These keys are derived at runtime and never change Atlas' stored
 * string/array value format.
 */
export function selectionOptionReferences(field: ForgeField): SelectionOptionReference[] {
  if (field.type !== 'choice' || !Array.isArray(field.options)) return [];
  const used = new Set<string>();
  return field.options.flatMap((raw, index) => {
    if (typeof raw !== 'string' || !raw.trim()) return [];
    const base = baseOptionKey(raw.trim(), index);
    let key = base;
    let suffix = 2;
    while (used.has(key)) {
      const tail = `_${suffix++}`;
      key = `${base.slice(0, 40 - tail.length)}${tail}`;
    }
    used.add(key);
    return [{ key, value: raw, index }];
  });
}

const OPENERS: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}' };

/** Split native Selection text at commas/newlines outside brackets. */
function splitSelectionText(text: string): string[] {
  const parts: string[] = [];
  const closers: string[] = [];
  let current = '';
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? '';
    if (char === '\\' && text[index + 1] === ',') {
      current += ',';
      index++;
      continue;
    }
    if (OPENERS[char]) closers.push(OPENERS[char] ?? '');
    else if (char === closers[closers.length - 1]) closers.pop();
    if ((char === ',' || char === '\n') && closers.length === 0) {
      const part = current.trim();
      if (part) parts.push(part);
      current = '';
    } else current += char;
  }
  const last = current.trim();
  if (last) parts.push(last);
  return parts;
}

function selectionEntries(raw: unknown, several: boolean): unknown[] {
  if (Array.isArray(raw)) return several ? raw : raw.slice(0, 1);
  if (typeof raw === 'string') {
    if (!raw.trim()) return [];
    const entries = several ? splitSelectionText(raw) : [raw.trim()];
    return entries;
  }
  return raw === undefined || raw === null ? [] : [raw];
}

function parseNumberAndUnit(rest: string, unit: string): { number: number; unit: string } | null {
  if (!rest.trim()) return null;
  const normalized = rest.trim().replace(/[−–]/g, '-');
  const match = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))(.*)$/.exec(normalized);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number)) return null;
  const writtenUnit = (match[2] ?? '').trim();
  const configuredUnit = unit.trim();
  if (writtenUnit && (!configuredUnit || writtenUnit.toLocaleLowerCase() !== configuredUnit.toLocaleLowerCase())) return null;
  return { number, unit: writtenUnit };
}

function optionAtStart(options: readonly string[], part: string): string | undefined {
  const lower = part.toLocaleLowerCase();
  let found: string | undefined;
  for (const option of options) {
    const candidate = option.trim();
    const wanted = candidate.toLocaleLowerCase();
    if (!wanted || !lower.startsWith(wanted)) continue;
    const next = part.charAt(candidate.length);
    if (next !== '' && !/\s/.test(next)) continue;
    if (!found || candidate.length > found.trim().length) found = option;
  }
  return found;
}

function readConfiguredEntry(field: ForgeField, raw: string): SelectionFieldPick | null {
  const options = Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    : [];
  const option = optionAtStart(options, raw.trim());
  if (option === undefined) return null;
  const rest = raw.trim().slice(option.trim().length).trim();
  if (field.numbered !== true) return rest === '' ? { option } : null;
  if (rest === '') return { option, unit: typeof field.unit === 'string' ? field.unit.trim() : '' };
  const parsed = parseNumberAndUnit(rest, typeof field.unit === 'string' ? field.unit : '');
  return parsed ? { option, ...parsed } : null;
}

/**
 * Read a value entered through "Allow other values". When Track a number is
 * enabled, a trailing number (and optional configured unit) belongs to the
 * custom pick, not to its label. The serialized value remains Atlas-compatible
 * Selection text, so older templates do not need a schema migration.
 */
function readCustomEntry(field: ForgeField, raw: string): SelectionFieldPick | null {
  if (field.open !== true) return null;
  const text = raw.trim();
  if (!text) return null;
  const defaultUnit = typeof field.unit === 'string' ? field.unit.trim() : '';
  if (field.numbered !== true) return { option: text, custom: true };

  const numbered = /^(.+?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s+(.+))?$/.exec(text);
  if (numbered) {
    const label = (numbered[1] ?? '').trim();
    const numberAndUnit = `${numbered[2] ?? ''}${numbered[3] ? ` ${numbered[3]}` : ''}`;
    const parsed = parseNumberAndUnit(numberAndUnit, defaultUnit);
    if (label && parsed) {
      return {
        option: label,
        custom: true,
        ...parsed,
        unit: parsed.unit || defaultUnit,
      };
    }
  }
  return { option: text, custom: true, ...(defaultUnit ? { unit: defaultUnit } : {}) };
}

function readLegacyObject(field: ForgeField, raw: Record<string, unknown>): SelectionFieldPick[] {
  const options = Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === 'string')
    : [];
  const picks: SelectionFieldPick[] = [];
  for (const option of options) {
    const value = raw[option];
    if (value === true) picks.push({ option });
    else if (typeof value === 'number' && Number.isFinite(value) && (field.numbered === true || value > 0)) {
      picks.push({ option, ...(field.numbered === true ? { number: value } : {}) });
    } else if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))
      && (field.numbered === true || Number(value) > 0)) {
      picks.push({ option, ...(field.numbered === true ? { number: Number(value) } : {}) });
    }
  }
  return picks;
}

/** Read configured picks and unknown text without losing legacy/custom values. */
export function readSelectionField(field: ForgeField, raw: unknown): SelectionFieldRead {
  if (field.type !== 'choice') return { picks: [], unread: [] };
  const picks: SelectionFieldPick[] = [];
  const unread: string[] = [];
  const add = (pick: SelectionFieldPick): void => {
    if (picks.some((entry) => entry.option.toLocaleLowerCase() === pick.option.toLocaleLowerCase())) return;
    picks.push(pick);
  };
  for (const entry of selectionEntries(raw, field.several === true)) {
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) continue;
      const pick = readConfiguredEntry(field, text) ?? readCustomEntry(field, text);
      if (pick) add(pick);
      else unread.push(text);
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const pick of readLegacyObject(field, entry as Record<string, unknown>)) add(pick);
    }
  }
  return { picks: field.several === true ? picks : picks.slice(0, 1), unread };
}

/** Read the number attached to a Selection option. Returns null when absent. */
export function selectionOptionNumber(field: ForgeField, raw: unknown, option: string, optionKey?: string): number | null {
  if (field.type !== 'choice' || field.numbered !== true) return null;
  const target = optionKey
    ? selectionOptionReferences(field).find((reference) => reference.key === optionKey)?.value ?? option
    : option;
  const pick = readSelectionField(field, raw).picks.find((entry) => !entry.custom && entry.option === target);
  return typeof pick?.number === 'number' ? pick.number : null;
}

/** Whether a Selection's stored scalar or multi-pick value contains an option. */
export function selectionOptionIsSelected(field: ForgeField, raw: unknown, option: string, optionKey?: string): boolean {
  if (field.type !== 'choice') return false;
  const target = optionKey
    ? selectionOptionReferences(field).find((reference) => reference.key === optionKey)?.value ?? option
    : option;
  return readSelectionField(field, raw).picks.some((pick) => !pick.custom && pick.option === target);
}

/** Parse Atlas-compatible scalar, list and legacy object Selection values. */
export function parseSelectionFieldPicks(field: ForgeField, raw: unknown): SelectionFieldPick[] {
  return readSelectionField(field, raw).picks;
}

/** Serialize picks using Atlas' native comma-separated Selection Value shape. */
export function serializeSelectionFieldPicks(field: ForgeField, picks: readonly SelectionFieldPick[]): string {
  if (field.type !== 'choice') return '';
  const options = Array.isArray(field.options)
    ? field.options.filter((option): option is string => typeof option === 'string')
    : [];
  const normalized = picks
    .filter((pick) => pick.custom === true ? field.open === true : options.includes(pick.option))
    .filter((pick, index, list) => list.findIndex((candidate) =>
      candidate.option.toLocaleLowerCase() === pick.option.toLocaleLowerCase()) === index);
  const limited = field.several === true ? normalized : normalized.slice(0, 1);
  const defaultUnit = typeof field.unit === 'string' ? field.unit.trim() : '';
  return limited.map((pick) => {
    if (field.numbered !== true || typeof pick.number !== 'number' || !Number.isFinite(pick.number)) return pick.option;
    const unit = typeof pick.unit === 'string' ? pick.unit.trim() : defaultUnit;
    return `${pick.option} ${String(pick.number)}${unit ? ` ${unit}` : ''}`;
  }).join(', ');
}

/** Treat the Selection Field itself as a boolean: any stored value is 1. */
export function selectionHasValue(raw: unknown): boolean {
  if (typeof raw === 'string') return raw.trim().length > 0;
  if (Array.isArray(raw)) return raw.some((entry) => selectionHasValue(entry));
  if (typeof raw === 'number') return Number.isFinite(raw) && raw !== 0;
  if (typeof raw === 'boolean') return raw;
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).some((value) => selectionHasValue(value));
  }
  return false;
}
