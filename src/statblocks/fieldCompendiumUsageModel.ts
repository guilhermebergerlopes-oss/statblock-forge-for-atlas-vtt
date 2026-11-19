/** Forge-only source tracking for Entries copied from a template Compendium. */

export const FORGE_COMPENDIUM_ITEM_SOURCE_KEY = '__forgeCompendiumItemId';
export const FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY = '__forgeCompendiumItemSnapshot';
export const FORGE_COMPENDIUM_ITEM_DETACHED_KEY = '__forgeCompendiumItemDetached';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function stableFingerprint(value: unknown): string {
  const serialized = JSON.stringify(stableValue(value));
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x01000193);
  }
  return `v1-${(first >>> 0).toString(16).padStart(8, '0')}${(second >>> 0).toString(16).padStart(8, '0')}`;
}

function sameStoredValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

function entryContentWithoutSourceMetadata(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const next = { ...value };
  delete next[FORGE_COMPENDIUM_ITEM_SOURCE_KEY];
  delete next[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
  delete next[FORGE_COMPENDIUM_ITEM_DETACHED_KEY];
  return next;
}

function entryRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  return value === undefined || value === null || value === '' ? [] : [value];
}

/** Attach a stable library-item identity to the statblock copy, never to the library source. */
export function markFieldCompendiumEntrySource(value: unknown, itemId: string): unknown {
  if (!isRecord(value) || !itemId.trim()) return value;
  const content = entryContentWithoutSourceMetadata(value);
  const next: Record<string, unknown> = {
    ...value,
    [FORGE_COMPENDIUM_ITEM_SOURCE_KEY]: itemId,
    [FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY]: stableFingerprint(content),
  };
  delete next[FORGE_COMPENDIUM_ITEM_DETACHED_KEY];
  return next;
}

/** Detach an ability from its source permanently once the statblock copy is edited. */
export function releaseFieldCompendiumEntrySource(entry: Record<string, unknown>): boolean {
  const hadSource = Object.prototype.hasOwnProperty.call(entry, FORGE_COMPENDIUM_ITEM_SOURCE_KEY);
  const wasDetached = entry[FORGE_COMPENDIUM_ITEM_DETACHED_KEY] === true;
  if (!hadSource && wasDetached) return false;
  delete entry[FORGE_COMPENDIUM_ITEM_SOURCE_KEY];
  delete entry[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
  entry[FORGE_COMPENDIUM_ITEM_DETACHED_KEY] = true;
  return true;
}


/**
 * Find Compendium entries already represented by an unchanged copy in this
 * statblock. New copies carry both an item ID and a stable content snapshot.
 * The snapshot lets the picker detect edits even when a mutation path did not
 * explicitly detach the source marker. Older copies without a snapshot fall
 * back to matching the current library value.
 */
export function usedFieldCompendiumItemIds(
  items: readonly { id: string; value: unknown }[],
  currentValue: unknown,
): Set<string> {
  const rows = entryRows(currentValue);
  const used = new Set<string>();
  const legacyRows: unknown[] = [];
  const itemsById = new Map(items.map((item) => [item.id, item]));

  for (const row of rows) {
    if (isRecord(row) && typeof row[FORGE_COMPENDIUM_ITEM_SOURCE_KEY] === 'string') {
      if (row[FORGE_COMPENDIUM_ITEM_DETACHED_KEY] === true) continue;
      const itemId = row[FORGE_COMPENDIUM_ITEM_SOURCE_KEY] as string;
      const snapshot = row[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
      const content = entryContentWithoutSourceMetadata(row);
      if (typeof snapshot === 'string') {
        if (stableFingerprint(content) === snapshot) used.add(itemId);
      } else {
        // Pre-snapshot entries are verified against the live library value.
        // A changed legacy copy must not keep consuming the Compendium item.
        const item = itemsById.get(itemId);
        if (item && sameStoredValue(content, item.value)) used.add(itemId);
      }
    } else if (!isRecord(row) || row[FORGE_COMPENDIUM_ITEM_DETACHED_KEY] !== true) {
      legacyRows.push(row);
    }
  }

  if (legacyRows.length > 0) {
    for (const item of items) {
      if (legacyRows.some((row) => sameStoredValue(row, item.value))) used.add(item.id);
    }
  }
  return used;
}

/** Treat matching collection Fields as one availability scope for a shared library. */
export function usedFieldCompendiumItemIdsAcrossValues(
  items: readonly { id: string; value: unknown }[],
  currentValues: readonly unknown[],
): Set<string> {
  const combinedRows = currentValues.flatMap((value) => entryRows(value));
  return usedFieldCompendiumItemIds(items, combinedRows);
}

/** Hide Forge-only Compendium tracking from the raw JSON editor. */
export function stripFieldCompendiumEntrySourceMetadata(value: unknown): unknown[] {
  return entryRows(value).map((row) => {
    if (!isRecord(row)) return row;
    if (!Object.prototype.hasOwnProperty.call(row, FORGE_COMPENDIUM_ITEM_SOURCE_KEY)
      && !Object.prototype.hasOwnProperty.call(row, FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY)
      && !Object.prototype.hasOwnProperty.call(row, FORGE_COMPENDIUM_ITEM_DETACHED_KEY)) return row;
    const next = { ...row };
    delete next[FORGE_COMPENDIUM_ITEM_SOURCE_KEY];
    delete next[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
    delete next[FORGE_COMPENDIUM_ITEM_DETACHED_KEY];
    return next;
  });
}


/**
 * Restore hidden source links only to unchanged rows after the full-field JSON
 * editor submits. Changed and newly added rows receive a detached marker so
 * they remain custom even if their values later become identical to a library
 * item. Matching prefers the original index, then searches elsewhere to allow
 * rows to be reordered without losing their source identity.
 */
export function preserveUnchangedFieldCompendiumEntrySources(previousValue: unknown, nextValue: unknown): unknown {
  const previousRows = entryRows(previousValue);
  const nextRows = stripFieldCompendiumEntrySourceMetadata(nextValue);
  const matchedNextIndexes = new Set<number>();

  for (let previousIndex = 0; previousIndex < previousRows.length; previousIndex += 1) {
    const previousRow = previousRows[previousIndex];
    if (!isRecord(previousRow)) continue;
    const previousComparable = { ...previousRow };
    delete previousComparable[FORGE_COMPENDIUM_ITEM_SOURCE_KEY];
    delete previousComparable[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
    delete previousComparable[FORGE_COMPENDIUM_ITEM_DETACHED_KEY];
    const isSame = (candidate: unknown): boolean => {
      if (!isRecord(candidate)) return sameStoredValue(candidate, previousComparable);
      const comparable = { ...candidate };
      delete comparable[FORGE_COMPENDIUM_ITEM_SOURCE_KEY];
      delete comparable[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
      delete comparable[FORGE_COMPENDIUM_ITEM_DETACHED_KEY];
      return sameStoredValue(comparable, previousComparable);
    };
    const preferred = !matchedNextIndexes.has(previousIndex) && isSame(nextRows[previousIndex])
      ? previousIndex
      : -1;
    const nextIndex = preferred >= 0 ? preferred : nextRows.findIndex((candidate, index) =>
      !matchedNextIndexes.has(index) && isSame(candidate));
    if (nextIndex < 0) continue;

    const candidate = nextRows[nextIndex];
    if (!isRecord(candidate)) {
      matchedNextIndexes.add(nextIndex);
      continue;
    }
    const next = { ...candidate };
    if (typeof previousRow[FORGE_COMPENDIUM_ITEM_SOURCE_KEY] === 'string') {
      next[FORGE_COMPENDIUM_ITEM_SOURCE_KEY] = previousRow[FORGE_COMPENDIUM_ITEM_SOURCE_KEY];
      if (typeof previousRow[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY] === 'string') {
        next[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY] = previousRow[FORGE_COMPENDIUM_ITEM_SNAPSHOT_KEY];
      }
    } else if (previousRow[FORGE_COMPENDIUM_ITEM_DETACHED_KEY] === true) {
      next[FORGE_COMPENDIUM_ITEM_DETACHED_KEY] = true;
    }
    nextRows[nextIndex] = next;
    matchedNextIndexes.add(nextIndex);
  }

  // Unmatched rows are newly added or edited. Mark them as custom so exact-value
  // legacy matching cannot accidentally reclaim a released Compendium item.
  nextRows.forEach((row, index) => {
    if (matchedNextIndexes.has(index) || !isRecord(row)) return;
    nextRows[index] = { ...row, [FORGE_COMPENDIUM_ITEM_DETACHED_KEY]: true };
  });

  // Keep legacy single-entry storage in its original scalar/object shape when
  // the full-field editor displays it as a one-row JSON array.
  if (!Array.isArray(previousValue) && previousValue !== undefined && previousValue !== null && previousValue !== ''
    && nextRows.length === 1) return nextRows[0];
  return nextRows;
}
