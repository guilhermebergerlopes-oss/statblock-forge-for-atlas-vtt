/**
 * Atlas-compatible whole-number bonus conversion used by `rollable` statblock
 * Values. Ordinary numbers are deliberately not rolls unless their block opts in.
 */
const WHOLE_NUMBER = /^([+\-−–]?)(\d{1,4})$/;

export function bonusFormulaForValue(text: string): string | null {
  const match = WHOLE_NUMBER.exec(text.trim());
  if (!match) return null;
  const value = Number(match[2]);
  return match[1] !== '' && match[1] !== '+' && value !== 0 ? `-${value}` : `+${value}`;
}

/** Mirrors Atlas' BonusLink: only a whole number with no explicit roll is completed as a bonus. */
export function rollableBonusFormula(text: string, rollable: boolean | undefined): string | null {
  if (rollable !== true) return null;
  // Signed whole numbers are bonuses, not already-linked dice notation. The
  // text-roll parser also recognizes `-2` and `+2` as roll pieces, so checking
  // it first incorrectly filtered them out before renderer-owned value nodes
  // could receive their direct link semantics.
  return bonusFormulaForValue(text);
}
