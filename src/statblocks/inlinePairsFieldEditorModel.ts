/** Pure value helpers for Atlas-compatible inline Pairs editing. */

import { isRecord } from '../templates/forgeTemplate.ts';
import { writtenRoll } from './atlasDiceEngine/textRolls.ts';

export interface InlinePair {
  key: string;
  value: unknown;
}

export interface InlinePairDraft {
  key: string;
  value: string;
}

const LETTER = /\p{L}/u;
const RESERVED_PAIR_KEYS = new Set(['_atlascountermaxes']);

function scalarText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function numberFromText(value: string): number | null {
  const normalized = value.trim().replace(/[\u2212\u2013]/g, '-');
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Split Pairs text like the Atlas pane: commas outside brackets and line
 * breaks separate pairs; `\\,` keeps a comma inside a label.
 */
export function splitInlinePairsText(text: string): string[] {
  const closers: string[] = [];
  const result: string[] = [];
  let current = '';
  const openers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index] ?? '';
    if (character === '\\' && text[index + 1] === ',') {
      current += ',';
      index += 1;
      continue;
    }
    if (openers[character]) closers.push(openers[character] as string);
    else if (character === closers[closers.length - 1]) closers.pop();
    if (character === '\n') closers.length = 0;
    if ((character === '\n' || (character === ',' && closers.length === 0))) {
      if (current.trim()) result.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function escapePairLabel(value: string): string {
  const closers: string[] = [];
  const openers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  let output = '';
  for (const character of value) {
    if (openers[character]) closers.push(openers[character] as string);
    else if (character === closers[closers.length - 1]) closers.pop();
    output += character === ',' && closers.length === 0 ? '\\,' : character;
    if (character === '\n') closers.length = 0;
  }
  return output;
}

function splitExplicitPairText(source: string): { key: string; value: string } | null {
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\\') { index += 1; continue; }
    if (source[index] === ':') {
      const key = source.slice(0, index).replace(/\\([\\,:])/g, '$1').trim();
      return key ? { key, value: source.slice(index + 1).trim() } : null;
    }
  }
  return null;
}

function pairEntries(item: Record<string, unknown>): InlinePair[] {
  // Fantasy Statblocks may represent one pair as an Entry with name/desc.
  if (item.desc !== undefined && typeof item.name === 'string') {
    return [{ key: item.name.startsWith('_') ? '' : item.name, value: item.desc }];
  }
  return Object.entries(item)
    .filter(([key]) => !RESERVED_PAIR_KEYS.has(key.toLowerCase()))
    .map(([key, value]) => ({ key, value }));
}

/** Reads all Atlas-supported Pairs shapes in the order they are stored. */
function pairFromStoredItem(item: unknown): InlinePair[] {
  if (typeof item === 'string') {
    const text = item.trim();
    if (!text) return [];
    return [parseInlinePairText(text) ?? { key: text, value: null }];
  }
  return isRecord(item) ? pairEntries(item) : [];
}

export function inlinePairsFromValue(value: unknown): InlinePair[] {
  if (Array.isArray(value)) return value.flatMap(pairFromStoredItem);
  if (isRecord(value)) return pairEntries(value);
  if (typeof value === 'string' && value.trim()) {
    return splitInlinePairsText(value).flatMap((part) => {
      const parsed = parseInlinePairText(part);
      return parsed ? [parsed] : [{ key: '', value: part }];
    });
  }
  return [];
}

/** The text initially shown by the Atlas-style whole-Field input. */
export function inlinePairsDraftValue(value: unknown): string {
  if (typeof value === 'string') return value;
  const items = Array.isArray(value) ? value : [value];
  const parts = items.flatMap((item): string[] => {
    if (typeof item === 'string') return [escapePairLabel(item.trim())].filter(Boolean);
    if (!isRecord(item)) return [];
    return pairEntries(item).map(({ key, value: pairValue }) => {
      const valueText = scalarText(pairValue).trim();
      const escapedKey = escapePairLabel(key).replace(/:/g, '\\:');
      return valueText ? `${escapedKey}: ${valueText}` : escapedKey;
    }).filter(Boolean);
  });
  return parts.join(', ');
}

export function parseInlinePairText(text: string): InlinePair | null {
  const source = text.trim();
  if (!source) return null;

  // Pairs are labelled values. Atlas displays numeric bonuses natively and
  // its inline text renderer can also turn an explicit dice formula into a
  // clickable roll, so keep the accepted values to those two forms.
  const explicit = splitExplicitPairText(source);
  if (explicit) {
    const key = explicit.key;
    const rawValue = explicit.value;
    if (!key || !LETTER.test(key)) return null;
    const numeric = numberFromText(rawValue);
    if (numeric !== null) return { key, value: numeric };
    return writtenRoll(rawValue) ? { key, value: rawValue } : null;
  }

  // Preserve the convenient Atlas shorthand `Dexterity +5` and extend it to
  // formulas such as `Damage 2d8 + 3`. Test splits from left to right so a
  // multi-word label stays intact and a complete formula wins over its tail.
  for (let split = source.indexOf(' '); split > 0; split = source.indexOf(' ', split + 1)) {
    const key = source.slice(0, split).trim();
    const rawValue = source.slice(split + 1).trim();
    if (!key || !LETTER.test(key) || !rawValue) continue;
    const numeric = numberFromText(rawValue);
    if (numeric !== null) return { key, value: numeric };
    if (writtenRoll(rawValue)) return { key, value: rawValue };
  }
  return null;
}

/** Serialize structured Name/Value rows; values must be numbers or dice formulas. */
export function serializeInlinePairsDraftRows(
  drafts: readonly InlinePairDraft[],
  language: 'en' | 'pt-BR' = 'en',
): Array<Record<string, number | string>> | undefined {
  const pairs: Array<Record<string, number | string>> = [];
  for (const draft of drafts) {
    const key = draft.key.trim();
    const rawValue = draft.value.trim();
    if (!key && !rawValue) continue;
    if (!key || !LETTER.test(key)) {
      throw new Error(language === 'pt-BR'
        ? 'Informe um nome para cada par.'
        : 'Enter a name for each pair.');
    }
    const numeric = numberFromText(rawValue);
    if (numeric !== null) {
      pairs.push({ [key]: numeric });
      continue;
    }
    if (writtenRoll(rawValue)) {
      pairs.push({ [key]: rawValue });
      continue;
    }
    throw new Error(language === 'pt-BR'
      ? `O valor de "${key}" precisa ser um número ou uma fórmula de dados, como 2d8+3.`
      : `The value for "${key}" must be a number or dice formula, such as 2d8+3.`);
  }
  return pairs.length > 0 ? pairs : undefined;
}

/** Parse the complete text edit atomically; numeric and dice values are supported. */
export function parseInlinePairsDraft(raw: string, language: 'en' | 'pt-BR' = 'pt-BR'): Array<Record<string, number | string>> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const pairs: Array<Record<string, number | string>> = [];
  for (const part of splitInlinePairsText(trimmed)) {
    const pair = parseInlinePairText(part);
    if (!pair) {
      throw new Error(language === 'pt-BR'
        ? `"${part}" não é um par válido. Use "Nome: +5" ou uma fórmula, como "Dano: 2d8+3".`
        : `"${part}" is not a valid pair. Use "Name: +5" or a formula such as "Damage: 2d8+3".`);
    }
    pairs.push({ [pair.key]: pair.value as number | string });
  }
  return pairs;
}

export function inlinePairName(key: string): string {
  return key.trim().replace(/^\p{Ll}/u, (letter) => letter.toLocaleUpperCase());
}

export function inlinePairValueText(value: unknown, signed: boolean): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const clean = String(value);
    return signed && value >= 0 ? `+${clean}` : clean;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (signed) {
      const number = numberFromText(trimmed);
      if (number !== null && number >= 0) return `+${String(number)}`;
    }
    return trimmed;
  }
  return scalarText(value).trim();
}
