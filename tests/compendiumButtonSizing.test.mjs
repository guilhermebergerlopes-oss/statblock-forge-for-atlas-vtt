import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [viewSource, styles] = await Promise.all([
  readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

test('Compendium Add, Edit, and Delete share the compact action button class', () => {
  const className = 'statblock-forge__compendium-action-button';
  assert.match(viewSource, /add\.classList\.add\('statblock-forge__compendium-action-button'(?:,|\))/);
  assert.match(viewSource, new RegExp(`edit\\.classList\\.add\\('${className}'\\)`));
  assert.match(viewSource, new RegExp(`remove\\.classList\\.add\\('${className}'\\)`));
});

test('Compendium action buttons use a reduced height, padding, and font size', () => {
  const rule = styles.match(/\.statblock-forge__editor\s+\.statblock-forge__button\.statblock-forge__compendium-action-button\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'compact Compendium action button rule exists');
  assert.match(rule, /min-height:\s*1\.3rem/);
  assert.match(rule, /padding:\s*0\.02rem\s+0\.24rem/);
  assert.match(rule, /font-size:\s*0\.66rem/);
});


test('Compendium Add button has a narrower width without changing Edit and Delete', () => {
  assert.match(viewSource, /add\.classList\.add\('statblock-forge__compendium-action-button'(?:,|\))/);
  const rule = styles.match(/\.statblock-forge__editor\s+\.statblock-forge__button\.statblock-forge__compendium-add-button\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'narrow Add button rule exists');
  assert.match(rule, /width:\s*auto/);
  assert.match(rule, /min-width:\s*0/);
  assert.match(rule, /padding-inline:\s*0\.1rem/);
  assert.doesNotMatch(rule, /width:\s*100%/);
  assert.match(viewSource, /edit\.classList\.add\('statblock-forge__compendium-action-button'\)/);
  assert.match(viewSource, /remove\.classList\.add\('statblock-forge__compendium-action-button'\)/);
});
