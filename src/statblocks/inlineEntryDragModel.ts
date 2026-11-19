/** Geometry helpers for the Atlas-style, single-list Entry drag surface. */
export interface InlineEntryDropRect {
  top: number;
  bottom: number;
  left?: number;
}

/**
 * Returns the insertion index after the dragged row has been removed.
 * Pointer positions above a row's midpoint insert before it; positions below
 * every midpoint insert at the end of the list.
 */
export function inlineEntryDropIndex(rows: readonly InlineEntryDropRect[], pointerY: number): number {
  const y = Number.isFinite(pointerY) ? pointerY : 0;
  const index = rows.findIndex((row) => y < row.top + ((row.bottom - row.top) / 2));
  return index < 0 ? rows.length : index;
}

/** Maps an edited Entry's index after another Entry is moved around it. */
export function inlineEntryIndexAfterMove(index: number, from: number, to: number): number {
  if (index === from) return to;
  if (from < index && to >= index) return index - 1;
  if (to <= index && from > index) return index + 1;
  return index;
}


export interface InlineEntryFieldTransfer {
  /** Original values are retained so a failed destination save can roll back. */
  sourceBefore: unknown[];
  destinationBefore: unknown[];
  sourceAfter: unknown[];
  destinationAfter: unknown[];
  destinationIndex: number;
}

/** Move one opaque Ability entry between two tab-owned Fields without rewriting its contents. */
export function moveInlineEntryBetweenFields(
  sourceValue: unknown,
  destinationValue: unknown,
  from: number,
  to: number,
): InlineEntryFieldTransfer | null {
  const toRows = (value: unknown): unknown[] => Array.isArray(value)
    ? [...value]
    : value === undefined || value === null || value === '' ? [] : [value];
  const sourceBefore = toRows(sourceValue);
  const destinationBefore = toRows(destinationValue);
  if (!Number.isInteger(from) || from < 0 || from >= sourceBefore.length) return null;
  const sourceAfter = [...sourceBefore];
  const [entry] = sourceAfter.splice(from, 1);
  if (entry === undefined) return null;
  const destinationAfter = [...destinationBefore];
  const destinationIndex = Math.max(0, Math.min(destinationAfter.length, Math.floor(Number.isFinite(to) ? to : destinationAfter.length)));
  destinationAfter.splice(destinationIndex, 0, entry);
  return { sourceBefore, destinationBefore, sourceAfter, destinationAfter, destinationIndex };
}
