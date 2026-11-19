/** Atlas-compatible emptiness semantics used when placing initial editing focus. */
export function isAtlasEmptyFieldValue(value: unknown, depth = 0): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (typeof value === 'number') return Number.isNaN(value);
  if (depth >= 32) return false;
  if (Array.isArray(value)) return value.every((item) => isAtlasEmptyFieldValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).every((item) => isAtlasEmptyFieldValue(item, depth + 1));
  }
  return false;
}
