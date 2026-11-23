import type { ForgeField } from '../templates/forgeTemplate.ts';

export const TABLE_DISPLAYED_FIELD_KEYS_CONTEXT = '__forgeTableDisplayedFieldKeys';

export type TableFormulaEvaluator = (
  formula: string,
  sample: Record<string, unknown>,
  slotValue: unknown,
  fields: readonly ForgeField[],
  selfFieldKey?: string,
) => number | null;

/**
 * Finds Template Fields consumed by a formula. Table storage paths are left
 * intact for the evaluator; this helper only reports roots that are actual
 * declared Fields so dependency ordering does not mistake functions/keywords
 * for Fields.
 */
export function tableFormulaReferencedFieldKeys(
  formula: string,
  fields: readonly ForgeField[],
): string[] {
  const candidates = new Map(fields.map((field) => [field.key, field]));
  const references = new Set<string>();
  const pattern = /\{([A-Za-z_][A-Za-z0-9_.-]*)\}|@([A-Za-z_][A-Za-z0-9_.-]*)|\b([A-Za-z_][A-Za-z0-9_.-]*)\b/g;
  for (const match of formula.matchAll(pattern)) {
    const token = match[1] ?? match[2] ?? match[3] ?? '';
    const root = token.split('.')[0] ?? '';
    const explicitReference = match[1] !== undefined || match[2] !== undefined;
    // Bare keywords and rowNumber belong to the formula context; braced/@
    // references normally identify Template Fields.
    if (!explicitReference && ['value', 'true', 'false', 'rowNumber'].includes(root)) continue;
    if (!candidates.has(root)) continue;
    if (match[3] !== undefined) {
      const next = formula.slice((match.index ?? 0) + token.length).match(/^\s*(.)/)?.[1];
      if (next === '(') continue;
    }
    references.add(root);
  }
  return [...references];
}

/**
 * Resolves the Row Formulas configured for one Table row. It has no dependency
 * on the preview evaluator: callers inject the evaluator, keeping the module
 * graph acyclic and allowing runtime-specific Table/Field references.
 */
export function resolveTableRowFormulaValues(
  fields: readonly ForgeField[],
  rowValues: Record<string, unknown>,
  formulas: Record<string, string>,
  evaluate: TableFormulaEvaluator,
  referenceFields: readonly ForgeField[] = fields,
): Record<string, unknown> {
  // Keep the entire statblock sample so formulas can read any Template Field.
  // Row-specific Table values already overlaid by the renderer take precedence.
  const base: Record<string, unknown> = { ...rowValues };
  const resolved: Record<string, unknown> = { ...base };
  const inheritedDisplayedKeys = rowValues[TABLE_DISPLAYED_FIELD_KEYS_CONTEXT];
  const displayedFieldKeys = new Set<string>(Array.isArray(inheritedDisplayedKeys)
    ? inheritedDisplayedKeys.filter((key): key is string => typeof key === 'string')
    : []);
  const states = new Map<string, 'resolving' | 'resolved'>();
  const resolve = (fieldKey: string): unknown => {
    const formula = formulas[fieldKey]?.trim();
    if (!formula) return base[fieldKey];
    if (states.get(fieldKey) === 'resolved') return resolved[fieldKey];
    if (states.get(fieldKey) === 'resolving') {
      resolved[fieldKey] = null;
      states.set(fieldKey, 'resolved');
      return null;
    }

    states.set(fieldKey, 'resolving');
    for (const dependency of tableFormulaReferencedFieldKeys(formula, referenceFields)) {
      if (dependency !== fieldKey && formulas[dependency]) resolve(dependency);
    }
    // Fields already calculated for display (and Row Formula dependencies
    // resolved above) must not have their Number/Rating Formula applied twice.
    const evaluationSample = {
      ...resolved,
      [TABLE_DISPLAYED_FIELD_KEYS_CONTEXT]: [...displayedFieldKeys],
    };
    const result = evaluate(formula, evaluationSample, base[fieldKey], referenceFields, fieldKey);
    resolved[fieldKey] = result !== null && Number.isFinite(result) ? result : null;
    displayedFieldKeys.add(fieldKey);
    states.set(fieldKey, 'resolved');
    return resolved[fieldKey];
  };

  for (const field of fields) resolve(field.key);
  delete resolved[TABLE_DISPLAYED_FIELD_KEYS_CONTEXT];
  return resolved;
}
