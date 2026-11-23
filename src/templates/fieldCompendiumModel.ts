import type { ForgeField, ForgeLayoutDocument } from './forgeTemplate.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneCompendiumValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export type CollectionFieldType = 'entries' | 'list' | 'pairs' | 'spells';

/** A reusable, template-owned value. `value` always uses the native Atlas Field shape. */
export interface ForgeCompendiumItem {
  id: string;
  name: string;
  /** Prevents a Field's library becoming structurally incompatible if its Type changes. */
  fieldType: CollectionFieldType;
  /** Optional user-defined group scoped to this Field's library. */
  category?: string;
  value: unknown;
}

export type ForgeFieldCompendium = Record<string, ForgeCompendiumItem[]>;
export type ForgeFieldCompendiumSources = Record<string, string>;

export function isCollectionFieldType(value: string): value is CollectionFieldType {
  return value === 'entries' || value === 'list' || value === 'pairs' || value === 'spells';
}

function makeId(): string {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replace(/-/g, '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `fid_${random.slice(0, 20)}`;
}

/** Stable identity is separate from the Field's editable key and display label. */
export function ensureFieldId(layout: ForgeLayoutDocument, field: ForgeField): string {
  layout.fieldIds ??= {};
  const existing = layout.fieldIds[field.key];
  if (typeof existing === 'string' && existing.trim()) return existing;
  const taken = new Set(Object.values(layout.fieldIds));
  let id = makeId();
  while (taken.has(id)) id = makeId();
  layout.fieldIds[field.key] = id;
  return id;
}

/** Resolve a Field's effective library owner, following links defensively. */
export function fieldCompendiumLibraryIdById(
  layout: ForgeLayoutDocument,
  fieldId: string,
): string {
  const links = layout.compendiumSourceByFieldId ?? {};
  const visited = new Set<string>();
  let current = fieldId;
  while (true) {
    if (visited.has(current)) return fieldId;
    visited.add(current);
    const source = links[current];
    if (typeof source !== 'string' || !source.trim() || source === current) return current;
    current = source;
  }
}

export function fieldCompendiumLibraryId(
  layout: ForgeLayoutDocument,
  field: ForgeField,
): string {
  return fieldCompendiumLibraryIdById(layout, ensureFieldId(layout, field));
}

/** Direct source ID, or null when this Field owns an independent library. */
export function fieldCompendiumSourceId(
  layout: ForgeLayoutDocument,
  field: ForgeField,
): string | null {
  const fieldId = ensureFieldId(layout, field);
  const sourceId = layout.compendiumSourceByFieldId?.[fieldId];
  return typeof sourceId === 'string' && sourceId.trim() ? sourceId : null;
}

/** Source Field key for display in the editor. */
export function fieldCompendiumSourceKey(
  layout: ForgeLayoutDocument,
  field: ForgeField,
): string | null {
  const sourceId = fieldCompendiumSourceId(layout, field);
  if (!sourceId) return null;
  return Object.entries(layout.fieldIds ?? {}).find(([, id]) => id === sourceId)?.[0] ?? null;
}

/**
 * Link a compatible Collection Field to another Field's Compendium. The link
 * is flattened to the source's effective library owner and cycles are rejected.
 * Passing null restores the Field's own independent library.
 */
export function setFieldCompendiumSource(
  layout: ForgeLayoutDocument,
  field: ForgeField,
  sourceField: ForgeField | null,
): boolean {
  const fieldId = ensureFieldId(layout, field);
  layout.compendiumSourceByFieldId ??= {};
  if (!sourceField) {
    if (!layout.compendiumSourceByFieldId[fieldId]) return false;
    delete layout.compendiumSourceByFieldId[fieldId];
    return true;
  }
  if (!isCollectionFieldType(field.type) || !isCollectionFieldType(sourceField.type)
    || field.type !== sourceField.type) return false;
  const sourceId = fieldCompendiumLibraryId(layout, sourceField);
  if (sourceId === fieldId) return false;
  if (layout.compendiumSourceByFieldId[fieldId] === sourceId) return false;
  layout.compendiumSourceByFieldId[fieldId] = sourceId;
  return true;
}

/** Fields that consume the same library, including the owner itself. */
export function fieldCompendiumLinkedFieldKeys(
  layout: ForgeLayoutDocument,
  field: ForgeField,
): string[] {
  const libraryId = fieldCompendiumLibraryId(layout, field);
  return Object.entries(layout.fieldIds ?? {})
    .filter(([, id]) => fieldCompendiumLibraryIdById(layout, id) === libraryId)
    .map(([key]) => key);
}

export function fieldCompendiumItems(
  layout: ForgeLayoutDocument | null | undefined,
  field: ForgeField,
): ForgeCompendiumItem[] {
  if (!layout || !isCollectionFieldType(field.type)) return [];
  const libraryId = fieldCompendiumLibraryId(layout, field);
  const items = layout.compendiumByFieldId?.[libraryId];
  return Array.isArray(items) ? items.filter((item) => item.fieldType === field.type) : [];
}

export function addFieldCompendiumItem(
  layout: ForgeLayoutDocument,
  field: ForgeField,
  name: string,
  value: unknown,
  category = '',
): ForgeCompendiumItem {
  if (!isCollectionFieldType(field.type)) throw new Error('O Compendium só pode ser usado por Fields da Category Collections.');
  const itemName = name.trim();
  if (!itemName) throw new Error('Informe um nome para o conteúdo do Compendium.');
  const fieldId = fieldCompendiumLibraryId(layout, field);
  layout.compendiumByFieldId ??= {};
  const items = layout.compendiumByFieldId[fieldId] ?? [];
  const normalizedCategory = category.trim();
  const item: ForgeCompendiumItem = {
    id: makeId(), name: itemName, fieldType: field.type,
    ...(normalizedCategory ? { category: normalizedCategory } : {}),
    value: cloneCompendiumValue(value),
  };
  layout.compendiumByFieldId[fieldId] = [...items, item];
  return item;
}

export function updateFieldCompendiumItem(
  layout: ForgeLayoutDocument,
  field: ForgeField,
  itemId: string,
  name: string,
  value: unknown,
  category?: string,
): boolean {
  const fieldId = fieldCompendiumLibraryId(layout, field);
  const items = layout.compendiumByFieldId?.[fieldId];
  if (!Array.isArray(items)) return false;
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) return false;
  const itemName = name.trim();
  if (!itemName) throw new Error('Informe um nome para o conteúdo do Compendium.');
  const next = [...items];
  const current = next[index];
  if (!current) return false;
  const normalizedCategory = (category ?? current.category ?? '').trim();
  next[index] = {
    id: itemId, name: itemName, fieldType: current.fieldType,
    ...(normalizedCategory ? { category: normalizedCategory } : {}),
    value: cloneCompendiumValue(value),
  };
  layout.compendiumByFieldId![fieldId] = next;
  return true;
}

export function removeFieldCompendiumItem(
  layout: ForgeLayoutDocument,
  field: ForgeField,
  itemId: string,
): boolean {
  const fieldId = fieldCompendiumLibraryId(layout, field);
  const items = layout.compendiumByFieldId?.[fieldId];
  if (!Array.isArray(items)) return false;
  const next = items.filter((item) => item.id !== itemId);
  if (next.length === items.length) return false;
  if (next.length) layout.compendiumByFieldId![fieldId] = next;
  else delete layout.compendiumByFieldId![fieldId];
  return true;
}

/** Keep a Field's library attached to its stable ID when its editable key changes. */
export function renameFieldCompendiumIdentity(
  layout: ForgeLayoutDocument,
  from: string,
  to: string,
): void {
  layout.fieldIds ??= {};
  const id = layout.fieldIds[from];
  if (id) {
    delete layout.fieldIds[from];
    layout.fieldIds[to] = id;
  }
}

/** Remove a Field's private library when the Field itself is deleted. */
export function removeFieldCompendium(
  layout: ForgeLayoutDocument,
  fieldKey: string,
): void {
  const id = layout.fieldIds?.[fieldKey];
  if (layout.fieldIds) delete layout.fieldIds[fieldKey];
  if (id && layout.fieldTypography) delete layout.fieldTypography[id];
  if (id && layout.compendiumByFieldId) delete layout.compendiumByFieldId[id];
  if (id && layout.compendiumSourceByFieldId) {
    delete layout.compendiumSourceByFieldId[id];
    for (const [targetId, sourceId] of Object.entries(layout.compendiumSourceByFieldId)) {
      if (sourceId === id) delete layout.compendiumSourceByFieldId[targetId];
    }
  }
}

/** Normalize compatible Field-to-Compendium links and discard missing IDs/cycles. */
export function normalizeFieldCompendiumSources(
  raw: unknown,
  fields: readonly ForgeField[],
  fieldIds: Readonly<Record<string, string>>,
): ForgeFieldCompendiumSources {
  if (!isRecord(raw)) return {};
  const typeById = new Map<string, string>();
  for (const field of fields) {
    const id = fieldIds[field.key];
    if (typeof id === 'string' && id.trim() && isCollectionFieldType(field.type)) typeById.set(id, field.type);
  }
  const result: ForgeFieldCompendiumSources = {};
  for (const [targetId, sourceValue] of Object.entries(raw)) {
    const sourceId = typeof sourceValue === 'string' ? sourceValue.trim() : '';
    const targetType = typeById.get(targetId);
    if (!sourceId || sourceId === targetId || !targetType || typeById.get(sourceId) !== targetType) continue;
    result[targetId] = sourceId;
  }
  // Remove every edge whose target participates in a cycle. This keeps
  // old/corrupt metadata from making a Field resolve unpredictably.
  const cyclicTargets = new Set<string>();
  for (const startId of Object.keys(result)) {
    const path: string[] = [];
    const pathIndexes = new Map<string, number>();
    let current = startId;
    while (result[current]) {
      const previousIndex = pathIndexes.get(current);
      if (previousIndex !== undefined) {
        for (const cycleId of path.slice(previousIndex)) cyclicTargets.add(cycleId);
        break;
      }
      pathIndexes.set(current, path.length);
      path.push(current);
      current = result[current] ?? '';
    }
  }
  for (const targetId of cyclicTargets) delete result[targetId];
  return result;
}

/** Normalizes sidecar content while preserving its native Atlas value shapes. */
export function normalizeFieldCompendium(
  raw: unknown,
  validFieldIds: ReadonlySet<string>,
): ForgeFieldCompendium {
  if (!isRecord(raw)) return {};
  const result: ForgeFieldCompendium = {};
  for (const [fieldId, rawItems] of Object.entries(raw)) {
    if (!validFieldIds.has(fieldId) || !Array.isArray(rawItems)) continue;
    const seen = new Set<string>();
    const items: ForgeCompendiumItem[] = [];
    for (const rawItem of rawItems) {
      const fieldType = rawItem && isRecord(rawItem) ? rawItem.fieldType : undefined;
      if (!isRecord(rawItem) || typeof rawItem.id !== 'string' || !rawItem.id.trim()
        || typeof rawItem.name !== 'string' || !rawItem.name.trim()
        || typeof fieldType !== 'string' || !isCollectionFieldType(fieldType)
        || !Object.prototype.hasOwnProperty.call(rawItem, 'value')) continue;
      if (seen.has(rawItem.id)) continue;
      seen.add(rawItem.id);
      const category = typeof rawItem.category === 'string' ? rawItem.category.trim() : '';
      items.push({
        id: rawItem.id, name: rawItem.name.trim(), fieldType,
        ...(category ? { category } : {}),
        value: cloneCompendiumValue(rawItem.value),
      });
    }
    if (items.length) result[fieldId] = items;
  }
  return result;
}

export function normalizeFieldIds(
  raw: unknown,
  fields: readonly ForgeField[],
): Record<string, string> {
  const source = isRecord(raw) ? raw : {};
  const result: Record<string, string> = {};
  const taken = new Set<string>();
  for (const field of fields) {
    let candidate = source[field.key];
    if (typeof candidate !== 'string' || !candidate.trim()) {
      const formerKeys = Array.isArray(field.formerKeys)
        ? field.formerKeys.filter((key): key is string => typeof key === 'string')
        : [];
      candidate = formerKeys.map((key) => source[key]).find((value) => typeof value === 'string' && value.trim());
    }
    const candidateId = typeof candidate === 'string' ? candidate.trim() : '';
    const id = candidateId && !taken.has(candidateId) ? candidateId : makeId();
    result[field.key] = id;
    taken.add(id);
  }
  return result;
}

/** Unique, normalized category names scoped to the current Field library. */
export function compendiumCategories(items: readonly ForgeCompendiumItem[]): string[] {
  const categories = new Set<string>();
  for (const item of items) {
    const category = typeof item.category === 'string' ? item.category.trim() : '';
    if (category) categories.add(category);
  }
  return [...categories].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** Search by item name, category, and the human-readable summary for its Field type. */
export function filterCompendiumItems(
  field: ForgeField,
  items: readonly ForgeCompendiumItem[],
  query: string,
  category = '',
): ForgeCompendiumItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const normalizedCategory = category.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const itemCategory = (item.category ?? '').trim();
    if (normalizedCategory === '__uncategorized__' && itemCategory) return false;
    if (normalizedCategory && normalizedCategory !== '__uncategorized__'
      && itemCategory.toLocaleLowerCase() !== normalizedCategory) return false;
    if (!normalizedQuery) return true;
    const serializedValue = JSON.stringify(item.value) ?? '';
    const haystack = `${item.name} ${itemCategory} ${compendiumSummary(field, item.value)} ${serializedValue}`.toLocaleLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function compendiumSummary(field: ForgeField, value: unknown): string {
  if (field.type === 'entries' && isRecord(value)) {
    const entry = isRecord(field.entry) ? field.entry : {};
    const textKey = typeof entry.textKey === 'string' ? entry.textKey : 'desc';
    const text = value[textKey] ?? value.desc ?? value.text;
    return typeof text === 'string' ? text : '';
  }
  if (field.type === 'list') return typeof value === 'string' ? value : '';
  if (field.type === 'pairs' && isRecord(value)) {
    return Object.entries(value).map(([key, item]) => `${key}: ${String(item ?? '')}`).join(' · ');
  }
  if (field.type === 'spells' && Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      if (!isRecord(item)) return '';
      return Object.entries(item).map(([key, itemValue]) => `${key}: ${Array.isArray(itemValue) ? itemValue.join(', ') : String(itemValue ?? '')}`).join(' · ');
    }).filter(Boolean).join(' · ');
  }
  return '';
}
