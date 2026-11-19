/**
 * Rest formula handling aligned with Atlas VTT's recoveryFormula.ts and spendFormula.ts.
 * The source syntax, reference boundaries, formula limits and exact arithmetic are shared with
 * the Forge's Atlas-adapted dice engine; only the field lookup is supplied by the Forge statblock.
 */
import { evaluatePreviewFormula } from '../render/previewValueModel.ts';
import { calculateNumericFieldValue } from '../templates/numericFieldModel.ts';
import { isRecord, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { evaluateFormula } from './atlasDiceEngine/evaluateFormula.ts';
import { FORMULA_LIMITS, parseFormula } from './atlasDiceEngine/parseFormula.ts';
import { readTerm } from './atlasDiceEngine/formulaTerms.ts';
import type { FormulaErrorCode, FormulaTerm, ParsedFormula } from './atlasDiceEngine/formulaTypes.ts';

const REFERENCE = /@([A-Za-z_](?:[\w-]*\w)?(?:\.\w(?:[\w-]*\w)?)*)/y;
const DICE_AFTER = /^[ \t]*[dD](?:\d|%|[fF](?![A-Za-z]))/;
const SPACES = /^[ \t]*/;
const MAX_CONSTANT = 9999;
const MAX_DICE_COUNT = 999;
const LIMIT_CODES: ReadonlySet<FormulaErrorCode> = new Set(['length', 'terms', 'dice', 'faces', 'depth', 'total', 'modifier']);

export type RestFormulaProblem =
  | { kind: 'missing-reference'; field: string }
  | { kind: 'not-whole'; field: string }
  | { kind: 'limits' }
  | { kind: 'syntax' };

export interface FilledRestFormula {
  readonly ok: true;
  readonly formula: string;
  readonly parsed: ParsedFormula;
  readonly dice: boolean;
}

export type RestFormulaFill = FilledRestFormula | { readonly ok: false; readonly problem: RestFormulaProblem };

export type RestFormulaValue = { value: number } | { reason: 'missing-reference' | 'invalid-value' | 'invalid-formula' | 'dice-roll-unavailable' | 'roll-failed' };
export type RestFormulaRoller = (formula: string, label: string) => number | null;

function wholeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
  if (typeof value !== 'string' || !/^\s*[+-]?\d{1,15}\s*$/.test(value)) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function nestedValue(data: JsonRecord, path: string): unknown {
  if (Object.prototype.hasOwnProperty.call(data, path)) return data[path];
  let value: unknown = data;
  for (const part of path.split('.')) {
    if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, part)) return undefined;
    value = value[part];
  }
  return value;
}

/** Atlas-style statblock lookup over the Forge field record, including calculated numeric fields. */
function lookupValue(template: ForgeTemplate, data: JsonRecord, path: string): unknown {
  const field = template.fields.find((candidate) => candidate.key === path);
  if (field && (field.type === 'number' || field.type === 'rating')) {
    return calculateNumericFieldValue(field, data, evaluatePreviewFormula) ?? nestedValue(data, path);
  }
  return nestedValue(data, path);
}

function referencePathAt(text: string, at: number): string | null {
  if (text[at] !== '@') return null;
  REFERENCE.lastIndex = at;
  return REFERENCE.exec(text)?.[1] ?? null;
}

type ReferenceRead = { field: string; value: unknown; end: number } | { missing: string; end: number } | null;

/** Same longest-existing-path fallback as Atlas: @con-1 and @leveld6. */
function readReference(text: string, at: number, lookup: (path: string) => unknown): ReferenceRead {
  const path = referencePathAt(text, at);
  if (path === null) return null;
  const start = at + 1;
  const end = start + path.length;
  const whole = lookup(path);
  if (whole !== undefined) return { field: path, value: whole, end };
  for (let split = path.length - 1; split > 0; split -= 1) {
    const field = path.slice(0, split);
    if (field.endsWith('.') || field.endsWith('-')) continue;
    const after = path[split];
    const boundary = after === '-' || ((after === 'd' || after === 'D') && DICE_AFTER.test(text.slice(start + split)));
    if (!boundary) continue;
    const value = lookup(field);
    if (value !== undefined) return { field, value, end: start + split };
  }
  return { missing: path, end };
}

/** Substitutes references except inside labels, preserving the Atlas dice-count and sign syntax. */
function substitute(formula: string, lookup: (path: string) => unknown):
  | { ok: true; text: string }
  | { ok: false; problem: RestFormulaProblem } {
  let text = '';
  let cursor = 0;
  while (cursor < formula.length) {
    const character = formula[cursor]!;
    if (character === '[') {
      const close = formula.indexOf(']', cursor);
      const end = close < 0 ? formula.length : close + 1;
      text += formula.slice(cursor, end);
      cursor = end;
      continue;
    }
    const reference = readReference(formula, cursor, lookup);
    if (reference === null) {
      text += character;
      cursor += 1;
      continue;
    }
    if ('missing' in reference) return { ok: false, problem: { kind: 'missing-reference', field: reference.missing } };
    const value = wholeNumber(reference.value);
    if (value === null) return { ok: false, problem: { kind: 'not-whole', field: reference.field } };
    const rest = formula.slice(reference.end);
    const count = DICE_AFTER.test(rest);
    if (count ? value < 0 || value > MAX_DICE_COUNT : Math.abs(value) > MAX_CONSTANT) {
      return { ok: false, problem: { kind: 'limits' } };
    }
    text += count ? String(value) : `(${value})`;
    cursor = reference.end + (count ? SPACES.exec(rest)![0].length : 0);
  }
  return { ok: true, text };
}

function checkedFormula(text: string): RestFormulaFill {
  const parsed = parseFormula(text);
  if (!parsed.ok) {
    return { ok: false, problem: { kind: LIMIT_CODES.has(parsed.code) ? 'limits' : 'syntax' } };
  }
  return { ok: true, formula: text, parsed, dice: parsed.terms.some((term) => term.kind === 'dice') };
}

export function fillRestFormula(formula: string, template: ForgeTemplate, data: JsonRecord): RestFormulaFill {
  const substituted = substitute(formula.trim(), (path) => lookupValue(template, data, path));
  return substituted.ok ? checkedFormula(substituted.text) : substituted;
}

function termTexts(formula: string): string[] {
  const texts: string[] = [];
  let cursor = 0;
  while (cursor < formula.length) {
    if (/[ \t+\-()]/.test(formula[cursor]!)) {
      cursor += 1;
      continue;
    }
    const read = readTerm(formula, cursor);
    if (!read) return [];
    texts.push(formula.slice(cursor, read.end));
    cursor = read.end;
  }
  return texts;
}

function scaledTerm(term: FormulaTerm, text: string, units: number): string {
  if (term.kind === 'dice') return `${term.count * units}${text.replace(/^\d*/, '')}`;
  const label = text.replace(/^\d+/, '');
  const value = term.value * units;
  return value <= MAX_CONSTANT ? `${value}${label}` : `${units}*${text}`;
}

function scaledSum(unit: FilledRestFormula, units: number): string | null {
  const { terms, linear } = unit.parsed;
  if (!linear || terms.some((term) => term.kind === 'dice' && term.keep !== undefined)) return null;
  const texts = termTexts(unit.formula);
  if (texts.length !== terms.length) return null;
  return terms.map((term, index) => {
    const sign = term.negative ? '-' : index === 0 ? '' : '+';
    return `${sign}${scaledTerm(term, texts[index]!, units)}`;
  }).join('');
}

/** Combines all spent units before evaluation/rolling, exactly as Atlas' spendFormula does. */
export function combineRestSpendFormula(unit: FilledRestFormula, units: number): RestFormulaFill {
  if (!Number.isSafeInteger(units) || units < 1) return { ok: false, problem: { kind: 'limits' } };
  if (units === 1) return unit;
  const scaled = unit.dice ? scaledSum(unit, units) : `${units}*(${unit.formula})`;
  if (scaled === null && unit.dice && units * (unit.formula.length + 3) - 1 > FORMULA_LIMITS.characters) {
    return { ok: false, problem: { kind: 'limits' } };
  }
  const candidate = scaled ?? (unit.dice
    ? Array.from({ length: units }, () => `(${unit.formula})`).join('+')
    : `${units}*(${unit.formula})`);
  const checked = checkedFormula(candidate);
  return checked.ok || checked.problem.kind !== 'syntax' ? checked : { ok: false, problem: { kind: 'limits' } };
}

export function evaluateFilledRestFormula(
  formula: FilledRestFormula,
  label: string,
  roll?: RestFormulaRoller,
): RestFormulaValue {
  if (!formula.dice) {
    try {
      return { value: evaluateFormula(formula.parsed.expression, (term) => term.kind === 'constant' ? term.value : 0) };
    } catch {
      return { reason: 'invalid-formula' };
    }
  }
  if (!roll) return { reason: 'dice-roll-unavailable' };
  const result = roll(formula.formula, label);
  return typeof result === 'number' && Number.isFinite(result)
    ? { value: Math.trunc(result) }
    : { reason: 'roll-failed' };
}

export function evaluateRestFormula(
  formula: string,
  template: ForgeTemplate,
  data: JsonRecord,
  label: string,
  roll?: RestFormulaRoller,
): RestFormulaValue {
  const filled = fillRestFormula(formula, template, data);
  if (!filled.ok) {
    if (filled.problem.kind === 'missing-reference') return { reason: 'missing-reference' };
    if (filled.problem.kind === 'not-whole') return { reason: 'invalid-value' };
    return { reason: 'invalid-formula' };
  }
  return evaluateFilledRestFormula(filled, label, roll);
}
