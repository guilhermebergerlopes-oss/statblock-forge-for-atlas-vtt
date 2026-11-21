import assert from 'node:assert/strict';
import test from 'node:test';
import {
  atlasResourceReadsForgeField,
  atlasResourceSharesForgeFieldKey,
  atlasRoleTemplateIdsForCollection,
  effectiveAtlasCampaignResources,
  effectiveAtlasCollectionResources,
  parseAtlasCollectionResourceDefinitions,
} from '../src/atlas/atlasResourceCatalog.ts';

const field = (key, extra = {}) => ({ key, label: key, type: 'number', ...extra });

const resource = (key, extra = {}) => ({
  key,
  name: key.toUpperCase(),
  field: key,
  direction: 'drains',
  color: '#22c55e',
  ...extra,
});

test('Resource definitions preserve Atlas defeat, visibility, and socket metadata', () => {
  const definitions = parseAtlasCollectionResourceDefinitions([
    resource('hp', { defeatedWhenSpent: true, visibleToPlayers: true, slot: 4 }),
    resource('static', { direction: 'static', defeatedWhenSpent: true, slot: 2 }),
  ]);

  assert.deepEqual(definitions, [
    {
      key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e',
      defeatedWhenSpent: true, visibleToPlayers: true, slot: 4,
    },
    {
      key: 'static', name: 'STATIC', field: 'static', direction: 'static',
      color: '#22c55e', visibleToPlayers: false, slot: 2,
    },
  ]);
});

test('Resource parser rejects malformed definitions, duplicate keys, and sockets outside Atlas capacity', () => {
  const values = [
    resource('hp'),
    resource('hp', { name: 'Duplicate key' }),
    resource('bad-color', { color: 'green' }),
    resource('bad-direction', { direction: 'increases' }),
    resource('bad-field', { field: '  ' }),
    resource('slot-outside', { slot: 6 }),
    resource('slot-fraction', { slot: 1.5 }),
    resource('second'), resource('third'), resource('fourth'), resource('fifth'), resource('sixth'), resource('seventh'),
  ];
  const parsed = parseAtlasCollectionResourceDefinitions(values);
  assert.deepEqual(parsed.map((definition) => definition.key), ['hp', 'slot-outside', 'slot-fraction', 'second', 'third', 'fourth']);
  assert.equal(parsed[1].slot, undefined);
  assert.equal(parsed[2].slot, undefined);
});

test('built-in preset defaults preserve Atlas 0.17.0 defeat rules', () => {
  const cairn = effectiveAtlasCollectionResources({ systemPresetId: 'builtin:cairn' });
  assert.deepEqual(cairn.map(({ key, defeatedWhenSpent }) => [key, defeatedWhenSpent]), [
    ['hp', undefined],
    ['str', true],
  ]);

  const daggerheart = effectiveAtlasCollectionResources({ systemPresetId: 'builtin:daggerheart' });
  assert.deepEqual(daggerheart.map(({ key, direction, defeatedWhenSpent, visibleToPlayers }) => [key, direction, defeatedWhenSpent, visibleToPlayers]), [
    ['hp', 'drains', true, false],
    ['stress', 'fills', undefined, false],
  ]);

  const drawsteel = effectiveAtlasCollectionResources({ systemPresetId: 'builtin:drawsteel' });
  assert.deepEqual(drawsteel.map(({ key, name, field, defeatedWhenSpent }) => [key, name, field, defeatedWhenSpent]), [
    ['hp', 'Stamina', 'stamina', true],
  ]);
});

test('campaign Resource fallback inherits its preset unless an explicit list, even empty, is stored', () => {
  assert.deepEqual(
    effectiveAtlasCampaignResources({ systemPresetId: 'builtin:daggerheart' }).map(({ key, direction }) => [key, direction]),
    [['hp', 'drains'], ['stress', 'fills']],
  );
  assert.deepEqual(
    effectiveAtlasCampaignResources({ systemPresetId: 'builtin:cairn' }).map(({ key, field }) => [key, field]),
    [['hp', 'hp'], ['str', 'stats.0']],
  );
  assert.deepEqual(effectiveAtlasCampaignResources({ systemPresetId: 'builtin:daggerheart', resources: [] }), []);
  assert.deepEqual(effectiveAtlasCampaignResources({ systemPresetId: 'builtin:daggerheart', resources: [resource('focus')] }).map(({ key }) => key), ['focus']);
});

test('legacy collection fallback follows Atlas stress-bar switches and unknown-preset HP default', () => {
  assert.deepEqual(
    effectiveAtlasCollectionResources({ systemPresetId: 'builtin:daggerheart', defaultWidgets: { stressBar: false } }).map((item) => item.key),
    ['hp'],
  );
  assert.deepEqual(
    effectiveAtlasCollectionResources({ systemPresetId: 'builtin:dnd5e', defaultWidgets: { stressBar: true } }).map(({ key, name }) => [key, name]),
    [['hp', 'HP'], ['stress', 'Secondary resource']],
  );
  assert.deepEqual(
    effectiveAtlasCollectionResources({ systemPresetId: 'unknown:preset' }).map(({ key, defeatedWhenSpent }) => [key, defeatedWhenSpent]),
    [['hp', true]],
  );
});

test('explicit collection Resources override preset defaults, including an intentionally empty list', () => {
  assert.deepEqual(effectiveAtlasCollectionResources({
    systemPresetId: 'builtin:daggerheart',
    resources: [resource('focus', { field: 'stats.focus', direction: 'fills', slot: 1 })],
  }), [{
    key: 'focus', name: 'FOCUS', field: 'stats.focus', direction: 'fills', color: '#22c55e', visibleToPlayers: false, slot: 1,
  }]);
  assert.deepEqual(effectiveAtlasCollectionResources({ systemPresetId: 'builtin:dnd5e', resources: [] }), []);
});

test('Field identification follows dotted paths, former keys, and hit-point meanings', () => {
  assert.equal(atlasResourceReadsForgeField(resource('unused', { field: 'resources.mana' }), field('resources')), true);
  assert.equal(atlasResourceReadsForgeField(resource('unused', { field: 'STATS.0' }), field('stats')), true);
  assert.equal(atlasResourceReadsForgeField(resource('unused', { field: 'health' }), field('vitality', { formerKeys: ['health'] })), true);
  assert.equal(atlasResourceReadsForgeField(resource('unused', { field: 'hit_points' }), field('vitality', { meaning: 'hit-points' })), true);
  assert.equal(atlasResourceReadsForgeField(resource('unused', { field: 'mana' }), field('hp')), false);
});

test('Atlas stable Resource keys are identified separately from the Field path', () => {
  const definition = resource('hp', { field: 'vitality' });
  assert.equal(atlasResourceSharesForgeFieldKey(definition, field('hp')), true);
  assert.equal(atlasResourceReadsForgeField(definition, field('hp')), false);
});

test('role lookup prefers explicit collection roles, then preset roles, then generic roles', () => {
  assert.deepEqual(atlasRoleTemplateIdsForCollection({
    systemPresetId: 'builtin:dnd5e',
    statblockRoles: [{ id: 'custom', name: 'Boss', templateId: 'boss-template' }],
  }), ['boss-template']);
  assert.deepEqual(atlasRoleTemplateIdsForCollection({ systemPresetId: 'builtin:dnd5e' }), ['builtin:5e-2024-monster']);
  assert.deepEqual(atlasRoleTemplateIdsForCollection({ systemPresetId: 'unknown:preset' }), ['builtin:generic-creature', 'builtin:generic-npc']);
  assert.deepEqual(atlasRoleTemplateIdsForCollection({ statblockRoles: [{ id: 'broken', name: 'Broken' }] }), []);
});
