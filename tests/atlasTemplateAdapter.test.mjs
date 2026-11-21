import assert from 'node:assert/strict';
import test from 'node:test';
import {
  projectForgeStatblockDataForLegacyNote,
  restoreForgeStatblockDataFromLegacyNote,
} from '../src/atlas/atlasTemplateAdapter.ts';

function template(overrides = {}) {
  return {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'creature-abc123',
    fields: [
      {
        key: 'abilities', label: 'Abilities', type: 'entries',
        entry: {
          extras: [
            { key: 'uses', label: 'Uses', type: 'counter', max: 3, look: 'pips', retained: 'metadata' },
            { key: 'reach', label: 'Reach', type: 'text' },
          ],
        },
      },
      { key: 'resources', label: 'Resources', type: 'counters' },
    ],
    layout: { maxColumns: 12, blocks: [] },
    ...overrides,
  };
}

test('serializes imported Atlas-origin Counter marks as readable legacy note text without mutating source data', () => {
  const source = {
    abilities: [
      { name: 'Bite', desc: 'Attack', uses: [true, true, false], reach: 'Melee', extension: { kept: true } },
      { name: 'Roar', desc: 'Fear', uses: [true, false, true], reach: 'Near' },
    ],
    resources: [{ name: 'Spell slots', max: 3, used: 1 }],
  };
  const before = structuredClone(source);

  const result = projectForgeStatblockDataForLegacyNote(template(), source);

  assert.equal(result.convertedCounters, 2);
  assert.deepEqual(result.data.abilities, [
    { name: 'Bite', desc: 'Attack', uses: '2/3', reach: 'Melee', extension: { kept: true } },
    { name: 'Roar', desc: 'Fear', uses: '●○●', reach: 'Near' },
  ]);
  assert.deepEqual(result.data.resources, source.resources);
  assert.deepEqual(source, before);
});

test('preserves object-shaped single Entries values and leaves unknown counter text untouched', () => {
  const source = { abilities: { name: 'Bite', desc: 'Attack', uses: 'legacy-format', other: 9 } };
  const result = projectForgeStatblockDataForLegacyNote(template(), source);
  assert.equal(result.convertedCounters, 0);
  assert.deepEqual(result.data.abilities, source.abilities);
  assert.notEqual(result.data, source);
});

test('restores legacy text from imported Atlas-origin notes to Forge boolean marks and row maxima', () => {
  const source = {
    abilities: [
      { name: 'Bite', uses: '2/5', _atlasCounterMaxes: { other: 7 } },
      { name: 'Roar', uses: '☑☐☑☐', _atlasCounterMaxes: { uses: 8 } },
      { name: 'Claw', uses: [true, false, false] },
      { name: 'Tail', uses: 'not-a-counter' },
    ],
  };
  const restored = restoreForgeStatblockDataFromLegacyNote(template(), source);

  assert.deepEqual(restored.abilities[0], {
    name: 'Bite', uses: [true, true, false, false, false], _atlasCounterMaxes: { other: 7, uses: 5 },
  });
  assert.deepEqual(restored.abilities[1], {
    name: 'Roar', uses: [true, false, true, false], _atlasCounterMaxes: { uses: 4 },
  });
  assert.deepEqual(restored.abilities[2], source.abilities[2]);
  assert.deepEqual(restored.abilities[3], source.abilities[3]);
  assert.deepEqual(source.abilities[0], { name: 'Bite', uses: '2/5', _atlasCounterMaxes: { other: 7 } });
});

test('clears a row maximum override when restored text uses the template default', () => {
  const restored = restoreForgeStatblockDataFromLegacyNote(template(), {
    abilities: { name: 'Bite', uses: '1/3', _atlasCounterMaxes: { uses: 9, other: 4 } },
  });
  assert.deepEqual(restored.abilities, {
    name: 'Bite', uses: [true, false, false], _atlasCounterMaxes: { other: 4 },
  });
});
