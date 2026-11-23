/**
 * Dice formula implementation adapted from Atlas VTT's formula engine.
 * Original project: Atlas VTT Beta; licensed under GNU AGPL-3.0.
 * The Forge copy is deliberately isolated and exposes only the total needed by Rest.
 */
/**
 * Complete, bounded dice grammar. A formula adds, subtracts, multiplies and
 * divides dice and constants, with the usual precedence and parentheses:
 * `2d6+3`, `(1d8+2)*2`, `(3+2)d6kh2`, `4d6kh3`, `3dF`, `d%`. A parenthesized
 * arithmetic expression immediately before `d` can calculate the dice count.
 * A sign may only open a formula
 * or a parenthesis, so `d20++2` is refused rather than guessed at.
 *
 * Dice terms and their modifiers are read by `formulaTerms.ts`. Division keeps
 * its fractions while the formula is worked out, and only the total is cut to
 * a whole number, towards zero: `7/2` is 3 and `-7/2` is −3. A divisor that
 * comes out 0 makes its quotient 0; a divisor written as 0 is refused.
 */
import { checkFormula } from './formulaChecks.ts';
import { readTerm, type TermDraft } from './formulaTerms.ts';
import { FORMULA_LIMITS, type FormulaError, type FormulaErrorCode, type FormulaNode, type FormulaOperator, type FormulaTerm,
  type ParsedFormula } from './formulaTypes.ts';

export { FORMULA_LIMITS } from './formulaTypes.ts';

export type {
  ConstantTerm, DiceKeep, DiceReroll, DiceTally, DiceTerm, FormulaError, FormulaErrorCode, FormulaNode, FormulaOperator,
  FormulaTerm, ParsedFormula,
} from './formulaTypes.ts';

/** A draft of the tree, before the signs that lead to each term are known. */
type DraftNode =
  | { readonly kind: 'term'; readonly term: TermDraft }
  | { readonly kind: 'negate'; readonly operand: DraftNode }
  | { readonly kind: 'operation'; readonly operator: FormulaOperator; readonly left: DraftNode; readonly right: DraftNode };

class FormulaSyntaxError extends Error {
  readonly code: FormulaErrorCode;
  constructor(code: FormulaErrorCode) {
    super(code);
    this.code = code;
  }
}

// Whitespace is SP/HTAB only, and only between terms, operators and parentheses.
const SPACE = /[ \t]*/y;

/** Recursive descent over the formula's text. */
class FormulaReader {
  private cursor = 0;
  private depth = 0;
  private readonly text: string;

  constructor(text: string) { this.text = text; }

  read(): DraftNode {
    this.skipSpace();
    const node = this.expression();
    if (this.cursor < this.text.length) throw new FormulaSyntaxError('syntax');
    return node;
  }

  private expression(): DraftNode {
    const sign = this.take('+', '-');
    if (sign !== null) this.skipSpace();
    const first = this.product();
    let node: DraftNode = sign === '-' ? { kind: 'negate', operand: first } : first;
    for (let operator = this.take('+', '-'); operator !== null; operator = this.take('+', '-')) {
      this.skipSpace();
      node = { kind: 'operation', operator, left: node, right: this.product() };
    }
    return node;
  }

  private product(): DraftNode {
    let node = this.factor();
    for (let operator = this.take('*', '/'); operator !== null; operator = this.take('*', '/')) {
      this.skipSpace();
      const right = this.factor();
      if (operator === '/' && right.kind === 'term' && right.term.kind === 'constant' && right.term.value === 0) {
        throw new FormulaSyntaxError('syntax');
      }
      node = { kind: 'operation', operator, left: node, right };
    }
    return node;
  }

  private factor(): DraftNode {
    if (this.text[this.cursor] === '(') {
      const countedDice = this.parenthesizedDiceTerm();
      if (countedDice) return countedDice;
      if (this.take('(') !== null) {
        if (++this.depth > FORMULA_LIMITS.depth) throw new FormulaSyntaxError('depth');
        this.skipSpace();
        const inner = this.expression();
        if (this.take(')') === null) throw new FormulaSyntaxError('syntax');
        this.depth -= 1;
        this.skipSpace();
        return inner;
      }
    }
    const read = readTerm(this.text, this.cursor);
    if (!read) throw new FormulaSyntaxError('syntax');
    this.cursor = read.end;
    this.skipSpace();
    return { kind: 'term', term: read.term };
  }

  /**
   * Reads an arithmetic count such as `(power+damage)d6kh2` as one Dice term.
   * Ordinary parenthesized expressions keep their existing meaning; this
   * special form is selected only when the matching `)` is followed by `d`.
   */
  private parenthesizedDiceTerm(): DraftNode | null {
    const start = this.cursor;
    let nesting = 0;
    let close = -1;
    for (let index = start; index < this.text.length; index += 1) {
      const character = this.text[index];
      if (character === '(') nesting += 1;
      else if (character === ')') {
        nesting -= 1;
        if (nesting === 0) {
          close = index;
          break;
        }
      }
    }
    if (close < 0) return null;

    let diceStart = close + 1;
    while (this.text[diceStart] === ' ' || this.text[diceStart] === '\t') diceStart += 1;
    if (!/[dD]/.test(this.text[diceStart] ?? '')) return null;

    if (++this.depth > FORMULA_LIMITS.depth) throw new FormulaSyntaxError('depth');
    const countDraft = new FormulaReader(this.text.slice(start + 1, close)).read();
    this.depth -= 1;
    const count = constantValue(countDraft);
    if (count === null || !Number.isSafeInteger(count) || count < 0) throw new FormulaSyntaxError('syntax');
    if (count > 999) throw new FormulaSyntaxError('dice');

    const countText = String(count);
    const synthetic = `${countText}${this.text.slice(diceStart)}`;
    const read = readTerm(synthetic, 0);
    if (!read || read.term.kind !== 'dice') throw new FormulaSyntaxError('syntax');
    this.cursor = diceStart + read.end - countText.length;
    this.skipSpace();
    return { kind: 'term', term: read.term };
  }

  /** Consumes one of `characters` at the cursor and returns it, or null. */
  private take<T extends string>(...characters: T[]): T | null {
    const found = characters.find((character) => this.text[this.cursor] === character);
    if (found === undefined) return null;
    this.cursor += 1;
    return found;
  }

  private skipSpace(): void {
    SPACE.lastIndex = this.cursor;
    SPACE.exec(this.text);
    this.cursor = SPACE.lastIndex;
  }
}

/** Evaluate a dice-count group only when it contains arithmetic constants, never dice. */
function constantValue(node: DraftNode): number | null {
  if (node.kind === 'term') return node.term.kind === 'constant' ? node.term.value : null;
  if (node.kind === 'negate') {
    const value = constantValue(node.operand);
    return value === null ? null : -value;
  }
  const left = constantValue(node.left);
  const right = constantValue(node.right);
  if (left === null || right === null) return null;
  let value: number;
  switch (node.operator) {
    case '+': value = left + right; break;
    case '-': value = left - right; break;
    case '*': value = left * right; break;
    case '/':
      if (right === 0) return null;
      value = left / right;
      break;
  }
  return Number.isFinite(value) ? value : null;
}

/**
 * Rewrites arithmetic dice-count groups to the integer count the parser rolls.
 * For example, `(10+10)d6kh10` becomes `20d6kh10`. Only groups immediately
 * followed by a dice marker are changed; ordinary grouping parentheses remain
 * untouched. The input should already have passed `parseFormula` validation.
 */
export function normalizeDiceCountExpressions(formula: string): string {
  let result = '';
  let cursor = 0;

  while (cursor < formula.length) {
    const character = formula[cursor]!;

    // Dice labels are opaque text; parentheses inside `[label]` are not syntax.
    if (character === '[') {
      const close = formula.indexOf(']', cursor);
      const end = close < 0 ? formula.length : close + 1;
      result += formula.slice(cursor, end);
      cursor = end;
      continue;
    }

    if (character !== '(') {
      result += character;
      cursor += 1;
      continue;
    }

    let nesting = 0;
    let inLabel = false;
    let close = -1;
    for (let index = cursor; index < formula.length; index += 1) {
      const current = formula[index]!;
      if (current === '[') inLabel = true;
      else if (current === ']') inLabel = false;
      else if (!inLabel && current === '(') nesting += 1;
      else if (!inLabel && current === ')') {
        nesting -= 1;
        if (nesting === 0) {
          close = index;
          break;
        }
      }
    }

    if (close < 0) {
      result += character;
      cursor += 1;
      continue;
    }

    let diceStart = close + 1;
    while (formula[diceStart] === ' ' || formula[diceStart] === '\t') diceStart += 1;
    const diceMarker = formula[diceStart]?.toLowerCase();
    const nextCharacter = formula[diceStart + 1] ?? '';
    const isDiceBoundary = diceMarker === 'd'
      && (/\d/.test(nextCharacter) || nextCharacter === '%' || nextCharacter.toLowerCase() === 'f');

    if (!isDiceBoundary) {
      result += character;
      cursor += 1;
      continue;
    }

    try {
      const countDraft = new FormulaReader(formula.slice(cursor + 1, close)).read();
      const count = constantValue(countDraft);
      if (count !== null && Number.isSafeInteger(count) && count >= 0 && count <= 999) {
        result += String(count);
        cursor = close + 1;
        continue;
      }
    } catch {
      // Leave malformed or non-constant groups unchanged; validation rejects them separately.
    }

    result += character;
    cursor += 1;
  }

  return result;
}

/** The final tree: every term learns whether an odd number of minus signs leads to it. */
function signed(node: DraftNode, negative: boolean, terms: FormulaTerm[]): FormulaNode {
  switch (node.kind) {
    case 'term': {
      const term = { ...node.term, negative } as FormulaTerm;
      terms.push(term);
      return { kind: 'term', term };
    }
    case 'negate':
      return { kind: 'negate', operand: signed(node.operand, !negative, terms) };
    case 'operation': {
      const left = signed(node.left, negative, terms);
      const right = signed(node.right, node.operator === '-' ? !negative : negative, terms);
      return { kind: 'operation', operator: node.operator, left, right };
    }
  }
}

function isLinear(node: FormulaNode): boolean {
  switch (node.kind) {
    case 'term': return node.term.kind === 'constant' || node.term.tally === undefined;
    case 'negate': return isLinear(node.operand);
    case 'operation': return node.operator !== '*' && node.operator !== '/' && isLinear(node.left) && isLinear(node.right);
  }
}

/**
 * Validates the whole expression before the caller can consume any randomness. A formula is at most
 * `characters` long: one written (`FORMULA_LIMITS.characters`) unless a bonus completed with the
 * set's dice is read (`completeFormula`).
 */
export function parseFormula(formula: string, characters: number = FORMULA_LIMITS.characters): ParsedFormula | FormulaError {
  if (formula.length > characters) return { ok: false, code: 'length' };
  let draft: DraftNode;
  try {
    draft = new FormulaReader(formula).read();
  } catch (error) {
    if (error instanceof FormulaSyntaxError) return { ok: false, code: error.code };
    throw error;
  }
  const terms: FormulaTerm[] = [];
  const expression = signed(draft, false, terms);
  const problem = checkFormula(expression, terms);
  if (problem) return { ok: false, code: problem };
  return { ok: true, terms, expression, linear: isLinear(expression) };
}
