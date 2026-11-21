import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  resolveInlineCounterRows,
  updateInlineCounterUsedValue,
} from '../src/statblocks/inlineCountersFieldEditorModel.ts';

const countersField = (counterRows) => ({ key: 'resources', label: 'Resources', type: 'counters', counterRows });

test('renaming a configured Counter updates the visible name even when the statblock stores an old name', () => {
  const field = countersField([{ name: 'Focus', max: 4 }]);
  const rows = resolveInlineCounterRows([{ name: 'Mana', max: 4, used: 2 }], field);
  assert.equal(rows?.[0]?.name, 'Focus');
  assert.equal(rows?.[0]?.used, 2);
});

test('Counter rows may have blank names and duplicate names without merging', () => {
  const field = countersField([
    { name: '', max: 3 },
    { name: '', max: 2 },
    { name: 'Focus', max: 5 },
  ]);
  const rows = resolveInlineCounterRows(undefined, field);
  assert.deepEqual(rows?.map((row) => row.name), ['', '', 'Focus']);
  assert.equal(rows?.length, 3);
});

test('Counter row records may omit the name property entirely', () => {
  const field = countersField([{ max: 3 }]);
  const rows = resolveInlineCounterRows([{ max: 3, used: 1 }], field);
  assert.equal(rows?.[0]?.name, '');
  assert.equal(rows?.[0]?.used, 1);
});

test('an empty configured Counter name stays empty after usage is edited and persisted', () => {
  const field = countersField([{ name: '', max: 4 }, { name: '', max: 2 }]);
  const updated = updateInlineCounterUsedValue(undefined, field, 1, 1);
  assert.deepEqual(updated, [
    { name: '', max: 4, used: 0 },
    { name: '', max: 2, used: 1 },
  ]);
});

test('Counter preset name confirmation updates the Field and rerenders the editor', async () => {
  const editor = await readFile(new URL('../src/views/templateCounterPresetsEditor.ts', import.meta.url), 'utf8');
  assert.match(editor, /const commitName = \(\): void =>/);
  assert.match(editor, /field\.counterRows = rows\.map\(\(item, at\) => at === index \? \{ \.\.\.item, name: nextName \} : item\)/);
  assert.match(editor, /name\.addEventListener\('change', commitName\)/);
  assert.match(editor, /name\.addEventListener\('blur', commitName\)/);
  assert.match(editor, /context\.render\(\)/);
});

test('Counter names are not replaced by a generic visible label and Table renders each Counter as its matching row', async () => {
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /const counterName = rowData\.name\.trim\(\)/);
  assert.doesNotMatch(renderer, /rowIndex === 0 && \(!rawCounterName/);
  assert.match(renderer, /const counterRowCount = counterFields\.reduce/);
  assert.match(renderer, /isCounterField \? rowIndex : undefined/);
  assert.match(renderer, /const rowsToRender = onlyRowIndex === undefined/);
  assert.match(renderer, /isCounterField \|\| rowIndex === 0/);
  assert.match(renderer, /isCounterField \|\| rowIndex === 0/);
});
