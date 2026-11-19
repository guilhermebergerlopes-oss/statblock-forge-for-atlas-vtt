import type { ForgeField } from '../templates/forgeTemplate.ts';

const INLINE_TEXT_FIELD_TYPES = new Set(['text', 'choice', 'markdown', 'dice']);

export function isInlineTextField(field: ForgeField | undefined): field is ForgeField {
  return Boolean(field && INLINE_TEXT_FIELD_TYPES.has(field.type));
}

/** Convert a stored text-like value to a safe editor draft. */
export function inlineTextFieldDraftValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/**
 * Parse a contextual Text/Choice/Markdown edit. Choice values are restricted to
 * the options declared by the template, while preserving a legacy value when
 * the user has not changed it.
 */
export function parseInlineTextFieldDraft(
  field: ForgeField,
  raw: string,
  previousValue: unknown,
  language: 'en' | 'pt-BR' = 'pt-BR',
): string {
  if (!field || !INLINE_TEXT_FIELD_TYPES.has(field.type)) {
    throw new Error(language === 'pt-BR'
      ? `O campo "${field.label || field.key}" não é Text, Choice ou Markdown.`
      : `Field "${field.label || field.key}" is not Text, Choice or Markdown.`);
  }

  if (field.type === 'choice') {
    const options = Array.isArray(field.options)
      ? field.options.filter((option): option is string => typeof option === 'string')
      : [];
    const unchangedLegacyValue = raw === inlineTextFieldDraftValue(previousValue);
    if (options.length > 0 && raw !== '' && !options.includes(raw) && !unchangedLegacyValue) {
      throw new Error(language === 'pt-BR'
        ? `Selecione uma das opções configuradas para "${field.label || field.key}".`
        : `Select one of the configured options for "${field.label || field.key}".`);
    }
  }

  // Text and Markdown intentionally preserve whitespace and line breaks.
  return raw;
}
