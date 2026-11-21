import {
  createBlock,
  isRecord,
  registerTemplateField,
  type ForgeBlock,
  type ForgeField,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import type { ForgeLayoutDocument } from './forgeTemplate.ts';

/** Atlas stores Metric fields as an unrestricted FieldKey array; Forge intentionally adds no slot cap. */
export const METRIC_COMPATIBLE_FIELD_TYPES = ['text', 'number', 'rating', 'dice', 'choice'] as const;

export type MetricFlag = 'rollable';

export type MetricNumberLook = 'number' | 'boxes' | 'gauge';

interface MetricBlockLocation {
  siblings: ForgeBlock[];
  index: number;
  block: ForgeBlock;
  parent: ForgeBlock | null;
}

function locateMetricBlock(blocks: ForgeBlock[], id: string, parent: ForgeBlock | null = null): MetricBlockLocation | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) continue;
    if (block.id === id) return { siblings: blocks, index, block, parent };
    if (Array.isArray(block.blocks)) {
      const found = locateMetricBlock(block.blocks as ForgeBlock[], id, block);
      if (found) return found;
    }
  }
  return null;
}

function findBlock(blocks: ForgeBlock[], id: string): ForgeBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    if (Array.isArray(block.blocks)) {
      const found = findBlock(block.blocks.filter(isRecord) as ForgeBlock[], id);
      if (found) return found;
    }
  }
  return null;
}

export function findMetricBlock(template: ForgeTemplate, blockId: string): ForgeBlock | null {
  const block = findBlock(template.layout.blocks, blockId);
  return block?.type === 'metric' ? block : null;
}

function metricSlots(block: ForgeBlock): string[] {
  const raw: unknown[] = Array.isArray(block.fields) ? block.fields : [];
  if (!Array.isArray(block.fields)) block.fields = [];
  return raw.filter((key): key is string => typeof key === 'string');
}

function metricFormulas(block: ForgeBlock): string[] {
  return Array.isArray(block.formulas)
    ? block.formulas.map((value) => typeof value === 'string' ? value : '')
    : [];
}

function metricFormulaLabels(block: ForgeBlock): string[] {
  return Array.isArray(block.formulaLabels)
    ? block.formulaLabels.map((value) => typeof value === 'string' ? value : '')
    : [];
}

function writeMetricStringArray(block: ForgeBlock, property: 'formulas' | 'formulaLabels', values: string[]): void {
  const normalized = values.map((value) => value.trim());
  if (normalized.every((value) => value === '')) delete block[property];
  else block[property] = normalized;
}

/** The expression assigned to one slot, if it is a formula slot. */
export function metricSlotFormula(block: ForgeBlock, slotIndex: number): string {
  return metricFormulas(block)[slotIndex] ?? '';
}

/** The custom label for a formula slot. Bound Fields continue to use their own Field label. */
export function metricSlotFormulaLabel(block: ForgeBlock, slotIndex: number): string {
  return metricFormulaLabels(block)[slotIndex] ?? '';
}

function compatibleField(field: ForgeField): boolean {
  return (METRIC_COMPATIBLE_FIELD_TYPES as readonly string[]).includes(field.type);
}

export function metricAvailableFields(
  template: ForgeTemplate,
  blockId: string,
  slotIndex: number,
): ForgeField[] {
  const block = findMetricBlock(template, blockId);
  if (!block || slotIndex < 0 || slotIndex >= metricSlots(block).length) return [];
  const used = new Set(metricSlots(block).filter((_key, index) => index !== slotIndex));
  return template.fields.filter((field) => compatibleField(field) && !used.has(field.key));
}

/** Add an empty Metric slot. The native Atlas format does not impose a slot limit. */
export function addMetricSlot(template: ForgeTemplate, blockId: string): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block) return false;
  const slots = metricSlots(block);
  block.fields = [...slots, ''];
  return true;
}

/** Remove only the slot reference; the field definition and its data remain intact. */
export function removeMetricSlot(template: ForgeTemplate, blockId: string, slotIndex: number): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block) return false;
  const slots = metricSlots(block);
  if (slotIndex < 0 || slotIndex >= slots.length) return false;
  block.fields = slots.filter((_key, index) => index !== slotIndex);
  for (const property of ['formulas', 'formulaLabels'] as const) {
    const values = property === 'formulas' ? metricFormulas(block) : metricFormulaLabels(block);
    if (values.length > 0) writeMetricStringArray(block, property, values.filter((_value, index) => index !== slotIndex));
  }
  return true;
}

/** Bind a compatible scalar field to one slot. A field cannot occupy two slots in the same Metric. */
export function setMetricSlotField(
  template: ForgeTemplate,
  blockId: string,
  slotIndex: number,
  fieldKey: string | null,
): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block) return false;
  const slots = metricSlots(block);
  if (slotIndex < 0 || slotIndex >= slots.length) return false;
  const normalizedKey = fieldKey?.trim() ?? '';
  if (normalizedKey) {
    const field = template.fields.find((item) => item.key === normalizedKey);
    if (!field || !compatibleField(field)) return false;
    if (slots.some((key, index) => index !== slotIndex && key === normalizedKey)) return false;
  }
  if (slots[slotIndex] === normalizedKey) return false;
  const next = [...slots];
  next[slotIndex] = normalizedKey;
  block.fields = next;
  if (normalizedKey) {
    const formulas = metricFormulas(block);
    if (formulas.length > 0) {
      formulas[slotIndex] = '';
      writeMetricStringArray(block, 'formulas', formulas);
    }
    const labels = metricFormulaLabels(block);
    if (labels.length > 0) {
      labels[slotIndex] = '';
      writeMetricStringArray(block, 'formulaLabels', labels);
    }
  }
  return true;
}

/** Name an empty slot by creating a Number field, or rename its already-bound field. */
export function nameMetricSlot(
  template: ForgeTemplate,
  blockId: string,
  slotIndex: number,
  label: string,
): string | null {
  const cleanLabel = label.trim();
  const block = findMetricBlock(template, blockId);
  if (!block || !cleanLabel) return null;
  const slots = metricSlots(block);
  if (slotIndex < 0 || slotIndex >= slots.length) return null;
  const currentKey = slots[slotIndex] ?? '';
  const currentFormula = metricSlotFormula(block, slotIndex);
  if (currentFormula) {
    setMetricSlotFormulaLabel(template, blockId, slotIndex, cleanLabel);
    return '';
  }
  const currentField = currentKey ? template.fields.find((field) => field.key === currentKey) : undefined;
  if (currentField && compatibleField(currentField)) {
    if (currentField.label === cleanLabel) return currentField.key;
    currentField.label = cleanLabel;
    return currentField.key;
  }
  const field = registerTemplateField(template, cleanLabel, 'number');
  const next = [...slots];
  next[slotIndex] = field.key;
  block.fields = next;
  return field.key;
}

/** Set the display label used by a formula-backed Metric slot. */
export function setMetricSlotFormulaLabel(
  template: ForgeTemplate,
  blockId: string,
  slotIndex: number,
  label: string,
): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block) return false;
  const slots = metricSlots(block);
  if (slotIndex < 0 || slotIndex >= slots.length) return false;
  const cleanLabel = label.trim().slice(0, 100);
  const labels = metricFormulaLabels(block);
  while (labels.length < slots.length) labels.push('');
  if ((labels[slotIndex] ?? '') === cleanLabel) return false;
  labels[slotIndex] = cleanLabel;
  writeMetricStringArray(block, 'formulaLabels', labels);
  return true;
}

/** Store a safe arithmetic expression in place of a bound Field for one Metric slot. */
export function setMetricSlotFormula(
  template: ForgeTemplate,
  blockId: string,
  slotIndex: number,
  formula: string,
): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block) return false;
  const slots = metricSlots(block);
  if (slotIndex < 0 || slotIndex >= slots.length) return false;
  const cleanFormula = formula.trim();
  if (cleanFormula.length > 500) return false;
  const formulas = metricFormulas(block);
  while (formulas.length < slots.length) formulas.push('');
  if ((formulas[slotIndex] ?? '') === cleanFormula && (!cleanFormula || slots[slotIndex] === '')) return false;
  formulas[slotIndex] = cleanFormula;
  if (cleanFormula) {
    const next = [...slots];
    next[slotIndex] = '';
    block.fields = next;
  }
  writeMetricStringArray(block, 'formulas', formulas);
  return true;
}

export function setMetricHeading(template: ForgeTemplate, blockId: string, heading: string): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block) return false;
  const cleanHeading = heading.trim();
  if ((typeof block.heading === 'string' ? block.heading : '') === cleanHeading) return false;
  if (cleanHeading) block.heading = cleanHeading;
  else delete block.heading;
  return true;
}

export function setMetricFlag(
  template: ForgeTemplate,
  blockId: string,
  flag: MetricFlag,
  enabled: boolean,
): boolean {
  const block = findMetricBlock(template, blockId);
  if (!block || Boolean(block[flag]) === enabled) return false;
  if (enabled) block[flag] = true;
  else delete block[flag];
  return true;
}

/**
 * Shows one of a Metric's Number fields as an Atlas Track tile. If it is the
 * only number, the Metric is replaced in place and keeps its block ID. If the
 * Metric has other numbers, only this field leaves the Metric and the new
 * Track is placed after the Metric (or after its containing Row).
 */
export function setMetricNumberLook(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
  fieldKey: string,
  look: Exclude<MetricNumberLook, 'number'>,
): boolean {
  const location = locateMetricBlock(template.layout.blocks, blockId);
  const block = location?.block;
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'number');
  if (!location || !block || block.type !== 'metric' || !field) return false;

  const originalSlots = metricSlots(block);
  const removedIndexes = originalSlots.flatMap((key, index) => key === fieldKey ? [index] : []);
  if (removedIndexes.length === 0) return false;
  const remainingIndexes = originalSlots.flatMap((key, index) => key !== fieldKey ? [index] : []);

  const existingTracks = isRecord(field.tracks) ? field.tracks : {};
  const counts = existingTracks.counts === 'up' || existingTracks.counts === 'down'
    ? existingTracks.counts : 'down';
  field.tracks = { ...existingTracks, counts };

  const newTrack: ForgeBlock = remainingIndexes.length === 0
    ? { id: block.id, type: 'track', field: fieldKey, look, counts }
    : { ...createBlock('track', template, fieldKey), look, counts };

  if (remainingIndexes.length === 0) {
    location.siblings[location.index] = newTrack;
    const metadata = layout.blocks[block.id];
    if (metadata) delete metadata.metricSlotsPerRow;
    return true;
  }

  block.fields = remainingIndexes.map((index) => originalSlots[index] ?? '');
  for (const property of ['formulas', 'formulaLabels'] as const) {
    const values = property === 'formulas' ? metricFormulas(block) : metricFormulaLabels(block);
    if (values.length === 0) continue;
    writeMetricStringArray(block, property, remainingIndexes.map((index) => values[index] ?? ''));
  }

  // Atlas moves a Metric number out of its Row rather than inserting a third
  // peer into the same horizontal group. Preserve that rule at any nesting depth.
  let targetSiblings = location.siblings;
  let targetIndex = location.index + 1;
  if (location.parent?.type === 'row') {
    const rowLocation = locateMetricBlock(template.layout.blocks, location.parent.id);
    if (!rowLocation) return false;
    targetSiblings = rowLocation.siblings;
    targetIndex = rowLocation.index + 1;
  }
  targetSiblings.splice(targetIndex, 0, newTrack);
  layout.blocks[newTrack.id] = {
    span: 12,
    rows: 1,
    appearance: {},
    appearanceMode: 'theme',
  };
  return true;
}

/** Default user-selected Metric line width when no sidecar preference exists. */
export const DEFAULT_METRIC_SLOTS_PER_ROW = 6;

/** Set the maximum number of Metric items rendered on each line (1–12). */
export function setMetricSlotsPerRow(
  layout: ForgeLayoutDocument,
  blockId: string,
  value: number,
): boolean {
  const metadata = layout.blocks[blockId];
  if (!metadata) return false;
  const normalized = Math.max(1, Math.min(12, Math.trunc(Number.isFinite(value) ? value : DEFAULT_METRIC_SLOTS_PER_ROW)));
  if (metadata.metricSlotsPerRow === normalized) return false;
  metadata.metricSlotsPerRow = normalized;
  return true;
}

/**
 * Splits slots sequentially into rows of at most `slotsPerRow`.
 * No balancing or redistribution is performed: the user controls the row width.
 */
export function metricPreviewRows(slotCount: number, slotsPerRow = DEFAULT_METRIC_SLOTS_PER_ROW): number[] {
  const count = Math.max(0, Math.trunc(Number.isFinite(slotCount) ? slotCount : 0));
  if (count === 0) return [];
  const perRow = Number.isSafeInteger(slotsPerRow) && slotsPerRow > 0
    ? slotsPerRow : DEFAULT_METRIC_SLOTS_PER_ROW;
  const rows: number[] = [];
  for (let remaining = count; remaining > 0; remaining -= perRow) rows.push(Math.min(remaining, perRow));
  return rows;
}

/** Number of columns in the widest preview row. */
export function metricPreviewColumns(slotCount: number, slotsPerRow = DEFAULT_METRIC_SLOTS_PER_ROW): number {
  return Math.max(1, ...metricPreviewRows(slotCount, slotsPerRow));
}
