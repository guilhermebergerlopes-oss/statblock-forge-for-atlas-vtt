/** Advantage/disadvantage written as a final `adv` or `dis` word in a dice formula. */
export type WrittenAdvantageSide = 'advantage' | 'disadvantage';

const SIDE_WORDS: Readonly<Record<string, WrittenAdvantageSide>> = {
  adv: 'advantage',
  dis: 'disadvantage',
};

const WRITTEN_SIDE = /(?:^|[ \t]+)(adv|dis)[ \t]*$/i;

export interface WrittenAdvantage {
  /** Formula without the trailing side word. */
  readonly formula: string;
  /** Side requested by the written word, or null when absent. */
  readonly side: WrittenAdvantageSide | null;
  /** Original side word, preserving its case; empty when absent. */
  readonly word: string;
}

/** Splits a final, space-separated `adv` or `dis` word from a formula. */
export function writtenAdvantage(formula: string): WrittenAdvantage {
  const match = WRITTEN_SIDE.exec(formula);
  if (!match) return { formula, side: null, word: '' };
  const word = match[1]!;
  return {
    formula: formula.slice(0, match.index),
    side: SIDE_WORDS[word.toLowerCase()] ?? null,
    word,
  };
}

/** Combines a written side with a side explicitly requested by a click or menu. Opposites cancel. */
export function combineWrittenAdvantage(
  written: WrittenAdvantageSide | null,
  requested: WrittenAdvantageSide | null | undefined,
): WrittenAdvantageSide | null {
  if (!written) return requested ?? null;
  if (!requested) return written;
  return written === requested ? written : null;
}

/** Adds a canonical side word to a formula, after removing any previous side word. */
export function withWrittenAdvantage(
  formula: string,
  side: WrittenAdvantageSide | null,
): string {
  const body = writtenAdvantage(formula).formula.trimEnd();
  if (!side) return body;
  return `${body} ${side === 'advantage' ? 'adv' : 'dis'}`;
}
