import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);

const renderers = [
  {
    name: 'Tags',
    signature: /function renderTags\(\s*block: ForgeBlock,\s*field: ForgeField \| undefined,\s*sample: JsonRecord,/,
    call: /case 'tags': return renderTags\(block, field, sample, layout, numericRuntime, language\)/,
  },
  {
    name: 'Pairs',
    signature: /function renderPairs\(\s*block: ForgeBlock,\s*field: ForgeField \| undefined,\s*sample: JsonRecord,/,
    call: /case 'pairs': return renderPairs\(block, field, sample, layout, numericRuntime, language\)/,
  },
  {
    name: 'Counters',
    signature: /function renderCounters\(\s*block: ForgeBlock,\s*field: ForgeField \| undefined,\s*sample: JsonRecord,/,
    call: /case 'counters': return renderCounters\(block, field, sample, layout, language, numericRuntime\)/,
  },
  {
    name: 'Groups',
    signature: /function renderGroups\(\s*block: ForgeBlock,\s*field: ForgeField \| undefined,\s*sample: JsonRecord,/,
    call: /case 'spells': return renderGroups\(block, field, sample, fields, layout, language, numericRuntime\)/,
  },
];

test('all Field-aware leaf renderers receive their Field in the correct argument position', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  for (const renderer of renderers) {
    assert.match(source, renderer.signature, `${renderer.name} must declare its optional Field parameter`);
    assert.match(source, renderer.call, `${renderer.name} must receive the resolved Field at its call site`);
  }
});

test('Field-aware leaf renderers use the explicit Field parameter rather than an ambient variable', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  for (const renderer of renderers) {
    const name = renderer.name === 'Groups' ? 'renderGroups' : `render${renderer.name}`;
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ', start + 1);
    assert.notEqual(start, -1, `${name} function must exist`);
    assert.notEqual(end, -1, `${name} must end before the next top-level function`);
    const implementation = source.slice(start, end);
    assert.match(implementation, /\bfield\b/, `${name} must reference its explicit Field parameter`);
  }
});
