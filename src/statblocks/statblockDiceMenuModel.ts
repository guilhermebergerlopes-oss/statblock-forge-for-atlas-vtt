import { parseFormula } from './atlasDiceEngine/parseFormula.ts';
import type { FormulaTerm } from './atlasDiceEngine/formulaTypes.ts';
import { writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';

export type ForgeAdvantageSide = 'advantage' | 'disadvantage';

export interface ForgeStatblockRollingRules {
  readonly dice: readonly { readonly count: number; readonly sides: number }[];
  readonly advantage?: unknown;
  readonly disadvantage?: unknown;
}

/**
 * Mirrors Atlas' advantageSidesFor rule for the statblock context menu.
 * A side is offered only when the roll contains the dice belonging to the
 * active set, and only when that set defines a rule for the side.
 */
export function forgeStatblockAdvantageSides(
  formula: string,
  rules: ForgeStatblockRollingRules,
): ForgeAdvantageSide[] {
  const parsed = parseFormula(writtenAdvantage(formula.trim()).formula.trim());
  if (!parsed.ok || rules.dice.length === 0) return [];

  // A bare bonus (for example +4) is completed with the active set's dice,
  // just as Atlas' DiceTool.completeFormula does before checking advantage.
  const terms: readonly FormulaTerm[] = parsed.terms.some((term) => term.kind === 'dice')
    ? parsed.terms
    : [
        ...rules.dice.map((die): FormulaTerm => ({
          kind: 'dice', count: die.count, faces: die.sides, negative: false,
        })),
        ...parsed.terms,
      ];

  const available = new Map<number, number>();
  for (const term of terms) {
    if (term.kind !== 'dice' || term.negative || term.fate || term.keep || term.tally || term.advantage) continue;
    available.set(term.faces, (available.get(term.faces) ?? 0) + term.count);
  }

  for (const die of rules.dice) {
    const count = available.get(die.sides) ?? 0;
    if (count < die.count) return [];
    available.set(die.sides, count - die.count);
  }

  const sides: ForgeAdvantageSide[] = [];
  if (rules.advantage != null) sides.push('advantage');
  if (rules.disadvantage != null) sides.push('disadvantage');
  return sides;
}
