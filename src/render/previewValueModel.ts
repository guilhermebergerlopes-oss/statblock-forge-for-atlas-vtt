/**
 * Pure adapters for the Atlas statblock values shown by the standalone Forge
 * preview. These mirror the public value shapes, without importing Atlas code.
 */
import { isRecord, type ForgeField } from '../templates/forgeTemplate.ts';
import { readSelectionField, selectionHasValue, selectionOptionIsSelected, selectionOptionNumber, selectionOptionReferences } from '../templates/selectionFieldModel.ts';
import { checkboxFieldOptions } from '../templates/checkboxFieldModel.ts';
import { forgeTableCellValue, FORGE_TABLE_MAX_ROWS } from '../statblocks/tableRowsModel.ts';
import type { TableCellReferenceIndex } from '../statblocks/tableFormulaModel.ts';
import { calculateNumericFieldValue, isFormulaCapableNumericField } from '../templates/numericFieldModel.ts';
import { MAX_MATH_FORMULA_LENGTH } from '../templates/formulaLimits.ts';

export interface ScorePreviewGrid {
  columns: string[];
  rows: unknown[][];
  align: Array<'start' | 'center' | 'end'>;
  header: boolean;
  /** A scalar stored in a Scores field is a native value/type mismatch. */
  mismatchedValue?: unknown;
}

const recordValue = (record: Record<string, unknown>, candidates: string[]): unknown => {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(record, candidate)) return record[candidate];
  }
  const lower = new Map(Object.keys(record).map((key) => [key.toLowerCase(), key]));
  for (const candidate of candidates) {
    const actual = lower.get(candidate.toLowerCase());
    if (actual !== undefined) return record[actual];
  }
  return undefined;
};

function isPairsList(value: unknown[]): boolean {
  return value.length > 0 && value.every((item) => isRecord(item));
}

function rowFromNamedValues(
  value: Record<string, unknown> | unknown[],
  keys: string[],
  labels: string[],
): unknown[] {
  return labels.map((label, index) => {
    const candidates = [keys[index] ?? '', label, String(index)].filter(Boolean);
    if (Array.isArray(value)) {
      for (const item of value) {
        if (!isRecord(item)) continue;
        const found = recordValue(item, candidates);
        if (found !== undefined) return found;
      }
      return null;
    }
    return recordValue(value, candidates) ?? null;
  });
}

function asRows(value: unknown): unknown[][] | null {
  if (!Array.isArray(value)) return null;
  if (value.some(Array.isArray)) {
    return value.map((row) => Array.isArray(row) ? row : [row]);
  }
  return [value];
}

function strings(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((item): item is string => typeof item === 'string');
}

/**
 * Reads the formats Atlas accepts for Scores fields:
 * - flat arrays and arrays of rows;
 * - records and lists of one-key records, keyed by slotKeys or slot labels;
 * - { columns, rows } tables with statblock-specific column names;
 * - template defaults when the sample value is absent.
 */
export function scorePreviewGrid(raw: unknown, field: ForgeField | undefined): ScorePreviewGrid {
  const sourceValue = Array.isArray(raw) && raw.length === 0 ? undefined : raw;
  const templateColumns = strings(field?.slots) ?? [];
  const slotKeys = strings(field?.slotKeys) ?? templateColumns.map((_name, index) => `slot_${index + 1}`);
  const alignments = Array.isArray(field?.align) ? field.align : [];
  let columns = [...templateColumns];
  let rows: unknown[][] = [];

  if (isRecord(sourceValue) && Array.isArray(sourceValue.rows)) {
    const ownColumns = strings(sourceValue.columns);
    if (ownColumns) columns = ownColumns;
    const ownRows = asRows(sourceValue.rows) ?? [];
    rows = ownRows;
  } else if (Array.isArray(sourceValue)) {
    if (sourceValue.length > 0 && isPairsList(sourceValue)) {
      rows = [rowFromNamedValues(sourceValue, slotKeys, columns)];
    } else {
      rows = asRows(sourceValue) ?? [];
    }
  } else if (isRecord(sourceValue)) {
    rows = [rowFromNamedValues(sourceValue, slotKeys, columns)];
  } else if (sourceValue !== undefined && sourceValue !== null && sourceValue !== '') {
    return {
      columns,
      rows: [],
      align: columns.map((_, index) => alignments[index] === 'center' || alignments[index] === 'end' ? alignments[index] : 'start'),
      header: field?.header !== false,
      mismatchedValue: sourceValue,
    };
  } else {
    rows = Array.isArray(field?.rows) ? field.rows.filter(Array.isArray) as unknown[][] : [];
  }

  // Atlas keeps unnamed cells that extend beyond the template's columns.
  const columnCount = Math.max(columns.length, ...rows.map((row) => row.length), 0);
  columns = Array.from({ length: columnCount }, (_, index) => columns[index] ?? '');
  rows = rows.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? null));
  if (rows.length === 0 && columnCount > 0) rows = [Array.from({ length: columnCount }, () => null)];

  const align = columns.map((column, index) => {
    const templateIndex = templateColumns.findIndex((name) => name.trim().toLowerCase() === column.trim().toLowerCase());
    const sourceIndex = templateIndex >= 0 ? templateIndex : index;
    const value = alignments[sourceIndex];
    return value === 'center' || value === 'end' ? value : 'start';
  });

  return { columns, rows, align, header: field?.header !== false };
}

export interface GroupPreviewLine {
  level?: string;
  text: string;
}

export interface GroupPreviewGroup {
  header: string;
  values: GroupPreviewLine[];
}

function groupValueText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(groupValueText).filter(Boolean).join(', ');
  if (isRecord(value)) return Object.entries(value).map(([key, item]) => `${key}: ${groupValueText(item)}`).filter(Boolean).join(' · ');
  return String(value).trim();
}

function isGroupHeader(value: string): boolean {
  const text = value.trim();
  return text.endsWith(':') || !text.includes(':');
}

/**
 * Parses Atlas' legacy Groups convention. Header strings (ending in `:` or with
 * no colon) start groups; one-key records such as { "1/day": "quick strike" }
 * are categorized value rows.
 */
export function groupPreviewGroups(raw: unknown, creatureName = 'Creature'): GroupPreviewGroup[] {
  if (raw === undefined || raw === null || raw === '') return [];
  const entries: unknown[] = Array.isArray(raw)
    ? raw
    : isRecord(raw)
      ? Object.entries(raw).map(([key, value]) => ({ [key]: value }))
      : [raw];
  const groups: GroupPreviewGroup[] = [];

  for (const entry of entries) {
    if (typeof entry === 'string' && isGroupHeader(entry)) {
      const trimmedHeader = entry.trim();
      const header = trimmedHeader.endsWith(':') || /[^a-zA-Z0-9:]$/.test(trimmedHeader)
        ? trimmedHeader
        : `${trimmedHeader}:`;
      groups.push({ header, values: [] });
      continue;
    }

    let line: GroupPreviewLine | null = null;
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (text) line = { text };
    } else if (isRecord(entry)) {
      const [level, value] = Object.entries(entry)[0] ?? [];
      const text = groupValueText(value);
      if (level && text) line = { level, text };
    } else {
      const text = groupValueText(entry);
      if (text) line = { text };
    }

    if (!line) continue;
    if (groups.length === 0) groups.push({ header: `${creatureName} has the following values:`, values: [] });
    groups[groups.length - 1]?.values.push(line);
  }

  return groups;
}


/**
 * Evaluates the safe arithmetic subset shared by Number/Rating, Metric, and
 * Scores formulas. It deliberately has no `eval`, property access outside
 * declared sample references, assignments, or arbitrary function calls.
 */
export function evaluatePreviewFormula(
  source: string,
  sample: Record<string, unknown>,
  slotValue: unknown,
  fieldsOrSelfFieldKey: readonly ForgeField[] | string = [],
  tableReferences: TableCellReferenceIndex = {},
  tableSourceValues: Record<string, unknown> = sample,
  selfFieldKey?: string,
): number | null {
  // calculateNumericFieldValue can pass this function directly as its evaluator;
  // in that callback shape the fourth argument is the Field currently being calculated.
  const fields = typeof fieldsOrSelfFieldKey === 'string' ? [] : fieldsOrSelfFieldKey;
  const currentFieldKey = typeof fieldsOrSelfFieldKey === 'string' ? fieldsOrSelfFieldKey : selfFieldKey;
  return evaluatePreviewFormulaInternal(
    source, sample, slotValue, fields, tableReferences, tableSourceValues, new Set<string>(), currentFieldKey,
  );
}

/** Shared recursion stack makes calculated Field references composable while rejecting cycles. */
function evaluatePreviewFormulaInternal(
  source: string,
  sample: Record<string, unknown>,
  slotValue: unknown,
  fields: readonly ForgeField[],
  tableReferences: TableCellReferenceIndex,
  tableSourceValues: Record<string, unknown>,
  resolvingValues: Set<string>,
  selfFieldKey?: string,
): number | null {
  source = source.trim();
  if (!source || source.length > MAX_MATH_FORMULA_LENGTH) return null;

  type FormulaAtom = number | boolean;
  type Token =
    | { type: 'number'; value: number }
    | { type: 'name'; value: string; explicitReference: boolean }
    | { type: 'op'; value: string }
    | { type: 'end' };
  type FormulaNode =
    | { kind: 'literal'; value: FormulaAtom }
    | { kind: 'reference'; name: string; explicitReference: boolean }
    | { kind: 'unary'; operator: '+' | '-' | '!'; operand: FormulaNode }
    | { kind: 'binary'; operator: string; left: FormulaNode; right: FormulaNode }
    | { kind: 'conditional'; condition: FormulaNode; whenTrue: FormulaNode; whenFalse: FormulaNode }
    | { kind: 'call'; name: string; args: FormulaNode[] };

  const tokens: Token[] = [];
  const pattern = /\s*(?:(\d+(?:\.\d+)?)|(@[A-Za-z_][A-Za-z0-9_.]*|\{[A-Za-z_][A-Za-z0-9_.-]*\})|([A-Za-z_][A-Za-z0-9_.]*)|(>=|<=|==|!=|&&|\|\||[+\-*/%><!?:(),]))/gy;
  let offset = 0;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match || match.index !== offset) return null;
    if (match[1] !== undefined) {
      const value = Number(match[1]);
      if (!Number.isFinite(value)) return null;
      tokens.push({ type: 'number', value });
    } else if (match[2] !== undefined) {
      const reference = match[2];
      tokens.push({ type: 'name', value: reference.startsWith('@') ? reference.slice(1) : reference.slice(1, -1), explicitReference: true });
    } else if (match[3] !== undefined) {
      tokens.push({ type: 'name', value: match[3], explicitReference: false });
    } else if (match[4] !== undefined) {
      tokens.push({ type: 'op', value: match[4] });
    }
    offset = pattern.lastIndex;
    // Each token consumes at least one source character, so the shared character
    // budget also provides a strict upper bound on parser work.
    if (tokens.length > MAX_MATH_FORMULA_LENGTH) return null;
  }
  tokens.push({ type: 'end' });

  let position = 0;
  let depth = 0;
  const peek = (): Token => tokens[position] ?? { type: 'end' };
  const take = (): Token => {
    const token = peek();
    if (token.type !== 'end') position += 1;
    return token;
  };
  const peekOperator = (): string | null => {
    const token = peek();
    return token.type === 'op' ? token.value : null;
  };
  const isOperator = (operator: string): boolean => peekOperator() === operator;
  const consumeOperator = (operator: string): boolean => {
    if (!isOperator(operator)) return false;
    take();
    return true;
  };
  const nested = <T>(parse: () => T | null): T | null => {
    depth += 1;
    if (depth > 64) {
      depth -= 1;
      return null;
    }
    const result = parse();
    depth -= 1;
    return result;
  };

  // Recursive-descent parser. Parsing produces a small, inert syntax tree;
  // evaluation happens afterward so logical and conditional branches can
  // short-circuit without evaluating unused expressions.
  const parseConditional = (): FormulaNode | null => {
    const condition = parseLogicalOr();
    if (!condition) return null;
    if (!consumeOperator('?')) return condition;
    return nested(() => {
      const whenTrue = parseConditional();
      if (!whenTrue || !consumeOperator(':')) return null;
      const whenFalse = parseConditional();
      return whenFalse ? { kind: 'conditional', condition, whenTrue, whenFalse } : null;
    });
  };

  const parseLogicalOr = (): FormulaNode | null => {
    let left = parseLogicalAnd();
    if (!left) return null;
    while (consumeOperator('||')) {
      const right = parseLogicalAnd();
      if (!right) return null;
      left = { kind: 'binary', operator: '||', left, right };
    }
    return left;
  };

  const parseLogicalAnd = (): FormulaNode | null => {
    let left = parseComparison();
    if (!left) return null;
    while (consumeOperator('&&')) {
      const right = parseComparison();
      if (!right) return null;
      left = { kind: 'binary', operator: '&&', left, right };
    }
    return left;
  };

  const parseComparison = (): FormulaNode | null => {
    let left = parseAdditive();
    if (!left) return null;
    while (['>', '>=', '<', '<=', '==', '!='].includes(peekOperator() ?? '')) {
      const operator = (take() as Extract<Token, { type: 'op' }>).value;
      const right = parseAdditive();
      if (!right) return null;
      left = { kind: 'binary', operator, left, right };
    }
    return left;
  };

  const parseAdditive = (): FormulaNode | null => {
    let left = parseMultiplicative();
    if (!left) return null;
    while (isOperator('+') || isOperator('-')) {
      const operator = (take() as Extract<Token, { type: 'op' }>).value;
      const right = parseMultiplicative();
      if (!right) return null;
      left = { kind: 'binary', operator, left, right };
    }
    return left;
  };

  const parseMultiplicative = (): FormulaNode | null => {
    let left = parseUnary();
    if (!left) return null;
    while (isOperator('*') || isOperator('/') || isOperator('%')) {
      const operator = (take() as Extract<Token, { type: 'op' }>).value;
      const right = parseUnary();
      if (!right) return null;
      left = { kind: 'binary', operator, left, right };
    }
    return left;
  };

  const parseUnary = (): FormulaNode | null => {
    if (isOperator('+') || isOperator('-') || isOperator('!')) {
      const operator = (take() as Extract<Token, { type: 'op' }>).value as '+' | '-' | '!';
      return nested(() => {
        const operand = parseUnary();
        return operand ? { kind: 'unary', operator, operand } : null;
      });
    }
    return parsePrimary();
  };

  const parsePrimary = (): FormulaNode | null => {
    const token = take();
    if (token.type === 'number') return { kind: 'literal', value: token.value };
    if (token.type === 'name') {
      if (!token.explicitReference && token.value.toLowerCase() === 'true') return { kind: 'literal', value: true };
      if (!token.explicitReference && token.value.toLowerCase() === 'false') return { kind: 'literal', value: false };
      if (!consumeOperator('(')) return { kind: 'reference', name: token.value, explicitReference: token.explicitReference };

      const name = token.value.toLowerCase();
      if (!['floor', 'ceil', 'round', 'abs', 'min', 'max'].includes(name)) return null;
      return nested(() => {
        const args: FormulaNode[] = [];
        if (!isOperator(')')) {
          for (;;) {
            const argument = parseConditional();
            if (!argument) return null;
            args.push(argument);
            if (!consumeOperator(',')) break;
          }
        }
        if (!consumeOperator(')') || args.length === 0) return null;
        if (!['min', 'max'].includes(name) && args.length !== 1) return null;
        return { kind: 'call', name, args };
      });
    }
    if (token.type === 'op' && token.value === '(') {
      return nested(() => {
        const expression = parseConditional();
        return expression && consumeOperator(')') ? expression : null;
      });
    }
    return null;
  };

  const root = parseConditional();
  if (!root || peek().type !== 'end') return null;

  const finite = (value: number): number | null => Number.isFinite(value) ? value : null;
  const numberOf = (value: unknown): number | null => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (typeof value === 'number') return finite(value);
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim();
      const parsed = Number(normalized);
      if (Number.isFinite(parsed)) return parsed;
      const fraction = normalized.match(/^(-?\d+)\s*\/\s*(\d+)$/);
      if (fraction) {
        const numerator = Number(fraction[1]);
        const denominator = Number(fraction[2]);
        if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
          return finite(numerator / denominator);
        }
      }
    }
    return null;
  };
  const toAtom = (value: unknown): FormulaAtom | null => {
    if (typeof value === 'boolean') return value;
    return numberOf(value);
  };
  const truthy = (value: FormulaAtom): boolean => typeof value === 'boolean' ? value : value !== 0;
  const selectionFields = new Map(fields.filter((field) => field.type === 'choice').map((field) => [field.key, field]));
  const checkboxFields = new Map(fields.filter((field) => field.type === 'checkboxes').map((field) => [field.key, field]));
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));

  /**
   * Return the number the statblock displays for a Number/Rating Field. A
   * formula-backed Field must resolve its own formula before another formula
   * consumes it; the stored input remains untouched for editing.
   */
  const resolveDisplayedNumericValue = (
    field: ForgeField,
    values: Record<string, unknown>,
    resolutionKey: string,
  ): unknown => {
    if (!isFormulaCapableNumericField(field)) return values[field.key];
    if (resolvingValues.has(resolutionKey)) return undefined;
    resolvingValues.add(resolutionKey);
    try {
      const result = calculateNumericFieldValue(field, values, (formula, formulaSample, formulaSlotValue, currentFieldKey) =>
        evaluatePreviewFormulaInternal(
          formula, formulaSample, formulaSlotValue, fields, tableReferences, tableSourceValues, resolvingValues, currentFieldKey,
        ));
      return result === null ? undefined : result;
    } finally {
      resolvingValues.delete(resolutionKey);
    }
  };

  const readRef = (ref: string): unknown => {
    const [rootKey, ...parts] = ref.split('.');
    if (!rootKey) return undefined;
    const tableColumns = tableReferences[rootKey];
    if (tableColumns) {
      // Table references are positional and one-based. Resolve the target
      // Number/Rating through its display formula using a sample overlaid with
      // every source cell from the requested row, not the raw first-row input.
      const rowMatch = parts[0]?.match(/^row([1-9][0-9]*)$/i);
      const columnKey = parts[1];
      if (parts.length !== 2 || !rowMatch || !columnKey || !tableColumns.includes(columnKey)) return undefined;
      const rowNumber = Number(rowMatch[1]);
      if (!Number.isSafeInteger(rowNumber) || rowNumber > FORGE_TABLE_MAX_ROWS) return undefined;

      const rowSample: Record<string, unknown> = { ...tableSourceValues, ...sample };
      for (const childKey of tableColumns) {
        rowSample[childKey] = rowNumber === 1
          ? tableSourceValues[childKey]
          : forgeTableCellValue(tableSourceValues[rootKey], rowNumber - 1, childKey);
      }
      if (columnKey === selfFieldKey) return rowSample[columnKey];
      const targetField = fieldsByKey.get(columnKey);
      if (!targetField) return rowSample[columnKey];
      return resolveDisplayedNumericValue(targetField, rowSample, `${rootKey}.row${rowNumber}.${columnKey}`);
    }
    if (parts.length === 0 && rootKey === selfFieldKey) return slotValue;
    const selectionField = selectionFields.get(rootKey);
    if (selectionField) {
      const raw = sample[rootKey];
      if (parts.length === 0) {
        return selectionHasValue(raw) || readSelectionField(selectionField, raw).picks.length > 0 ? 1 : 0;
      }
      if (parts.length === 1 || (parts.length === 2 && parts[1] === 'number')) {
        const option = selectionOptionReferences(selectionField).find((candidate) => candidate.key === parts[0]);
        if (option) {
          if (parts.length === 2) return selectionOptionNumber(selectionField, raw, option.value, option.key) ?? 0;
          return selectionOptionIsSelected(selectionField, raw, option.value, option.key) ? 1 : 0;
        }
      }
      return undefined;
    }
    const checkboxField = checkboxFields.get(rootKey);
    if (checkboxField) {
      const raw = isRecord(sample[rootKey]) ? sample[rootKey] : {};
      const options = checkboxFieldOptions(checkboxField);
      if (parts.length === 0) return options.some((option) => raw[option.key] === true) ? 1 : 0;
      if (parts.length === 1) {
        const option = options.find((candidate) => candidate.key === parts[0]
          || candidate.aliases?.includes(parts[0] ?? ''));
        return option ? (raw[option.key] === true ? 1 : 0) : undefined;
      }
      return undefined;
    }
    if (parts.length === 0) {
      const referencedField = fieldsByKey.get(rootKey);
      if (referencedField && isFormulaCapableNumericField(referencedField)) {
        return resolveDisplayedNumericValue(referencedField, sample, rootKey);
      }
    }
    if (Object.prototype.hasOwnProperty.call(sample, ref)) return sample[ref];
    if (!Object.prototype.hasOwnProperty.call(sample, rootKey)) return undefined;
    let value: unknown = sample[rootKey];
    for (const part of parts) {
      if (Array.isArray(value) && /^\d+$/.test(part)) {
        const index = Number(part);
        value = Number.isSafeInteger(index) && Object.prototype.hasOwnProperty.call(value, index) ? value[index] : undefined;
      } else if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, part)) {
        value = value[part];
      } else return undefined;
    }
    return value;
  };

  const evaluate = (node: FormulaNode): FormulaAtom | null => {
    if (node.kind === 'literal') return node.value;
    if (node.kind === 'reference') {
      // Bare `value` is the current cell's original value. Explicit references
      // such as `{value}` or `@value` must resolve the Template Field key.
      if (node.name === 'value' && !node.explicitReference) return toAtom(slotValue);
      // `rowNumber` is supplied only while a Table row is being evaluated.
      // Its hidden context key avoids colliding with a Template Field of the
      // same name; `{rowNumber}` can still explicitly read that Field.
      if (node.name === 'rowNumber' && !node.explicitReference
        && Number.isSafeInteger(sample.__forgeTableRowNumber)) return sample.__forgeTableRowNumber as number;
      return toAtom(readRef(node.name));
    }
    if (node.kind === 'conditional') {
      const condition = evaluate(node.condition);
      if (condition === null) return null;
      return evaluate(truthy(condition) ? node.whenTrue : node.whenFalse);
    }
    if (node.kind === 'unary') {
      const value = evaluate(node.operand);
      if (value === null) return null;
      if (node.operator === '!') return !truthy(value);
      const numeric = numberOf(value);
      if (numeric === null) return null;
      return finite(node.operator === '-' ? -numeric : numeric);
    }
    if (node.kind === 'call') {
      const args = node.args.map(evaluate);
      if (args.some((value) => value === null)) return null;
      const numbers = args.map((value) => numberOf(value));
      if (numbers.some((value) => value === null)) return null;
      const values = numbers as number[];
      const first = values[0] ?? 0;
      const result = node.name === 'floor' ? Math.floor(first)
        : node.name === 'ceil' ? Math.ceil(first)
          : node.name === 'round' ? Math.round(first)
            : node.name === 'abs' ? Math.abs(first)
              : node.name === 'min' ? Math.min(...values) : Math.max(...values);
      return finite(result);
    }

    const left = evaluate(node.left);
    if (left === null) return null;
    if (node.operator === '&&') {
      return truthy(left) ? (() => {
        const right = evaluate(node.right);
        return right === null ? null : truthy(right);
      })() : false;
    }
    if (node.operator === '||') {
      if (truthy(left)) return true;
      const right = evaluate(node.right);
      return right === null ? null : truthy(right);
    }

    const right = evaluate(node.right);
    if (right === null) return null;
    if (node.operator === '==' || node.operator === '!=') {
      const leftNumber = numberOf(left);
      const rightNumber = numberOf(right);
      const equal = leftNumber !== null && rightNumber !== null
        ? leftNumber === rightNumber
        : left === right;
      return node.operator === '==' ? equal : !equal;
    }

    const leftNumber = numberOf(left);
    const rightNumber = numberOf(right);
    if (leftNumber === null || rightNumber === null) return null;
    switch (node.operator) {
      case '+': return finite(leftNumber + rightNumber);
      case '-': return finite(leftNumber - rightNumber);
      case '*': return finite(leftNumber * rightNumber);
      case '/': return rightNumber === 0 ? null : finite(leftNumber / rightNumber);
      case '%': return rightNumber === 0 ? null : finite(leftNumber % rightNumber);
      case '>': return leftNumber > rightNumber;
      case '>=': return leftNumber >= rightNumber;
      case '<': return leftNumber < rightNumber;
      case '<=': return leftNumber <= rightNumber;
      default: return null;
    }
  };

  const result = evaluate(root);
  return result === null ? null : numberOf(result);
}
