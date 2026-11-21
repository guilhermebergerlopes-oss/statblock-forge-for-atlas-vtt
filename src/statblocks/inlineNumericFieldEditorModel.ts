import type { ForgeField } from '../templates/forgeTemplate.ts';
import { writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';
import { writtenRoll } from './atlasDiceEngine/textRolls.ts';

/** Convert the stored Number/Rating value to the initial text shown by an inline editor. */
export function inlineNumericFieldDraftValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * Resolve a Number Field value that is intentionally a roll rather than a numeric quantity.
 * A trailing `adv`/`dis` is required so ordinary descriptive text is never accepted as a Number.
 * Bare positive bonuses such as `5 adv` are normalized to `+5 adv` for the dice engine.
 */
export function numberFieldAdvantageRollFormula(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text) return null;
  const side = writtenAdvantage(text);
  if (!side.side) return null;
  const direct = writtenRoll(text);
  if (direct) return direct;
  if (/^\d+(?:[.,]\d+)?$/.test(side.formula.trim())) {
    return writtenRoll(`+${side.formula.trim().replace(',', '.')} ${side.word}`);
  }
  return null;
}

/**
 * Parse a contextual Number/Rating edit without changing the source format unnecessarily.
 * Number Fields normally store numeric values, but may also store a valid dice expression
 * ending in `adv` or `dis`. Rating Fields preserve fractions and legacy descriptive strings.
 */
export function parseInlineNumericFieldDraft(field: ForgeField, raw: string, language: 'en' | 'pt-BR' = 'pt-BR'): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (field.type === 'number') {
    if (numberFieldAdvantageRollFormula(trimmed)) return trimmed;
    const normalized = trimmed.includes(',') && !trimmed.includes('.') ? trimmed.replace(',', '.') : trimmed;
    const value = Number(normalized);
    if (!Number.isFinite(value)) {
      throw new Error(language === 'pt-BR'
        ? `O campo "${field.label || field.key}" precisa conter um número válido.`
        : `Field "${field.label || field.key}" must contain a valid number.`);
    }
    return value;
  }

  if (field.type === 'rating') {
    const fraction = trimmed.replace(/\s+/g, '').match(/^(-?\d+)\/([1-9]\d*)$/);
    if (fraction) return `${fraction[1]}/${fraction[2]}`;
    const normalized = trimmed.includes(',') && !trimmed.includes('.') ? trimmed.replace(',', '.') : trimmed;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric;
    return trimmed;
  }

  throw new Error(language === 'pt-BR'
    ? `O campo "${field.label || field.key}" não é um Number ou Rating.`
    : `Field "${field.label || field.key}" is not a Number or Rating.`);
}
