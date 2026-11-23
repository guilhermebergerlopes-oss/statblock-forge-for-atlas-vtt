import { isRecord, type ForgeBlock, type ForgeField } from '../templates/forgeTemplate.ts';
import { evaluatePreviewFormula } from '../render/previewValueModel.ts';
import { MAX_MATH_FORMULA_LENGTH } from '../templates/formulaLimits.ts';
import { resolveTableRowFormulaValues as resolveTableRowFormulaValuesModel, tableFormulaReferencedFieldKeys } from './tableRowFormulaResolver.ts';
import type { TableFormulaEvaluator } from './tableRowFormulaResolver.ts';

export type { TableFormulaEvaluator } from './tableRowFormulaResolver.ts';
export { tableFormulaReferencedFieldKeys } from './tableRowFormulaResolver.ts';

export type TableFormulaKind = 'row' | 'column';

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

/** Metadata required to resolve a Table cell exactly as it is displayed. */
export interface TableCellReferenceDefinition {
  /** Public Template Field keys assigned to this Table's columns. */
  columns: readonly string[];
  /** Table-level Row Formulas take precedence over the child Field's own formula. */
  rowFormulas: Readonly<Record<string, string>>;
}

/** Maps each Table's private storage Field key to its columns and display formulas. */
export type TableCellReferenceIndex = Readonly<Record<string, TableCellReferenceDefinition>>;

/**
 * Builds the stable lookup needed by formulas such as `{table_1.row2.value}`.
 * The storage Field identifies the Table, while the `fields` array on its
 * Scores block identifies which Template Fields are valid columns.
 */
export function tableCellReferenceIndex(blocks: readonly ForgeBlock[]): Record<string, TableCellReferenceDefinition> {
  const index: Record<string, TableCellReferenceDefinition> = {};
  const visit = (items: readonly ForgeBlock[]): void => {
    for (const block of items) {
      if (block.type === 'scores' && typeof block.field === 'string' && block.field.trim()) {
        const columns = Array.isArray(block.fields)
          ? [...new Set(block.fields.filter((key): key is string => typeof key === 'string' && key.trim().length > 0))]
          : [];
        index[block.field] = {
          columns,
          rowFormulas: tableFormulaMap(block, 'row'),
        };
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
  const clean = formula.trim();
  if (clean.length > MAX_MATH_FORMULA_LENGTH) return false;
  if ((current[fieldKey] ?? '') === clean) return false;
  const next = { ...current };
  if (clean) next[fieldKey] = clean;
  else delete next[fieldKey];
  if (Object.keys(next).length > 0) block[property] = next;
  else delete block[property];
  return true;
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
 * Resolves every Row Formula in one row using the supplied or default safe
 * formula evaluator. The resolver itself lives in a dependency-free module so
 * previewValueModel can use it without creating a circular import.
 */
export function resolveTableRowFormulaValues(
  fields: readonly ForgeField[],
  rowValues: Record<string, unknown>,
  formulas: Record<string, string>,
  evaluate: TableFormulaEvaluator = evaluateTableFormulaDefault,
  referenceFields: readonly ForgeField[] = fields,
): Record<string, unknown> {
  return resolveTableRowFormulaValuesModel(fields, rowValues, formulas, evaluate, referenceFields);
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
