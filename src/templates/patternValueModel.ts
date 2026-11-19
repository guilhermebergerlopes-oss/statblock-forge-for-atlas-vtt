/** Expand `{fieldKey}` references in Forge block patterns using live Field values. */
export function expandStatblockPattern(
  pattern: unknown,
  sample: Readonly<Record<string, unknown>>,
  formatValue: (value: unknown) => string,
): string | null {
  if (typeof pattern !== 'string' || !pattern.trim()) return null;
  return pattern.replace(/\{([A-Za-z0-9_-]+)\}/g, (_match, key: string) => formatValue(sample[key]));
}
