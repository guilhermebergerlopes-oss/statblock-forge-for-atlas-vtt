/**
 * Pure field/header editing operations for Statblock Forge.
 *
 * This module deliberately owns no Obsidian UI state. It edits the documented
 * Atlas template JSON shape and preserves unknown properties while keeping
 * field references coherent.
 */
import { diceFieldFormulaUsesField, renameDiceFieldFormulaReference } from '../statblocks/diceFieldFormulaModel.ts';
import { isFormulaCapableNumericField } from './numericFieldModel.ts';
import {
  DEFAULT_SCORE_COLUMNS,
  FIELD_TO_BLOCK,
  headerFieldForPart,
  isHeaderField,
  isRecord,
  slugify,
  type ForgeBlock,
  type ForgeField,
  type ForgeTemplate,
  type JsonRecord,
} from './forgeTemplate.ts';

export type HeaderPartId = 'name' | 'token' | 'level' | 'type' | 'hp' | 'description';
export type FieldMeaning = 'hit-points' | 'armor' | 'rating' | 'size' | 'creature-type' | 'senses' | 'initiative' | 'traits' | 'description' | 'display-name';

export const HEADER_PARTS: ReadonlyArray<{ id: HeaderPartId; label: string; always: boolean }> = [
  { id: 'name', label: 'Name', always: true },
  { id: 'token', label: 'Token art', always: true },
  { id: 'level', label: 'Level', always: false },
  { id: 'type', label: 'Type', always: false },
  { id: 'hp', label: 'HP', always: false },
  { id: 'description', label: 'Description', always: false },
];

/** Minimal optional references accepted from any native block shape. */
export type BlockFieldReferences = Record<string, unknown>;

/** Resolves the primary Template Field when a linked canvas block is selected. */
export function firstLinkedTemplateFieldKey(block: BlockFieldReferences): string | null {
  if (typeof block.field === 'string' && block.field.trim()) return block.field;
  if (Array.isArray(block.fields)) {
    const first = block.fields.find((key): key is string => typeof key === 'string' && key.trim().length > 0);
    return first ?? null;
  }
  return null;
}

/** Returns the field inspector target for a single, valid block selection. */
export function templateFieldKeyToOpenForBlock(
  block: BlockFieldReferences,
  availableFieldKeys: readonly string[],
  additiveSelection = false,
): string | null {
  if (additiveSelection) return null;
  const key = firstLinkedTemplateFieldKey(block);
  return key && availableFieldKeys.includes(key) ? key : null;
}

export interface FieldReference {
  blockId: string;
  blockType: string;
  property: string;
}

export interface FieldValidationIssue {
  code: 'invalid-key' | 'duplicate-key' | 'reserved-key' | 'missing-reference' | 'duplicate-meaning' | 'duplicate-block-field-reference';
  message: string;
  fieldKey?: string;
  blockId?: string;
}

const FIELD_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const RESERVED_FIELD_KEYS = new Set(['tags', 'statblock-forge', '__forgeconditions', '__forgeconditionvalues', '__proto__', 'prototype', 'constructor']);
const HEADER_MEANINGS = new Set(['rating', 'creature-type', 'hit-points', 'description', 'display-name']);

function addDefaultSample(template: ForgeTemplate, key: string, value: unknown): void {
  const sample = isRecord(template.sample) ? { ...template.sample } : {};
  if (!Object.prototype.hasOwnProperty.call(sample, key)) sample[key] = value;
  template.sample = sample;
}

function formerKeys(field: ForgeField): string[] {
  return Array.isArray(field.formerKeys)
    ? field.formerKeys.filter((key): key is string => typeof key === 'string')
    : [];
}

/** Returns a short, actionable explanation when a field key cannot be used. */
export function fieldKeyProblem(template: ForgeTemplate, key: string, currentKey?: string): string | null {
  const candidate = key.trim();
  if (!candidate) return 'A chave do campo não pode ficar vazia.';
  if (!FIELD_KEY_PATTERN.test(candidate)) return 'Use de 1 a 40 caracteres: comece com uma letra e use apenas letras, números, _ ou -.';
  if (RESERVED_FIELD_KEYS.has(candidate.toLowerCase())) return `A chave "${candidate}" é reservada pelo Atlas ou pelo JavaScript.`;

  const taken = template.fields.some((field) => {
    if (field.key === currentKey) return false;
    return field.key.toLowerCase() === candidate.toLowerCase()
      || formerKeys(field).some((former) => former.toLowerCase() === candidate.toLowerCase());
  });
  if (taken) return `A chave "${candidate}" já está sendo usada por outro campo ou foi usada anteriormente.`;
  return null;
}

/** Header fields are fixed parts of the card, not regular layout fields. */
export function templateFields(template: ForgeTemplate): ForgeField[] {
  return template.fields.filter((field) => !isHeaderField(field));
}

/** Adds a missing fixed header field without creating a layout block. */
export function addMissingHeaderField(template: ForgeTemplate, part: HeaderPartId): ForgeField {
  const existing = headerFieldForPart(template.fields, part);
  if (existing) return existing;

  const definition: Record<HeaderPartId, Omit<ForgeField, 'key'> & { key: string; sample: unknown }> = {
    name: { key: 'name', label: 'Name', type: 'text', sample: 'Creature name' },
    token: { key: 'image', label: 'Token art', type: 'image', sample: '' },
    level: { key: 'level', label: 'Level', type: 'rating', meaning: 'rating', sample: '1' },
    type: { key: 'type', label: 'Type', type: 'text', meaning: 'creature-type', sample: 'Creature' },
    hp: { key: 'hp', label: 'HP', type: 'number', meaning: 'hit-points', sample: 10 },
    description: { key: 'description', label: 'Description', type: 'markdown', meaning: 'description', sample: 'A short description.' },
  };
  const source = definition[part];
  const { sample, ...field } = source;
  // A header's meaning takes precedence over a conventional key in Atlas. The
  // key remains fixed for Name and Token, whose header parts have no meaning.
  if ((part === 'name' || part === 'token') && template.fields.some((item) => item.key === field.key)) {
    throw new Error(`Não foi possível restaurar ${source.label}: a chave "${field.key}" já está ocupada.`);
  }
  template.fields.push(field as ForgeField);
  addDefaultSample(template, field.key, sample);
  return field as ForgeField;
}

function replacePatternReference(pattern: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return pattern.replace(new RegExp(`\\{${escaped}\\}`, 'g'), `{${to}}`);
}

/** Formula references in numeric/Metric/Score formulas use exact field identifiers. */
function formulaUsesField(formula: string, key: string): boolean {
  if (diceFieldFormulaUsesField(formula, key)) return true;
  if (restFormulaReferences(formula).some(({ path }) => path === key || path.startsWith(`${key}.`) || path.startsWith(`${key}-`))) return true;
  const pattern = /[A-Za-z_][A-Za-z0-9_.]*/g;
  for (const match of formula.matchAll(pattern)) {
    const token = match[0];
    if (token !== key && !token.startsWith(`${key}.`)) continue;
    // `value`, `true` and `false` are evaluator keywords, not Field lookups.
    if (token === key && ['value', 'true', 'false'].includes(token.toLowerCase())) continue;
    const next = formula.slice((match.index ?? 0) + token.length).match(/^\s*(.)/)?.[1];
    if (token === key && next === '(') continue;
    return true;
  }
  return false;
}

function renameFormulaFieldReference(formula: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let updated = formula.replace(new RegExp(`@${escaped}(?![A-Za-z0-9_.-])|\\{${escaped}\\}`, 'g'), (match) => match.startsWith('@') ? `@${to}` : `{${to}}`);
  updated = updated.replace(/[A-Za-z_][A-Za-z0-9_.]*/g, (token, offset: number, source: string) => {
    if (token !== from && !token.startsWith(`${from}.`)) return token;
    // These names have evaluator-specific meanings and are not Field lookups.
    if (token === from && ['value', 'true', 'false'].includes(token.toLowerCase())) return token;
    // Do not rewrite a function name such as `max(...)` if a Field happens to share its name.
    const next = source.slice(offset + token.length).match(/^\s*(.)/)?.[1];
    if (token === from && next === '(') return token;
    return `${to}${token.slice(from.length)}`;
  });
  return updated;
}

/** Reads explicit formula references, skipping bracketed labels. */
function restFormulaReferences(formula: string): Array<{ start: number; end: number; path: string; delimiter: '@' | '{}' }> {
  const result: Array<{ start: number; end: number; path: string; delimiter: '@' | '{}' }> = [];
  const atPattern = /@([A-Za-z_](?:[\w-]*\w)?(?:\.\w(?:[\w-]*\w)?)*)/y;
  const bracePattern = /\{([A-Za-z_](?:[\w-]*\w)?(?:\.\w(?:[\w-]*\w)?)*)\}/y;
  let cursor = 0;
  while (cursor < formula.length) {
    if (formula[cursor] === '[') {
      const close = formula.indexOf(']', cursor);
      cursor = close < 0 ? formula.length : close + 1;
      continue;
    }
    const delimiter = formula[cursor] === '@' ? '@' : formula[cursor] === '{' ? '{}' : null;
    if (!delimiter) { cursor += 1; continue; }
    const pattern = delimiter === '@' ? atPattern : bracePattern;
    pattern.lastIndex = cursor;
    const match = pattern.exec(formula);
    if (!match) { cursor += 1; continue; }
    result.push({ start: cursor, end: pattern.lastIndex, path: match[1] ?? '', delimiter });
    cursor = pattern.lastIndex;
  }
  return result;
}

/** Both @Field and {Field} references are recognized in Rest and formula dependencies. */
function restFormulaUsesField(formula: string, key: string): boolean {
  return restFormulaReferences(formula).some(({ path }) => path === key || path.startsWith(`${key}.`)
    || path.startsWith(`${key}-`)
    || (path.startsWith(key) && /^[dD](?:\d|%|[fF](?![A-Za-z]))/.test(path.slice(key.length))));
}

function renameRestFormulaFieldReference(formula: string, from: string, to: string): string {
  const references = restFormulaReferences(formula);
  if (references.length === 0) return formula;
  let result = '';
  let cursor = 0;
  for (const reference of references) {
    const { path, start, end, delimiter } = reference;
    let replacement = formula.slice(start, end);
    if (path === from || path.startsWith(`${from}.`) || path.startsWith(`${from}-`)) {
      const renamed = `${to}${path.slice(from.length)}`;
      replacement = delimiter === '@' ? `@${renamed}` : `{${renamed}}`;
    } else {
      const suffix = path.slice(from.length);
      if (path.startsWith(from) && /^[dD](?:\d|%|[fF](?![A-Za-z]))/.test(suffix)) {
        const renamed = `${to}${suffix}`;
        replacement = delimiter === '@' ? `@${renamed}` : `{${renamed}}`;
      }
    }
    result += formula.slice(cursor, start) + replacement;
    cursor = end;
  }
  return result + formula.slice(cursor);
}

function recoveryRuleFieldReference(record: JsonRecord, property: 'target' | 'from' | 'to', key: string): boolean {
  const value = record[property];
  if (!isRecord(value) || value.field !== key) return false;
  if (property === 'to') return true;
  return value.kind === 'resource' || value.kind === 'counters';
}

function visitRecoveryRecords(
  value: unknown,
  key: string,
  references: FieldReference[],
  path = 'recovery',
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitRecoveryRecords(item, key, references, `${path}[${index}]`));
    return;
  }
  if (!isRecord(value)) return;
  const id = typeof value.id === 'string' ? value.id : path;
  for (const property of ['target', 'from', 'to'] as const) {
    if (recoveryRuleFieldReference(value, property, key)) {
      references.push({ blockId: id, blockType: 'rest', property: `${property}.field` });
    }
  }
  for (const property of ['formula', 'each'] as const) {
    if (typeof value[property] === 'string' && restFormulaUsesField(value[property] as string, key)) {
      references.push({ blockId: id, blockType: 'rest', property });
    }
  }
  for (const [property, child] of Object.entries(value)) {
    if (child && typeof child === 'object') visitRecoveryRecords(child, key, references, `${path}.${property}`);
  }
}

function renameRecoveryReferences(value: unknown, from: string, to: string): void {
  if (Array.isArray(value)) {
    value.forEach((item) => renameRecoveryReferences(item, from, to));
    return;
  }
  if (!isRecord(value)) return;
  for (const property of ['target', 'from', 'to'] as const) {
    const target = value[property];
    if (isRecord(target) && target.field === from
      && (property === 'to' || target.kind === 'resource' || target.kind === 'counters')) {
      target.field = to;
    }
  }
  for (const property of ['formula', 'each'] as const) {
    if (typeof value[property] === 'string') value[property] = renameRestFormulaFieldReference(value[property] as string, from, to);
  }
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object') renameRecoveryReferences(child, from, to);
  }
}

function renameBlockReferences(blocks: ForgeBlock[], from: string, to: string): ForgeBlock[] {
  let changed = false;
  const result = blocks.map((block) => {
    const next: JsonRecord = { ...block };
    let blockChanged = false;
    const update = (property: string, value: unknown): void => {
      if (next[property] !== value) { next[property] = value; blockChanged = true; }
    };

    if (block.field === from) update('field', to);
    for (const property of ['headingField', 'rollFrom', 'introField'] as const) {
      if (block[property] === from) update(property, to);
    }
    const boundFields = block.fields;
    if (Array.isArray(boundFields)) {
      const fields = boundFields.map((value: unknown) => value === from ? to : value);
      if (fields.some((value: unknown, index: number) => value !== boundFields[index])) update('fields', fields);
    }
    for (const property of ['pattern', 'fallback'] as const) {
      if (typeof block[property] === 'string') update(property, replacePatternReference(block[property] as string, from, to));
    }
    const sourceFormulas = block.formulas;
    if (Array.isArray(sourceFormulas)) {
      const formulas = sourceFormulas.map((formula) => typeof formula === 'string'
        ? renameFormulaFieldReference(formula, from, to) : formula);
      if (formulas.some((formula, index) => formula !== sourceFormulas[index])) update('formulas', formulas);
    }
    if (isRecord(block.showWhen) && block.showWhen.field === from) {
      update('showWhen', { ...block.showWhen, field: to });
    }
    const sourceColumns = block.columns;
    if (Array.isArray(sourceColumns)) {
      const columns = sourceColumns.map((column: unknown) => {
        if (!isRecord(column)) return column;
        const nextColumn = { ...column };
        if (nextColumn.field === from) nextColumn.field = to;
        if (typeof nextColumn.formula === 'string') {
          nextColumn.formula = renameFormulaFieldReference(nextColumn.formula, from, to);
        }
        return Object.keys(nextColumn).some((property) => nextColumn[property] !== column[property]) ? nextColumn : column;
      });
      if (columns.some((column: unknown, index: number) => column !== sourceColumns[index])) update('columns', columns);
    }
    if (Array.isArray(block.blocks)) {
      const children = renameBlockReferences(block.blocks.filter(isRecord) as ForgeBlock[], from, to);
      if (children !== block.blocks) update('blocks', children);
    }
    if (blockChanged) changed = true;
    return blockChanged ? next as ForgeBlock : block;
  });
  return changed ? result : blocks;
}

function moveRecordKey(record: unknown, from: string, to: string): JsonRecord | undefined {
  if (!isRecord(record) || !Object.prototype.hasOwnProperty.call(record, from)) return isRecord(record) ? record : undefined;
  const next = { ...record };
  const value = next[from];
  delete next[from];
  next[to] = value;
  return next;
}

/** Renames a custom field key and updates every supported native reference. */
export function renameTemplateFieldKey(template: ForgeTemplate, from: string, to: string): void {
  const field = template.fields.find((item) => item.key === from);
  if (!field) throw new Error(`O campo "${from}" não existe.`);
  const candidate = to.trim();
  // Treat case-only changes as no-ops so the current key is not added to formerKeys.
  if (candidate.toLowerCase() === from.toLowerCase()) return;
  const problem = fieldKeyProblem(template, candidate, from);
  if (problem) throw new Error(problem);
  if (candidate === from) return;
  if (isHeaderField(field)) throw new Error('A chave dos campos fixos do Header não pode ser alterada.');

  const candidateIdentity = candidate.toLowerCase();
  const fromIdentity = from.toLowerCase();
  // Restoring one of this Field's own historical keys (including a case-only spelling change)
  // makes that key current again; it must no longer remain in formerKeys as a duplicate alias.
  const oldFormer = formerKeys(field).filter((key) => {
    const identity = key.toLowerCase();
    return identity !== candidateIdentity && identity !== fromIdentity;
  });
  field.key = candidate;
  field.formerKeys = [from, ...oldFormer];
  for (const candidateField of template.fields) {
    const tracks = isRecord(candidateField.tracks) ? candidateField.tracks : null;
    if (tracks?.max === from) candidateField.tracks = { ...tracks, max: candidate };
    if (typeof candidateField.formula === 'string') {
      candidateField.formula = renameFormulaFieldReference(candidateField.formula, from, candidate);
    }
    if (typeof candidateField.diceFormula === 'string') {
      candidateField.diceFormula = renameDiceFieldFormulaReference(candidateField.diceFormula, from, candidate);
    }
  }
  template.layout.blocks = renameBlockReferences(template.layout.blocks, from, candidate);
  renameRecoveryReferences(template.recovery, from, candidate);
  template.sample = moveRecordKey(template.sample, from, candidate) ?? template.sample;
  template.players = moveRecordKey(template.players, from, candidate) ?? template.players;
}

/** Change a field's Atlas semantic meaning, refusing ambiguous duplicates. */
export function setTemplateFieldMeaning(template: ForgeTemplate, key: string, meaning: FieldMeaning | null): void {
  const field = template.fields.find((item) => item.key === key);
  if (!field) throw new Error(`O campo "${key}" não existe.`);
  if (meaning && template.fields.some((item) => item !== field && item.meaning === meaning)) {
    throw new Error(`O significado "${meaning}" já está atribuído a outro campo.`);
  }
  if (meaning === null) delete field.meaning;
  else field.meaning = meaning;
}

/** Move only user-defined fields; the fixed header remains in its native order. */
export function moveTemplateField(template: ForgeTemplate, key: string, direction: -1 | 1): void {
  if (direction !== -1 && direction !== 1) return;
  const custom = templateFields(template);
  const currentPosition = custom.findIndex((field) => field.key === key);
  const target = custom[currentPosition + direction];
  if (currentPosition < 0 || !target) return;
  reorderTemplateField(template, key, target.key, direction > 0);
}

/**
 * Reorders user-defined fields as a list while leaving the fixed header fields
 * in their original slots and order. `afterTarget` controls which side of the
 * drop target receives the dragged field.
 */
export function reorderTemplateField(
  template: ForgeTemplate,
  sourceKey: string,
  targetKey: string,
  afterTarget = false,
): boolean {
  if (sourceKey === targetKey) return false;

  const custom = templateFields(template);
  const sourceIndex = custom.findIndex((field) => field.key === sourceKey);
  const targetIndex = custom.findIndex((field) => field.key === targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return false;

  const [source] = custom.splice(sourceIndex, 1);
  if (!source) return false;
  const targetIndexAfterRemoval = custom.findIndex((field) => field.key === targetKey);
  if (targetIndexAfterRemoval < 0) return false;
  custom.splice(targetIndexAfterRemoval + (afterTarget ? 1 : 0), 0, source);

  let customIndex = 0;
  template.fields = template.fields.map((field) => (
    isHeaderField(field) ? field : (custom[customIndex++] as ForgeField)
  ));
  return true;
}

/** Lists every recognized layout, formula and Rest reference to a field. */
export function findFieldReferences(template: ForgeTemplate, key: string): FieldReference[] {
  const references: FieldReference[] = [];
  const visit = (blocks: readonly ForgeBlock[]): void => {
    for (const block of blocks) {
      const record = block as JsonRecord;
      if (record.field === key) references.push({ blockId: block.id, blockType: block.type, property: 'field' });
      for (const property of ['headingField', 'rollFrom', 'introField'] as const) {
        if (record[property] === key) references.push({ blockId: block.id, blockType: block.type, property });
      }
      if (Array.isArray(record.fields) && record.fields.includes(key)) references.push({ blockId: block.id, blockType: block.type, property: 'fields' });
      if (isRecord(record.showWhen) && record.showWhen.field === key) references.push({ blockId: block.id, blockType: block.type, property: 'showWhen.field' });
      if (Array.isArray(record.columns)) {
        for (const column of record.columns) {
          if (!isRecord(column)) continue;
          if (column.field === key) references.push({ blockId: block.id, blockType: block.type, property: 'columns.field' });
          if (typeof column.formula === 'string' && formulaUsesField(column.formula, key)) {
            references.push({ blockId: block.id, blockType: block.type, property: 'columns.formula' });
          }
        }
      }
      if (Array.isArray(record.formulas) && record.formulas.some((formula) => typeof formula === 'string' && formulaUsesField(formula, key))) {
        references.push({ blockId: block.id, blockType: block.type, property: 'formulas' });
      }
      for (const property of ['pattern', 'fallback'] as const) {
        if (typeof record[property] === 'string' && (record[property] as string).includes(`{${key}}`)) {
          references.push({ blockId: block.id, blockType: block.type, property });
        }
      }
      if (Array.isArray(record.blocks)) visit(record.blocks.filter(isRecord) as ForgeBlock[]);
    }
  };
  visit(template.layout.blocks);
  for (const field of template.fields) {
    if (field.key === key) continue;
    if (isRecord(field.tracks) && field.tracks.max === key) {
      references.push({ blockId: '(field)', blockType: 'field', property: `${field.key}.tracks.max` });
    }
    if (typeof field.formula === 'string' && formulaUsesField(field.formula, key)) {
      references.push({ blockId: field.key, blockType: 'field', property: 'formula' });
    }
    if (typeof field.diceFormula === 'string' && diceFieldFormulaUsesField(field.diceFormula, key)) {
      references.push({ blockId: field.key, blockType: 'field', property: 'diceFormula' });
    }
  }
  visitRecoveryRecords(template.recovery, key, references);
  return references;
}

const AUTOMATICALLY_UNBOUND_BLOCK_REFERENCES = new Set([
  'field', 'headingField', 'rollFrom', 'introField', 'fields',
  'showWhen.field', 'columns.field', 'pattern', 'fallback',
]);

/** Removes direct bindings and interpolation tokens from every nested layout block. */
function unbindFieldFromLayoutBlocks(blocks: ForgeBlock[], key: string): ForgeBlock[] {
  let changed = false;
  const nextBlocks = blocks.map((block) => {
    const next: JsonRecord = { ...block };
    let blockChanged = false;
    const removeProperty = (property: string): void => {
      if (Object.prototype.hasOwnProperty.call(next, property)) {
        delete next[property];
        blockChanged = true;
      }
    };

    if (block.field === key) removeProperty('field');
    for (const property of ['headingField', 'rollFrom', 'introField'] as const) {
      if (block[property] === key) removeProperty(property);
    }

    if (Array.isArray(block.fields) && block.fields.includes(key)) {
      const remaining = block.fields.filter((value) => value !== key);
      if (remaining.length > 0) next.fields = remaining;
      else delete next.fields;
      blockChanged = true;
    }

    if (isRecord(block.showWhen) && block.showWhen.field === key) {
      const showWhen = { ...block.showWhen };
      delete showWhen.field;
      if (Object.keys(showWhen).length > 0) next.showWhen = showWhen;
      else delete next.showWhen;
      blockChanged = true;
    }

    if (Array.isArray(block.columns)) {
      let columnsChanged = false;
      const columns = block.columns.map((column) => {
        if (!isRecord(column) || column.field !== key) return column;
        const nextColumn = { ...column };
        delete nextColumn.field;
        columnsChanged = true;
        return nextColumn;
      });
      if (columnsChanged) {
        next.columns = columns;
        blockChanged = true;
      }
    }

    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const interpolation = new RegExp(`\\{${escapedKey}\\}`, 'g');
    for (const property of ['pattern', 'fallback'] as const) {
      const source = block[property];
      if (typeof source !== 'string' || !interpolation.test(source)) continue;
      interpolation.lastIndex = 0;
      next[property] = source.replace(interpolation, '');
      interpolation.lastIndex = 0;
      blockChanged = true;
    }

    if (Array.isArray(block.blocks)) {
      const children = unbindFieldFromLayoutBlocks(block.blocks as ForgeBlock[], key);
      if (children !== block.blocks) {
        next.blocks = children;
        blockChanged = true;
      }
    }

    if (blockChanged) changed = true;
    return blockChanged ? next as ForgeBlock : block;
  });
  return changed ? nextBlocks : blocks;
}

/**
 * Removes a custom field and automatically unbinds it from Canvas blocks.
 * Formula, other-Field, and Rest dependencies still block deletion to avoid
 * silently invalidating calculations or recovery rules.
 */
export function removeTemplateField(template: ForgeTemplate, key: string): void {
  const field = template.fields.find((item) => item.key === key);
  if (!field) throw new Error(`O campo "${key}" não existe.`);
  if (isHeaderField(field)) throw new Error('Campos do Header não podem ser removidos.');

  const blockingReferences = findFieldReferences(template, key).filter((reference) =>
    !AUTOMATICALLY_UNBOUND_BLOCK_REFERENCES.has(reference.property),
  );
  if (blockingReferences.length > 0) {
    const summary = blockingReferences.slice(0, 4)
      .map((reference) => `${reference.blockType} (${reference.blockId})`).join(', ');
    throw new Error(`Este campo ainda é usado por fórmulas ou regras: ${summary}. Remova ou reassocie essas dependências antes de excluir o campo.`);
  }

  template.layout.blocks = unbindFieldFromLayoutBlocks(template.layout.blocks, key);
  template.fields = template.fields.filter((item) => item.key !== key);
  const sample = isRecord(template.sample) ? { ...template.sample } : {};
  delete sample[key];
  template.sample = sample;
  const players = isRecord(template.players) ? { ...template.players } : null;
  if (players) { delete players[key]; template.players = players; }
}

/** Updates a field type and the directly-bound layout block types/defaults. */
export function changeTemplateFieldType(template: ForgeTemplate, key: string, nextType: string): void {
  const field = template.fields.find((item) => item.key === key);
  if (!field) throw new Error(`O campo "${key}" não existe.`);
  const allowed = ['text', 'markdown', 'number', 'rating', 'dice', 'choice', 'list', 'scores', 'entries', 'pairs', 'image', 'spells', 'counters', 'checkboxes'];
  if (!allowed.includes(nextType)) throw new Error(`Tipo de campo não suportado: ${nextType}`);
  const previousType = field.type;
  if (previousType === nextType) return;
  if (previousType === 'number' || previousType === 'rating') {
    if (nextType !== 'number' && nextType !== 'rating') {
      const diceFormulaDependents = findFieldReferences(template, key)
        .filter((reference) => reference.property === 'diceFormula');
      if (diceFormulaDependents.length > 0) {
        const dependents = diceFormulaDependents.slice(0, 4)
          .map((reference) => reference.blockId).join(', ');
        throw new Error(`Este Field é usado por Dice Formulas (${dependents}). Redirecione essas fórmulas antes de alterar seu tipo para ${nextType}.`);
      }
    }
  }
  field.type = nextType;
  if (previousType === 'dice' && nextType !== 'dice') delete field.diceFormula;
  if (nextType === 'entries' && !isRecord(field.entry)) field.entry = { nameKey: 'name', textKey: 'desc', extras: [] };
  if (nextType === 'choice' && !Array.isArray(field.options)) field.options = ['Option 1', 'Option 2'];
  if (nextType === 'scores' && !Array.isArray(field.slots)) {
    field.slots = [...DEFAULT_SCORE_COLUMNS]; field.slotKeys = ['slot_1', 'slot_2', 'slot_3']; field.rows = [[10, 10, 10]];
  }
  if (nextType === 'counters' && !Array.isArray(field.counterRows)) field.counterRows = [];
  if (nextType === 'checkboxes' && !Array.isArray(field.options)) field.options = [{ key: 'option_1', label: 'Option 1' }];
  const previousBlockType = FIELD_TO_BLOCK[previousType];
  const nextBlockType = FIELD_TO_BLOCK[nextType] ?? 'text';
  if (previousBlockType !== nextBlockType) {
    const update = (blocks: ForgeBlock[]): void => {
      for (const block of blocks) {
        if (block.field === key && block.type === previousBlockType) {
          block.type = nextBlockType;
          if (nextType === 'image') block.shape = 'portrait';
          if (['text', 'number', 'rating', 'dice', 'choice'].includes(nextType)) block.look = 'run-in';
          if (nextType === 'list') block.look = 'chips';
          if (nextType === 'scores') block.orientation = 'row';
          if (nextType === 'entries') block.nameStyle = 'run-in';
        }
        if (Array.isArray(block.blocks)) update(block.blocks.filter(isRecord) as ForgeBlock[]);
      }
    };
    update(template.layout.blocks);
  }
}

function inspectBlockReferences(blocks: readonly ForgeBlock[], knownKeys: Set<string>, issues: FieldValidationIssue[]): void {
  const addMissing = (key: unknown, block: ForgeBlock, property: string): void => {
    if (typeof key === 'string' && !knownKeys.has(key.toLowerCase())) {
      issues.push({ code: 'missing-reference', message: `O bloco ${block.id} (${block.type}) referencia o campo inexistente "${key}" em ${property}.`, blockId: block.id });
    }
  };
  for (const block of blocks) {
    const record = block as JsonRecord;
    addMissing(record.field, block, 'field');
    addMissing(record.headingField, block, 'headingField');
    addMissing(record.rollFrom, block, 'rollFrom');
    addMissing(record.introField, block, 'introField');
    if (Array.isArray(record.fields)) {
      record.fields.forEach((key) => addMissing(key, block, 'fields'));
      if (block.type === 'metric' || block.type === 'line') {
        const seenBlockFields = new Set<string>();
        for (const rawKey of record.fields) {
          if (typeof rawKey !== 'string' || !rawKey.trim()) continue;
          const normalizedKey = rawKey.toLowerCase();
          if (seenBlockFields.has(normalizedKey)) {
            issues.push({
              code: 'duplicate-block-field-reference',
              blockId: block.id,
              message: `O bloco ${block.id} (${block.type}) referencia o campo "${rawKey}" mais de uma vez.`,
            });
          }
          seenBlockFields.add(normalizedKey);
        }
      }
    }
    if (isRecord(record.showWhen)) addMissing(record.showWhen.field, block, 'showWhen.field');
    if (Array.isArray(record.columns)) {
      record.columns.forEach((column) => { if (isRecord(column)) addMissing(column.field, block, 'columns.field'); });
    }
    for (const property of ['pattern', 'fallback'] as const) {
      if (typeof record[property] === 'string') {
        const matches = (record[property] as string).matchAll(/\{([A-Za-z][A-Za-z0-9_-]*)\}/g);
        for (const match of matches) addMissing(match[1], block, property);
      }
    }
    if (Array.isArray(record.blocks)) inspectBlockReferences(record.blocks.filter(isRecord) as ForgeBlock[], knownKeys, issues);
  }
}

/** Validates keys and all recognized field references before a native save. */
export function validateTemplateFields(template: ForgeTemplate): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  const seen = new Set<string>();
  const meanings = new Set<string>();
  for (const field of template.fields) {
    const key = field.key;
    if (!FIELD_KEY_PATTERN.test(key)) {
      issues.push({ code: 'invalid-key', fieldKey: key, message: `A chave "${key}" não é válida.` });
    }
    if (RESERVED_FIELD_KEYS.has(key.toLowerCase())) {
      issues.push({ code: 'reserved-key', fieldKey: key, message: `A chave "${key}" é reservada.` });
    }
    if (seen.has(key.toLowerCase())) {
      issues.push({ code: 'duplicate-key', fieldKey: key, message: `A chave "${key}" está duplicada (chaves não diferenciam maiúsculas de minúsculas).` });
    }
    seen.add(key.toLowerCase());
    const meaning = typeof field.meaning === 'string' ? field.meaning : '';
    if (HEADER_MEANINGS.has(meaning)) {
      if (meanings.has(meaning)) issues.push({ code: 'duplicate-meaning', fieldKey: key, message: `Há mais de um campo com o significado especial "${meaning}".` });
      meanings.add(meaning);
    }
    for (const former of formerKeys(field)) {
      if (seen.has(former.toLowerCase())) issues.push({ code: 'duplicate-key', fieldKey: key, message: `A chave anterior "${former}" conflita com outro campo.` });
      seen.add(former.toLowerCase());
    }
  }
  const knownKeys = new Set(template.fields.flatMap((field) => [field.key, ...formerKeys(field)]).map((key) => key.toLowerCase()));
  inspectBlockReferences(template.layout.blocks, knownKeys, issues);
  for (const field of template.fields) {
    if (isRecord(field.tracks) && typeof field.tracks.max === 'string' && !knownKeys.has(field.tracks.max.toLowerCase())) {
      issues.push({ code: 'missing-reference', fieldKey: field.key, message: `O campo "${field.key}" referencia o campo inexistente "${field.tracks.max}" em tracks.max.` });
    }
    if (field.type === 'dice' && typeof field.diceFormula === 'string') {
      const references = [...field.diceFormula.matchAll(/\{([A-Za-z][A-Za-z0-9_-]{0,39})\}/g)];
      for (const match of references) {
        const referencedKey = match[1] ?? '';
        const referencedField = template.fields.find((candidate) => candidate.key === referencedKey);
        if (!referencedField || !isFormulaCapableNumericField(referencedField) || referencedField.key === field.key) {
          issues.push({
            code: 'missing-reference',
            fieldKey: field.key,
            message: `O Dice Field "${field.key}" referencia "${referencedKey}", mas fórmulas de dados exigem um Field Number ou Rating existente e diferente do próprio campo.`,
          });
        }
      }
    }
  }
  return issues;
}
