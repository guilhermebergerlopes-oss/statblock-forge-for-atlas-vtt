import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeAtlasTemplateCompatibility,
  applyForgeCounterProjectionToFrontmatter,
  projectForgeStatblockDataForAtlas,
  projectForgeTemplateForAtlas,
  restoreForgeStatblockDataFromAtlas,
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
    layout: {
      maxColumns: 12,
      blocks: [
        {
          id: 'root-section', type: 'section', label: 'Overview', blocks: [
            { id: 'ability-stat', type: 'stat', labelPlacement: 'above', addsToRolls: true },
            { id: 'hidden-heading', type: 'section', heading: 'Secret', headingField: 'secret', label: 'Hidden', labelPlacement: 'none', addsToRolls: true },
          ],
        },
      ],
    },
    ...overrides,
  };
}

test('projects Ability Part Counter marks to Atlas text without mutating Forge source data', () => {
  const source = {
    abilities: [
      { name: 'Bite', desc: 'Attack', uses: [true, true, false], reach: 'Melee', extension: { kept: true } },
      { name: 'Roar', desc: 'Fear', uses: [true, false, true], reach: 'Near' },
    ],
    resources: [{ name: 'Spell slots', max: 3, used: 1 }],
  };
  const before = structuredClone(source);

  const result = projectForgeStatblockDataForAtlas(template(), source);

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
  const result = projectForgeStatblockDataForAtlas(template(), source);
  assert.equal(result.convertedCounters, 0);
  assert.deepEqual(result.data.abilities, source.abilities);
  assert.notEqual(result.data, source);
});

test('restores Atlas text to Forge boolean marks and retains non-default row maxima', () => {
  const source = {
    abilities: [
      { name: 'Bite', uses: '2/5', _atlasCounterMaxes: { other: 7 } },
      { name: 'Roar', uses: '☑☐☑☐', _atlasCounterMaxes: { uses: 8 } },
      { name: 'Claw', uses: [true, false, false] },
      { name: 'Tail', uses: 'not-a-counter' },
    ],
  };
  const restored = restoreForgeStatblockDataFromAtlas(template(), source);

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
  const restored = restoreForgeStatblockDataFromAtlas(template(), {
    abilities: { name: 'Bite', uses: '1/3', _atlasCounterMaxes: { uses: 9, other: 4 } },
  });
  assert.deepEqual(restored.abilities, {
    name: 'Bite', uses: [true, false, false], _atlasCounterMaxes: { other: 4 },
  });
});

test('applies the text projection to only declared template fields in existing frontmatter', () => {
  const frontmatter = {
    abilities: [{ name: 'Bite', uses: [true, false, true] }],
    resources: [{ name: 'Focus', max: 4, used: 1 }],
    unrelated: { keep: true },
  };
  const count = applyForgeCounterProjectionToFrontmatter(template(), frontmatter);
  assert.equal(count, 1);
  assert.equal(frontmatter.abilities[0].uses, '●○●');
  assert.deepEqual(frontmatter.resources, [{ name: 'Focus', max: 4, used: 1 }]);
  assert.deepEqual(frontmatter.unrelated, { keep: true });
});

test('reports native compatibility and makes unknown schema elements explicit', () => {
  const native = analyzeAtlasTemplateCompatibility(template({
    fields: [{ key: 'name', label: 'Name', type: 'text' }],
    layout: { maxColumns: 12, blocks: [{ id: 'title', type: 'title' }] },
  }));
  assert.equal(native.quality, 'native');
  assert.equal(native.unknownFieldTypes, 0);
  assert.equal(native.unknownBlockTypes, 0);
  assert.ok(native.issues.some((issue) => issue.code === 'native-schema-compatible'));

  const mixed = analyzeAtlasTemplateCompatibility(template({
    fields: [
      { key: 'mystery', label: 'Mystery', type: 'future-field' },
      { key: 'abilities', label: 'Abilities', type: 'entries', entry: { extras: [{ key: 'unknown', label: 'Unknown', type: 'future-part' }, { key: 'uses', label: 'Uses', type: 'counter' }] } },
    ],
    layout: { maxColumns: 12, blocks: [{ id: 'custom', type: 'future-block', blocks: [{ id: 'child', type: 'title' }] }] },
  }));
  assert.equal(mixed.quality, 'best-effort');
  assert.equal(mixed.unknownFieldTypes, 1);
  assert.equal(mixed.unknownAbilityPartTypes, 1);
  assert.equal(mixed.unknownBlockTypes, 1);
  assert.equal(mixed.convertedAbilityCounters, 1);
  assert.deepEqual(mixed.issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.code), [
    'unknown-field-type', 'unknown-ability-part-type', 'forge-counter-as-atlas-text', 'unknown-layout-block',
  ]);
});

test('projects only supported layout adjustments while preserving Forge source template', () => {
  const source = template();
  const original = structuredClone(source);
  const result = projectForgeTemplateForAtlas(source);
  const fields = result.template.fields;
  assert.deepEqual(fields[0].entry.extras[0], {
    key: 'uses', label: 'Uses', type: 'text', retained: 'metadata',
  });
  assert.deepEqual(fields[0].entry.extras[1], { key: 'reach', label: 'Reach', type: 'text' });
  const [section] = result.template.layout.blocks;
  assert.equal(section.blocks[0].look, 'stacked');
  assert.equal('labelPlacement' in section.blocks[0], false);
  assert.equal('addsToRolls' in section.blocks[0], false);
  assert.equal(section.blocks[1].label, '');
  assert.equal('heading' in section.blocks[1], false);
  assert.equal('headingField' in section.blocks[1], false);
  assert.deepEqual(source, original);
});
