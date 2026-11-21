import assert from 'node:assert/strict';
import test from 'node:test';
import { loadForgeAtlasCollectionDiceSet } from '../src/atlas/atlasCollectionDiceSet.ts';

const defaultCollection = { id: 'default', name: 'Default', createdAt: 1, settings: {} };
const metadata = (collections, assets = {}, defaultCollectionId = 'default') => ({
  defaultCollectionId, collections, assets,
});
const set = (id, sides = 12) => ({
  format: 1, id, name: `Custom d${sides}`, dice: [{ count: 1, sides }], crit: 'natural',
});
function appFor({ metadataValue, files = [], contents = {}, legacyMetadata = null }) {
  return {
    vault: {
      adapter: {
        async read(path) {
          if (path === 'atlas-vtt/.atlas-data/assets-metadata.json' && metadataValue) return JSON.stringify(metadataValue);
          if (path === 'atlas-vtt/assets-metadata.json' && legacyMetadata) return JSON.stringify(legacyMetadata);
          throw new Error('not found');
        },
      },
      getFiles: () => files,
      async cachedRead(file) {
        if (!(file.path in contents)) throw new Error('unreadable');
        return contents[file.path];
      },
    },
  };
}

test('uses the set explicitly picked by the note collection before legacy and preset rules', async () => {
  const picked = set('picked-d12');
  const data = metadata({ default: defaultCollection, heroes: {
    id: 'heroes', name: 'Heroes', createdAt: 2, settings: { diceSetId: 'picked-d12', systemPresetId: 'builtin:drawsteel' },
  } }, { token: { type: 'token', statblockPath: 'Characters/Ayla.md', collection: 'heroes' } });
  const file = { path: 'atlas-vtt/dice-sets/picked.json' };
  const app = appFor({ metadataValue: data, files: [file], contents: { [file.path]: JSON.stringify(picked) } });
  const result = await loadForgeAtlasCollectionDiceSet(app, 'Characters/Ayla.md');
  assert.equal(result.id, 'picked-d12');
  assert.equal(result.dice[0].sides, 12);
});

test('note path inside a collection determines the collection before linked token assets', async () => {
  const data = metadata({ default: defaultCollection, heroes: {
    id: 'heroes', name: 'Heroes', settings: { diceSetId: 'builtin:d20-roll-under' },
  }, monsters: { id: 'monsters', name: 'Monsters', settings: { diceSetId: 'builtin:power-roll' } } }, {
    token: { type: 'token', statblockPath: 'atlas-vtt/collections/monsters/characters/Ayla.md', collection: 'monsters' },
  });
  const app = appFor({ metadataValue: data });
  const result = await loadForgeAtlasCollectionDiceSet(app, 'atlas-vtt/collections/heroes/statblocks/Ayla.md');
  assert.equal(result.id, 'builtin:d20-roll-under');
});

test('a unique linked token collection selects its collection when the note is outside collection folders', async () => {
  const data = metadata({ default: defaultCollection, heroes: {
    id: 'heroes', name: 'Heroes', settings: { diceSetId: 'builtin:power-roll' },
  } }, { token: { type: 'token', statblockPath: 'Characters/Ayla.md', collection: 'heroes' } });
  const result = await loadForgeAtlasCollectionDiceSet(appFor({ metadataValue: data }), 'Characters/Ayla.md');
  assert.equal(result.id, 'builtin:power-roll');
});

test('multiple linked collections are ambiguous and use Atlas default collection', async () => {
  const data = metadata({ default: { ...defaultCollection, settings: { diceSetId: 'builtin:d20' } }, heroes: {
    id: 'heroes', name: 'Heroes', settings: { diceSetId: 'builtin:power-roll' },
  }, monsters: { id: 'monsters', name: 'Monsters', settings: { diceSetId: 'builtin:d100-roll-under' } } }, {
    one: { type: 'token', statblockPath: 'Characters/Ayla.md', collection: 'heroes' },
    two: { type: 'token', statblockPath: 'Characters/Ayla.md', collection: 'monsters' },
  }, 'default');
  const result = await loadForgeAtlasCollectionDiceSet(appFor({ metadataValue: data }), 'Characters/Ayla.md');
  assert.equal(result.id, 'builtin:d20');
});

test('legacy collection dice rules resolve when the collection has not picked a Dice Set', async () => {
  const data = metadata({ default: { ...defaultCollection, settings: { dice: {
    defaultRoll: '2d8', crit: 'roll-under', explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 0 },
  } } } });
  const result = await loadForgeAtlasCollectionDiceSet(appFor({ metadataValue: data }), 'Characters/Ayla.md');
  assert.equal(result.id, 'collection:legacy-dice-rules');
  assert.equal(result.dice[0].count, 2);
  assert.equal(result.dice[0].sides, 8);
  assert.equal(result.crit, 'roll-under');
  assert.equal(result.explode.lowFaces, 0);
});

test('built-in system presets map to their Atlas Dice Sets', async () => {
  const cases = [
    ['builtin:cairn', 'builtin:d20-roll-under'],
    ['builtin:coc7e', 'builtin:d100-roll-under'],
    ['builtin:cyberpunkred', 'builtin:d10-exploding'],
    ['builtin:daggerheart', 'builtin:d20'],
    ['builtin:dnd5e', 'builtin:d20'],
    ['builtin:drawsteel', 'builtin:power-roll'],
    ['builtin:ose', 'builtin:d20'],
    ['builtin:pathfinder2e', 'builtin:d20'],
    ['builtin:shadowdark', 'builtin:d20'],
  ];
  for (const [presetId, expected] of cases) {
    const data = metadata({ default: { ...defaultCollection, settings: { systemPresetId: presetId } } });
    const result = await loadForgeAtlasCollectionDiceSet(appFor({ metadataValue: data }), 'Characters/Ayla.md');
    assert.equal(result.id, expected, presetId);
  }
});

test('custom system presets resolve their selected custom Dice Set', async () => {
  const diceSet = set('campaign-custom', 18);
  const diceFile = { path: 'atlas-vtt/dice-sets/campaign.json' };
  const presetFile = { path: 'atlas-vtt/system-presets/my-system.json' };
  const data = metadata({ default: { ...defaultCollection, settings: { systemPresetId: 'my-system' } } });
  const app = appFor({ metadataValue: data, files: [diceFile, presetFile], contents: {
    [diceFile.path]: JSON.stringify(diceSet),
    [presetFile.path]: JSON.stringify({ format: 1, id: 'my-system', name: 'My system', rules: { diceSetId: 'campaign-custom' } }),
  } });
  const result = await loadForgeAtlasCollectionDiceSet(app, 'Characters/Ayla.md');
  assert.equal(result.id, 'campaign-custom');
  assert.equal(result.dice[0].sides, 18);
});

test('custom system preset legacy dice rules are supported', async () => {
  const presetFile = { path: 'atlas-vtt/system-presets/my-system.json' };
  const data = metadata({ default: { ...defaultCollection, settings: { systemPresetId: 'my-system' } } });
  const app = appFor({ metadataValue: data, files: [presetFile], contents: {
    [presetFile.path]: JSON.stringify({ format: 1, id: 'my-system', name: 'My system', rules: {
      dice: { defaultRoll: '1d12', crit: 'doubles' },
    } }),
  } });
  const result = await loadForgeAtlasCollectionDiceSet(app, 'Characters/Ayla.md');
  assert.equal(result.dice[0].sides, 12);
  assert.equal(result.crit, 'doubles');
});

test('unknown or unavailable metadata falls back to d20 without throwing', async () => {
  const result = await loadForgeAtlasCollectionDiceSet({ vault: { adapter: { read: async () => { throw new Error('unavailable'); } }, getFiles: () => [], cachedRead: async () => '' } }, 'Characters/Ayla.md');
  assert.equal(result.id, 'builtin:d20');
});

test('legacy asset metadata path remains readable after Atlas data migration fallback', async () => {
  const data = metadata({ default: { ...defaultCollection, settings: { diceSetId: 'builtin:d100-roll-under' } } });
  const result = await loadForgeAtlasCollectionDiceSet(appFor({ metadataValue: null, legacyMetadata: data }), 'Characters/Ayla.md');
  assert.equal(result.id, 'builtin:d100-roll-under');
});
