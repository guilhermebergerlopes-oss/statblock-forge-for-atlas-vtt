export interface DiceSetOption {
  id: string | null;
  name: string;
  details: string;
  path?: string;
  builtIn?: boolean;
}

export const COLLECTION_DICE_OPTION: DiceSetOption = {
  id: null,
  name: 'Collection default',
  details: 'Use the dice configured by the collection.',
};

export const BUILT_IN_DICE_OPTIONS: readonly DiceSetOption[] = [
  { id: 'builtin:d20', name: 'd20', details: '1d20 · natural criticals', builtIn: true },
  { id: 'builtin:d20-roll-under', name: 'd20 roll-under', details: '1d20 · roll-under criticals', builtIn: true },
  { id: 'builtin:d100-roll-under', name: 'd100 roll-under', details: '1d100 · roll-under criticals', builtIn: true },
  { id: 'builtin:d10-exploding', name: 'd10 exploding', details: '1d10 · exploding die', builtIn: true },
  { id: 'builtin:power-roll', name: 'Power roll', details: '2d10 · edge and bane', builtIn: true },
];

/** Reads the stable public fields used to select a Vault dice-set record. */
export function readDiceSetOption(raw: unknown, path?: string): DiceSetOption | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.id !== 'string' || !record.id.trim() || record.id.startsWith('builtin:')) return null;
  if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > 40
    || !Array.isArray(record.dice) || record.dice.length === 0) return null;
  const dice = record.dice.filter((die) => typeof die === 'object' && die !== null && !Array.isArray(die)) as Record<string, unknown>[];
  if (dice.length !== record.dice.length || dice.length > 6 || dice.some((die) => !Number.isInteger(die.count) || Number(die.count) < 1 || !Number.isInteger(die.sides) || Number(die.sides) < 2 || Number(die.sides) > 999)) return null;
  if (dice.reduce((sum, die) => sum + Number(die.count), 0) > 20) return null;
  if (!['natural', 'roll-under', 'doubles', 'high-total', 'none'].includes(String(record.crit))) return null;
  if (record.explode !== undefined) {
    const explode = record.explode;
    if (typeof explode !== 'object' || explode === null || Array.isArray(explode)) return null;
    const rule = explode as Record<string, unknown>;
    if (!['default', 'all'].includes(String(rule.dice)) || typeof rule.repeats !== 'boolean'
      || !Number.isInteger(rule.highFaces) || Number(rule.highFaces) < 1 || Number(rule.highFaces) > 99
      || !Number.isInteger(rule.lowFaces) || Number(rule.lowFaces) < 0 || Number(rule.lowFaces) > 99) return null;
  }
  const details = dice.map((die) => `${die.count}d${die.sides}${typeof die.name === 'string' && die.name.length <= 40 ? ` ${die.name}` : ''}`).join(' + ');
  return { id: record.id, name: record.name.trim(), details: `${details} · ${record.crit}`, ...(path ? { path } : {}) };
}

export function diceSetOptions(stored: readonly DiceSetOption[]): DiceSetOption[] {
  const unique = new Map<string, DiceSetOption>();
  for (const option of [...BUILT_IN_DICE_OPTIONS, ...stored]) {
    if (option.id && !unique.has(option.id)) unique.set(option.id, option);
  }
  return [COLLECTION_DICE_OPTION, ...unique.values()];
}
