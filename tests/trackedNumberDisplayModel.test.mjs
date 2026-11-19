import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { forgeTrackedResourceDefinitionsFor } from '../src/statblocks/forgeResourceValues.ts';
import { trackedNumberDisplayForField } from '../src/statblocks/trackedNumberDisplayModel.ts';

const fields = [
  { key: 'hp', label: 'Hit Points', type: 'number' },
  { key: 'hpMax', label: 'Hit Point Maximum', type: 'number' },
];

const templateBlocks = [
  {
    id: 'root-section',
    type: 'section',
    blocks: [
      { id: 'hp-track', type: 'track', field: 'hp', counts: 'down' },
    ],
  },
];

test('tracked Number resolution consumes template block arrays', () => {
  const definitions = forgeTrackedResourceDefinitionsFor(fields, templateBlocks);
  assert.equal(definitions.length, 1);
  assert.equal(definitions[0].field.key, 'hp');
  assert.equal(definitions[0].counts, 'down');

});

test('statblock renderer passes template layout blocks, not Forge appearance metadata', async () => {
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /template\.header,\s*template\.layout\.blocks/);
  assert.match(renderer, /trackedNumberDisplayForField\(field, fields, sample, readNumber, sourceBlocks, header\)/);
  assert.doesNotMatch(renderer, /trackedNumberDisplayForField\(field, fields, sample, readNumber, layout\.blocks, header\)/);
});

test('tracked Number display resolves an unbound nested Track block from template blocks', () => {
  const hp = fields[0];
  const display = trackedNumberDisplayForField(
    hp,
    fields,
    { hp: 7, hpMax: 12 },
    (field) => field.key === 'hpMax' ? 12 : 7,
    templateBlocks,
  );
  assert.deepEqual(display && {
    current: display.current,
    maximum: display.maximum,
    counts: display.counts,
    maxField: display.maxField.key,
  }, {
    current: 7,
    maximum: 7,
    counts: 'down',
    maxField: 'hp',
  });
});
