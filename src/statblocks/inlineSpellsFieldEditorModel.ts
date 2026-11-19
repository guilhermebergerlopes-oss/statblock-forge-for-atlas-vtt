/**
 * Forge's structured editor for Atlas-compatible Spells Fields.
 *
 * Atlas stores a spellcasting group as a header string followed by one-key
 * records such as { "1st level (4 slots)": "shield, sleep" }. This adapter
 * gives the editor a predictable group/level shape without inventing a new
 * serialized format or changing the native Atlas contract.
 */

export interface InlineSpellLineDraft {
  /** The usage or level label, e.g. "At will", "1st level", or "1/day each". */
  level: string;
  /** One or more spell names, usually comma-separated. */
  spells: string;
}

export interface InlineSpellGroupDraft {
  /** Optional Atlas group header, e.g. "Innate Spellcasting". */
  heading: string;
  lines: InlineSpellLineDraft[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function spellValueText(value: unknown, depth = 0): string {
  if (value === undefined || value === null || depth >= 32) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => spellValueText(item, depth + 1)).filter(Boolean).join(', ');
  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => {
        const text = spellValueText(item, depth + 1);
        return text ? `${key}: ${text}` : key;
      })
      .filter(Boolean)
      .join(', ');
  }
  return '';
}

function isAtlasSpellHeader(value: string): boolean {
  const text = value.trim();
  // This mirrors Atlas' public spellGroups convention: bare strings and
  // strings ending in a colon are headers; strings with an internal colon
  // are free-form spell lines.
  return text.endsWith(':') || !text.includes(':');
}

function asSpellEntries(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return Object.entries(value).map(([level, spells]) => ({ [level]: spells }));
  return value === undefined || value === null || value === '' ? [] : [value];
}

/** Read native Atlas spell data into the group/level editing model. */
export function inlineSpellGroupsDraftValue(value: unknown): InlineSpellGroupDraft[] {
  const groups: InlineSpellGroupDraft[] = [];

  for (const entry of asSpellEntries(value)) {
    if (typeof entry === 'string') {
      const text = entry.trim();
      if (!text) continue;
      if (isAtlasSpellHeader(text)) {
        groups.push({ heading: text.replace(/:$/, '').trim(), lines: [] });
      } else {
        if (groups.length === 0) groups.push({ heading: '', lines: [] });
        groups[groups.length - 1]?.lines.push({ level: '', spells: text });
      }
      continue;
    }

    if (!isRecord(entry)) {
      const text = spellValueText(entry);
      if (!text) continue;
      if (groups.length === 0) groups.push({ heading: '', lines: [] });
      groups[groups.length - 1]?.lines.push({ level: '', spells: text });
      continue;
    }

    const entries = Object.entries(entry);
    for (const [level, rawSpells] of entries) {
      const spells = spellValueText(rawSpells);
      if (!level.trim() || !spells) continue;
      if (groups.length === 0) groups.push({ heading: '', lines: [] });
      groups[groups.length - 1]?.lines.push({ level: level.trim(), spells });
    }
  }

  return groups;
}

/**
 * Serialize editor drafts back into Atlas' native Spells shape.
 * Empty rows are ignored; an unlabeled row is made "At will" so it can never
 * accidentally be interpreted as a new header by Atlas.
 */
export function serializeInlineSpellGroups(
  groups: readonly InlineSpellGroupDraft[],
  defaultLevel = 'At will',
): unknown[] | undefined {
  const result: unknown[] = [];
  for (const group of groups) {
    const heading = group.heading.trim().replace(/:$/, '').trim();
    const lines = group.lines
      .map((line) => ({ level: line.level.trim(), spells: line.spells.trim() }))
      .filter((line) => line.spells.length > 0);

    if (heading) result.push(`${heading}:`);
    for (const line of lines) {
      result.push({ [line.level || defaultLevel]: line.spells });
    }
  }
  return result.length > 0 ? result : undefined;
}

/** Legacy text coercion retained for any older Forge integration callers. */
function valueText(value: unknown, depth = 0): string {
  if (value === undefined || value === null || depth >= 32) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isNaN(value) ? '' : String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    return value.map((item) => valueText(item, depth + 1)).filter((item) => item.trim() !== '').join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      const text = valueText(item, depth + 1);
      return text.trim() === '' ? key : `${key} ${text}`;
    }).filter((item) => item.trim() !== '').join(', ');
  }
  return '';
}

/** Convert a Spells value to the old multiline draft representation. */
export function inlineSpellsFieldDraftValue(value: unknown): string {
  return valueText(value);
}

/** Old plain-text parser retained for backwards compatibility with callers. */
export function parseInlineSpellsFieldDraft(raw: string): string[] | undefined {
  const entries = raw.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  return entries.length > 0 ? entries : undefined;
}
