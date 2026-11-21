import { rollPieces } from './atlasDiceEngine/textRolls.ts';
import { rollableBonusFormula } from './statblockValueRolls.ts';

/**
 * Returns every formula that should be clickable in one Table cell.
 * Explicit dice notation is always rollable; whole-number bonuses use the
 * Table's explicit `Roll as a bonus` setting, matching other statblock blocks.
 */
export function tableCellRollFormulas(text: string, rollable: boolean): string[] {
  const value = text.trim();
  if (!value) return [];
  const bonus = rollableBonusFormula(value, rollable);
  if (bonus) return [bonus];
  const formulas = new Set<string>();
  for (const piece of rollPieces(value)) {
    if (piece.formula) formulas.add(piece.formula);
  }
  return [...formulas];
}
