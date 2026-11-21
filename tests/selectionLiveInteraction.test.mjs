import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('editable Selection fields render the Atlas control directly instead of relying on block click activation', () => {
  const fieldRenderer = between(renderer, 'function createInlineTextFieldValue(', 'function renderNumericFieldValue(');
  assert.match(fieldRenderer, /field\.type === 'choice' && runtime\?\.canEdit && usesAtlasSelectionEditor\(field\)/);
  assert.match(fieldRenderer, /createSelectionEditorDom\(\s*field,\s*sample\[field\.key\],\s*runtime\.language,/);
  assert.match(fieldRenderer, /saveSelection/);
  assert.match(fieldRenderer, /runtime\.subscribe\(field\.key, \(\) => selection\.setValue\(sample\[field\.key\]\)\)/);
});

test('Selection editor ID counter is declared in module scope before editor creation', () => {
  assert.match(renderer, /let nextSelectionEditorId = 0;[\s\S]*?function createSelectionEditorDom\(/);
  assert.match(renderer, /const editorId = `forge-choice-\$\{\+\+nextSelectionEditorId\}`/);
});

test('Selection input opens options on mouse-down even when it already has focus', () => {
  const selection = between(renderer, 'function createSelectionEditorDom(', 'function createInlineTextFieldValue(');
  assert.match(selection, /const onInputMouseDown = \(event: MouseEvent\): void => \{\s*if \(event\.button === 0 && !opened\) refreshPopup\(true\);/);
  assert.match(selection, /input\.addEventListener\('mousedown', onInputMouseDown\)/);
  assert.match(selection, /input\.addEventListener\('click', onInputClick\)/);
});

test('Selection option changes, chip removal and per-option numbers are persisted through the callback', () => {
  const selection = between(renderer, 'function createSelectionEditorDom(', 'function createInlineTextFieldValue(');
  assert.match(selection, /const notifyChange = \(\): void =>/);
  assert.match(selection, /notifyChange\(\);/);
  assert.match(selection, /setValue\(nextRawValue: unknown\)/);
  assert.match(selection, /return \{ value: valueFromPicks\(\), error: null \}/);
});

test('Table Selection uses the same live Atlas control and cleans up the portal after a row redraw', () => {
  const table = between(renderer, 'function renderTableSlotValue(', 'function renderTableFields(');
  assert.match(table, /field\.type === 'choice' && usesAtlasSelectionEditor\(field\)/);
  assert.match(table, /classList\.add\('is-live-table'\)/);
  assert.match(table, /if \(onValueEdit\) selection\?\.destroy\(\)/);
});

test('Metric Selection receives the same directly interactive Selection control', () => {
  const metric = between(renderer, 'function renderMetric(', 'function normalizeTableCellValue(');
  assert.match(metric, /createInlineTextFieldValue\(/);
  assert.match(metric, /metricValue\.classList\.add\('is-live-metric'\)/);
});
