/**
 * Native Entry/Ability Part editing model.
 *
 * The Atlas template stores Parts in fields[].entry.extras. This module edits
 * that public data shape without depending on Atlas runtime code and preserves
 * unknown properties on both the field and each Part.
 */
import { cloneJson, isRecord, slugify, type BlockAppearance, type ForgeField, type ForgeLayoutDocument, type JsonRecord } from './forgeTemplate.ts';

export const ABILITY_PART_TYPES = ['text', 'number', 'dice', 'list', 'choice', 'counter'] as const;
export type AbilityPartType = (typeof ABILITY_PART_TYPES)[number];
export type AbilityPartTypeOption = AbilityPartType | (string & {});

export interface AbilityPart extends JsonRecord {
  key: string;
  label: string;
  type: AbilityPartTypeOption;
  options?: string[];
  several?: boolean;
  max?: number;
  look?: 'pips' | 'checkboxes';
}

export interface AbilityPartValidationIssue {
  code: 'malformed-part' | 'empty-key' | 'invalid-key' | 'duplicate-key' | 'reserved-key' | 'empty-label' | 'invalid-counter-max' | 'invalid-counter-look' | 'invalid-choice-options' | 'invalid-entry-key' | 'duplicate-entry-keys';
  fieldKey: string;
  partKey?: string;
  message: string;
}

const KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const BASE_RESERVED_KEYS = new Set(['__proto__', 'prototype', 'constructor', '_atlasCounterMaxes', 'statblock-forge']);
export const DEFAULT_ABILITY_COUNTER_MAX = 3;
export const MIN_ABILITY_COUNTER_MAX = 1;
export const MAX_ABILITY_COUNTER_MAX = 12;
export const ABILITY_COUNTER_MAXES_KEY = '_atlasCounterMaxes';

function entryShape(field: ForgeField): JsonRecord {
  return isRecord(field.entry) ? field.entry : {};
}

/** Validate the two reserved keys used by each Entries row. */
export function abilityEntryKeyProblem(field: ForgeField, nameKeyValue?: string, textKeyValue?: string): string | null {
  const entry = entryShape(field);
  const nameKey = (nameKeyValue ?? (typeof entry.nameKey === 'string' ? entry.nameKey : 'name')).trim() || 'name';
  const textKey = (textKeyValue ?? (typeof entry.textKey === 'string' ? entry.textKey : 'desc')).trim() || 'desc';
  for (const [label, key] of [['nome', nameKey], ['descrição', textKey]] as const) {
    if (!KEY_PATTERN.test(key)) return `A chave do ${label} da habilidade precisa começar com uma letra e conter apenas letras, números, _ ou - (máximo 40 caracteres).`;
    if (BASE_RESERVED_KEYS.has(key.toLowerCase())) return `A chave "${key}" é reservada e não pode ser usada no campo ${label}.`;
  }
  if (nameKey.toLowerCase() === textKey.toLowerCase()) {
    return `As chaves do nome e da descrição não podem ser iguais ("${nameKey}").`;
  }
  const collidingPart = abilityPartsForField(field).find((part) =>
    part.key.toLowerCase() === nameKey.toLowerCase() || part.key.toLowerCase() === textKey.toLowerCase());
  if (collidingPart) return `A chave "${collidingPart.key}" já está sendo usada por uma Ability Part.`;
  return null;
}

function rawParts(field: ForgeField): unknown[] {
  const extras = entryShape(field).extras;
  return Array.isArray(extras) ? extras : [];
}

function writeParts(field: ForgeField, extras: unknown[]): void {
  field.entry = { ...entryShape(field), ...(extras.length > 0 ? { extras } : {}) };
  if (extras.length === 0 && isRecord(field.entry)) {
    const next = { ...field.entry };
    delete next.extras;
    field.entry = Object.keys(next).length > 0 ? next : undefined;
  }
}

function validPart(value: unknown): value is AbilityPart {
  return isRecord(value)
    && typeof value.key === 'string'
    && typeof value.label === 'string'
    && typeof value.type === 'string';
}

/** Known or future Parts that have the minimum public shape needed to edit them. */
export function abilityPartsForField(field: ForgeField): AbilityPart[] {
  return rawParts(field).filter(validPart);
}


/**
 * Copies the shared Ability Parts schema to sibling Abilities fields while
 * retaining each tab's own name/text keys and any other field metadata. Atlas
 * treats the Parts as one schema shared by every tab of an Abilities tile.
 */
export function syncAbilityEntryShape(source: ForgeField, targets: readonly ForgeField[]): void {
  const sourceShape = cloneJson(entryShape(source));
  const sharedKeys = ['extras'] as const;
  for (const target of targets) {
    const next = { ...entryShape(target) };
    for (const key of sharedKeys) {
      if (Object.prototype.hasOwnProperty.call(sourceShape, key)) next[key] = sourceShape[key];
      else delete next[key];
    }
    target.entry = Object.keys(next).length > 0 ? next : undefined;
  }
}

function partKeyBase(label: string): string {
  const key = slugify(label).replace(/-/g, '_').slice(0, 40);
  return KEY_PATTERN.test(key) ? key : 'part';
}

function uniquePartKey(field: ForgeField, preferred: string): string {
  const parts = abilityPartsForField(field);
  const reserved = new Set([
    ...parts.map((part) => part.key.toLowerCase()),
    String(entryShape(field).nameKey ?? 'name').toLowerCase(),
    String(entryShape(field).textKey ?? 'desc').toLowerCase(),
    ...BASE_RESERVED_KEYS,
  ]);
  const base = partKeyBase(preferred);
  if (!reserved.has(base.toLowerCase())) return base;
  for (let suffix = 2; suffix < 10000; suffix += 1) {
    const candidate = `${base.slice(0, 40 - String(suffix).length - 1)}_${suffix}`;
    if (!reserved.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error('Não foi possível gerar uma chave exclusiva para a Part.');
}

export function abilityPartKeyProblem(field: ForgeField, candidate: string, currentKey?: string): string | null {
  const key = candidate.trim();
  if (!key) return 'A chave da Part não pode ficar vazia.';
  if (!KEY_PATTERN.test(key)) return 'Use de 1 a 40 caracteres: comece com uma letra e use apenas letras, números, _ ou -.';
  if (BASE_RESERVED_KEYS.has(key.toLowerCase())) return `A chave "${key}" é reservada.`;
  const entry = entryShape(field);
  const nameKey = typeof entry.nameKey === 'string' ? entry.nameKey : 'name';
  const textKey = typeof entry.textKey === 'string' ? entry.textKey : 'desc';
  if (key.toLowerCase() === nameKey.toLowerCase() || key.toLowerCase() === textKey.toLowerCase()) {
    return `A chave "${key}" já é usada pelo nome ou descrição da habilidade.`;
  }
  if (abilityPartsForField(field).some((part) => part.key !== currentKey && part.key.toLowerCase() === key.toLowerCase())) {
    return `A chave "${key}" já está sendo usada por outra Part.`;
  }
  return null;
}

function partDefaults(type: AbilityPartType): JsonRecord {
  if (type === 'choice') return { options: ['Option 1', 'Option 2'] };
  if (type === 'counter') return { max: DEFAULT_ABILITY_COUNTER_MAX, look: 'pips' };
  return {};
}

export function addAbilityPart(field: ForgeField, type: AbilityPartType, label = 'New Part'): AbilityPart {
  if (field.type !== 'entries') throw new Error('Ability Parts só podem ser adicionadas a campos Entries.');
  const key = uniquePartKey(field, label);
  const part: AbilityPart = { key, label: label.trim() || 'New Part', type, ...partDefaults(type) };
  writeParts(field, [...rawParts(field), part]);
  return part;
}

/** Changes a Part's type while removing only settings known to belong to another type. */
export function retypeAbilityPart(part: AbilityPart, type: AbilityPartType): AbilityPart {
  const next: AbilityPart = { ...part, type };
  delete next.options;
  delete next.several;
  delete next.max;
  delete next.look;
  Object.assign(next, partDefaults(type));
  return next;
}

export function updateAbilityPart(field: ForgeField, partKey: string, update: (part: AbilityPart) => AbilityPart): AbilityPart {
  const parts = rawParts(field);
  const index = parts.findIndex((part) => validPart(part) && part.key === partKey);
  if (index < 0) throw new Error(`A Part "${partKey}" não existe.`);
  const current = parts[index];
  if (!validPart(current)) throw new Error(`A Part "${partKey}" possui estrutura inválida.`);
  const next = update({ ...current });
  if (next.key !== partKey) {
    const problem = abilityPartKeyProblem(field, next.key, partKey);
    if (problem) throw new Error(problem);
  }
  const result = [...parts];
  result[index] = next;
  writeParts(field, result);
  return next;
}

export function renameAbilityPartKey(field: ForgeField, from: string, to: string): string {
  const candidate = to.trim();
  const problem = abilityPartKeyProblem(field, candidate, from);
  if (problem) throw new Error(problem);
  if (candidate.toLowerCase() === from.toLowerCase()) return from;
  updateAbilityPart(field, from, (part) => ({ ...part, key: candidate }));
  return candidate;
}

export function removeAbilityPart(field: ForgeField, partKey: string): boolean {
  const parts = rawParts(field);
  const next = parts.filter((part) => !validPart(part) || part.key !== partKey);
  if (next.length === parts.length) return false;
  writeParts(field, next);
  return true;
}

export function moveAbilityPart(field: ForgeField, partKey: string, direction: -1 | 1): boolean {
  const raw = rawParts(field);
  const indexes = raw.flatMap((part, index) => validPart(part) ? [index] : []);
  const currentIndex = indexes.find((index) => validPart(raw[index]) && raw[index].key === partKey);
  if (currentIndex === undefined) return false;
  const currentPosition = indexes.indexOf(currentIndex);
  const targetIndex = indexes[currentPosition + direction];
  if (targetIndex === undefined) return false;
  const next = [...raw];
  [next[currentIndex], next[targetIndex]] = [next[targetIndex], next[currentIndex]];
  writeParts(field, next);
  return true;
}

export function validateAbilityParts(fields: readonly ForgeField[]): AbilityPartValidationIssue[] {
  const issues: AbilityPartValidationIssue[] = [];
  for (const field of fields) {
    if (field.type !== 'entries') continue;
    const entry = entryShape(field);
    const nameKey = typeof entry.nameKey === 'string' && entry.nameKey.trim() ? entry.nameKey.trim() : 'name';
    const textKey = typeof entry.textKey === 'string' && entry.textKey.trim() ? entry.textKey.trim() : 'desc';
    if (!KEY_PATTERN.test(nameKey)) {
      issues.push({ code: 'invalid-entry-key', fieldKey: field.key, message: `A chave do nome da habilidade em "${field.label}" é inválida.` });
    }
    if (!KEY_PATTERN.test(textKey)) {
      issues.push({ code: 'invalid-entry-key', fieldKey: field.key, message: `A chave da descrição da habilidade em "${field.label}" é inválida.` });
    }
    if (nameKey.toLowerCase() === textKey.toLowerCase()) {
      issues.push({ code: 'duplicate-entry-keys', fieldKey: field.key, message: `As chaves do nome e da descrição de "${field.label}" são iguais ("${nameKey}").` });
    }
    const extras = entry.extras;
    if (extras === undefined) continue;
    if (!Array.isArray(extras)) {
      issues.push({ code: 'malformed-part', fieldKey: field.key, message: `As Ability Parts de "${field.label}" precisam ser uma lista.` });
      continue;
    }
    const seen = new Set<string>();
    for (const raw of extras) {
      if (!validPart(raw)) {
        issues.push({ code: 'malformed-part', fieldKey: field.key, message: `Há uma Ability Part com estrutura inválida em "${field.label}".` });
        continue;
      }
      const part = raw;
      const key = part.key.trim();
      if (!key) issues.push({ code: 'empty-key', fieldKey: field.key, partKey: part.key, message: `Uma Part de "${field.label}" está sem chave.` });
      else if (!KEY_PATTERN.test(key)) issues.push({ code: 'invalid-key', fieldKey: field.key, partKey: part.key, message: `A chave "${key}" da Part em "${field.label}" é inválida.` });
      else if (BASE_RESERVED_KEYS.has(key.toLowerCase()) || key.toLowerCase() === String(entry.nameKey ?? 'name').toLowerCase() || key.toLowerCase() === String(entry.textKey ?? 'desc').toLowerCase()) {
        issues.push({ code: 'reserved-key', fieldKey: field.key, partKey: part.key, message: `A chave "${key}" da Part em "${field.label}" conflita com uma chave reservada.` });
      }
      if (seen.has(key.toLowerCase())) issues.push({ code: 'duplicate-key', fieldKey: field.key, partKey: part.key, message: `A chave "${key}" aparece mais de uma vez nas Ability Parts de "${field.label}".` });
      seen.add(key.toLowerCase());
      if (!part.label.trim()) issues.push({ code: 'empty-label', fieldKey: field.key, partKey: part.key, message: `A Part "${key}" em "${field.label}" precisa de um nome.` });
      if (part.type === 'counter') {
        const max = part.max ?? DEFAULT_ABILITY_COUNTER_MAX;
        if (!Number.isInteger(max) || max < MIN_ABILITY_COUNTER_MAX || max > MAX_ABILITY_COUNTER_MAX) {
          issues.push({ code: 'invalid-counter-max', fieldKey: field.key, partKey: part.key, message: `O máximo do Counter "${part.label}" precisa ser de 1 a 12.` });
        }
        if (part.look !== undefined && part.look !== 'pips' && part.look !== 'checkboxes') {
          issues.push({ code: 'invalid-counter-look', fieldKey: field.key, partKey: part.key, message: `A aparência do Counter "${part.label}" precisa ser Pips ou Boxes.` });
        }
      }
      if (part.type === 'choice' && part.options !== undefined
        && (!Array.isArray(part.options) || !part.options.every((option) => typeof option === 'string'))) {
        issues.push({ code: 'invalid-choice-options', fieldKey: field.key, partKey: part.key, message: `As opções da Part "${part.label}" precisam ser uma lista de textos.` });
      }
    }
  }
  return issues;
}

/** Moves Forge-only per-Part appearance data when its native field key changes. */
export function renameAbilityPartAppearanceField(layout: Pick<ForgeLayoutDocument, 'abilityParts'>, from: string, to: string): void {
  if (!layout.abilityParts || !Object.prototype.hasOwnProperty.call(layout.abilityParts, from)) return;
  layout.abilityParts = { ...layout.abilityParts, [to]: layout.abilityParts[from] as Record<string, BlockAppearance> };
  delete layout.abilityParts[from];
}

export function removeAbilityPartAppearanceField(layout: Pick<ForgeLayoutDocument, 'abilityParts'>, fieldKey: string): void {
  if (!layout.abilityParts || !Object.prototype.hasOwnProperty.call(layout.abilityParts, fieldKey)) return;
  const next = { ...layout.abilityParts };
  delete next[fieldKey];
  layout.abilityParts = next;
}

export function renameAbilityPartAppearanceKey(
  layout: Pick<ForgeLayoutDocument, 'abilityParts'>,
  fieldKey: string,
  from: string,
  to: string,
): void {
  const parts = layout.abilityParts?.[fieldKey];
  if (!parts || !Object.prototype.hasOwnProperty.call(parts, from)) return;
  layout.abilityParts = {
    ...(layout.abilityParts ?? {}),
    [fieldKey]: { ...parts, [to]: parts[from] as BlockAppearance },
  };
  delete layout.abilityParts[fieldKey]?.[from];
}

export function removeAbilityPartAppearance(
  layout: Pick<ForgeLayoutDocument, 'abilityParts'>, fieldKey: string, partKey: string,
): void {
  const parts = layout.abilityParts?.[fieldKey];
  if (!parts || !Object.prototype.hasOwnProperty.call(parts, partKey)) return;
  const next = { ...parts };
  delete next[partKey];
  layout.abilityParts = { ...(layout.abilityParts ?? {}) };
  if (Object.keys(next).length > 0) layout.abilityParts[fieldKey] = next as Record<string, BlockAppearance>;
  else delete layout.abilityParts[fieldKey];
}

/** Updates three Forge-only indicator colors without placing them in Atlas's native template JSON. */
export function setAbilityPartIndicatorColor(
  layout: Pick<ForgeLayoutDocument, 'abilityParts'>,
  fieldKey: string,
  partKey: string,
  property: 'trackFillColor' | 'trackEmptyColor' | 'trackBorderColor',
  value: string | undefined,
): void {
  const byField = layout.abilityParts[fieldKey] ?? {};
  const current = byField[partKey] ?? {};
  const next = { ...current };
  if (value) next[property] = value;
  else delete next[property];
  const fieldParts = { ...byField };
  if (Object.keys(next).length > 0) fieldParts[partKey] = next as BlockAppearance;
  else delete fieldParts[partKey];
  const all = { ...layout.abilityParts };
  if (Object.keys(fieldParts).length > 0) all[fieldKey] = fieldParts;
  else delete all[fieldKey];
  layout.abilityParts = all;
}
