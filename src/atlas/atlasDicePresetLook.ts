import { parseFormula } from '../statblocks/atlasDiceEngine/parseFormula.ts';
import { writtenAdvantage } from '../statblocks/atlasDiceEngine/writtenAdvantage.ts';
import type { ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';

const MAX_LOOK_GROUPS = 6;
const MAX_LOOK_DICE = 20;
const MAX_LOOK_SIDES = 999;
const MAX_LOOK_BONUS = 99;

export interface AtlasDicePresetLook {
  dice: ForgeRestDiceSet['dice'];
  crit: ForgeRestDiceSet['crit'];
  explode?: ForgeRestDiceSet['explode'];
  advantage?: ForgeRestDiceSet['advantage'];
  disadvantage?: ForgeRestDiceSet['disadvantage'];
}

export interface AtlasDicePresetLookCandidate {
  /** The formula stored beside a look: only its signed numeric bonus, or empty. */
  readonly formula: string;
  readonly look: AtlasDicePresetLook;
  readonly source: 'active-dice-set' | 'formula';
  readonly setName?: string;
}

function bonusText(value: number): string {
  if (value === 0) return '';
  return value > 0 ? `+${value}` : String(value);
}

function copySetLook(set: ForgeRestDiceSet): AtlasDicePresetLook {
  return {
    dice: set.dice.map((die) => ({ ...die })),
    crit: set.crit,
    ...(set.explode ? { explode: { ...set.explode } } : {}),
    ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
    ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
  };
}

/**
 * Turns a simple additive statblock formula into Atlas' Dice Lab preset shape.
 * If its dice are the active Set's dice, their names, colours and rules are
 * copied. Otherwise the written dice become a fresh, natural-critical look
 * that can be further dressed in Atlas' native saved-roll editor.
 *
 * Atlas 0.18.0's preset contract only accepts an empty or signed-number formula
 * beside `look`; written `adv`/`dis` therefore remains a plain formula preset.
 */
export function createAtlasDicePresetLookCandidate(
  formula: string,
  activeSet?: ForgeRestDiceSet | null,
): AtlasDicePresetLookCandidate | null {
  const cleanFormula = formula.trim();
  if (!cleanFormula || cleanFormula.length > 100 || writtenAdvantage(cleanFormula).side) return null;

  const parsed = parseFormula(cleanFormula.replaceAll('−', '-'));
  if (!parsed.ok || !parsed.linear) return null;

  const dice: Array<{ count: number; sides: number; name?: string }> = [];
  let bonus = 0;
  let totalDice = 0;
  for (const term of parsed.terms) {
    if (term.kind === 'constant') {
      if (term.label) return null;
      bonus += term.negative ? -term.value : term.value;
      continue;
    }
    if (term.negative || term.fate || term.keep || term.reroll || term.explode || term.tally
      || term.advantage || term.sharedUnits || !Number.isInteger(term.count) || term.count < 1
      || term.count > MAX_LOOK_DICE || !Number.isInteger(term.faces) || term.faces < 2 || term.faces > MAX_LOOK_SIDES) return null;
    const name = term.label?.trim();
    if (name && name.length > 40) return null;
    dice.push({ count: term.count, sides: term.faces, ...(name ? { name } : {}) });
    totalDice += term.count;
  }

  if (Math.abs(bonus) > MAX_LOOK_BONUS || totalDice > MAX_LOOK_DICE || dice.length > MAX_LOOK_GROUPS) return null;

  if (dice.length === 0) {
    if (!activeSet) return null;
    return {
      formula: bonusText(bonus),
      look: copySetLook(activeSet),
      source: 'active-dice-set',
      setName: activeSet.name,
    };
  }

  const matchesSet = !!activeSet
    && dice.length === activeSet.dice.length
    && dice.every((die, index) => {
      const setDie = activeSet.dice[index];
      return !!setDie && die.count === setDie.count && die.sides === setDie.sides
        && (!die.name || die.name === setDie.name);
    });

  if (activeSet && matchesSet) {
    return {
      formula: bonusText(bonus),
      look: copySetLook(activeSet),
      source: 'active-dice-set',
      setName: activeSet.name,
    };
  }

  return {
    formula: bonusText(bonus),
    look: { dice: dice.map((die) => ({ ...die })), crit: 'natural' },
    source: 'formula',
  };
}
