import type { FieldTypographyAppearance, ForgeField, ForgeLayoutDocument } from './forgeTemplate.ts';
import { ensureFieldId } from './fieldCompendiumModel.ts';

const WEIGHTS = new Set(['400', '500', '600', '700']);
const STYLES = new Set(['normal', 'italic']);
const DECORATIONS = new Set(['none', 'underline', 'line-through']);

const NUMERIC_RANGES: Array<[keyof FieldTypographyAppearance, number, number]> = [
  ['fontSize', 8, 48], ['letterSpacing', -1, 8],
  ['labelFontSize', 8, 48], ['labelLetterSpacing', -1, 8],
  ['valueFontSize', 8, 48], ['valueLetterSpacing', -1, 8],
];
const CHOICE_VALUES: Array<[keyof FieldTypographyAppearance, ReadonlySet<string>]> = [
  ['fontWeight', WEIGHTS], ['labelFontWeight', WEIGHTS], ['valueFontWeight', WEIGHTS],
  ['fontStyle', STYLES], ['labelFontStyle', STYLES], ['valueFontStyle', STYLES],
  ['textDecoration', DECORATIONS], ['labelTextDecoration', DECORATIONS], ['valueTextDecoration', DECORATIONS],
];

/** Keep only the supported typography properties and clamp numeric values. */
export function normalizeFieldTypographyAppearance(value: unknown): FieldTypographyAppearance {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, min, max] of NUMERIC_RANGES) {
    const candidate = source[key];
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      result[key] = Math.max(min, Math.min(max, candidate));
    }
  }
  for (const [key, allowed] of CHOICE_VALUES) {
    const candidate = source[key];
    if (typeof candidate === 'string' && allowed.has(candidate)) result[key] = candidate;
  }
  return result as FieldTypographyAppearance;
}

/** Drop orphaned entries and invalid values when loading a Forge sidecar. */
export function normalizeFieldTypographyMap(
  value: unknown,
  validFieldIds: ReadonlySet<string>,
): Record<string, FieldTypographyAppearance> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const result: Record<string, FieldTypographyAppearance> = {};
  for (const [fieldId, raw] of Object.entries(value)) {
    if (!validFieldIds.has(fieldId)) continue;
    const appearance = normalizeFieldTypographyAppearance(raw);
    if (Object.keys(appearance).length > 0) result[fieldId] = appearance;
  }
  return result;
}

export function fieldTypographyForField(
  layout: ForgeLayoutDocument,
  field: ForgeField,
): FieldTypographyAppearance {
  const fieldId = layout.fieldIds?.[field.key];
  return fieldId ? layout.fieldTypography?.[fieldId] ?? {} : {};
}

export function setFieldTypographyForField(
  layout: ForgeLayoutDocument,
  field: ForgeField,
  value: unknown,
): FieldTypographyAppearance {
  const fieldId = ensureFieldId(layout, field);
  const appearance = normalizeFieldTypographyAppearance(value);
  layout.fieldTypography ??= {};
  if (Object.keys(appearance).length > 0) layout.fieldTypography[fieldId] = appearance;
  else delete layout.fieldTypography[fieldId];
  return appearance;
}

export function resetFieldTypographyForField(layout: ForgeLayoutDocument, field: ForgeField): void {
  const fieldId = layout.fieldIds?.[field.key];
  if (!fieldId || !layout.fieldTypography) return;
  delete layout.fieldTypography[fieldId];
}
