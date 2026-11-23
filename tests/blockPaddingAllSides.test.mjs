import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildBlockAppearanceCss, nestedLayoutInlineBleed } from '../src/templates/blockAppearance.ts';

const root = new URL('../', import.meta.url);

test('custom block padding uses the same configured value on all four sides', () => {
  const css = buildBlockAppearanceCss({ padding: 18 });
  assert.equal(css.padding, '18px');
  assert.equal(nestedLayoutInlineBleed({ padding: 18, borderWidth: 2, borderStyle: 'solid' }), 20);
});

test('value-block theme inset reset does not override Custom appearance padding', async () => {
  const stylesheet = await readFile(new URL('styles.css', root), 'utf8');
  assert.match(stylesheet, /\.statblock-forge__preview-block\.is-forge-value-block:not\(\[data-appearance-mode="custom"\]\)\s*\{\s*padding-right:\s*0\s*!important;/);
  assert.doesNotMatch(stylesheet, /\.statblock-forge__preview-block\.is-forge-value-block\s*\{\s*padding-right:\s*0\s*!important;/);
});

test('divider padding reset is also limited to theme-following blocks', async () => {
  const stylesheet = await readFile(new URL('styles.css', root), 'utf8');
  assert.match(stylesheet, /\.statblock-forge__preview-block\.is-divider:not\(\[data-appearance-mode="custom"\]\),\s*\.statblock-forge__preview-block\.is-vertical-divider:not\(\[data-appearance-mode="custom"\]\)\s*\{\s*padding:\s*0\s*!important;/);
});
