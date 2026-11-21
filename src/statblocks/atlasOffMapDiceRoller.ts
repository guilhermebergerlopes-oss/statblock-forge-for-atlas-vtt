/**
 * Forge-owned, scene-independent dice roller. Formula parsing and rolling are
 * adapted from Atlas VTT Beta's dice engine (AGPL-3.0); the implementation
 * follows Atlas 0.17.0's completeFormula, advantage and critical-result rules.
 */
import type { ForgeRestAdvantageRule, ForgeRestDiceSet } from './restDiceRoller.ts';
import { parseFormula, FORMULA_LIMITS, type FormulaErrorCode, type FormulaNode, type FormulaTerm, type ParsedFormula, type DiceTerm } from './atlasDiceEngine/parseFormula.ts';
import { checkFormula } from './atlasDiceEngine/formulaChecks.ts';
import { rollFormula, type DieLook, type NamedModifier, type RolledDie } from './atlasDiceEngine/diceFormula.ts';
import { MAX_EXPLOSIONS } from './atlasDiceEngine/diceExplosion.ts';
import { combineWrittenAdvantage, writtenAdvantage } from './atlasDiceEngine/writtenAdvantage.ts';

export type ForgeOffMapCrit = 'high' | 'low' | null;

export interface ForgeOffMapRollSource {
  readonly type: 'statblock';
  readonly statblockPath: string;
  readonly tokenId?: string;
  readonly tokenName?: string;
  readonly tokenImagePath?: string;
  readonly abilityName?: string;
}

export interface ForgeOffMapDiceRollResult {
  readonly id: string;
  readonly timestamp: number;
  readonly formula: string;
  readonly rolls: readonly RolledDie[];
  readonly modifiers: number;
  readonly namedModifiers?: readonly NamedModifier[];
  readonly total: number;
  readonly linear?: false;
  readonly crit: ForgeOffMapCrit;
  readonly diceSet: { readonly id: string; readonly name: string };
  readonly advantage?: 'advantage' | 'disadvantage';
  readonly player: string;
  readonly source: ForgeOffMapRollSource;
}

export type ForgeOffMapRollErrorCode = FormulaErrorCode | 'advantage' | 'random-unavailable' | 'invalid-rules';
export type ForgeOffMapRollAttempt =
  | { readonly ok: true; readonly result: ForgeOffMapDiceRollResult }
  | { readonly ok: false; readonly error: ForgeOffMapRollErrorCode };

interface RollingRules {
  readonly dice: readonly { readonly count: number; readonly sides: number; readonly name?: string; readonly colour?: string }[];
  readonly crit: ForgeRestDiceSet['crit'];
  readonly explode?: ForgeRestDiceSet['explode'];
  readonly advantage?: ForgeRestAdvantageRule;
  readonly disadvantage?: ForgeRestAdvantageRule;
}

interface PreparedFormula {
  readonly formula: string;
  readonly parsed: ParsedFormula;
  readonly written: boolean;
}

interface OffMapFormulaError {
  readonly ok: false;
  readonly code: ForgeOffMapRollErrorCode;
}

interface PreparedAdvantage {
  readonly ok: true;
  readonly parsed: ParsedFormula;
  readonly looks: readonly (DieLook | undefined)[];
  readonly explosionRules: RollingRules;
  readonly applied: boolean;
}

function isOffMapError(value: { readonly ok: boolean; readonly code?: ForgeOffMapRollErrorCode }): value is OffMapFormulaError {
  return value.ok === false;
}
const isSetTerm = (term: FormulaTerm): term is DiceTerm =>
  term.kind === 'dice' && !term.negative && !term.fate && !term.keep && !term.tally && !term.advantage;

function defaultRollOf(rules: RollingRules): string {
  return rules.dice.map((group) => `${group.count}d${group.sides}`).join('+');
}

function withDefaultRoll(modifier: string, defaultRoll: string): string {
  const bonus = modifier.replace(/\s+(?![^[]*\])/g, '');
  return bonus === '' || /^[+-]/.test(bonus) ? `${defaultRoll}${bonus}` : `${defaultRoll}+${bonus}`;
}

function completeFormula(formula: string, rules: RollingRules): PreparedFormula | OffMapFormulaError {
  const defaultRoll = defaultRollOf(rules);
  if (!defaultRoll) return { ok: false, code: 'invalid-rules' };
  const input = parseFormula(formula === '' ? defaultRoll : formula);
  if (isOffMapError(input)) return input;
  const written = input.terms.some((term) => term.kind === 'dice') && formula !== '';
  const completed = written ? formula : withDefaultRoll(formula, defaultRoll);
  const parsed = parseFormula(completed, written ? FORMULA_LIMITS.characters : FORMULA_LIMITS.completed);
  return isOffMapError(parsed) ? parsed : { formula: completed, parsed, written };
}

function setDiceTerm(terms: readonly FormulaTerm[], rules: RollingRules): number | null {
  const available = new Map<number, number>();
  for (const term of terms) {
    if (isSetTerm(term)) available.set(term.faces, (available.get(term.faces) ?? 0) + term.count);
  }
  for (const group of rules.dice) {
    const held = available.get(group.sides) ?? 0;
    if (held < group.count) return null;
    available.set(group.sides, held - group.count);
  }
  const first = rules.dice[0];
  const index = terms.findIndex((term) => isSetTerm(term) && term.faces === first?.sides);
  return index < 0 ? null : index;
}

function keepsHighest(side: 'advantage' | 'disadvantage', rules: RollingRules): boolean {
  return (side === 'advantage') !== (rules.crit === 'roll-under');
}

function replaceTerm(node: FormulaNode, from: FormulaTerm, to: FormulaTerm): FormulaNode {
  switch (node.kind) {
    case 'term': return node.term === from ? { kind: 'term', term: to } : node;
    case 'negate': return { kind: 'negate', operand: replaceTerm(node.operand, from, to) };
    case 'operation': return { ...node, left: replaceTerm(node.left, from, to), right: replaceTerm(node.right, from, to) };
  }
}

function advantageAddedTerm(rule: Exclude<ForgeRestAdvantageRule, { kind: 'keep' }>, side: 'advantage' | 'disadvantage'): FormulaTerm {
  if (rule.kind === 'die') {
    return {
      kind: 'dice', count: 1, faces: rule.sides,
      negative: side === 'disadvantage', advantage: true,
    };
  }
  return {
    kind: 'constant', value: Math.abs(rule.value),
    negative: (side === 'disadvantage') !== (rule.value < 0),
  };
}

function withAdvantage(
  parsed: ParsedFormula,
  looks: readonly (DieLook | undefined)[],
  rules: RollingRules,
  side: 'advantage' | 'disadvantage',
): PreparedAdvantage | OffMapFormulaError {
  const rule = rules[side];
  const index = rule ? setDiceTerm(parsed.terms, rules) : null;
  if (!rule || index === null) return { ok: true, parsed, looks, explosionRules: rules, applied: false };

  const terms = [...parsed.terms];
  const diceCount = terms.filter((term) => term.kind === 'dice').length;
  const shownLooks = Array.from({ length: diceCount }, (_, i) => looks[i]);
  let expression = parsed.expression;
  let explosionRules = rules;
  if (rule.kind === 'keep') {
    const original = terms[index] as DiceTerm;
    const shares = rule.tensOnly === true && original.faces === 100 && original.count === 1;
    const kept: DiceTerm = {
      ...original,
      count: original.count + 1,
      keep: { mode: 'keep', end: keepsHighest(side, rules) ? 'highest' : 'lowest', count: original.count, chains: true },
      ...(shares ? { sharedUnits: true } : {}),
    };
    terms[index] = kept;
    expression = replaceTerm(expression, original, kept);
    const [first, ...rest] = rules.dice;
    if (first) explosionRules = { ...rules, dice: [{ ...first, count: first.count + 1 }, ...rest] };
  } else {
    const added = advantageAddedTerm(rule, side);
    terms.push(added);
    expression = {
      kind: 'operation', operator: added.negative ? '-' : '+', left: expression,
      right: { kind: 'term', term: added },
    };
    if (rule.kind === 'die') shownLooks.push({ ...(rule.name ? { name: rule.name } : {}), ...(rule.colour ? { colour: rule.colour } : {}) });
  }
  const problem = checkFormula(expression, terms);
  if (problem) return { ok: false, code: problem };
  return {
    ok: true,
    parsed: { ok: true, terms, expression, linear: parsed.linear },
    looks: shownLooks,
    explosionRules,
    applied: true,
  };
}

function defaultDiceOf(rolls: readonly RolledDie[], rules: RollingRules): RolledDie[] | null {
  const taken = new Set<number>();
  const found: RolledDie[] = [];
  for (const group of rules.dice) {
    for (let count = 0; count < group.count; count++) {
      const index = rolls.findIndex((die, i) => !taken.has(i) && !die.negative && !die.exploded
        && !die.rerolled && !die.dropped && !die.advantage && die.max === group.sides);
      if (index < 0) return null;
      taken.add(index);
      found.push(rolls[index]!);
    }
  }
  return found;
}

function critOf(rolls: readonly RolledDie[], rules: RollingRules): ForgeOffMapCrit {
  if (rules.crit === 'none') return null;
  const dice = defaultDiceOf(rolls, rules);
  if (!dice?.length || !rolls.every((die) => dice.includes(die) || die.exploded || die.rerolled || die.dropped || die.advantage)) return null;
  const extreme = (best: (die: RolledDie) => boolean, worst: (die: RolledDie) => boolean): ForgeOffMapCrit => {
    if (dice.some(best)) return 'high';
    return dice.some(worst) ? 'low' : null;
  };
  switch (rules.crit) {
    case 'natural': return extreme((die) => die.value === die.max, (die) => die.value === 1);
    case 'roll-under': return extreme((die) => die.value === 1, (die) => die.value === die.max);
    case 'doubles': return dice.length >= 2 && dice.every((die) => die.value === dice[0]!.value) ? 'high' : null;
    case 'high-total': {
      const total = dice.reduce((sum, die) => sum + die.value, 0);
      const highest = dice.reduce((sum, die) => sum + die.max, 0);
      return total >= highest - 1 ? 'high' : null;
    }
  }
}

function secureRandom(): number {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('random-unavailable');
  return cryptoApi.getRandomValues(new Uint32Array(1))[0]! / 0x1_0000_0000;
}

function newId(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('random-unavailable');
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function sourceCopy(source: ForgeOffMapRollSource): ForgeOffMapRollSource {
  return {
    type: 'statblock', statblockPath: source.statblockPath,
    ...(source.tokenId ? { tokenId: source.tokenId } : {}),
    ...(source.tokenName ? { tokenName: source.tokenName } : {}),
    ...(source.tokenImagePath ? { tokenImagePath: source.tokenImagePath } : {}),
    ...(source.abilityName ? { abilityName: source.abilityName } : {}),
  };
}

/** Rolls a statblock outside an Atlas map with the same collection and Dice Set semantics. */
export function rollForgeOffMapDiceFormula(
  formula: string,
  set: ForgeRestDiceSet,
  source: ForgeOffMapRollSource,
  advantage?: 'advantage' | 'disadvantage' | null,
  random: () => number = secureRandom,
  timestamp = Date.now(),
  idFactory: () => string = newId,
): ForgeOffMapRollAttempt {
  if (!set.dice.length || set.dice.some((die) => !Number.isInteger(die.count) || die.count < 1 || !Number.isInteger(die.sides) || die.sides < 2)) {
    return { ok: false, error: 'invalid-rules' };
  }
  const rules: RollingRules = {
    dice: set.dice.map((die) => ({ ...die })), crit: set.crit,
    ...(set.explode ? { explode: { ...set.explode } } : {}),
    ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
    ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
  };
  const written = writtenAdvantage(formula.trim());
  const effectiveAdvantage = combineWrittenAdvantage(written.side, advantage);
  const completed = completeFormula(written.formula.trim(), rules);
  if ('ok' in completed && completed.ok === false) return { ok: false, error: completed.code };
  const complete = completed as PreparedFormula;
  const looks = complete.written ? [] : rules.dice.map((die) => ({
    ...(die.name ? { name: die.name } : {}), ...(die.colour ? { colour: die.colour } : {}),
  }));
  const helped = effectiveAdvantage ? withAdvantage(complete.parsed, looks, rules, effectiveAdvantage) : {
    ok: true as const, parsed: complete.parsed, looks, explosionRules: rules, applied: false,
  };
  if (!helped.ok) return { ok: false, error: helped.code };
  // Atlas refuses a written side when the active set cannot apply it to this roll.
  if (written.side && effectiveAdvantage === written.side && !helped.applied) {
    return { ok: false, error: 'advantage' };
  }
  try {
    const rolled = rollFormula(helped.parsed, random, helped.explosionRules, helped.looks);
    if (!Number.isFinite(rolled.total)) return { ok: false, error: 'total' };
    return {
      ok: true,
      result: {
        id: idFactory(), timestamp, formula: complete.formula,
        rolls: rolled.rolls,
        modifiers: rolled.modifiers,
        ...(rolled.named.length ? { namedModifiers: rolled.named } : {}),
        total: Math.trunc(rolled.total),
        ...(!rolled.linear ? { linear: false as const } : {}),
        crit: critOf(rolled.rolls, rules),
        diceSet: { id: set.id, name: set.name },
        ...(helped.applied && effectiveAdvantage ? { advantage: effectiveAdvantage } : {}),
        player: 'Statblock Forge',
        source: sourceCopy(source),
      },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'random-unavailable') return { ok: false, error: 'random-unavailable' };
    return { ok: false, error: 'syntax' };
  }
}

/** Default formula for queued modifiers and context-menu preparation. */
export function forgeOffMapDefaultFormula(set: ForgeRestDiceSet): string {
  return defaultRollOf({ dice: set.dice, crit: set.crit, ...(set.explode ? { explode: set.explode } : {}) });
}
