import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORGE_TABLE_MAX_ROWS,
  forgeTableCellValue,
  forgeTableRowLabel,
  isForgeTableRowDeletable,
  readForgeTableRows,
  updateForgeTableRows,
} from '../src/statblocks/tableRowsModel.ts';

test('Table row model starts with one implicit row and preserves legacy Scores storage', () => {
  const initial = readForgeTableRows([[10, 20]]);
  assert.equal(initial.extraRows.length, 0);
  assert.deepEqual(initial.legacyValue, [[10, 20]]);
  assert.equal(forgeTableRowLabel(initial, 0), '');
});

test('Table row model adds rows, stores labels and Field-keyed cell values', () => {
  let data = updateForgeTableRows(undefined, { type: 'add-row' });
  data = updateForgeTableRows(data, { type: 'set-row-label', row: 1, value: 'Mithril' });
  data = updateForgeTableRows(data, { type: 'set-row-cell', row: 1, fieldKey: 'defense', value: 17 });
  assert.equal(data.extraRows.length, 1);
  assert.equal(forgeTableRowLabel(data, 1), 'Mithril');
  assert.equal(forgeTableCellValue(data, 1, 'defense'), 17);
});

test('Table row model rejects invalid row indexes and respects the row limit', () => {
  let data = readForgeTableRows(undefined);
  assert.deepEqual(updateForgeTableRows(data, { type: 'set-row-cell', row: 0, fieldKey: 'hp', value: 3 }), data);
  assert.deepEqual(updateForgeTableRows(data, { type: 'set-row-label', row: FORGE_TABLE_MAX_ROWS, value: 'Invalid' }), data);
  for (let index = 0; index < FORGE_TABLE_MAX_ROWS; index += 1) {
    const next = updateForgeTableRows(data, { type: 'add-row' });
    if (next === data) break;
    data = next;
  }
  assert.equal(data.extraRows.length + 1, FORGE_TABLE_MAX_ROWS);
  assert.equal(updateForgeTableRows(data, { type: 'add-row' }).extraRows.length + 1, FORGE_TABLE_MAX_ROWS);
});

test('Table materializes implicit Counter rows when ordinary cells or row labels are edited', () => {
  let data = readForgeTableRows(undefined);
  data = updateForgeTableRows(data, { type: 'set-row-cell', row: 2, fieldKey: 'armor', value: 17 });
  assert.equal(data.extraRows.length, 2);
  assert.equal(forgeTableCellValue(data, 2, 'armor'), 17);
  data = updateForgeTableRows(data, { type: 'set-row-label', row: 3, value: 'Heavy' });
  assert.equal(data.extraRows.length, 3);
  assert.equal(forgeTableRowLabel(data, 3), 'Heavy');
});


test('Table row model removes only the requested manually-added row and shifts later rows', () => {
  let data = updateForgeTableRows(undefined, { type: 'add-row' });
  data = updateForgeTableRows(data, { type: 'set-row-cell', row: 1, fieldKey: 'armor', value: 12 });
  data = updateForgeTableRows(data, { type: 'add-row' });
  data = updateForgeTableRows(data, { type: 'set-row-cell', row: 2, fieldKey: 'armor', value: 18 });
  data = updateForgeTableRows(data, { type: 'remove-row', row: 1 });
  assert.equal(data.extraRows.length, 1);
  assert.equal(forgeTableCellValue(data, 1, 'armor'), 18);
  assert.deepEqual(updateForgeTableRows(data, { type: 'remove-row', row: 0 }), data);
  assert.deepEqual(updateForgeTableRows(data, { type: 'remove-row', row: 2 }), data);
});

test('Table can append a manual row after rows supplied implicitly by Counters', () => {
  let data = updateForgeTableRows(undefined, { type: 'add-row', row: 3 });
  assert.equal(data.extraRows.length, 3);
  data = updateForgeTableRows(data, { type: 'remove-row', row: 3 });
  assert.equal(data.extraRows.length, 2);
});


test('Table deletion includes the first manual row after Counter-provided rows', () => {
  assert.equal(isForgeTableRowDeletable(1, 1, 1), true, 'first manual row after one Counter row');
  assert.equal(isForgeTableRowDeletable(2, 2, 2), true, 'first manual row after two Counter rows');
  assert.equal(isForgeTableRowDeletable(1, 0, 1), true, 'first manual row when there are no Counter rows');
  assert.equal(isForgeTableRowDeletable(0, 0, 1), false, 'the base row is not deletable');
  assert.equal(isForgeTableRowDeletable(1, 2, 1), false, 'a Counter-provided row is not deletable');
  assert.equal(isForgeTableRowDeletable(2, 1, 1), false, 'a row without stored manual data is not deletable');
});
