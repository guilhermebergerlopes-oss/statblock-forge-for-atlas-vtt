import assert from 'node:assert/strict';
import test from 'node:test';
import {
  atlasResourceReadsForgeField,
  atlasResourceSharesForgeFieldKey,
  atlasSceneFileShowsLegacySecondaryResource,
  atlasRoleTemplateIdsForCollection,
  effectiveAtlasCampaignResources,
  effectiveAtlasCollectionResources,
  parseAtlasCollectionResourceDefinitions,
  slottedAtlasCollectionResources,
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

test('Atlas socket assignment reserves explicit slots, fills collisions and missing slots, and returns socket order', () => {
  const definitions = [
    resource('first', { slot: 4 }),
    resource('second'),
    resource('third', { slot: 4 }),
    resource('fourth', { slot: 1 }),
    resource('fifth'),
    resource('sixth'),
  ];
  assert.deepEqual(slottedAtlasCollectionResources(definitions).map(({ definition, slot }) => [definition.key, slot]), [
    ['second', 0], ['fourth', 1], ['third', 2], ['fifth', 3], ['first', 4], ['sixth', 5],
  ]);
});

test('custom preset Roles are inherited, while custom Resources are read from the applied collection settings', () => {
  const customRules = {
    resources: [resource('focus', { field: 'stats.focus', direction: 'fills', slot: 2 })],
    statblockRoles: [{ id: 'hero', name: 'Hero', templateId: 'custom-hero-template' }],
  };
  assert.deepEqual(effectiveAtlasCollectionResources({ systemPresetId: 'custom:preset' }, customRules).map(({ key, field, direction }) => [key, field, direction]), [
    ['hp', 'hp', 'drains'],
  ]);
  assert.deepEqual(effectiveAtlasCollectionResources({
    systemPresetId: 'custom:preset',
    resources: customRules.resources,
  }).map(({ key, field, direction }) => [key, field, direction]), [['focus', 'stats.focus', 'fills']]);
  assert.deepEqual(atlasRoleTemplateIdsForCollection({ systemPresetId: 'custom:preset' }, customRules), ['custom-hero-template']);
  assert.deepEqual(atlasRoleTemplateIdsForCollection({ systemPresetId: 'custom:preset', statblockRoles: [{ id: 'npc', name: 'NPC', templateId: 'collection-template' }] }, customRules), ['collection-template']);
  assert.deepEqual(effectiveAtlasCollectionResources({ systemPresetId: 'custom:preset', resources: [] }, customRules), []);
});

test('campaign custom Resources come from the applied campaign system list, including explicit empty lists', () => {
  const customResources = [resource('momentum', { field: 'momentum', direction: 'fills' })];
  assert.deepEqual(effectiveAtlasCampaignResources({ systemPresetId: 'custom:preset' }).map(({ key }) => key), ['hp']);
  assert.deepEqual(effectiveAtlasCampaignResources({ systemPresetId: 'custom:preset', resources: customResources }).map(({ key }) => key), ['momentum']);
  assert.deepEqual(effectiveAtlasCampaignResources({ systemPresetId: 'custom:preset', resources: [] }), []);
});

test('built-in preset defaults preserve Atlas defeat rules', () => {
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


test('legacy scene detection reads secondary Resources stored in Atlas statblockResources', () => {
  const scene = (token) => JSON.stringify({ state: {
    tokenSettings: { hiddenResources: [] },
    objects: { tokens: { token } },
  } });

  assert.equal(atlasSceneFileShowsLegacySecondaryResource(scene({
    statblockResources: { stress: { current: 3, max: 8 } },
  })), true);
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(scene({
    statblockResources: { stress: 3 },
  })), true);
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(scene({
    statblockResources: { focus: { current: 3, max: 8 } },
  })), false);
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(scene({
    statblockResources: { stress: null },
  })), false);
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(scene({
    statblockResources: { stress: '3' },
  })), false);
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(scene({
    statblockResources: { stress: { current: Number.NaN, max: 8 } },
  })), false);
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
    effectiveAtlasCollectionResources({ systemPresetId: 'builtin:dnd5e', defaultWidgets: { stressBar: false } }, null, true).map(({ key, name }) => [key, name]),
    [['hp', 'HP'], ['stress', 'Secondary resource']],
    'a scene using the old bar keeps it even when the collection switch is off',
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
