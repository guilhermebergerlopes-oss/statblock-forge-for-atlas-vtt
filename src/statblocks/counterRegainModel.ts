import { parseFormula } from './atlasDiceEngine/parseFormula.ts';

/** Atlas only rolls a Counter `regain` value when it is a valid dice formula with at least one die. */
export function isCounterRegainFormula(value: string): boolean {
  const parsed = parseFormula(value);
  return parsed.ok && parsed.terms.some((term) => term.kind === 'dice' && term.count > 0);
}

/** Template presets with an unsupported regain formula behave like rows without a formula in Atlas. */
export function presetCounterRegain(value: unknown): string | null {
  return typeof value === 'string' && isCounterRegainFormula(value) ? value : null;
}
