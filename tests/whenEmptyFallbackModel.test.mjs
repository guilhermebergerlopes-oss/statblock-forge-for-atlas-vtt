import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowWhenEmptyFallback, whenEmptyFallbackSourceFieldKeys } from '../src/templates/whenEmptyFallbackModel.ts';

const block = (overrides = {}) => ({ id: 'test0001', type: 'stat', field: 'initiative', whenEmpty: 'fallback', fallback: '—', ...overrides });

test('When Empty Fallback appears only when every source field is empty', () => {
  assert.equal(shouldShowWhenEmptyFallback(block(), {}), true);
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: '' }), true);
  assert.equal(shouldShowWhenEmptyFallback(block({ type: 'line', fields: ['size', 'kind'] }), { size: '', kind: null }), true);
  assert.equal(shouldShowWhenEmptyFallback(block({ type: 'line', fields: ['size', 'kind'] }), { size: '', kind: 'Large' }), false);
});

test('renderer dash placeholders count as empty for When Empty', () => {
  for (const placeholder of ['-', '—', '–', '−', '  —  ']) {
    assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: placeholder }), true, `${JSON.stringify(placeholder)} should be empty`);
  }
  assert.equal(shouldShowWhenEmptyFallback(block({ type: 'line', fields: ['one', 'two'] }), { one: '-', two: '' }), true);
  assert.equal(shouldShowWhenEmptyFallback(block({ type: 'line', fields: ['one', 'two'] }), { one: '-', two: 'Present' }), false);
});

test('dash placeholders inside nested collection values count as empty', () => {
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: { nested: ['—', '-'] } }), true);
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: { nested: ['—', 'Present'] } }), false);
});

test('zero and false are populated values, not empty fields', () => {
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: 0 }), false);
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: false }), false);
});

test('empty arrays and records count as empty recursively', () => {
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: [] }), true);
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: { nested: ['', null] } }), true);
  assert.equal(shouldShowWhenEmptyFallback(block(), { initiative: { nested: ['present'] } }), false);
});

test('block pattern references participate in emptiness; fallback references do not', () => {
  const configured = block({ pattern: '{dex}', fallback: 'From {dex}' });
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(configured), ['dex']);
  assert.equal(shouldShowWhenEmptyFallback(configured, { initiative: null, dex: 14 }), false);
  assert.equal(shouldShowWhenEmptyFallback(configured, { initiative: null, dex: null }), true);
});

test('Stat rollFrom is not treated as displayed content; Scores columns and Entries intro are', () => {
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ rollFrom: 'initiative_dice' })), ['initiative']);
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ type: 'scores', columns: [{ field: 'str' }, { field: 'dex' }] })), ['initiative', 'str', 'dex']);
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ type: 'entries', introField: 'intro' })), ['initiative', 'intro']);
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ type: 'metric', fields: [''], formulas: ['floor((dex - 10) / 2)'] }), [{ key: 'dex' }]), ['dex']);
});

test('Number and Rating Field formulas use their actual referenced source Fields', () => {
  const fields = [
    { key: 'armor', label: 'Armor', type: 'number', formula: '@might-score + proficiency' },
    { key: 'might-score', label: 'Might', type: 'number' },
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
  ];
  const stat = block({ field: 'armor' });
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(stat, fields), ['might-score', 'proficiency']);
  assert.equal(shouldShowWhenEmptyFallback(stat, { armor: null, 'might-score': '—', proficiency: '' }, fields), true);
  assert.equal(shouldShowWhenEmptyFallback(stat, { armor: null, 'might-score': 4, proficiency: '' }, fields), false);

  const valueFormula = [{ key: 'armor', label: 'Armor', type: 'number', formula: 'value + 2' }];
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(stat, valueFormula), ['armor']);
});

test('Metric formula slots recognize @ and braced hyphenated Field references', () => {
  const metric = block({ type: 'metric', fields: [''], formulas: ['max({might-score}, @proficiency)'] });
  const fields = [
    { key: 'might-score', label: 'Might', type: 'number' },
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
  ];
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(metric, fields), ['might-score', 'proficiency']);
});

test('a configured Pattern takes precedence over unused block bindings when checking emptiness', () => {
  const stat = block({ pattern: 'Armor {dex}', field: 'armor' });
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(stat), ['dex']);
  assert.equal(shouldShowWhenEmptyFallback(stat, { armor: 18, dex: '—' }), true);
  assert.equal(shouldShowWhenEmptyFallback(stat, { armor: 18, dex: 14 }), false);

  const line = block({ type: 'line', fields: ['str', 'dex'], pattern: 'Defense {armor}' });
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(line), ['armor']);
  assert.equal(shouldShowWhenEmptyFallback(line, { str: 3, dex: 4, armor: '' }), true);
  assert.equal(shouldShowWhenEmptyFallback(line, { str: 3, dex: 4, armor: 12 }), false);
});

test('only the fallback mode is interpreted; Hide and Fold remain Forge-owned behaviors', () => {
  assert.equal(shouldShowWhenEmptyFallback(block({ whenEmpty: 'hide' }), {}), false);
  assert.equal(shouldShowWhenEmptyFallback(block({ whenEmpty: 'fold' }), {}), false);
  assert.equal(shouldShowWhenEmptyFallback(block({ whenEmpty: undefined }), {}), false);
});

test('empty fallback text and blocks without source fields do not render a fallback', () => {
  assert.equal(shouldShowWhenEmptyFallback(block({ fallback: '   ' }), {}), false);
  assert.equal(shouldShowWhenEmptyFallback(block({ type: 'heading', field: undefined }), {}), false);
});

test('the renderer keeps the source block mounted and replaces its layout with the fallback', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(renderer, /appendWhenEmptyFallback\(node, source, block, sample, options\)/);
  assert.match(renderer, /options\.numericFieldRuntime\?\.subscribeAll\(sync\)/);
  assert.match(styles, /\.is-when-empty-fallback-source\s*\{\s*display:\s*none\s*!important;/);
  assert.match(styles, /\.statblock-forge__preview-when-empty-fallback\s*\{[^}]*pointer-events:\s*none;/s);
});
