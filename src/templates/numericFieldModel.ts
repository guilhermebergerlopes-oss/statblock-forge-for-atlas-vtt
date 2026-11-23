import type { ForgeField } from './forgeTemplate.ts';
import { MAX_MATH_FORMULA_LENGTH } from './formulaLimits.ts';

/** Base arithmetic expression for a numeric Field. Empty means use its stored value. */
export function numericFieldFormula(field: ForgeField): string {
  return typeof field.formula === 'string' ? field.formula : '';
}

/** Number and Rating are the numeric Field types supported by the formula evaluator. */
export function isFormulaCapableNumericField(field: ForgeField | undefined): field is ForgeField {
  return Boolean(field && (field.type === 'number' || field.type === 'rating'));
}

/** Whether a Field has opted into formula evaluation. */
export function hasNumericFieldFormulaSettings(field: ForgeField): boolean {
  return numericFieldFormula(field).trim() !== '';
}

function numericRawValue(field: ForgeField, raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const normalized = raw.trim();
  const direct = Number(normalized);
  if (Number.isFinite(direct)) return direct;
  if (field.type === 'rating') {
    const fraction = normalized.match(/^(-?\d+)\s*\/\s*(\d+)$/);
    if (fraction) {
      const numerator = Number(fraction[1]);
      const denominator = Number(fraction[2]);
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) return numerator / denominator;
    }
  }
  return null;
}

/** Formula context converts fractional Rating values (e.g. CR 1/4) to decimals for arithmetic. */
export function numericFieldFormulaContext(
  field: ForgeField,
  sample: Record<string, unknown>,
): { sample: Record<string, unknown>; slotValue: unknown } {
  const raw = sample[field.key];
  const numericRaw = numericRawValue(field, raw);
  if (field.type === 'rating' && numericRaw !== null) {
    return { sample: { ...sample, [field.key]: numericRaw }, slotValue: numericRaw };
  }
  return { sample, slotValue: raw };
}

export function setNumericFieldFormula(field: ForgeField, formula: string): boolean {
  const clean = formula.trim();
  if (clean.length > MAX_MATH_FORMULA_LENGTH) return false;
  if (numericFieldFormula(field) === clean) return false;
  if (clean) field.formula = clean;
  else delete field.formula;
  return true;
}

/** Evaluate the Field's formula, or return its stored numeric value when no formula is set. */
export type NumericFieldFormulaEvaluator = (
  formula: string,
  sample: Record<string, unknown>,
  slotValue: unknown,
  selfFieldKey?: string,
) => number | null;

export function calculateNumericFieldValue(
  field: ForgeField,
  sample: Record<string, unknown>,
  evaluate: NumericFieldFormulaEvaluator,
): number | null {
  if (!isFormulaCapableNumericField(field)) return null;
  const context = numericFieldFormulaContext(field, sample);
  const formula = numericFieldFormula(field).trim();
  const value = formula
    ? evaluate(formula, context.sample, context.slotValue, field.key)
    : numericRawValue(field, sample[field.key]);
  return value !== null && Number.isFinite(value) ? value : null;
}
