/** Pure helpers for Atlas-style inline List Fields edited as removable chips. */

function scalarText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

/** Split a comma-written list while respecting escaped commas (e.g. `Fire\\, cold`). */
export function splitInlineListText(value: string): string[] {
  const result: string[] = [];
  const closers: string[] = [];
  const openers: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
  let item = '';
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (character === '\\') {
      const next = value[index + 1];
      if (next === ',' || next === '\\') {
        item += next;
        index += 1;
      } else item += character;
      continue;
    }
    if (openers[character]) closers.push(openers[character] as string);
    else if (character === closers[closers.length - 1]) closers.pop();
    const separator = character === '\n' || character === ',' && closers.length === 0;
    if (separator) {
      if (item.trim()) result.push(item.trim());
      item = '';
      if (character === '\n') closers.length = 0;
    } else item += character;
  }
  if (item.trim()) result.push(item.trim());
  return result;
}

export function inlineListItems(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(scalarText).map((item) => item.trim()).filter(Boolean);
  if (value === null || value === undefined) return [];
  return splitInlineListText(scalarText(value));
}

export function unescapeInlineListItem(value: string): string {
  return value.replace(/\\([\\,])/g, '$1').trim();
}

export function addInlineListItem(value: unknown, item: string): string[] {
  const clean = unescapeInlineListItem(item);
  return clean ? [...inlineListItems(value), clean] : inlineListItems(value);
}

export function removeInlineListItem(value: unknown, index: number): string[] {
  return inlineListItems(value).filter((_item, itemIndex) => itemIndex !== index);
}
