/** Dynamic formulas for Dice Fields. References use the same `{fieldKey}` interpolation style as Forge Patterns. */
import type { ForgeField } from '../templates/forgeTemplate.ts';
import { isFormulaCapableNumericField } from '../templates/numericFieldModel.ts';
import { isDiceFieldValue } from './diceFieldEditorModel.ts';
import { writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';
import { normalizeDiceCountExpressions } from './atlasDiceEngine/parseFormula.ts';

export const MAX_DICE_FIELD_FORMULA_LENGTH = 500;
const REFERENCE = /@([A-Za-z_][A-Za-z0-9_.]{0,79})|\{([A-Za-z_][A-Za-z0-9_.-]{0,79})\}/g;

export function diceFieldFormula(field: ForgeField): string {
  return typeof field.diceFormula === 'string' ? field.diceFormula : '';
}

export function hasDiceFieldFormula(field: ForgeField): boolean {
  return diceFieldFormula(field).trim().length > 0;
}

export function setDiceFieldFormula(field: ForgeField, formula: string): boolean {
  const clean = formula.trim().slice(0, MAX_DICE_FIELD_FORMULA_LENGTH);
  if (diceFieldFormula(field) === clean) return false;
  if (clean) field.diceFormula = clean;
  else delete field.diceFormula;
  return true;
}

/** Validate notation independently from live Field values (the template editor may have empty samples). */
export function isDiceFieldFormulaSyntaxValid(formula: string): boolean {
  const source = formula.trim();
  if (!source || source.length > MAX_DICE_FIELD_FORMULA_LENGTH) return false;
  const replaced = writtenAdvantage(source).formula.replace(REFERENCE, '2').replace(/([0-9)])\s+(?=[dD](?:\d|%|[fF]))/g, '$1');
  if (/[{}]/.test(replaced)) return false;
  return isDiceFieldValue(replaced);
}

function numericSample(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const direct = Number(value.trim());
  if (Number.isFinite(direct)) return direct;
  const fraction = value.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!fraction || Number(fraction[2]) <= 0) return null;
  const result = Number(fraction[1]) / Number(fraction[2]);
  return Number.isFinite(result) ? result : null;
}

/**
 * Resolves a configured Dice Field formula against the current statblock values.
 * Only Number/Rating Fields may be referenced; every substituted value must be
 * a safe integer because the Atlas dice grammar uses whole-number counts/faces.
 * Returns null when no formula is configured and an empty string when the
 * configured expression cannot currently be resolved or parsed.
 */
export function resolveDiceFieldFormula(
  field: ForgeField,
  fields: readonly ForgeField[],
  data: Readonly<Record<string, unknown>>,
  numericValue?: (source: ForgeField) => number | null,
): string | null {
  const source = diceFieldFormula(field).trim();
  if (!source) return null;
  const writtenSide = writtenAdvantage(source);

  let invalid = false;
  const expanded = writtenSide.formula.replace(REFERENCE, (_match, atKey: string | undefined, braceKey: string | undefined) => {
    const key = atKey ?? braceKey ?? '';
    const reference = fields.find((candidate) => candidate.key === key);
    if (!reference || reference.key === field.key || !isFormulaCapableNumericField(reference)) {
      invalid = true;
      return '0';
    }
    const raw = numericValue ? numericValue(reference) : numericSample(data[key]);
    if (raw === null || !Number.isSafeInteger(raw)) {
      invalid = true;
      return '0';
    }
    return String(raw);
  });

  // References used as dice counts may be spaced from `d` in authored formulas.
  // Normalize only the count-to-die boundary after substitution; stored text stays unchanged.
  const normalized = expanded.replace(/([0-9)])\s+(?=[dD](?:\d|%|[fF]))/g, '$1');
  // An unmatched brace is almost certainly a misspelled or malformed placeholder.
  if (invalid || /[{}]/.test(normalized) || !isDiceFieldValue(normalized)) return '';
  const resolved = normalizeDiceCountExpressions(normalized);
  return writtenSide.word ? `${resolved} ${writtenSide.word}` : resolved;
}

/** Exact `{fieldKey}` references used by dependency validation and rename operations. */
export function diceFieldFormulaUsesField(formula: string, key: string): boolean {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:@${escaped}(?![A-Za-z0-9_.-])|\\{${escaped}\\})`).test(formula);
}

export function renameDiceFieldFormulaReference(formula: string, from: string, to: string): string {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return formula.replace(new RegExp(`@${escaped}(?![A-Za-z0-9_.-])|\\{${escaped}\\}`, 'g'), (match) => match.startsWith('@') ? `@${to}` : `{${to}}`);
}
