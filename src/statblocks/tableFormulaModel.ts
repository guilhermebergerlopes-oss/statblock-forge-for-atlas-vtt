import { isRecord, type ForgeBlock, type ForgeField } from '../templates/forgeTemplate.ts';
import { evaluatePreviewFormula } from '../render/previewValueModel.ts';

export type TableFormulaKind = 'row' | 'column';
export type TableFormulaEvaluator = (
  formula: string,
  sample: Record<string, unknown>,
  slotValue: unknown,
  fields: readonly ForgeField[],
  selfFieldKey?: string,
) => number | null;

const evaluateTableFormulaDefault: TableFormulaEvaluator = (formula, sample, slotValue, fields, selfFieldKey) =>
  evaluatePreviewFormula(formula, sample, slotValue, fields, {}, sample, selfFieldKey);

export interface TableColumnAggregate {
  sum: number;
  average: number;
  avg: number;
  min: number;
  max: number;
  count: number;
}

/** Maps each Table's private storage Field key to the public column Field keys it owns. */
export type TableCellReferenceIndex = Readonly<Record<string, readonly string[]>>;

/**
 * Builds the stable lookup needed by formulas such as `{table_1.row2.value}`.
 * The storage Field identifies the Table, while the `fields` array on its
 * Scores block identifies which Template Fields are valid columns.
 */
export function tableCellReferenceIndex(blocks: readonly ForgeBlock[]): Record<string, string[]> {
  const index: Record<string, string[]> = {};
  const visit = (items: readonly ForgeBlock[]): void => {
    for (const block of items) {
      if (block.type === 'scores' && typeof block.field === 'string' && block.field.trim()) {
        const keys = Array.isArray(block.fields)
          ? [...new Set(block.fields.filter((key): key is string => typeof key === 'string' && key.trim().length > 0))]
          : [];
        index[block.field] = keys;
      }
      if (Array.isArray(block.blocks)) {
        visit(block.blocks.filter(isRecord) as ForgeBlock[]);
      }
    }
  };
  visit(blocks);
  return index;
}

/** True when a formula explicitly points at a column inside a specific Table. */
function tableCellReferenceUsesField(
  formula: string,
  fieldKey: string,
  fields: readonly ForgeField[],
): boolean {
  const storageKeys = new Set(fields
    .filter((field) => field.type === 'scores' && field.forgeInternal === 'table-storage')
    .map((field) => field.key));
  const pattern = /\{([A-Za-z_][A-Za-z0-9_.-]*)\}|@([A-Za-z_][A-Za-z0-9_.-]*)/g;
  for (const match of formula.matchAll(pattern)) {
    const path = match[1] ?? match[2] ?? '';
    const [tableKey, rowSegment, columnKey] = path.split('.');
    if (tableKey && storageKeys.has(tableKey)
      && rowSegment && /^row[1-9][0-9]*$/i.test(rowSegment)
      && columnKey === fieldKey
      && fields.some((field) => field.key === columnKey)) return true;
  }
  return false;
}

function formulaProperty(kind: TableFormulaKind): 'rowFormulas' | 'columnFormulas' {
  return kind === 'row' ? 'rowFormulas' : 'columnFormulas';
}

export function tableFormulaMap(block: ForgeBlock, kind: TableFormulaKind): Record<string, string> {
  const raw = block[formulaProperty(kind)];
  if (!isRecord(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] =>
    typeof entry[1] === 'string' && entry[1].trim().length > 0,
  ));
}

export function tableFormulaText(block: ForgeBlock, kind: TableFormulaKind, fieldKey: string): string {
  return tableFormulaMap(block, kind)[fieldKey] ?? '';
}

/** An empty formula disables the selected formula mode without changing Table data. */
export function setScoresTableFormula(
  block: ForgeBlock,
  kind: TableFormulaKind,
  fieldKey: string,
  formula: string,
): boolean {
  if (block.type !== 'scores' || !fieldKey) return false;
  const childKeys = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string')
    : [];
  if (!childKeys.includes(fieldKey)) return false;

  const property = formulaProperty(kind);
  const current = tableFormulaMap(block, kind);
  const clean = formula.trim().slice(0, 500);
  if ((current[fieldKey] ?? '') === clean) return false;
  const next = { ...current };
  if (clean) next[fieldKey] = clean;
  else delete next[fieldKey];
  if (Object.keys(next).length > 0) block[property] = next;
  else delete block[property];
  return true;
}

/**
 * Reads references used by a Table formula. Every declared Template Field is
 * eligible; `field.sum`/`field.average` etc. are resolved when that Field is a
 * numeric column in this Table. The evaluator resolves external Number/Rating
 * references to their displayed formula-calculated value.
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
    // Bare keywords belong to the formula language; braced/@ references
    // always mean a Template Field key, even when that key is `value`.
    if (!explicitReference && ['value', 'true', 'false'].includes(root.toLowerCase())) continue;
    if (!candidates.has(root)) continue;
    if (match[3] !== undefined) {
      const next = formula.slice((match.index ?? 0) + token.length).match(/^\s*(.)/)?.[1];
      if (next === '(') continue;
    }
    references.add(root);
  }
  return [...references];
}

export function tableFormulaReferencesField(
  formula: string,
  fieldKey: string,
  fields: readonly ForgeField[],
): boolean {
  return tableFormulaReferencedFieldKeys(formula, fields).includes(fieldKey)
    || tableCellReferenceUsesField(formula, fieldKey, fields);
}

function numericValue(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const text = raw.trim();
  const direct = Number(text);
  if (Number.isFinite(direct)) return direct;
  const fraction = text.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!fraction) return null;
  const numerator = Number(fraction[1]);
  const denominator = Number(fraction[2]);
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? numerator / denominator
    : null;
}

/**
 * Resolves every Row Formula in one row. Formula dependencies are evaluated
 * first, allowing a calculated column to use another calculated column in
 * the same row. References to Number/Rating Fields outside the Table are
 * resolved by the evaluator to their displayed (formula-calculated) value.
 * Cycles safely return null.
 */
export function resolveTableRowFormulaValues(
  fields: readonly ForgeField[],
  rowValues: Record<string, unknown>,
  formulas: Record<string, string>,
  evaluate: TableFormulaEvaluator = evaluateTableFormulaDefault,
  referenceFields: readonly ForgeField[] = fields,
): Record<string, unknown> {
  // Keep the entire statblock sample so formulas can read any Template Field.
  // Row-specific Table values already overlaid by the renderer take precedence.
  const base: Record<string, unknown> = { ...rowValues };
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(base, field.key)) base[field.key] = rowValues[field.key];
  }
  const resolved: Record<string, unknown> = { ...base };
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
    const result = evaluate(formula, resolved, base[fieldKey], referenceFields, fieldKey);
    resolved[fieldKey] = result !== null && Number.isFinite(result) ? result : null;
    states.set(fieldKey, 'resolved');
    return resolved[fieldKey];
  };

  for (const field of fields) resolve(field.key);
  return resolved;
}

/**
 * Builds the `field.sum`, `field.average`, `field.min`, `field.max`, and
 * `field.count` references used by Column Formulas. Only numeric Table Fields
 * contribute; blank and non-numeric cells are ignored.
 */
export function tableColumnAggregateContext(
  fields: readonly ForgeField[],
  rows: readonly Record<string, unknown>[],
): Record<string, TableColumnAggregate> {
  const context: Record<string, TableColumnAggregate> = {};
  for (const field of fields) {
    if (field.type !== 'number' && field.type !== 'rating') continue;
    const values = rows
      .map((row) => numericValue(row[field.key]))
      .filter((value): value is number => value !== null && Number.isFinite(value));
    const sum = values.reduce((total, value) => total + value, 0);
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 0;
    const average = values.length > 0 ? sum / values.length : 0;
    context[field.key] = { sum, average, avg: average, min, max, count: values.length };
  }
  return context;
}

export function tableColumnFormulaValue(
  formula: string,
  fieldKey: string,
  context: Record<string, TableColumnAggregate>,
  fields: readonly ForgeField[],
  evaluate: TableFormulaEvaluator = evaluateTableFormulaDefault,
  externalValues: Record<string, unknown> = {},
): number | null {
  const own = context[fieldKey];
  if (!own) return null;
  // Table aggregates override the plain statblock Values for child Fields;
  // every other Field remains addressable and is resolved by the evaluator,
  // including any Number/Rating Formula that controls its displayed value.
  const sample = { ...externalValues, ...context };
  return evaluate(formula, sample, own.sum, fields, fieldKey);
}
