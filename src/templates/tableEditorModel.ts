import { isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate } from './forgeTemplate.ts';
import { scorePreviewGrid } from '../render/previewValueModel.ts';


export interface ScoresFieldKeyValidationIssue {
  fieldKey: string;
  code: 'duplicate-slot-key' | 'invalid-slot-key' | 'missing-slot-key';
  message: string;
}

/** Check stable per-column identifiers without rewriting legacy table data. */
export function validateScoresFieldSlotKeys(fields: readonly ForgeField[]): ScoresFieldKeyValidationIssue[] {
  const issues: ScoresFieldKeyValidationIssue[] = [];
  for (const field of fields) {
    if (field.type !== 'scores') continue;
    if (!Array.isArray(field.slotKeys)) continue;
    const columnCount = Array.isArray(field.slots) ? field.slots.length : field.slotKeys.length;
    if (field.slotKeys.length < columnCount) {
      for (let index = field.slotKeys.length; index < columnCount; index += 1) {
        issues.push({ fieldKey: field.key, code: 'missing-slot-key', message: `A coluna ${index + 1} da tabela "${field.label}" não possui uma slotKey definida.` });
      }
    }
    const seen = new Set<string>();
    field.slotKeys.forEach((raw, index) => {
      if (typeof raw !== 'string' || !/^[a-z][a-z0-9_-]{0,39}$/i.test(raw.trim())) {
        issues.push({ fieldKey: field.key, code: 'invalid-slot-key', message: `A coluna ${index + 1} da tabela "${field.label}" não possui uma slotKey válida.` });
        return;
      }
      const key = raw.trim().toLowerCase();
      if (seen.has(key)) {
        issues.push({ fieldKey: field.key, code: 'duplicate-slot-key', message: `A slotKey "${raw}" aparece mais de uma vez na tabela "${field.label}".` });
      }
      seen.add(key);
    });
  }
  return issues;
}

/** Explicitly repairs one ambiguous/invalid column identifier after user confirmation. */
export function setScoresFieldSlotKey(
  template: ForgeTemplate,
  fieldKey: string,
  columnIndex: number,
  nextKeyValue: string,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'scores');
  if (!field) return false;
  const nextKey = nextKeyValue.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,39}$/.test(nextKey)) {
    throw new Error('Use uma slotKey iniciada por letra, com até 40 caracteres e apenas letras, números, _ ou -.');
  }
  const sample = isRecord(template.sample) ? template.sample : {};
  const grid = scorePreviewGrid(sample[field.key], field);
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= grid.columns.length) return false;
  const oldKeys = Array.isArray(field.slotKeys)
    ? field.slotKeys.map((value) => typeof value === 'string' ? value : '')
    : grid.columns.map((_value, index) => `slot_${index + 1}`);
  while (oldKeys.length < grid.columns.length) oldKeys.push(`slot_${oldKeys.length + 1}`);
  const currentKey = oldKeys[columnIndex] ?? '';
  if (currentKey.toLowerCase() === nextKey) return false;
  if (oldKeys.some((key, index) => index !== columnIndex && key.trim().toLowerCase() === nextKey)) {
    throw new Error(`A slotKey "${nextKey}" já está sendo usada por outra coluna desta tabela.`);
  }
  // When a sample is object-backed, duplicate source keys are ambiguous. Copy
  // the previous value to the newly named column instead of deleting/reassigning
  // the original property; this preserves the visible value on both columns.
  const rawSample = sample[field.key];
  if (isRecord(rawSample) && !Array.isArray(rawSample.rows) && currentKey && Object.prototype.hasOwnProperty.call(rawSample, currentKey)) {
    template.sample = { ...sample, [field.key]: { ...rawSample, [nextKey]: rawSample[currentKey] } };
  }
  oldKeys[columnIndex] = nextKey;
  field.slotKeys = oldKeys;
  return true;
}

export type ScoreTableEdit =
  | { type: 'set-column'; index: number; value: string }
  | { type: 'add-column' }
  | { type: 'remove-column'; index: number }
  | { type: 'move-column'; index: number; direction: -1 | 1 }
  | { type: 'set-cell'; row: number; column: number; value: string }
  | { type: 'add-row' }
  | { type: 'remove-row'; index: number }
  | { type: 'move-row'; index: number; direction: -1 | 1 };

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

function boundField(template: ForgeTemplate, block: ForgeBlock): ForgeField | null {
  if (typeof block.field !== 'string') return null;
  return template.fields.find((field) => field.key === block.field && field.type === 'scores') ?? null;
}

function currentGrid(template: ForgeTemplate, block: ForgeBlock, field: ForgeField) {
  const sample = isRecord(template.sample) ? template.sample : {};
  return scorePreviewGrid(sample[field.key], field);
}

/** Generate neutral, stable table identifiers instead of deriving data keys from display labels. */
function uniqueSlotKey(existingKeys: string[], index: number): string {
  const base = `slot_${index + 1}`;
  const used = new Set(existingKeys.map((key) => key.toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  let suffix = 2;
  while (used.has(`${base}_${suffix}`.toLowerCase())) suffix += 1;
  return `${base}_${suffix}`;
}

function columnKeys(field: ForgeField, columns: string[]): string[] {
  const oldKeys = Array.isArray(field.slotKeys) ? field.slotKeys.filter((value): value is string => typeof value === 'string') : [];
  const keys: string[] = [];
  return columns.map((_label, index) => {
    const previous = oldKeys[index];
    if (previous && !keys.some((key) => key.toLowerCase() === previous.toLowerCase())) {
      keys.push(previous);
      return previous;
    }
    const next = uniqueSlotKey([...oldKeys, ...keys], index);
    keys.push(next);
    return next;
  });
}

function updateFieldColumnMetadata(
  field: ForgeField,
  columns: string[],
  keys: string[],
  alignments?: unknown[],
): void {
  field.slots = [...columns];
  field.slotKeys = [...keys];
  if (alignments) {
    if (alignments.some((value) => value !== undefined && value !== null)) field.align = [...alignments];
    else delete field.align;
  }
}

function editableRows(template: ForgeTemplate, block: ForgeBlock, field: ForgeField): Array<Array<string | number | null>> {
  const grid = currentGrid(template, block, field);
  return grid.rows.map((row) => row.map((cell) => {
    if (cell === undefined || cell === null || cell === '') return '';
    if (typeof cell === 'string' || typeof cell === 'number') return cell;
    return JSON.stringify(cell);
  }));
}

function writeRows(template: ForgeTemplate, field: ForgeField, rows: Array<Array<string | number | null>>): void {
  const sample = isRecord(template.sample) ? template.sample : {};
  const source = sample[field.key];
  if (isRecord(source) && Array.isArray(source.rows)) {
    template.sample = { ...sample, [field.key]: { ...source, rows } };
    return;
  }
  const hasSampleValue = source !== undefined && source !== null && source !== ''
    && !(Array.isArray(source) && source.length === 0);
  if (hasSampleValue) template.sample = { ...sample, [field.key]: rows };
  else field.rows = rows;
}

function writeColumns(
  template: ForgeTemplate,
  field: ForgeField,
  columns: string[],
  keys: string[],
  alignments?: unknown[],
): void {
  const sample = isRecord(template.sample) ? template.sample : {};
  const source = sample[field.key];
  if (isRecord(source) && Array.isArray(source.rows) && Array.isArray(source.columns)) {
    // An explicit sample table owns its own display columns; keep the field defaults intact.
    template.sample = { ...sample, [field.key]: { ...source, columns: [...columns] } };
    return;
  }
  updateFieldColumnMetadata(field, columns, keys, alignments);
}

function cellValue(next: string, previous: unknown): string | number | null {
  if (next === '') return null;
  if (typeof previous === 'number') {
    const parsed = Number(next);
    return Number.isFinite(parsed) ? parsed : next;
  }
  return next;
}

/** Applies a table-canvas edit while preserving native Atlas field/block properties. */
export function editScoresTable(template: ForgeTemplate, blockId: string, edit: ScoreTableEdit): boolean {
  const block = findScoresBlock(template, blockId);
  if (!block) return false;
  const field = boundField(template, block);
  if (!field) return false;
  const grid = currentGrid(template, block, field);
  const columns = [...grid.columns];
  const rows = editableRows(template, block, field);

  switch (edit.type) {
    case 'set-column': {
      if (edit.index < 0 || edit.index >= columns.length || columns[edit.index] === edit.value) return false;
      columns[edit.index] = edit.value;
      const oldKeys = columnKeys(field, grid.columns);
      const oldAlign = Array.isArray(field.align) ? [...field.align] : undefined;
      writeColumns(template, field, columns, oldKeys, oldAlign);
      return true;
    }
    case 'add-column': {
      const nextColumns = [...columns, `Column ${columns.length + 1}`];
      const existingKeys = columnKeys(field, columns);
      const nextKeys = [...existingKeys, uniqueSlotKey(existingKeys, nextColumns.length - 1)];
      const nextAlign = Array.isArray(field.align) ? [...field.align, null] : undefined;
      writeColumns(template, field, nextColumns, nextKeys, nextAlign);
      const nextRows = rows.length ? rows.map((row) => [...row, '']) : [nextColumns.map(() => '')];
      writeRows(template, field, nextRows);
      return true;
    }
    case 'remove-column': {
      if (columns.length <= 1 || edit.index < 0 || edit.index >= columns.length) return false;
      const nextColumns = columns.filter((_value, index) => index !== edit.index);
      const nextKeys = columnKeys(field, columns).filter((_value, index) => index !== edit.index);
      const nextAlign = Array.isArray(field.align) ? field.align.filter((_value, index) => index !== edit.index) : undefined;
      writeColumns(template, field, nextColumns, nextKeys, nextAlign);
      writeRows(template, field, rows.map((row) => row.filter((_value, index) => index !== edit.index)));
      return true;
    }
    case 'move-column': {
      const target = edit.index + edit.direction;
      if (edit.index < 0 || edit.index >= columns.length || target < 0 || target >= columns.length) return false;
      const move = <T,>(items: T[]): T[] => {
        const next = [...items];
        const [item] = next.splice(edit.index, 1);
        next.splice(target, 0, item as T);
        return next;
      };
      const nextKeys = move(columnKeys(field, columns));
      const nextAlign = Array.isArray(field.align) ? move([...field.align]) : undefined;
      writeColumns(template, field, move(columns), nextKeys, nextAlign);
      writeRows(template, field, rows.map((row) => move(row)));
      const sample = isRecord(template.sample) ? template.sample : {};
      const rawSample = sample[field.key];
      if (isRecord(rawSample) && Array.isArray(rawSample.rows)) {
        template.sample = { ...sample, [field.key]: { ...rawSample, rows: rows.map((row) => move(row)) } };
      }
      return true;
    }
    case 'set-cell': {
      if (edit.row < 0 || edit.row >= rows.length || edit.column < 0 || edit.column >= columns.length) return false;
      const previous = rows[edit.row]?.[edit.column];
      if (String(previous ?? '') === edit.value) return false;
      const nextRows = rows.map((row, rowIndex) => rowIndex === edit.row
        ? row.map((cell, columnIndex) => columnIndex === edit.column ? cellValue(edit.value, cell) : cell)
        : [...row]);
      writeRows(template, field, nextRows);
      return true;
    }
    case 'add-row': {
      writeRows(template, field, [...rows, columns.map(() => '')]);
      return true;
    }
    case 'remove-row': {
      if (rows.length <= 1 || edit.index < 0 || edit.index >= rows.length) return false;
      writeRows(template, field, rows.filter((_value, index) => index !== edit.index));
      return true;
    }
    case 'move-row': {
      const target = edit.index + edit.direction;
      if (edit.index < 0 || edit.index >= rows.length || target < 0 || target >= rows.length) return false;
      const nextRows = [...rows];
      const [row] = nextRows.splice(edit.index, 1);
      nextRows.splice(target, 0, row as Array<string | number | null>);
      writeRows(template, field, nextRows);
      return true;
    }
  }
}


/** Update the native Atlas Scores column schema from the Field Properties panel.
 * sourceIndexes preserves the cells, stable slot keys and alignments when a
 * column is removed or moved. A null source index represents a new column.
 */
export function setScoresFieldColumns(
  template: ForgeTemplate,
  fieldKey: string,
  nextColumns: string[],
  sourceIndexes?: Array<number | null>,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'scores');
  if (!field) return false;
  const columns = nextColumns.slice(0, 12).map((value) => String(value));
  if (columns.length === 0) return false;

  const sample = isRecord(template.sample) ? template.sample : {};
  const rawSample = sample[field.key];
  const grid = scorePreviewGrid(rawSample, field);
  const oldColumns = [...grid.columns];
  const indexes = sourceIndexes && sourceIndexes.length === columns.length
    ? sourceIndexes
    : columns.map((_column, index) => index);
  const oldKeys = Array.isArray(field.slotKeys)
    ? field.slotKeys.filter((value): value is string => typeof value === 'string')
    : oldColumns.map((_column, index) => `slot_${index + 1}`);
  const oldAlign = Array.isArray(field.align) ? [...field.align] : [];

  const nextKeys: string[] = [];
  const nextAlign: unknown[] = [];
  const usedKeys = new Set<string>();
  for (let index = 0; index < columns.length; index += 1) {
    const sourceIndex = indexes[index];
    let key = sourceIndex !== null && sourceIndex !== undefined ? oldKeys[sourceIndex] : undefined;
    if (!key || usedKeys.has(key.toLowerCase())) {
      const base = `slot_${index + 1}`;
      key = base;
      let suffix = 2;
      while (usedKeys.has(key.toLowerCase()) || oldKeys.some((old) => old.toLowerCase() === key!.toLowerCase())) {
        key = `${base}_${suffix}`;
        suffix += 1;
      }
    }
    usedKeys.add(key.toLowerCase());
    nextKeys.push(key);
    nextAlign.push(sourceIndex !== null && sourceIndex !== undefined ? oldAlign[sourceIndex] : undefined);
  }

  const nextRows = grid.rows.map((row) => columns.map((_column, index) => {
    const sourceIndex = indexes[index];
    return sourceIndex === null || sourceIndex === undefined ? '' : (row[sourceIndex] ?? '');
  }));

  field.slots = [...columns];
  field.slotKeys = nextKeys;
  if (nextAlign.some((value) => value === 'center' || value === 'end')) field.align = nextAlign;
  else delete field.align;
  field.rows = nextRows;

  // If the sample uses Atlas' explicit { columns, rows } table form, keep that
  // form authoritative and synchronized with the Field's default schema.
  if (isRecord(rawSample) && Array.isArray(rawSample.rows)) {
    template.sample = {
      ...sample,
      [field.key]: { ...rawSample, columns: [...columns], rows: nextRows },
    };
  } else if (Array.isArray(rawSample)) {
    template.sample = { ...sample, [field.key]: nextRows };
  }
  return true;
}

/** Sets the native Atlas per-column alignment: start, center or end. */
export function setScoresFieldAlignment(
  template: ForgeTemplate,
  fieldKey: string,
  columnIndex: number,
  alignment: 'start' | 'center' | 'end',
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'scores');
  if (!field) return false;
  const sample = isRecord(template.sample) ? template.sample : {};
  const columns = scorePreviewGrid(sample[field.key], field).columns;
  if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= columns.length) return false;
  const align = Array.isArray(field.align) ? [...field.align] : [];
  while (align.length < columns.length) align.push('start');
  if (align[columnIndex] === alignment) return false;
  align[columnIndex] = alignment;
  if (align.every((value) => value === 'start' || value === undefined || value === null)) delete field.align;
  else field.align = align;
  return true;
}

/** Sets a native Atlas TableOptions boolean on a Scores Field. */
export function setScoresFieldProperty(
  template: ForgeTemplate,
  fieldKey: string,
  option: 'header' | 'addRows' | 'addColumns',
  enabled: boolean,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'scores');
  if (!field) return false;
  const previous = field[option] !== false;
  if (previous === enabled) return false;
  if (enabled) delete field[option];
  else field[option] = false;
  return true;
}

export function setScoresFieldOption(
  template: ForgeTemplate,
  blockId: string,
  option: 'label' | 'header' | 'addRows' | 'addColumns',
  value: string | boolean,
): boolean {
  const block = findScoresBlock(template, blockId);
  const field = block ? boundField(template, block) : null;
  if (!field) return false;
  if (option === 'label') {
    const clean = String(value).trim();
    if (!clean || field.label === clean) return false;
    field.label = clean;
    return true;
  }
  const normalized = Boolean(value);
  const stored = normalized ? undefined : false;
  if (option === 'header') {
    if ((field.header !== false) === normalized) return false;
    if (stored === undefined) delete field.header;
    else field.header = stored;
  } else if (option === 'addRows') {
    if ((field.addRows !== false) === normalized) return false;
    if (stored === undefined) delete field.addRows;
    else field.addRows = stored;
  } else {
    if ((field.addColumns !== false) === normalized) return false;
    if (stored === undefined) delete field.addColumns;
    else field.addColumns = stored;
  }
  return true;
}

export function setScoresBlockOption(
  template: ForgeTemplate,
  blockId: string,
  option: 'display' | 'orientation' | 'perLine' | 'rollable',
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
  if (option === 'orientation') {
    const next = value === 'table' ? 'table' : 'row';
    if (block.orientation === next) return false;
    block.orientation = next;
    return true;
  }
  if (option === 'perLine') {
    const next = Math.max(1, Math.trunc(Number(value) || 1));
    if (block.perLine === next) return false;
    block.perLine = next;
    return true;
  }
  const next = value === true;
  if (Boolean(block.rollable) === next) return false;
  if (next) block.rollable = true;
  else delete block.rollable;
  return true;
}

export interface ScoreDerivedColumn {
  label?: string;
  field?: string;
  formula?: string;
  display?: 'plain' | 'signed';
}

export function setScoreDerivedColumns(template: ForgeTemplate, blockId: string, columns: ScoreDerivedColumn[]): boolean {
  const block = findScoresBlock(template, blockId);
  if (!block || block.type !== 'scores') return false;
  if (JSON.stringify(block.columns ?? []) === JSON.stringify(columns)) return false;
  if (columns.length) block.columns = columns;
  else delete block.columns;
  return true;
}
