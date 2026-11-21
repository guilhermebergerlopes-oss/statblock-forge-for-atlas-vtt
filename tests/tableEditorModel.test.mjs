import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankTemplate } from '../src/templates/forgeTemplate.ts';
import { editScoresTable, setScoresBlockOption } from '../src/templates/tableEditorModel.ts';
import { readForgeTableRows } from '../src/statblocks/tableRowsModel.ts';

function templateWithFields() {
  const template = createBlankTemplate('Table Editing');
  template.fields.push(
    { key: 'defenses', label: 'Defenses', type: 'pairs' },
    { key: 'speed', label: 'Speed', type: 'number' },
    { key: 'table_data', label: 'Table Data', type: 'scores', slots: ['Column 1'], rows: [[0]] },
  );
  template.sample = {
    ...template.sample,
    defenses: [{ Armor: 12 }, { Resist: 2 }],
    speed: 30,
    table_data: [[0]],
  };
  template.layout.blocks.push({
    id: 'table_block',
    type: 'scores',
    field: 'table_data',
    fields: ['speed'],
  });
  return template;
}

test('Table preview edits assigned Field values without creating another Field', () => {
  const template = templateWithFields();
  assert.equal(editScoresTable(template, 'table_block', {
    type: 'set-slot-value', fieldKey: 'speed', value: '35',
  }), true);
  assert.equal(template.sample.speed, 35);
  assert.equal(template.fields.filter((field) => field.key === 'speed').length, 1);
});

test('Pair Fields cannot be edited through a Table because they are no longer Table children', () => {
  const template = templateWithFields();
  assert.equal(editScoresTable(template, 'table_block', {
    type: 'set-slot-value', fieldKey: 'defenses', value: '18',
  }), false);
  assert.deepEqual(template.sample.defenses, [{ Armor: 12 }, { Resist: 2 }]);
});

test('Table allows column Labels and row Labels independently', () => {
  const template = templateWithFields();
  assert.equal(setScoresBlockOption(template, 'table_block', 'showColumnLabels', false), true);
  assert.equal(template.layout.blocks[0].showColumnLabels, false);
  assert.equal(setScoresBlockOption(template, 'table_block', 'showColumnLabels', true), true);
  assert.equal(template.layout.blocks[0].showColumnLabels, undefined);
  assert.equal(setScoresBlockOption(template, 'table_block', 'showRowLabels', true), true);
  assert.equal(template.layout.blocks[0].showRowLabels, true);
  assert.equal(template.layout.blocks[0].showColumnLabels, undefined, 'column Labels remain enabled at the same time');
});

test('Table adds rows and saves row Labels and per-Field values in its private Scores storage', () => {
  const template = templateWithFields();
  assert.equal(setScoresBlockOption(template, 'table_block', 'allowRowAdd', true), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'add-row' }), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'set-row-label', row: 1, value: 'Mithril' }), false);
  // Row labels must be enabled before they can be edited.
  assert.equal(setScoresBlockOption(template, 'table_block', 'showRowLabels', true), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'set-row-label', row: 1, value: 'Mithril' }), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'set-row-cell', row: 1, fieldKey: 'speed', value: '45' }), true);
  const rows = readForgeTableRows(template.sample.table_data);
  assert.equal(rows.extraRows.length, 1);
  assert.equal(rows.extraRows[0].label, 'Mithril');
  assert.equal(rows.extraRows[0].values.speed, 45);
  assert.equal(template.sample.speed, 30, 'extra table rows do not overwrite the base Field value');
});

test('Table cannot add rows unless enabled and rejects cells from unlinked Fields', () => {
  const template = templateWithFields();
  assert.equal(editScoresTable(template, 'table_block', { type: 'add-row' }), false);
  assert.equal(setScoresBlockOption(template, 'table_block', 'allowRowAdd', true), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'add-row' }), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'set-row-cell', row: 1, fieldKey: 'defenses', value: '12' }), false);
});

test('Table retains number display and rollable settings without legacy Columns configuration', () => {
  const template = templateWithFields();
  assert.equal(setScoresBlockOption(template, 'table_block', 'display', 'signed'), true);
  assert.equal(template.layout.blocks[0].display, 'signed');
  assert.equal(setScoresBlockOption(template, 'table_block', 'rollable', true), true);
  assert.equal(template.layout.blocks[0].rollable, true);
  assert.equal('orientation' in template.layout.blocks[0], false);
  assert.equal('perLine' in template.layout.blocks[0], false);
});


test('Table allows deleting manually-added rows only when row addition is enabled', () => {
  const template = templateWithFields();
  assert.equal(editScoresTable(template, 'table_block', { type: 'remove-row', row: 1 }), false);
  assert.equal(setScoresBlockOption(template, 'table_block', 'allowRowAdd', true), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'add-row' }), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'set-row-cell', row: 1, fieldKey: 'speed', value: 45 }), true);
  assert.equal(editScoresTable(template, 'table_block', { type: 'remove-row', row: 1 }), true);
  assert.equal(readForgeTableRows(template.sample.table_data).extraRows.length, 0);
});
