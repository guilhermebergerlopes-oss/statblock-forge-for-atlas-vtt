import { parseFormula } from './atlasDiceEngine/parseFormula.ts';

const AT_REFERENCE = /^@([A-Za-z_](?:[\w-]*\w)?(?:\.\w(?:[\w-]*\w)?)*)/;
const BRACE_REFERENCE = /^\{([A-Za-z_](?:[\w-]*\w)?(?:\.\w(?:[\w-]*\w)?)*)\}/;

/** Replace explicit references with harmless integers for syntax-only validation. */
function formulaWithReferencePlaceholders(source: string): string {
  let result = '';
  let cursor = 0;
  while (cursor < source.length) {
    if (source[cursor] === '[') {
      const close = source.indexOf(']', cursor);
      const end = close < 0 ? source.length : close + 1;
      result += source.slice(cursor, end);
      cursor = end;
      continue;
    }
    const match = source[cursor] === '@'
      ? AT_REFERENCE.exec(source.slice(cursor))
      : source[cursor] === '{' ? BRACE_REFERENCE.exec(source.slice(cursor)) : null;
    if (match) {
      result += '1';
      cursor += match[0].length;
      continue;
    }
    result += source[cursor];
    cursor += 1;
  }
  return result.replace(/([0-9)])\s+(?=[dD](?:\d|%|[fF]))/g, '$1');
}

/** Counter regain is evaluated per row in Rest context; references resolve against that sheet. */
export function isCounterRegainFormula(value: string): boolean {
  const parsed = parseFormula(formulaWithReferencePlaceholders(value));
  return parsed.ok && parsed.terms.some((term) => term.kind === 'dice' && term.count > 0);
}

/** Template presets with an unsupported regain formula behave like rows without a formula in Atlas. */
export function presetCounterRegain(value: unknown): string | null {
  return typeof value === 'string' && isCounterRegainFormula(value) ? value : null;
}
