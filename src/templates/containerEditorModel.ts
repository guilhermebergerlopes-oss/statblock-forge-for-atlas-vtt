import {
  isRecord,
  registerTableStorageField,
  type ForgeBlock,
  type ForgeContainerDefinition,
  type ForgeField,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import { addLayoutBlock, findLayoutBlock } from './layoutEditorModel.ts';

/** Forge-only container kinds backed by native Atlas Metric and Scores blocks. */
export type ForgeContainerKind = 'metric' | 'table';

export interface ForgeContainer {
  /** The Forge container itself is distinct from any Field it contains. */
  type: 'container';
  kind: ForgeContainerKind;
  id: string;
  block: ForgeBlock;
  /** Table's native Scores Field is an implementation detail, not a child Field. */
  dataFieldKey?: string;
  /** Fields presented as members of this container. */
  fields: ForgeField[];
}

const METRIC_FIELD_TYPES = new Set(['text', 'number', 'rating', 'dice', 'choice']);
// Table slots may bind any user-facing Field except the private Scores storage Field.
const TABLE_FIELD_TYPES = new Set([
  'text', 'inline', 'markdown', 'number', 'rating', 'dice', 'choice', 'selection',
  'checkboxes', 'counter', 'counters', 'list', 'entries', 'image', 'groups', 'spells',
]);

function walkBlocks(blocks: ForgeBlock[], visit: (block: ForgeBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    if (Array.isArray(block.blocks)) walkBlocks(block.blocks.filter(isRecord) as ForgeBlock[], visit);
  }
}

function definitionFor(block: ForgeBlock): ForgeContainerDefinition | null {
  if (block.type === 'metric') return { blockId: block.id, kind: 'metric' };
  if (block.type === 'scores') {
    return {
      blockId: block.id,
      kind: 'table',
      ...(typeof block.field === 'string' && block.field ? { dataFieldKey: block.field } : {}),
    };
  }
  return null;
}

/**
 * Rebuilds the explicit Forge Container registry from native blocks. This is
 * also the migration path for 0.5.0 templates written before Containers were
 * introduced: no native Field data is copied or rewritten.
 */
export function ensureForgeContainers(template: ForgeTemplate, layout: ForgeLayoutDocument): void {
  const current = Array.isArray(layout.containers) ? layout.containers : [];
  const currentByBlockId = new Map(current.filter(isRecord).map((item) => [
    typeof item.blockId === 'string' ? item.blockId : '', item,
  ]));
  const referencedStorageKeys = new Set<string>();
  const tableCount = (): number => {
    const count = (items: readonly ForgeBlock[]): number => items.reduce((total, item) =>
      total + (item.type === 'scores' ? 1 : 0)
      + (Array.isArray(item.blocks) ? count(item.blocks.filter(isRecord) as ForgeBlock[]) : 0), 0);
    return count(template.layout.blocks);
  };

  // First normalize every existing Table block. The Scores Field it references
  // is an Atlas serialization adapter owned by the block, not a user Field.
  walkBlocks(template.layout.blocks, (block) => {
    if (block.type !== 'scores') return;
    migrateTableChildren(template, block);
    const requestedStorage = typeof block.field === 'string'
      ? template.fields.find((field) => field.key === block.field && field.type === 'scores')
      : undefined;
    let storage = requestedStorage && !referencedStorageKeys.has(requestedStorage.key)
      ? requestedStorage
      : template.fields.find((field) => field.type === 'scores' && !referencedStorageKeys.has(field.key));
    if (!storage) storage = registerTableStorageField(template, `Table ${tableCount()}`);
    if (block.field !== storage.key) block.field = storage.key;
    storage.forgeInternal = 'table-storage';
    if (layout.fieldKinds) delete layout.fieldKinds[storage.key];
    referencedStorageKeys.add(storage.key);
  });

  // Older templates could contain a Scores Field without a matching Canvas
  // block. Promote it to a Table block instead of leaving a Field-only Table.
  for (const storage of template.fields) {
    if (storage.type !== 'scores' || referencedStorageKeys.has(storage.key)) continue;
    storage.forgeInternal = 'table-storage';
    if (layout.fieldKinds) delete layout.fieldKinds[storage.key];
    addLayoutBlock(template, layout, 'scores', storage.key);
    referencedStorageKeys.add(storage.key);
  }

  const next: NonNullable<ForgeLayoutDocument['containers']> = [];
  walkBlocks(template.layout.blocks, (block) => {
    if (block.type === 'scores') migrateTableChildren(template, block);
    const definition = definitionFor(block);
    if (!definition) return;
    const previous = currentByBlockId.get(block.id);
    const dataFieldKey = block.type === 'scores' && typeof block.field === 'string' && block.field
      ? block.field
      : undefined;
    next.push({
      blockId: block.id,
      kind: block.type === 'metric' ? 'metric' : 'table',
      ...(dataFieldKey ? { dataFieldKey } : {}),
      ...(previous && isRecord(previous) ? Object.fromEntries(Object.entries(previous).filter(([key]) =>
        key !== 'blockId' && key !== 'kind' && key !== 'dataFieldKey')) : {}),
    });
  });
  layout.containers = next;
}

function childFieldKeys(block: ForgeBlock, kind: ForgeContainerKind): string[] {
  const keys = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string' && key.length > 0)
    : [];
  return keys;
}

/**
 * Remove the former Pairs/Table coupling and normalize all remaining Table
 * children into one ordered Field list. Legacy non-Pairs column references
 * are retained as ordinary Fields; Pair references are detached but the
 * Fields and their data remain in the Template.
 */
function migrateTableChildren(template: ForgeTemplate, block: ForgeBlock): void {
  const fields = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string')
    : [];
  // Older Table versions also stored Field links under block.columns[].field.
  const legacyColumnFields = Array.isArray(block.columns)
    ? block.columns.filter(isRecord).map((column) => column.field)
      .filter((key): key is string => typeof key === 'string')
    : [];
  const validFields = [...fields, ...legacyColumnFields].filter((key) => {
    const field = template.fields.find((item) => item.key === key);
    return Boolean(field && field.type !== 'pairs' && field.type !== 'scores' && TABLE_FIELD_TYPES.has(field.type));
  });
  const nextFields = [...new Set(validFields)];
  if (nextFields.length) block.fields = nextFields;
  else delete block.fields;
  delete block.pairRows;
  // The former labelsInRows flag changed the Fields' orientation. The current
  // model keeps Fields as columns and uses row Labels for user-created records.
  // Preserve the author's intent by enabling row labels during migration.
  if (block.labelsInRows === true && block.showRowLabels === undefined) block.showRowLabels = true;
  if (block.showColumnLabels !== false && block.showColumnLabels !== undefined) delete block.showColumnLabels;
  delete block.labelsInRows;
  // Remove obsolete Table layout settings; ordered Fields now define columns.
  delete block.columns;
  delete block.orientation;
  delete block.perLine;
}

/** Return the public Forge Container objects represented in a template. */
export function forgeContainers(template: ForgeTemplate, layout: ForgeLayoutDocument): ForgeContainer[] {
  ensureForgeContainers(template, layout);
  const fieldsByKey = new Map(template.fields.map((field) => [field.key, field]));
  return (layout.containers ?? []).flatMap((definition) => {
    const block = findLayoutBlock(template, definition.blockId);
    if (!block || (block.type !== 'metric' && block.type !== 'scores')) return [];
    const kind: ForgeContainerKind = block.type === 'metric' ? 'metric' : 'table';
    const children = childFieldKeys(block, kind)
      .map((key) => fieldsByKey.get(key))
      .filter((field): field is ForgeField => Boolean(field));
    return [{
      type: 'container' as const,
      kind,
      id: definition.blockId,
      block,
      ...(kind === 'table' && typeof block.field === 'string' && block.field
        ? { dataFieldKey: block.field } : {}),
      fields: children,
    }];
  });
}

export function forgeContainerForBlock(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
): ForgeContainer | null {
  return forgeContainers(template, layout).find((container) => container.id === blockId) ?? null;
}

export function isContainerDataField(layout: ForgeLayoutDocument, fieldKey: string): boolean {
  return (layout.containers ?? []).some((container) =>
    container.kind === 'table' && container.dataFieldKey === fieldKey,
  );
}

export function containerAcceptsField(kind: ForgeContainerKind, field: ForgeField): boolean {
  return kind === 'metric' ? METRIC_FIELD_TYPES.has(field.type) : TABLE_FIELD_TYPES.has(field.type);
}

/** Add a Field as a child of a Metric or Table Container. */
export function addFieldToContainer(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
  fieldKey: string,
): boolean {
  const block = findLayoutBlock(template, blockId);
  const field = template.fields.find((item) => item.key === fieldKey);
  if (!block || !field || (block.type !== 'metric' && block.type !== 'scores')) return false;
  const kind: ForgeContainerKind = block.type === 'metric' ? 'metric' : 'table';
  if (!containerAcceptsField(kind, field)) return false;
  if (kind === 'metric') {
    const keys = Array.isArray(block.fields)
      ? block.fields.filter((key): key is string => typeof key === 'string')
      : [];
    if (keys.includes(fieldKey)) return false;
    block.fields = [...keys, fieldKey];
  } else {
    const slots = Array.isArray(block.fields)
      ? block.fields.filter((key): key is string => typeof key === 'string')
      : [];
    if (slots.includes(fieldKey)) return false;
    block.fields = [...slots, fieldKey];
  }
  ensureForgeContainers(template, layout);
  return true;
}

/** Reorder a Field already assigned to a Metric or Table. */
export function moveFieldWithinContainer(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
  fieldKey: string,
  direction: -1 | 1,
): boolean {
  const block = findLayoutBlock(template, blockId);
  if (!block || (block.type !== 'metric' && block.type !== 'scores')) return false;
  const keys = Array.isArray(block.fields)
    ? block.fields.filter((key): key is string => typeof key === 'string')
    : [];
  const index = keys.indexOf(fieldKey);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= keys.length) return false;
  [keys[index], keys[target]] = [keys[target] as string, keys[index] as string];
  block.fields = keys;
  ensureForgeContainers(template, layout);
  return true;
}

/** Remove a child reference while leaving the Field and its sample data intact. */
export function removeFieldFromContainer(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
  fieldKey: string,
): boolean {
  const block = findLayoutBlock(template, blockId);
  if (!block || (block.type !== 'metric' && block.type !== 'scores')) return false;
  if (block.type === 'metric') {
    const keys = Array.isArray(block.fields)
      ? block.fields.filter((key): key is string => typeof key === 'string')
      : [];
    const index = keys.indexOf(fieldKey);
    if (index < 0) return false;
    keys.splice(index, 1);
    block.fields = keys;
    for (const property of ['formulas', 'formulaLabels'] as const) {
      if (Array.isArray(block[property])) {
        const values = [...block[property] as unknown[]];
        values.splice(index, 1);
        if (values.some((value) => typeof value === 'string' && value.trim())) block[property] = values;
        else delete block[property];
      }
    }
  } else {
    const fields = Array.isArray(block.fields) ? block.fields.filter((key): key is string => typeof key === 'string') : [];
    const nextFields = fields.filter((key) => key !== fieldKey);
    if (nextFields.length === fields.length) return false;
    if (nextFields.length) block.fields = nextFields; else delete block.fields;
  }
  ensureForgeContainers(template, layout);
  return true;
}

/**
 * Create a new, empty Forge Container. A Table gets a private native Scores
 * Field as its storage adapter; it is hidden from the Field palette and remains
 * part of the Forge-owned Template JSON for import/migration compatibility.
 */
export function createForgeContainer(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  kind: ForgeContainerKind,
  targetContainerId: string | null = null,
  insertAfterBlockId: string | null = null,
): ForgeContainer {
  let block: ForgeBlock;
  let dataFieldKey: string | undefined;
  if (kind === 'metric') {
    block = addLayoutBlock(template, layout, 'metric', null, targetContainerId, insertAfterBlockId);
  } else {
    block = addLayoutBlock(template, layout, 'scores', null, targetContainerId, insertAfterBlockId);
    dataFieldKey = typeof block.field === 'string' && block.field ? block.field : undefined;
  }
  ensureForgeContainers(template, layout);
  return forgeContainerForBlock(template, layout, block.id) ?? {
    type: 'container', kind, id: block.id, block,
    ...(dataFieldKey ? { dataFieldKey } : {}), fields: [],
  };
}

/** Remove the metadata entry associated with a deleted Container block. */
export function forgetForgeContainer(layout: ForgeLayoutDocument, blockId: string): void {
  if (Array.isArray(layout.containers)) {
    layout.containers = layout.containers.filter((item) => item.blockId !== blockId);
  }
}
