import type { ForgeField } from './forgeTemplate.ts';

export interface SelectionOptionReference {
  key: string;
  value: string;
  index: number;
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

function choiceEntryMatches(value: unknown, option: string, numbered: boolean): boolean {
  if (typeof value === 'string') {
    if (value === option) return true;
    if (numbered && value.startsWith(`${option} `)) {
      const amount = Number(value.slice(option.length + 1).trim());
      return Number.isFinite(amount) && amount > 0;
    }
    return false;
  }
  if (Array.isArray(value)) return value.some((entry) => choiceEntryMatches(entry, option, numbered));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of ['choice', 'option', 'value', 'key', 'name', 'label']) {
      if (choiceEntryMatches(record[key], option, numbered)) return true;
    }
  }
  return false;
}

/** Whether a Selection's stored scalar or multi-pick value contains an option. */
export function selectionOptionIsSelected(field: ForgeField, raw: unknown, option: string, optionKey?: string): boolean {
  const numbered = field.numbered === true;
  if (typeof raw === 'string') {
    if (field.several === true) {
      return raw.split(',').some((part) => choiceEntryMatches(part.trim(), option, numbered));
    }
    return choiceEntryMatches(raw, option, numbered);
  }
  if (Array.isArray(raw)) {
    const entries = field.several === true ? raw : raw.slice(0, 1);
    return entries.some((entry) => choiceEntryMatches(entry, option, numbered));
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    for (const key of [option, ...(optionKey ? [optionKey] : [])]) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      const value = record[key];
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return Number.isFinite(value) && value > 0;
      if (typeof value === 'string') return value.trim() !== '' && Number(value) !== 0;
    }
    return Object.values(record).some((entry) => choiceEntryMatches(entry, option, numbered));
  }
  return false;
}

/** Treat the Selection Field itself as a boolean: any selected value is 1. */
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
