/** Dynamic formulas for Dice Fields. References follow the shared Number/Rating formula resolver. */
import type { ForgeField } from '../templates/forgeTemplate.ts';
import { isFormulaCapableNumericField } from '../templates/numericFieldModel.ts';
import { isDiceFieldValue } from './diceFieldEditorModel.ts';
import { writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';
import { normalizeDiceCountExpressions } from './atlasDiceEngine/parseFormula.ts';

export const MAX_DICE_FIELD_FORMULA_LENGTH = 500;
const EXPLICIT_AT_REFERENCE = /^@([A-Za-z_][A-Za-z0-9_.]*)/;
const BRACED_REFERENCE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const BARE_PATH_SEGMENT = /^[A-Za-z0-9_]+/;
const RESERVED_DICE_WORDS = new Set([
  'd', 'kh', 'kl', 'dh', 'dl', 'k', 'h', 'l', 'r', 'ro', 'rr', 'x', 'xo', 'cs', 'cf', 'adv', 'dis',
]);

export function diceFieldFormula(field: ForgeField): string {
  return typeof field.diceFormula === 'string' ? field.diceFormula : '';
}

export function hasDiceFieldFormula(field: ForgeField): boolean {
  return diceFieldFormula(field).trim().length > 0;
}

export function setDiceFieldFormula(field: ForgeField, formula: string): boolean {
  const clean = formula.trim().slice(0, MAX_DICE_FIELD_FORMULA_LENGTH);
  if (diceFieldFormula(field) === clean) return false;
  if (clean) field.diceFormula = clean;
  else delete field.diceFormula;
  return true;
}

interface ReferenceTransformResult {
  text: string;
  invalid: boolean;
  references: string[];
}

/**
 * Replaces explicit (`@path`, `{path}`) and bare Number Formula references with
 * integer placeholders/values. Labels remain opaque so words such as `fire`
 * inside `[fire]` are never interpreted as Field keys.
 */
function transformDiceFormulaReferences(
  source: string,
  fields: readonly ForgeField[],
  resolve: (reference: string) => number | null,
): ReferenceTransformResult {
  const keys = [...fields]
    .map((field) => field.key)
    // Bare Number Formula identifiers cannot contain hyphens; use `{field-key}` for those.
    .filter((key) => /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(key))
    .sort((left, right) => right.length - left.length);
  let text = '';
  let invalid = false;
  const references: string[] = [];
  let cursor = 0;

  const appendReference = (reference: string): void => {
    references.push(reference);
    const value = resolve(reference);
    if (value === null || !Number.isSafeInteger(value)) {
      invalid = true;
      text += '0';
    } else text += String(value);
  };

  while (cursor < source.length) {
    const character = source[cursor] ?? '';

    // Dice labels are descriptive text, not formula syntax.
    if (character === '[') {
      const close = source.indexOf(']', cursor);
      const end = close < 0 ? source.length : close + 1;
      text += source.slice(cursor, end);
      cursor = end;
      continue;
    }

    if (character === '{') {
      const close = source.indexOf('}', cursor + 1);
      if (close >= 0) {
        const reference = source.slice(cursor + 1, close);
        if (BRACED_REFERENCE.test(reference)) {
          appendReference(reference);
          cursor = close + 1;
          continue;
        }
      }
      text += character;
      cursor += 1;
      continue;
    }

    if (character === '@') {
      const match = EXPLICIT_AT_REFERENCE.exec(source.slice(cursor));
      if (match) {
        appendReference(match[1] ?? '');
        cursor += match[0].length;
        continue;
      }
      text += character;
      cursor += 1;
      continue;
    }

    const previous = cursor > 0 ? source[cursor - 1] ?? '' : '';

    // Number Formula also accepts boolean literals as numeric 1/0.
    const literalBoundary = cursor === 0 || !/[A-Za-z0-9_.-]/.test(previous);
    if (literalBoundary && source.slice(cursor, cursor + 4).toLowerCase() === 'true'
      && !/[A-Za-z0-9_-]/.test(source[cursor + 4] ?? '')) {
      text += '1';
      cursor += 4;
      continue;
    }
    if (literalBoundary && source.slice(cursor, cursor + 5).toLowerCase() === 'false'
      && !/[A-Za-z0-9_-]/.test(source[cursor + 5] ?? '')) {
      text += '0';
      cursor += 5;
      continue;
    }

    // Number Formula also accepts bare Field keys. Match only declared roots,
    // then retain dotted paths so Checkboxes, Selection, Tables, and structured
    // Fields use the same lookup semantics as Number/Rating formulas.
    if (/[A-Za-z_]/.test(character) && !/[A-Za-z0-9_.-]/.test(previous)) {
      let matchedKey = '';
      for (const key of keys) {
        if (!source.startsWith(key, cursor)) continue;
        const after = source[cursor + key.length] ?? '';
        if (/[A-Za-z0-9_-]/.test(after) || after === '(') continue;
        if (RESERVED_DICE_WORDS.has(key.toLowerCase())) continue;
        matchedKey = key;
        break;
      }
      if (matchedKey) {
        let end = cursor + matchedKey.length;
        while (source[end] === '.') {
          const segment = BARE_PATH_SEGMENT.exec(source.slice(end + 1));
          if (!segment) break;
          end += segment[0].length + 1;
        }
        appendReference(source.slice(cursor, end));
        cursor = end;
        continue;
      }
    }

    text += character;
    cursor += 1;
  }

  return { text, invalid, references };
}

function numericSample(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const direct = Number(value.trim());
  if (Number.isFinite(direct)) return direct;
  const fraction = value.trim().match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (!fraction || Number(fraction[2]) <= 0) return null;
  const result = Number(fraction[1]) / Number(fraction[2]);
  return Number.isFinite(result) ? result : null;
}

/**
 * Validate notation independently from live Field values (the Template editor
 * may have empty samples). Optional Field definitions enable validation of
 * the same bare-key references accepted by Number/Rating formulas.
 */
export function isDiceFieldFormulaSyntaxValid(formula: string, fields: readonly ForgeField[] = []): boolean {
  const source = formula.trim();
  if (!source || source.length > MAX_DICE_FIELD_FORMULA_LENGTH) return false;
  const side = writtenAdvantage(source);
  const transformed = transformDiceFormulaReferences(side.formula, fields, () => 2);
  const replaced = transformed.text
    .replace(/([0-9)])\s+(?=[dD](?:\s*(?:\d|%|[fF])))/g, '$1')
    .replace(/([dD])\s+(?=\d|%|[fF])/g, '$1');
  if (/[{}]/.test(replaced)) return false;
  return isDiceFieldValue(replaced);
}

/**
 * Resolves a configured Dice Field formula against the current statblock Values.
 * `referenceValue` delegates each reference to the same safe resolver used by
 * Number/Rating formulas. Its result must be an integer because the dice grammar
 * uses whole numbers for counts, faces, keep/drop amounts, and constants.
 * The legacy numeric callback remains as a fallback for isolated callers.
 */
export function resolveDiceFieldFormula(
  field: ForgeField,
  fields: readonly ForgeField[],
  data: Readonly<Record<string, unknown>>,
  numericValue?: (source: ForgeField) => number | null,
  referenceValue?: (reference: string) => number | null,
): string | null {
  const source = diceFieldFormula(field).trim();
  if (!source) return null;
  const writtenSide = writtenAdvantage(source);

  const transformed = transformDiceFormulaReferences(writtenSide.formula, fields, (reference) => {
    if (referenceValue) return referenceValue(reference);
    // Backwards-compatible pure-model behavior: callers without the shared
    // resolver can still substitute simple Number/Rating roots.
    if (reference.includes('.')) return null;
    const sourceField = fields.find((candidate) => candidate.key === reference);
    if (!sourceField || sourceField.key === field.key || !isFormulaCapableNumericField(sourceField)) return null;
    return numericValue ? numericValue(sourceField) : numericSample(data[reference]);
  });

  // Normalize only the count-to-die boundary after substitution; stored text stays unchanged.
  const normalized = transformed.text
    .replace(/([0-9)])\s+(?=[dD](?:\s*(?:\d|%|[fF])))/g, '$1')
    .replace(/([dD])\s+(?=\d|%|[fF])/g, '$1');
  // An unmatched brace is almost certainly a misspelled or malformed placeholder.
  if (transformed.invalid || /[{}]/.test(normalized) || !isDiceFieldValue(normalized)) return '';
  const resolved = normalizeDiceCountExpressions(normalized);
  return writtenSide.word ? `${resolved} ${writtenSide.word}` : resolved;
}

/** All source paths used by a Dice Formula, including bare Number Formula keys. */
export function diceFieldFormulaReferences(formula: string, fields: readonly ForgeField[] = []): string[] {
  return transformDiceFormulaReferences(formula, fields, () => 0).references;
}

function pathReferencesField(reference: string, key: string): boolean {
  const parts = reference.split('.');
  if (parts[0] === key) return true;
  // A Table cell path also depends on its public column Field.
  return parts.length === 3 && /^row[1-9][0-9]*$/i.test(parts[1] ?? '') && parts[2] === key;
}

/** Exact references used by dependency validation and rename/delete protection. */
export function diceFieldFormulaUsesField(formula: string, key: string): boolean {
  const explicit = transformDiceFormulaReferences(formula, [], () => 0).references;
  const bare = transformDiceFormulaReferences(formula, [{ key, label: key, type: 'text' }], () => 0).references;
  const tableColumn = new RegExp(`(?:^|[^A-Za-z0-9_.@{}-])[A-Za-z_][A-Za-z0-9_-]*\\.row[1-9][0-9]*\\.${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^A-Za-z0-9_-])`, 'i');
  return [...explicit, ...bare].some((reference) => pathReferencesField(reference, key)) || tableColumn.test(formula);
}

/** Update the root Field key and Table column segment, without rewriting option/property names. */
export function renameDiceFieldFormulaReference(formula: string, from: string, to: string): string {
  const replacePath = (path: string): string => {
    const parts = path.split('.');
    if (parts[0] === from) {
      parts[0] = to;
      return parts.join('.');
    }
    if (parts.length === 3 && /^row[1-9][0-9]*$/i.test(parts[1] ?? '') && parts[2] === from) {
      parts[2] = to;
      return parts.join('.');
    }
    return path;
  };

  let result = formula.replace(/@([A-Za-z_][A-Za-z0-9_.]*)|\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g, (match, atPath: string | undefined, bracePath: string | undefined) => {
    const path = atPath ?? bracePath ?? '';
    const renamed = replacePath(path);
    if (renamed === path) return match;
    return match.startsWith('@') ? `@${renamed}` : `{${renamed}}`;
  });

  // Bare keys are supported by Number Formula too. Keep a dotted suffix when
  // renaming a root, and require a token boundary so dice notation (e.g. d6)
  // is not mistaken for a Field key.
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(from)) {
    const bare = new RegExp(`(^|[^A-Za-z0-9_.@{}-])(${escaped})(?=$|[.\\s+*/%()\\-])`, 'g');
    result = result.replace(bare, (_match, prefix: string) => `${prefix}${to}`);
  }
  const tableColumn = new RegExp(`(\\.row[1-9][0-9]*\\.)${escaped}(?=$|[^A-Za-z0-9_-])`, 'gi');
  result = result.replace(tableColumn, (_match, prefix: string) => `${prefix}${to}`);
  return result;
}
