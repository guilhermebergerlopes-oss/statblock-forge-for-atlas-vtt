import type { App } from 'obsidian';
import type { ForgeTemplate, JsonRecord } from '../templates/forgeTemplate.ts';
import { parseFormula } from './atlasDiceEngine/parseFormula.ts';
import { rollFormula } from './atlasDiceEngine/diceFormula.ts';
import type { ExplodeRule } from './atlasDiceEngine/diceRulesTypes.ts';

export interface ForgeRestDiceGroup {
  count: number;
  sides: number;
  name?: string;
  colour?: string;
}

export type ForgeRestAdvantageRule =
  | { kind: 'keep'; tensOnly?: true }
  | { kind: 'number'; value: number }
  | { kind: 'die'; sides: number; name?: string; colour?: string };

export interface ForgeRestDiceSet {
  id: string;
  name: string;
  builtIn: boolean;
  dice: ForgeRestDiceGroup[];
  crit: 'natural' | 'roll-under' | 'doubles' | 'high-total' | 'none';
  explode?: ExplodeRule;
  advantage?: ForgeRestAdvantageRule;
  disadvantage?: ForgeRestAdvantageRule;
}

export interface ForgeRestDiceRoll {
  formula: string;
  total: number;
}

const KEEP_BEST: Pick<ForgeRestDiceSet, 'advantage' | 'disadvantage'> = {
  advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};
const EDGE: ForgeRestAdvantageRule = { kind: 'number', value: 2 };
const BUILT_IN_REST_DICE_SETS: readonly ForgeRestDiceSet[] = [
  { id: 'builtin:d20', name: 'd20', builtIn: true, dice: [{ count: 1, sides: 20 }], crit: 'natural', ...KEEP_BEST },
  { id: 'builtin:d20-roll-under', name: 'd20 roll-under', builtIn: true, dice: [{ count: 1, sides: 20 }], crit: 'roll-under', ...KEEP_BEST },
  { id: 'builtin:d100-roll-under', name: 'd100 roll-under', builtIn: true, dice: [{ count: 1, sides: 100 }], crit: 'roll-under', ...KEEP_BEST },
  {
    id: 'builtin:d10-exploding', name: 'd10 exploding', builtIn: true, dice: [{ count: 1, sides: 10 }], crit: 'natural',
    explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 1 },
  },
  { id: 'builtin:power-roll', name: 'Power roll', builtIn: true, dice: [{ count: 2, sides: 10 }], crit: 'high-total', advantage: EDGE, disadvantage: EDGE },
];

const DEFAULT_REST_DICE_SET = BUILT_IN_REST_DICE_SETS[0]!;

/** Returns a copy of a built-in Atlas-compatible Dice Set by its stable id. */
export function forgeRestDiceSetById(id: string): ForgeRestDiceSet | null {
  const set = BUILT_IN_REST_DICE_SETS.find((candidate) => candidate.id === id);
  return set ? {
    ...set,
    dice: set.dice.map((die) => ({ ...die })),
    ...(set.explode ? { explode: { ...set.explode } } : {}),
    ...(set.advantage ? { advantage: { ...set.advantage } } : {}),
    ...(set.disadvantage ? { disadvantage: { ...set.disadvantage } } : {}),
  } : null;
}

/** Immutable copies of the built-in sets, for Atlas collection/preset resolution. */
export function forgeRestBuiltInDiceSets(): ForgeRestDiceSet[] {
  return BUILT_IN_REST_DICE_SETS.map((set) => forgeRestDiceSetById(set.id)!).filter(Boolean);
}
const VALID_CRITS = new Set(['natural', 'roll-under', 'doubles', 'high-total', 'none']);

function parseAdvantageRule(value: unknown): ForgeRestAdvantageRule | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'keep') return { kind: 'keep', ...(value.tensOnly === true ? { tensOnly: true as const } : {}) };
  if (value.kind === 'number' && Number.isInteger(value.value) && Number(value.value) >= 1 && Number(value.value) <= 99) {
    return { kind: 'number', value: Number(value.value) };
  }
  if (value.kind === 'die' && Number.isInteger(value.sides) && Number(value.sides) >= 2 && Number(value.sides) <= 999) {
    const result: Extract<ForgeRestAdvantageRule, { kind: 'die' }> = { kind: 'die', sides: Number(value.sides) };
    if (typeof value.name === 'string' && value.name.trim().length > 0 && value.name.trim().length <= 40) result.name = value.name.trim();
    if (typeof value.colour === 'string' && /^#[0-9a-f]{6}$/i.test(value.colour)) result.colour = value.colour.toLowerCase();
    return result;
  }
  return undefined;
}

/** Validates the same public fields Atlas reads from a vault Dice Set record. */
export function parseForgeRestDiceSet(raw: unknown): ForgeRestDiceSet | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim() || raw.id.startsWith('builtin:')
    || typeof raw.name !== 'string' || !raw.name.trim() || raw.name.length > 40
    || !Array.isArray(raw.dice) || raw.dice.length < 1 || raw.dice.length > 6
    || !VALID_CRITS.has(String(raw.crit))) return null;

  const dice: ForgeRestDiceGroup[] = [];
  for (const rawDie of raw.dice) {
    if (!isRecord(rawDie) || !Number.isInteger(rawDie.count) || Number(rawDie.count) < 1 || Number(rawDie.count) > 20
      || !Number.isInteger(rawDie.sides) || Number(rawDie.sides) < 2 || Number(rawDie.sides) > 999) return null;
    const group: ForgeRestDiceGroup = { count: Number(rawDie.count), sides: Number(rawDie.sides) };
    if (typeof rawDie.name === 'string' && rawDie.name.trim().length > 0 && rawDie.name.trim().length <= 40) group.name = rawDie.name.trim();
    if (typeof rawDie.colour === 'string' && /^#[0-9a-f]{6}$/i.test(rawDie.colour)) group.colour = rawDie.colour.toLowerCase();
    dice.push(group);
  }
  if (dice.reduce((sum, die) => sum + die.count, 0) > 20) return null;

  let explode: ExplodeRule | undefined;
  if (raw.explode !== undefined) {
    if (!isRecord(raw.explode) || !['default', 'all'].includes(String(raw.explode.dice))
      || typeof raw.explode.repeats !== 'boolean'
      || !Number.isInteger(raw.explode.highFaces) || Number(raw.explode.highFaces) < 1 || Number(raw.explode.highFaces) > 99
      || !Number.isInteger(raw.explode.lowFaces) || Number(raw.explode.lowFaces) < 0 || Number(raw.explode.lowFaces) > 99) return null;
    explode = {
      dice: raw.explode.dice as 'default' | 'all',
      repeats: raw.explode.repeats,
      highFaces: Number(raw.explode.highFaces),
      lowFaces: Number(raw.explode.lowFaces),
    };
  }

  const advantage = parseAdvantageRule(raw.advantage);
  const disadvantage = parseAdvantageRule(raw.disadvantage);
  return {
    id: raw.id,
    name: raw.name.trim(),
    builtIn: false,
    dice,
    crit: raw.crit as ForgeRestDiceSet['crit'],
    ...(explode ? { explode } : {}),
    ...(advantage ? { advantage } : {}),
    ...(disadvantage ? { disadvantage } : {}),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Resolves a template's explicit set, then Atlas's built-in d20 fallback for a Forge-only sheet. */
export function resolveForgeRestDiceSet(templateSetId: unknown, customSets: readonly ForgeRestDiceSet[]): ForgeRestDiceSet {
  if (typeof templateSetId !== 'string' || !templateSetId.trim()) return DEFAULT_REST_DICE_SET;
  return BUILT_IN_REST_DICE_SETS.find((set) => set.id === templateSetId)
    ?? customSets.find((set) => set.id === templateSetId)
    ?? DEFAULT_REST_DICE_SET;
}

/** Reads a template's named Dice Set from the same Vault folder Atlas uses. */
export async function loadForgeRestDiceSet(app: App, template: ForgeTemplate): Promise<ForgeRestDiceSet> {
  const templateSetId = template.diceSetId;
  if (typeof templateSetId !== 'string' || !templateSetId.trim()) return DEFAULT_REST_DICE_SET;
  const builtIn = BUILT_IN_REST_DICE_SETS.find((set) => set.id === templateSetId);
  if (builtIn) return builtIn;

  for (const file of app.vault.getFiles()) {
    if (!file.path.startsWith('atlas-vtt/dice-sets/') || file.extension.toLowerCase() !== 'json') continue;
    try {
      const parsed = parseForgeRestDiceSet(JSON.parse(await app.vault.cachedRead(file)) as unknown);
      if (parsed?.id === templateSetId) return parsed;
    } catch {
      // Invalid or unreadable set files do not prevent the Rest itself from opening.
    }
  }
  return DEFAULT_REST_DICE_SET;
}

function cryptographicRandom(): number {
  const cryptoApi = window.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Secure random number generation is unavailable.');
  const value = cryptoApi.getRandomValues(new Uint32Array(1))[0]!;
  return value / 0x1_0000_0000;
}

/**
 * Rolls a Rest formula with Atlas's bounded grammar and dice-set explosion rules.
 * It returns only the numeric total because Forge's current Rest step shows a preview, not a roll log.
 */
export function rollForgeRestFormula(
  formula: string,
  set: ForgeRestDiceSet,
  random: () => number = cryptographicRandom,
): ForgeRestDiceRoll | null {
  const text = formula.trim();
  if (!text) return null;
  try {
    const parsed = parseFormula(text);
    if (!parsed.ok) return null;
    const rolled = rollFormula(parsed, random, { dice: set.dice, ...(set.explode ? { explode: set.explode } : {}) });
    if (!Number.isFinite(rolled.total)) return null;
    return { formula: text, total: Math.trunc(rolled.total) };
  } catch {
    return null;
  }
}

/** For tests and diagnostics; the live resolver only returns immutable built-in records. */
export function forgeRestDefaultDiceSet(): ForgeRestDiceSet {
  return { ...DEFAULT_REST_DICE_SET, dice: DEFAULT_REST_DICE_SET.dice.map((die) => ({ ...die })) };
}
