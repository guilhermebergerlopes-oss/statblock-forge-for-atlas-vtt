import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialStatblockData } from '../src/templates/statblockCreationModel.ts';
import { createLoadedStatblockSource } from '../src/statblocks/statblockDataSources.ts';
import { FORGE_TABLE_DATA_FORMAT } from '../src/statblocks/tableRowsModel.ts';

const tableSample = {
  format: FORGE_TABLE_DATA_FORMAT,
  firstRowLabel: 'STR',
  extraRows: [
    { label: 'DEX', values: { score: 14, modifier: 2 } },
    { label: 'CON', values: { score: 16, modifier: 3 } },
  ],
};

function makeTemplate() {
  return {
    id: 'table-structure-template',
    name: 'Table Structure Template',
    fields: [
      { key: 'name', label: 'Name', type: 'inline', meaning: 'name' },
      { key: 'table_data', label: 'Attributes', type: 'scores', forgeInternal: 'table-storage' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'modifier', label: 'Modifier', type: 'number' },
    ],
    layout: { format: 'statblock-forge-layout', version: 1, templateId: 'table-structure-template', blocks: [] },
    sample: {
      name: 'Example',
      table_data: tableSample,
      score: 18,
      modifier: 4,
    },
  };
}

test('new statblocks always retain Table row count and labels without copying sample cell values', () => {
  const data = createInitialStatblockData(makeTemplate(), 'New Character', false);
  assert.deepEqual(data.table_data, {
    format: FORGE_TABLE_DATA_FORMAT,
    firstRowLabel: 'STR',
    extraRows: [
      { label: 'DEX', values: {} },
      { label: 'CON', values: {} },
    ],
  });
  assert.equal(data.score, undefined);
  assert.equal(data.modifier, undefined);
  assert.equal(data.name, 'New Character');
});

test('Copy example values still copies the complete Table and all other sample Values', () => {
  const data = createInitialStatblockData(makeTemplate(), 'Copied Sample', true);
  assert.deepEqual(data.table_data, tableSample);
  assert.equal(data.score, 18);
  assert.equal(data.modifier, 4);
});

test('existing statblocks missing Table storage receive only the structural sample fallback', () => {
  const template = makeTemplate();
  const loaded = createLoadedStatblockSource({
    path: 'Creatures/Test.md',
    basename: 'Test',
    format: 'markdown-frontmatter',
    raw: { name: 'Test', score: 9 },
    template,
  });
  assert.deepEqual(loaded.binding.data.table_data, {
    format: FORGE_TABLE_DATA_FORMAT,
    firstRowLabel: 'STR',
    extraRows: [
      { label: 'DEX', values: {} },
      { label: 'CON', values: {} },
    ],
  });
  assert.equal(loaded.binding.data.score, 9);
  assert.equal(loaded.binding.data.modifier, undefined);
});

test('an explicitly stored Table remains authoritative and is not overwritten by the sample', () => {
  const explicit = {
    format: FORGE_TABLE_DATA_FORMAT,
    firstRowLabel: 'MIG',
    extraRows: [{ label: 'AGI', values: { score: 7 } }],
  };
  const loaded = createLoadedStatblockSource({
    path: 'Creatures/Test.md',
    basename: 'Test',
    format: 'markdown-frontmatter',
    raw: { name: 'Test', table_data: explicit },
    template: makeTemplate(),
  });
  assert.deepEqual(loaded.binding.data.table_data, explicit);
});


test('missing or invalid Table storage receives the structural sample fallback', () => {
  const loaded = createLoadedStatblockSource({
    path: 'Creatures/Test.md',
    basename: 'Test',
    format: 'markdown-frontmatter',
    raw: { name: 'Test', table_data: null },
    template: makeTemplate(),
  });
  assert.deepEqual(loaded.binding.data.table_data, {
    format: FORGE_TABLE_DATA_FORMAT,
    firstRowLabel: 'STR',
    extraRows: [
      { label: 'DEX', values: {} },
      { label: 'CON', values: {} },
    ],
  });
});
