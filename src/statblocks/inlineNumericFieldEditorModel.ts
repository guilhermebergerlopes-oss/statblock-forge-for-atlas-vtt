import type { ForgeField } from '../templates/forgeTemplate.ts';

/** Convert the stored Number/Rating value to the initial text shown by an inline editor. */
export function inlineNumericFieldDraftValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/**
 * Parse a contextual Number/Rating edit without changing the source format unnecessarily.
 * Number Fields are always numeric; Rating Fields also preserve fractions such as 1/4
 * and legacy descriptive strings when they do not participate in arithmetic.
 */
export function parseInlineNumericFieldDraft(field: ForgeField, raw: string, language: 'en' | 'pt-BR' = 'pt-BR'): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (field.type === 'number') {
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
