import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

test('Table preview renders each Pairs Field as a row with its named pairs as columns', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /function renderPairsTable\(/);
  assert.match(renderer, /buildTablePairsModel\(pairFields, slotFields, sample\)/);
  assert.match(renderer, /model\.columns\.forEach\(\(column\)/);
  assert.match(renderer, /model\.rows\.forEach\(\(row\)/);
  assert.match(renderer, /rowHeading.*row\.label/);
});

test('Pairs table cells can be edited in the statblock and saved through the Field runtime', async () => {
  const renderer = await readFile(rendererUrl, 'utf8');
  assert.match(renderer, /function renderPairsTableCellEditor\(/);
  assert.match(renderer, /if \(!runtime\?\.canEdit\) return;/);
  assert.match(renderer, /serializeInlinePairsDraftRows\(drafts, runtime\.language\)/);
  assert.match(renderer, /runtime\.setBaseValue\(field\.key, nextValue\)/);
  assert.match(renderer, /cell\.replaceChildren\(input\)/);
});

test('Table Field slots render supported inline editors and editable Pair cells have visible affordance', async () => {
  const [renderer, styles] = await Promise.all([
    readFile(rendererUrl, 'utf8'),
    readFile(stylesUrl, 'utf8'),
  ]);
  assert.match(renderer, /function renderTableSlotValue\(/);
  assert.match(renderer, /renderNumericFieldValue\(field, sample, runtime\)/);
  assert.match(renderer, /createInlineTextFieldValue\(app, markdownComponent, sourcePath, field, sample, runtime\)/);
  assert.match(styles, /\.statblock-forge__table-pair-cell-value:not\(:disabled\):hover/);
  assert.match(styles, /\.statblock-forge__table-pair-cell-editor/);
});
