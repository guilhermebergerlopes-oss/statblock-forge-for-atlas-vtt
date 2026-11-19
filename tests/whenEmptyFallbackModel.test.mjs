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
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(configured), ['initiative', 'dex']);
  assert.equal(shouldShowWhenEmptyFallback(configured, { initiative: null, dex: 14 }), false);
  assert.equal(shouldShowWhenEmptyFallback(configured, { initiative: null, dex: null }), true);
});

test('stat rollFrom, scores columns and entries introField are source fields', () => {
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ rollFrom: 'initiative_dice' })), ['initiative', 'initiative_dice']);
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ type: 'scores', columns: [{ field: 'str' }, { field: 'dex' }] })), ['initiative', 'str', 'dex']);
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ type: 'entries', introField: 'intro' })), ['initiative', 'intro']);
  assert.deepEqual(whenEmptyFallbackSourceFieldKeys(block({ type: 'metric', fields: [''], formulas: ['floor((dex - 10) / 2)'] }), [{ key: 'dex' }]), ['dex']);
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

test('the renderer overlays the fallback without replacing the editable block', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(renderer, /appendWhenEmptyFallback\(node, source, block, sample, options\)/);
  assert.match(renderer, /options\.numericFieldRuntime\?\.subscribeAll\(sync\)/);
  assert.match(styles, /\.is-when-empty-fallback-source\s*\{\s*opacity:\s*0;/);
  assert.match(styles, /\.statblock-forge__preview-when-empty-fallback\s*\{[^}]*pointer-events:\s*none;/s);
});
