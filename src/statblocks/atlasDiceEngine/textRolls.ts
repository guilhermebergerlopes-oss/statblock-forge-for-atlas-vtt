/**
 * Where a text holds rolls, and the formula each rolls: the one rule every surface that shows
 * statblock values and texts with roll links reads (the card, the DM screen, the note panel, and the
 * online player page, which keeps a copy of this file). Pure.
 *
 * A formula is a roll where the dice parser accepts it (`parseFormula`, within its limits) and it
 * throws dice (`2d8+2`, `d20`, `3d6kh2+1`) or opens with a sign (`+2`, `+4+1`, `-1+2`): a bonus,
 * which the dice tool adds to the game's dice. A number alone (`3`) or a sum without a sign (`4+1`)
 * is no roll.
 *
 * In running text a roll opens on a die (`2d8`, `D12`, `d%`), on a sign standing directly on its
 * first die or number (`+4`, `−1`, `+2d6`), or on an attack label before such a sign (`ATK: +4`),
 * and goes on over further dice and numbers joined by `+ - − – * / ×` (and the SRD's `+ -`), with
 * spaces or tabs around them if any. Parentheses are arithmetic grouping, so `Deals (2d6+3)*2 fire
 * damage` links the complete `(2d6+3)*2` expression. A die or number never starts or ends inside
 * a word or a number (`x2d6`, `hd6`, `5d`, `+5ft`, `+1.5`), so numbers in sentences (`3 goblins`,
 * `Recharge 5-6`, `CR 1/4`, `1 + 1`) roll nothing, and a dash with a space after it is punctuation
 * (`Very Close - 1d12+2` rolls 1d12+2). Exploding dice such as `2d6!` use the same term grammar as
 * the formula parser. What the parser refuses (`101d6`, `1d0`) rolls nothing. Where that leaves a
 * number outside every roll, the whole text is read as one formula instead, so a value such as
 * `2 + 1d6` or `(1d8+2)*2` rolls whole.
 *
 * A roll joined to a `@` reference by operators, brackets and spaces alone (`2d6 + @int`,
 * `@level d6`) is part of one that cannot be made: text is read once its references that name a
 * number are filled in, so one left names none, and the roll beside it rolls nothing. An `@` inside
 * a word (an address) is none.
 */
import { FORMULA_LIMITS, parseFormula } from './parseFormula.ts';
import { readTerm } from './formulaTerms.ts';

/** A piece of a text: words, or a roll written in it with the formula a click on it rolls. */
export interface RollPiece {
  readonly text: string;
  /** What the piece rolls; null for plain words. */
  readonly formula: string | null;
}

/** Nothing of a word or a number stands right before or after a roll. */
const OPENS = /[\p{L}\p{N}_]/u;
const ENDS = /[\p{L}\p{N}_]/u;

const REFERENCE_AFTER = /^[\s()+\-−–*/×]*(?<![\w.])@[A-Za-z_]/;
const REFERENCE_BEFORE = /(?<![\w.])@[A-Za-z_][\w.-]*[\s()+\-−–*/×]*$/;
const ATTACK_PREFIX = /(?:ATK|Attack)[ \t]*:[ \t]*(?=[+\-−–])/iy;

interface FormulaSpan {
  readonly end: number;
}

/**
 * Reads the longest formula-shaped prefix at `start`, using the same term reader,
 * precedence and parenthesis limits as the dice parser. It deliberately stops
 * before prose: whitespace is only consumed when it belongs to an arithmetic
 * operator or to a parenthesized expression.
 */
function formulaSpan(text: string, start: number): FormulaSpan | null {
  let cursor = start;

  const skipSpace = (): void => {
    while (text[cursor] === ' ' || text[cursor] === '\t') cursor += 1;
  };

  const binaryOperator = (): '+' | '-' | '*' | '/' | null => {
    const beforeSpace = cursor;
    skipSpace();
    const current = text[cursor];
    if (current === '+' || current === '-') {
      cursor += 1;
      if (current === '+') {
        const afterPlus = cursor;
        skipSpace();
        if (text[cursor] === '-') {
          cursor += 1;
          return '-';
        }
        cursor = afterPlus;
      }
      return current;
    }
    if (current === '−' || current === '–') {
      cursor += 1;
      return '-';
    }
    if (current === '*' || current === '×') {
      cursor += 1;
      return '*';
    }
    if (current === '/') {
      cursor += 1;
      return '/';
    }
    cursor = beforeSpace;
    return null;
  };

  const factor = (depth: number): boolean => {
    skipSpace();
    if (text[cursor] === '(') {
      if (depth >= FORMULA_LIMITS.depth) return false;
      cursor += 1;
      if (!expression(depth + 1)) return false;
      skipSpace();
      if (text[cursor] !== ')') return false;
      cursor += 1;
      return true;
    }

    const term = readTerm(text, cursor);
    if (!term) return false;
    cursor = term.end;
    return true;
  };

  const product = (depth: number): boolean => {
    if (!factor(depth)) return false;
    while (true) {
      const beforeOperator = cursor;
      const operator = binaryOperator();
      if (operator !== '*' && operator !== '/') {
        cursor = beforeOperator;
        return true;
      }
      if (!factor(depth)) {
        cursor = beforeOperator;
        return true;
      }
    }
  };

  const expression = (depth: number): boolean => {
    skipSpace();
    if (text[cursor] === '+' || text[cursor] === '-' || text[cursor] === '−' || text[cursor] === '–') {
      cursor += 1;
      skipSpace();
    }
    if (!product(depth)) return false;

    while (true) {
      const beforeOperator = cursor;
      const operator = binaryOperator();
      if (operator !== '+' && operator !== '-') {
        cursor = beforeOperator;
        return true;
      }
      if (!product(depth)) {
        cursor = beforeOperator;
        return true;
      }
    }
  };

  if (!expression(0)) return null;
  return cursor > start ? { end: cursor } : null;
}

/** A possible start cannot be inside a word, identifier, or decimal number. */
function canStartAt(text: string, at: number): boolean {
  if (at > 0 && OPENS.test(text[at - 1]!)) return false;
  if (at > 1 && text[at - 1] === '.' && /\d/.test(text[at - 2]!)) return false;
  const character = text[at];
  return character === '(' || character === '+' || character === '-' || character === '−' || character === '–'
    || (character !== undefined && /[\d]/.test(character))
    || (character !== undefined && /[dD]/.test(character));
}

/** A candidate must not end inside a word, identifier, or decimal number. */
function canEndAt(text: string, end: number): boolean {
  const next = text[end];
  if (next !== undefined && ENDS.test(next)) return false;
  return !(next === '.' && end + 1 < text.length && /\d/.test(text[end + 1]!));
}

/** A roll as written, spelled as the parser reads it: no label, a plain minus and times, `+ -` as `-`. */
function spelled(written: string): string {
  return written
    .trim()
    .replace(/^(?:ATK|Attack)[ \t]*:[ \t]*/i, '')
    .replace(/[−–]/g, '-')
    .replace(/×/g, '*')
    .replace(/\+[ \t]*-/g, '-');
}

/** A roll as written, as the formula the dice tool rolls: no spaces (but in a label), no label before it; a bare bonus stays bare. */
export function toRollFormula(written: string): string {
  return spelled(written).replace(/\s+(?![^[]*\])/g, '');
}

/** Whether a formula is a roll: the parser accepts it, and it throws dice or opens with a sign. */
export function isRollFormula(formula: string): boolean {
  const parsed = parseFormula(formula);
  return parsed.ok && (/^[+-]/.test(formula) || parsed.terms.some((term) => term.kind === 'dice' && term.count > 0));
}

/** The formula a text written as one roll rolls, or null where it is no roll. */
export function writtenRoll(written: string): string | null {
  return isRollFormula(spelled(written)) ? toRollFormula(written) : null;
}

/** The text in pieces as running text reads it, before a stray number sends it to be read whole. */
function scanned(text: string): RollPiece[] {
  const pieces: RollPiece[] = [];
  const words = (part: string): void => {
    if (!part) return;
    const last = pieces[pieces.length - 1];
    if (last && last.formula === null) pieces[pieces.length - 1] = { text: last.text + part, formula: null };
    else pieces.push({ text: part, formula: null });
  };

  let at = 0;
  let plainStart = 0;
  while (at < text.length) {
    let displayStart = at;
    let formulaStart = at;
    let attackLabel = false;

    // `ATK: +4` and `Attack: +4` are signed bonuses whose label stays visible.
    if ((text[at] === 'A' || text[at] === 'a') && (at === 0 || !OPENS.test(text[at - 1]!))) {
      ATTACK_PREFIX.lastIndex = at;
      const attack = ATTACK_PREFIX.exec(text);
      if (attack) {
        const candidateStart = ATTACK_PREFIX.lastIndex;
        const signTouchesTerm = text[candidateStart + 1] !== ' ' && text[candidateStart + 1] !== '\t';
        if (signTouchesTerm) {
          attackLabel = true;
          formulaStart = candidateStart;
        }
      }
    }

    // A leading sign belongs to a bonus only when it touches its first term;
    // a spaced dash in prose remains punctuation rather than a negative roll.
    const startsWithSign = text[at] === '+' || text[at] === '-' || text[at] === '−' || text[at] === '–';
    const signTouchesTerm = !startsWithSign || (text[at + 1] !== ' ' && text[at + 1] !== '\t');
    if (!attackLabel && (!canStartAt(text, at) || !signTouchesTerm)) {
      at += 1;
      continue;
    }

    const span = formulaSpan(text, formulaStart);
    if (!span || !canEndAt(text, span.end)) {
      at += 1;
      continue;
    }

    const written = text.slice(displayStart, span.end);
    const formula = writtenRoll(written);
    if (formula === null) {
      at += 1;
      continue;
    }

    const joined = REFERENCE_AFTER.test(text.slice(span.end)) || REFERENCE_BEFORE.test(text.slice(0, displayStart));
    words(text.slice(plainStart, displayStart));
    if (joined) words(written);
    else pieces.push({ text: written, formula });
    at = span.end;
    plainStart = span.end;
  }

  if (plainStart < text.length) words(text.slice(plainStart));
  return pieces;
}

/** The whole text as one roll, its spaces around it as words; null where it is no roll. */
function wholeRoll(text: string): RollPiece[] | null {
  const written = text.trim();
  const formula = written === '' ? null : writtenRoll(written);
  if (formula === null) return null;
  const at = text.indexOf(written);
  const pieces: RollPiece[] = [
    { text: text.slice(0, at), formula: null },
    { text: written, formula },
    { text: text.slice(at + written.length), formula: null },
  ];
  return pieces.filter((piece) => piece.text !== '');
}

/** A text in pieces: its words, and every roll written in it on its own. */
export function rollPieces(text: string): RollPiece[] {
  const pieces = scanned(text);
  const strayNumber = pieces.some((piece) => piece.formula === null && /\d/.test(piece.text));
  return strayNumber ? wholeRoll(text) ?? pieces : pieces;
}
