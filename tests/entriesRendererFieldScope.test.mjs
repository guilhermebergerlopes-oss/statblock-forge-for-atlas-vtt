import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);

test('entries renderer receives its Field explicitly at the renderBlockNode call site', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  assert.match(
    source,
    /function renderEntries\(\s*block: ForgeBlock,\s*field: ForgeField \| undefined,\s*sample: JsonRecord,/,
  );
  assert.match(
    source,
    /case 'entries': return renderEntries\(block, field, sample, layout, interactiveCounters, insideTab, onAbilityCounterMaxChange, numericRuntime, language\)/,
  );
  const start = source.indexOf('function renderEntries(');
  const end = source.indexOf('\nfunction ', start + 1);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /field\?\.key/);
  assert.match(implementation, /abilityPartsForField\(field\)/);
  assert.match(implementation, /field\?\.type/);
});
