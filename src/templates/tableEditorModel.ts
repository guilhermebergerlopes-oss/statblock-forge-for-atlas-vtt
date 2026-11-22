import { isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate } from './forgeTemplate.ts';
import { readForgeTableRows, updateForgeTableRows, type ForgeTableRowsEdit } from '../statblocks/tableRowsModel.ts';

export type ScoreTableEdit = { type: 'set-slot-value'; fieldKey: string; value: unknown } | ForgeTableRowsEdit;

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

export function findScoresBlock(template: ForgeTemplate, blockId: string): ForgeBlock | null {
  const block = findBlock(template.layout.blocks, blockId);
  return block?.type === 'scores' ? block : null;
}

function editSlotSample(template: ForgeTemplate, block: ForgeBlock, edit: Extract<ScoreTableEdit, { type: 'set-slot-value' }>): boolean {
  const field = template.fields.find((item) => item.key === edit.fieldKey && item.type !== 'pairs' && item.type !== 'scores');
  const linked = Array.isArray(block.fields) && block.fields.includes(edit.fieldKey);
  if (!field || !linked) return false;
  const sample = isRecord(template.sample) ? template.sample : {};
  const previous = sample[field.key];
  let next: unknown = edit.value;
  if ((field.type === 'number' || field.type === 'rating')
    && typeof edit.value === 'string' && edit.value.trim() !== '') {
    const parsed = Number(edit.value);
    if (Number.isFinite(parsed)) next = parsed;
  }
  if (JSON.stringify(previous) === JSON.stringify(next)) return false;
  template.sample = { ...sample, [field.key]: next };
  return true;
}

/** Applies an edit to a Field assigned to a Table or to its additional rows. */
export function editScoresTable(template: ForgeTemplate, blockId: string, edit: ScoreTableEdit): boolean {
  const block = findScoresBlock(template, blockId);
  if (!block) return false;
  if (edit.type === 'set-slot-value') return editSlotSample(template, block, edit);
  const storageKey = typeof block.field === 'string' ? block.field : '';
  const storageField = template.fields.find((field) => field.key === storageKey && field.type === 'scores');
  if (!storageField) return false;
  // This model is used by the Template Builder. Row creation/deletion there is
  // always available; `allowRowAdd` is a separate permission that controls
  // inline editing in saved statblocks, not authoring of the Template sample.
  if (edit.type === 'remove-row' && (!Number.isInteger(edit.row) || edit.row < 1)) return false;
  const sample = isRecord(template.sample) ? template.sample : {};
  const previous = sample[storageKey];
  if (edit.type === 'remove-row' && edit.row > readForgeTableRows(previous).extraRows.length) return false;
  if (edit.type === 'set-row-cell') {
    const field = template.fields.find((item) => item.key === edit.fieldKey && item.type !== 'pairs' && item.type !== 'scores');
    if (!field || !Array.isArray(block.fields) || !block.fields.includes(edit.fieldKey)) return false;
  }
  if (edit.type === 'set-row-label' && block.showRowLabels !== true) return false;
  let normalizedEdit = edit;
  if (edit.type === 'set-row-cell') {
    const field = template.fields.find((item) => item.key === edit.fieldKey);
    if (field && (field.type === 'number' || field.type === 'rating')
      && typeof edit.value === 'string' && edit.value.trim() !== '') {
      const parsed = Number(edit.value);
      if (Number.isFinite(parsed)) normalizedEdit = { ...edit, value: parsed };
    }
  }
  const next = updateForgeTableRows(previous, normalizedEdit);
  if (JSON.stringify(previous) === JSON.stringify(next)) return false;
  template.sample = { ...sample, [storageKey]: next };
  return true;
}

export function setScoresBlockOption(
  template: ForgeTemplate,
  blockId: string,
  option: 'display' | 'rollable' | 'showColumnLabels' | 'showRowLabels' | 'allowRowAdd',
  value: string | number | boolean | null,
): boolean {
  const block = findScoresBlock(template, blockId);
  if (!block) return false;
  if (option === 'display') {
    const next = value === 'signed' ? 'signed' : undefined;
    if (block.display === next) return false;
    if (next) block.display = next;
    else delete block.display;
    return true;
  }
  const enabled = value === true;
  if (option === 'showColumnLabels') {
    const current = block.showColumnLabels !== false;
    if (current === enabled) return false;
    if (enabled) delete block.showColumnLabels;
    else block.showColumnLabels = false;
    return true;
  }
  const property = option === 'showRowLabels' ? 'showRowLabels' : option === 'allowRowAdd' ? 'allowRowAdd' : 'rollable';
  if (Boolean(block[property]) === enabled) return false;
  if (enabled) block[property] = true;
  else delete block[property];
  return true;
}

/** Backward-compatible setter; row Labels now mean labels for data rows, not Field orientation. */
export function setScoresLabelsInRows(template: ForgeTemplate, blockId: string, enabled: boolean): boolean {
  return setScoresBlockOption(template, blockId, 'showRowLabels', enabled);
}
