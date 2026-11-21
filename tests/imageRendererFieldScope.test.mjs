import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);

test('image renderer receives the image Field explicitly at every call site', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  assert.match(
    source,
    /function renderImage\(\s*block: ForgeBlock,\s*field: ForgeField \| undefined,\s*sample: JsonRecord,/,
  );
  assert.match(
    source,
    /renderImage\(tokenBlock, imageField, sample, resolveImage, onImageFieldAction/,
  );
  assert.match(
    source,
    /renderImage\(block, field, sample, resolveImage, onImageFieldAction/,
  );
  const start = source.indexOf('function renderImage(');
  const end = source.indexOf('\nfunction renderGroupsDisplay(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const implementation = source.slice(start, end);
  assert.match(implementation, /field\?\.type === 'image'/);
  assert.match(implementation, /field\?\.label/);
  assert.match(implementation, /onImageFieldAction\(field\.key, face\)/);
});
