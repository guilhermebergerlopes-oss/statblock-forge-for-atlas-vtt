/** Dice notation helpers used by the inline Dice Field editor. */
import { parseFormula } from './atlasDiceEngine/parseFormula.ts';
import type { DiceTerm, ParsedFormula } from './atlasDiceEngine/formulaTypes.ts';
import { writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';

export interface DiceAverageResult {
  average: number;
  diceCount: number;
}

/** References are validated as numeric placeholders; their actual values are filled when rolled. */
const REFERENCE = /^(?:@([A-Za-z_][\w.]*)|\{([A-Za-z_](?:[\w-]*\w)?(?:\.\w(?:[\w-]*\w)?)*)\})/;

/**
 * Replaces statblock references outside labels so the shared Atlas formula parser can validate
 * the complete expression. The editor has no statblock data context, so the placeholder's value
 * is deliberately immaterial here; this function validates notation, not runtime field values.
 */
function formulaWithReferencePlaceholders(text: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < text.length) {
    const character = text[cursor]!;
    if (character === '[') {
      const close = text.indexOf(']', cursor);
      const end = close < 0 ? text.length : close + 1;
      result += text.slice(cursor, end);
      cursor = end;
      continue;
    }
    if (character === '@' || character === '{') {
      const match = REFERENCE.exec(text.slice(cursor));
      if (match) {
        result += '1';
        cursor += match[0].length;
        continue;
      }
    }
    result += character;
    cursor += 1;
  }
  return result;
}

function normalizeFormulaText(text: string): string {
  return text
    .replace(/[\u2212\u2013]/g, '-')
    .replace(/×/g, '*')
    .replace(/\+[ \t]*-/g, '-');
}

function parsedDiceField(text: string): ParsedFormula | null {
  const side = writtenAdvantage(normalizeFormulaText(text).trim());
  const source = formulaWithReferencePlaceholders(side.formula.trim())
    .replace(/([0-9)])\s+(?=[dD](?:\d|%|[fF]))/g, '$1');
  if (!source) return null;
  const parsed = parseFormula(source);
  return parsed.ok && parsed.terms.some((term) => term.kind === 'dice') ? parsed : null;
}

/**
 * Parse a dice field with the same bounded grammar used by the actual roll engine.
 * Returns null for prose, malformed notation, constants without dice, or formulas over the
 * engine's limits. This keeps the editor's validity indicator aligned with what can be rolled.
 */
export function parseDiceField(text: string): ParsedFormula | null {
  return parsedDiceField(text);
}

/**
 * Calculate the average only for an unmodified, additive/subtractive dice expression.
 * Rerolls, explosions, keep/drop and success-count terms have a different distribution; products
 * and quotients are intentionally left without a hint rather than displaying a misleading value.
 */
export function parseDiceAverage(text: string): DiceAverageResult | null {
  if (writtenAdvantage(text.trim()).side) return null;
  const parsed = parsedDiceField(text);
  if (!parsed || !parsed.linear) return null;

  let sum = 0;
  let diceCount = 0;
  for (const term of parsed.terms) {
    if (term.kind === 'constant') {
      sum += term.negative ? -term.value : term.value;
      continue;
    }
    if (hasDistributionModifier(term)) return null;
    diceCount += term.count;
    // Fate dice have faces −1, 0 and +1; percentile dice are numbered 1 through 100.
    const averagePerDie = term.fate ? 0 : (term.faces + 1) / 2;
    sum += (term.negative ? -1 : 1) * term.count * averagePerDie;
  }
  if (diceCount === 0 || !Number.isFinite(sum)) return null;
  return { average: sum, diceCount };
}

function hasDistributionModifier(term: DiceTerm): boolean {
  return term.reroll !== undefined || term.explode !== undefined
    || term.keep !== undefined || term.tally !== undefined;
}

/** Whether a value is a syntactically valid dice formula with at least one die term. */
export function isDiceFieldValue(text: string): boolean {
  return parsedDiceField(text) !== null;
}

/** Atlas-style average hint; references and expressions without a reliable average suppress it. */
export function diceAverageHint(text: string): string | null {
  if (/@|\{/.test(text)) return null;
  const parsed = parseDiceAverage(text);
  if (!parsed) return null;
  const rounded = Math.round(parsed.average * 10) / 10;
  return `avg ${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}`;
}
