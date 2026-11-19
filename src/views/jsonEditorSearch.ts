/**
 * Search helpers for the native JSON draft textarea.
 *
 * Keep these operations independent from focus management: the search input
 * must remain focused while matches are revealed in the JSON editor.
 */
export interface JsonSearchMatch {
  index: number;
  length: number;
}


export function findJsonTextMatches(text: string, query: string): JsonSearchMatch[] {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const escapedQuery = normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(escapedQuery, 'giu');
  const matches: JsonSearchMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length });
    // Defensive guard for any future matcher mode that can produce empty hits.
    if (match[0].length === 0) matcher.lastIndex += 1;
  }
  return matches;
}

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Select a match and scroll the textarea itself to reveal it. No focus call is
 * made here, so callers can keep keyboard focus in the search input.
 */
export function revealJsonTextMatch(editor: HTMLTextAreaElement, match: JsonSearchMatch): void {
  const start = Math.max(0, Math.min(editor.value.length, match.index));
  const end = Math.max(start, Math.min(editor.value.length, start + match.length));
  editor.setSelectionRange(start, end);

  const textBeforeMatch = editor.value.slice(0, start);
  const lastNewline = textBeforeMatch.lastIndexOf('\n');
  const lineIndex = (textBeforeMatch.match(/\n/g) ?? []).length;
  const linePrefix = textBeforeMatch.slice(lastNewline + 1);
  const view = editor.ownerDocument.defaultView;
  const computed = view?.getComputedStyle(editor);
  const fontSize = readNumber(computed?.fontSize, 14);
  const lineHeightValue = computed?.lineHeight ?? '';
  const lineHeight = lineHeightValue === 'normal'
    ? fontSize * 1.45
    : readNumber(lineHeightValue, fontSize * 1.45);
  const paddingTop = readNumber(computed?.paddingTop, 0);
  const borderTop = readNumber(computed?.borderTopWidth, 0);
  const lineTop = borderTop + paddingTop + lineIndex * lineHeight;
  const contextOffset = Math.max(0, (editor.clientHeight - lineHeight) / 2);
  const maxScrollTop = Math.max(0, editor.scrollHeight - editor.clientHeight);
  editor.scrollTop = Math.min(maxScrollTop, Math.max(0, lineTop - contextOffset));

  // The JSON editor uses white-space: pre, so long JSON lines do not wrap.
  // Reveal the horizontal column as well as the line; otherwise matches near
  // the end of a long property line can remain outside the visible viewport.
  const tabSize = Math.max(1, Math.round(readNumber(computed?.tabSize, 2)));
  const measuredPrefix = linePrefix.replace(/\t/g, ' '.repeat(tabSize));
  const canvas = editor.ownerDocument.createElement('canvas');
  const context = canvas.getContext?.('2d');
  const font = computed?.font?.trim()
    || `${computed?.fontStyle || 'normal'} ${computed?.fontWeight || '400'} ${fontSize}px ${computed?.fontFamily || 'monospace'}`;
  let prefixWidth = measuredPrefix.length * fontSize * 0.6;
  if (context) {
    context.font = font;
    prefixWidth = context.measureText(measuredPrefix).width;
  }
  const letterSpacing = readNumber(computed?.letterSpacing, 0);
  if (letterSpacing) prefixWidth += Math.max(0, measuredPrefix.length - 1) * letterSpacing;
  const paddingLeft = readNumber(computed?.paddingLeft, 0);
  const horizontalContext = Math.max(0, editor.clientWidth / 3);
  const targetScrollLeft = Math.max(0, paddingLeft + prefixWidth - horizontalContext);
  const maxScrollLeft = Math.max(0, editor.scrollWidth - editor.clientWidth);
  editor.scrollLeft = Math.min(maxScrollLeft, targetScrollLeft);
}
