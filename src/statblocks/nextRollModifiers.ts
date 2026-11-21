import { parseFormula } from './atlasDiceEngine/parseFormula.ts';
import { combineWrittenAdvantage, withWrittenAdvantage, writtenAdvantage, type WrittenAdvantageSide } from './atlasDiceEngine/writtenAdvantage.ts';

/** One formula selected from a statblock roll link for the next successful roll. */
export interface ForgeNextRollModifier {
  readonly key: string;
  readonly formula: string;
  readonly label?: string;
}

const pendingByApp = new WeakMap<object, Map<string, ForgeNextRollModifier[]>>();

function pendingMap(app: object): Map<string, ForgeNextRollModifier[]> {
  let map = pendingByApp.get(app);
  if (!map) {
    map = new Map();
    pendingByApp.set(app, map);
  }
  return map;
}

/** Stable key for one clickable formula within a statblock. */
export function nextRollModifierKey(formula: string, label?: string): string {
  return `${formula.trim()}\u0000${label?.trim() ?? ''}`;
}

/** Returns a snapshot of formulas currently queued for this statblock. */
export function pendingNextRollModifiers(app: object, statblockKey: string): readonly ForgeNextRollModifier[] {
  return [...(pendingMap(app).get(statblockKey) ?? [])];
}

/** Adds a formula to the queue, or removes it when the same link is selected again. Returns true when queued. */
export function toggleNextRollModifier(
  app: object,
  statblockKey: string,
  formula: string,
  label?: string,
): boolean {
  const map = pendingMap(app);
  const current = map.get(statblockKey) ?? [];
  const key = nextRollModifierKey(formula, label);
  const existing = current.findIndex((entry) => entry.key === key);
  if (existing >= 0) {
    const next = current.filter((entry) => entry.key !== key);
    if (next.length) map.set(statblockKey, next);
    else map.delete(statblockKey);
    return false;
  }
  map.set(statblockKey, [...current, {
    key,
    formula: formula.trim(),
    ...(label?.trim() ? { label: label.trim() } : {}),
  }]);
  return true;
}

/** Whether a specific roll link is already queued. */
export function isNextRollModifierQueued(
  app: object,
  statblockKey: string,
  formula: string,
  label?: string,
): boolean {
  const key = nextRollModifierKey(formula, label);
  return (pendingMap(app).get(statblockKey) ?? []).some((entry) => entry.key === key);
}

/** Atomically takes the current queue so concurrent clicks cannot spend the same modifiers twice. */
export function takeNextRollModifiers(app: object, statblockKey: string): ForgeNextRollModifier[] {
  const map = pendingMap(app);
  const taken = map.get(statblockKey) ?? [];
  map.delete(statblockKey);
  return [...taken];
}

/** Restores modifiers when Atlas refuses a roll; newer queue entries remain after the restored ones. */
export function restoreNextRollModifiers(
  app: object,
  statblockKey: string,
  restore: readonly ForgeNextRollModifier[],
): void {
  if (restore.length === 0) return;
  const map = pendingMap(app);
  const current = map.get(statblockKey) ?? [];
  const seen = new Set(current.map((entry) => entry.key));
  const restored = restore.filter((entry) => !seen.has(entry.key));
  const next = [...restored, ...current];
  if (next.length) map.set(statblockKey, next);
}

function formulaHasDice(formula: string): boolean {
  const parsed = parseFormula(writtenAdvantage(formula.trim()).formula.trim());
  return 'ok' in parsed && parsed.terms.some((term) => term.kind === 'dice');
}

/**
 * Combines queued formulas with the next roll. If a dice formula is added to a bare bonus,
 * the active Dice Set's default dice are written explicitly so Atlas does not mistake the
 * added dice for the whole roll and omit the default die.
 *
 * Returns null only when a default die is required but could not be resolved.
 */
function modifierTerm(entry: ForgeNextRollModifier): string {
  const formula = writtenAdvantage(entry.formula.trim()).formula.trim();
  const integer = /^([+-]?\d+)$/.exec(formula);
  const label = entry.label
    ?.replace(/[^\p{L}\p{N} '-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24)
    .trim();
  if (integer && label) {
    const value = Number(integer[1]);
    return `${value < 0 ? '-' : '+'}${Math.abs(value)}[${label}]`;
  }
  return `+(${formula})`;
}

export function formulaWithNextRollModifiers(
  formula: string,
  modifiers: readonly ForgeNextRollModifier[],
  defaultRoll?: string | null,
): string | null {
  const base = formula.trim();
  if (modifiers.length === 0) return base;

  const writtenBase = writtenAdvantage(base);
  let side: WrittenAdvantageSide | null = writtenBase.side;
  for (const modifier of modifiers) {
    side = combineWrittenAdvantage(side, writtenAdvantage(modifier.formula.trim()).side);
  }
  const baseFormula = writtenBase.formula.trim();
  const baseHasDice = formulaHasDice(baseFormula);
  const addedDice = modifiers.some((entry) => formulaHasDice(entry.formula));
  let combined = baseFormula;

  if (!baseHasDice && addedDice) {
    if (!defaultRoll?.trim()) return null;
    const bonus = /^[+-]/.test(baseFormula) ? baseFormula : `+${baseFormula}`;
    combined = `${defaultRoll.trim()}${bonus}`;
  }

  return withWrittenAdvantage(combined + modifiers.map(modifierTerm).join(''), side);
}
