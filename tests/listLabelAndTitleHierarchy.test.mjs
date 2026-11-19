import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

function extractFunction(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `Could not find ${functionName}`);
  const end = source.indexOf(`function ${nextFunctionName}(`, start + 1);
  assert.notEqual(end, -1, `Could not find following function ${nextFunctionName}`);
  return source.slice(start, end);
}

test('all List styles show the linked Field label unless No Label is explicitly selected', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const renderTags = extractFunction(source, 'renderTags', 'renderEntryCounter');
  assert.match(
    renderTags,
    /visibleFieldBlockLabel\(block,\s*block\.label,\s*field,\s*block\.field,\s*true,\s*false\)/,
    'List styles should use the Field label for chips, bullets, numbered and comma presentations',
  );
  assert.match(
    renderTags,
    /if\s*\(!label\)\s*wrapper\.classList\.add\('is-value-only'\)/,
    'Explicit No Label must retain the value-only layout',
  );
});

test('When Empty Fallback keeps the same visible List label as the source block', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const fallback = extractFunction(source, 'appendWhenEmptyFallback', 'renderBlockList');
  assert.match(
    fallback,
    /case\s*'tags':\s*heading\s*=\s*visibleFieldBlockLabel\(block,\s*block\.label,\s*field,\s*fieldKey,\s*true,\s*false\)/,
    'Fallback overlay should preserve List labels for every List style',
  );
});

test('Title H2 and H3 use separate visual sizes in the statblock', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  const h2Rule = styles.match(/\.atlas-statblock\s+:is\(h1,\s*h2,\s*h3\)\.atlas-sb-heading\[data-level="2"\]\s*\{([^}]*)\}/s)?.[1];
  const h3Rule = styles.match(/\.atlas-statblock\s+:is\(h1,\s*h2,\s*h3\)\.atlas-sb-heading\[data-level="3"\]\s*\{([^}]*)\}/s)?.[1];
  assert.ok(h2Rule, 'H2 needs its own statblock heading rule');
  assert.ok(h3Rule, 'H3 needs its own statblock heading rule');
  const h2Size = h2Rule.match(/font-size:\s*([^;]+);/)?.[1];
  const h3Size = h3Rule.match(/font-size:\s*([^;]+);/)?.[1];
  assert.equal(h2Size, 'var(--font-ui-medium)');
  assert.equal(h3Size, 'var(--font-ui-small)');
  assert.notEqual(h2Size, h3Size, 'H2 and H3 must use different font sizes');
});

test('Title renderer keeps semantic heading levels and level-specific classes', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  const renderTitle = extractFunction(source, 'renderTitle', 'renderStat');
  assert.match(renderTitle, /element\(`h\$\{level\}`/);
  assert.match(renderTitle, /statblock-forge__preview-title level-\$\{level\}/);
  assert.match(renderTitle, /title\.dataset\.level\s*=\s*String\(level\)/);
});
