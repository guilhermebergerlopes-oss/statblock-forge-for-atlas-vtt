import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const cssUrl = new URL('../styles.css', import.meta.url);
const fieldInspectorUrl = new URL('../src/views/templateFieldEditor.ts', import.meta.url);
const blockInspectorUrl = new URL('../src/views/templateValueBlockInspector.ts', import.meta.url);

test('When Empty is configured once, at block level, not on individual Fields', async () => {
  const fieldInspector = await readFile(fieldInspectorUrl, 'utf8');
  const blockInspector = await readFile(blockInspectorUrl, 'utf8');
  assert.doesNotMatch(fieldInspector, /When Empty|whenEmpty|fallback/i);
  assert.match(blockInspector, /translateForgeText\('When Empty'/);
  assert.match(blockInspector, /block\.whenEmpty = 'fallback'/);
});

test('Field inspector does not expose a second empty-state text setting', async () => {
  const fieldEditor = await readFile(fieldInspectorUrl, 'utf8');
  assert.doesNotMatch(fieldEditor, /promptControl|Texto quando vazio|field\.prompt/);
  // Legacy Field.prompt may remain in saved JSON, but it no longer controls
  // an empty-state placeholder in Forge; the Block owns the single fallback.
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const markdownPanel = await readFile(new URL('../src/views/StatblockMarkdownFieldsPanel.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(renderer, /field\.prompt/);
  assert.doesNotMatch(markdownPanel, /field\.prompt/);
});

test('When Empty fallback replaces an empty source in normal document flow', async () => {
  const css = await readFile(cssUrl, 'utf8');
  const sourceRule = css.match(/\.statblock-forge__preview-block > \.is-when-empty-fallback-source\s*\{([^}]*)\}/);
  const fallbackRule = css.match(/\.statblock-forge__preview-when-empty-fallback\s*\{([^}]*)\}/);
  assert.ok(sourceRule, 'source visibility rule exists');
  assert.match(sourceRule[1], /display:\s*none\s*!important/);
  assert.ok(fallbackRule, 'fallback layout rule exists');
  assert.match(fallbackRule[1], /position:\s*relative/);
  assert.doesNotMatch(fallbackRule[1], /position:\s*absolute/);
});
