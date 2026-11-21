import assert from 'node:assert/strict';
import test from 'node:test';
import {
  atlasResourceSourcePath,
  atlasResourceSourceValues,
  parseAtlasResourceValue,
  readAtlasResourceSourceValue,
  syncAtlasResourcesForToken,
} from '../src/atlas/atlasResourceTokenSyncModel.ts';

const resource = (key, field, direction = 'drains') => ({
  key, name: key.toUpperCase(), field, direction, color: '#22c55e', visibleToPlayers: false,
});
const field = (key, extra = {}) => ({ key, label: key, type: 'number', ...extra });
const spec = (resourceDefinition, forgeField) => ({ resource: resourceDefinition, field: forgeField });

test('parses Atlas scalar, fraction, noted and structured Resource values', () => {
  assert.deepEqual(parseAtlasResourceValue(12, 'drains'), { current: 12, max: 12 });
  assert.deepEqual(parseAtlasResourceValue('3/8', 'drains'), { current: 3, max: 8 });
  assert.deepEqual(parseAtlasResourceValue('7 (2d6+1)', 'drains'), { current: 7, max: 7 });
  assert.deepEqual(parseAtlasResourceValue({ current: 4, max: 9 }, 'fills'), { current: 4, max: 9 });
  assert.deepEqual(parseAtlasResourceValue({ value: 6, max: 10 }, 'fills'), { current: 6, max: 10 });
  assert.deepEqual(parseAtlasResourceValue(5, 'fills'), { current: 0, max: 5 });
  assert.equal(parseAtlasResourceValue('unknown', 'drains'), null);
});

test('resolves nested Atlas paths through Forge current and former Field keys', () => {
  assert.equal(atlasResourceSourcePath(spec(resource('mana', 'resources.mana'), field('resources'))), 'resources.mana');
  assert.equal(atlasResourceSourcePath(spec(resource('str', 'stats.0'), field('attributes', { formerKeys: ['stats'] }))), 'attributes.0');
  assert.equal(atlasResourceSourcePath(spec(resource('hp', 'health'), field('vitality', { meaning: 'hit-points' }))), 'vitality');
  assert.equal(atlasResourceSourcePath(spec(resource('hp', 'mana'), field('vitality', { meaning: 'hit-points' }))), null);
});

test('distinguishes absent, invalid, explicitly empty, and valid source values', () => {
  const hp = spec(resource('hp', 'hp'), field('hp'));
  assert.equal(readAtlasResourceSourceValue({}, hp).status, 'missing');
  assert.equal(readAtlasResourceSourceValue({ hp: 'not yet set' }, hp).status, 'invalid');
  assert.equal(readAtlasResourceSourceValue({ hp: null }, hp).status, 'empty');
  assert.equal(readAtlasResourceSourceValue({ hp: '  ' }, hp).status, 'empty');
  assert.deepEqual(readAtlasResourceSourceValue({ hp: 9 }, hp), {
    status: 'value', value: { current: 9, max: 9 }, spec: hp,
  });
});

test('updates maxima while preserving current values, clamping, and manually overridden maxima', () => {
  const hp = spec(resource('hp', 'hp'), field('hp'));
  const stress = spec(resource('stress', 'stress', 'fills'), field('stress'));
  const sources = atlasResourceSourceValues({ hp: 8, stress: 4 }, [hp, stress]);
  const result = syncAtlasResourcesForToken({
    resources: { hp: { current: 5, max: 12 }, stress: { current: 6, max: 9 } },
  }, sources);
  assert.deepEqual(result.resources, {
    hp: { current: 5, max: 8 },
    stress: { current: 4, max: 4 },
  });
  const overridden = syncAtlasResourcesForToken({
    resources: { hp: { current: 5, max: 20 } }, overriddenMax: ['hp'],
  }, sources);
  assert.deepEqual(overridden.resources.hp, { current: 5, max: 20 });
});

test('initializes new draining Resources full and filling Resources empty', () => {
  const hp = spec(resource('hp', 'hp'), field('hp'));
  const stress = spec(resource('stress', 'stress', 'fills'), field('stress'));
  const result = syncAtlasResourcesForToken({}, atlasResourceSourceValues({ hp: 10, stress: 6 }, [hp, stress]));
  assert.deepEqual(result.resources, {
    hp: { current: 10, max: 10 },
    stress: { current: 0, max: 6 },
  });
});

test('removes explicitly emptied Resources but leaves absent or invalid Fields untouched', () => {
  const hp = spec(resource('hp', 'hp'), field('hp'));
  const old = { resources: { hp: { current: 2, max: 10 } } };
  assert.deepEqual(syncAtlasResourcesForToken(old, atlasResourceSourceValues({ hp: null }, [hp])).resources, {});
  assert.deepEqual(syncAtlasResourcesForToken(old, atlasResourceSourceValues({}, [hp])).resources, old.resources);
  assert.deepEqual(syncAtlasResourcesForToken(old, atlasResourceSourceValues({ hp: 'unknown' }, [hp])).resources, old.resources);
});

test('refielded Resources restart only when still at their previous starting value', () => {
  const hp = spec(resource('hp', 'stamina'), field('stamina'));
  const stress = spec(resource('stress', 'strain', 'fills'), field('strain'));
  const sources = atlasResourceSourceValues({ stamina: 6, strain: 8 }, [hp, stress]);
  const result = syncAtlasResourcesForToken({
    resources: { hp: { current: 10, max: 10 }, stress: { current: 0, max: 4 } },
  }, sources, { refieldedKeys: new Set(['hp', 'stress']) });
  assert.deepEqual(result.resources, { hp: { current: 6, max: 6 }, stress: { current: 0, max: 8 } });
  const wounded = syncAtlasResourcesForToken({
    resources: { hp: { current: 3, max: 10 }, stress: { current: 2, max: 4 } },
  }, sources, { refieldedKeys: new Set(['hp', 'stress']) });
  assert.deepEqual(wounded.resources, { hp: { current: 3, max: 6 }, stress: { current: 2, max: 8 } });
});

test('preserves static zero Resources as held values', () => {
  const armor = spec(resource('armor', 'armor', 'static'), field('armor'));
  const result = syncAtlasResourcesForToken({}, atlasResourceSourceValues({ armor: 0 }, [armor]));
  assert.deepEqual(result.resources, { armor: { current: 0, max: 0 } });
});
