import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasCollectionUsesLegacySecondaryResource } from '../src/atlas/atlasLegacyResourceScenes.ts';
import { atlasSceneFileShowsLegacySecondaryResource } from '../src/atlas/atlasResourceCatalog.ts';

function sceneFile(path, state) {
  return { path, extension: 'atlasmap', content: JSON.stringify({ state }) };
}

test('legacy scene detection converts top-level Stress and respects the old scene visibility switch', () => {
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(JSON.stringify({ state: {
    tokenSettings: { showStressBars: true },
    objects: { tokens: { token: { stress: 3, maxStress: 10 } } },
  } })), true);

  assert.equal(atlasSceneFileShowsLegacySecondaryResource(JSON.stringify({ state: {
    tokenSettings: { showStressBars: false },
    objects: { tokens: { token: { stress: 3, maxStress: 10 } } },
  } })), false);
});

test('legacy scene detection preserves hiddenResources and migrated Resource values', () => {
  assert.equal(atlasSceneFileShowsLegacySecondaryResource(JSON.stringify({ state: {
    tokenSettings: { hiddenResources: ['stress'] },
    objects: { tokens: { token: { resources: { stress: { current: 3, max: 10 } } } } },
  } })), false);

  assert.equal(atlasSceneFileShowsLegacySecondaryResource(JSON.stringify({ state: {
    tokenSettings: { hiddenResources: [] },
    objects: { tokens: { token: { resources: { stress: { current: 3, max: 10 } } } } },
  } })), true);
  assert.equal(atlasSceneFileShowsLegacySecondaryResource('{invalid'), false);
});

test('collection scene scan checks every .atlasmap assigned to the collection, including closed scenes', async () => {
  const files = [
    sceneFile('atlas-vtt/collections/heroes/scenes/empty.atlasmap', {
      tokenSettings: { showStressBars: true }, objects: { tokens: {} },
    }),
    sceneFile('atlas-vtt/collections/heroes/scenes/old.atlasmap', {
      tokenSettings: { showStressBars: true }, objects: { tokens: { old: { stress: 2 } } },
    }),
    sceneFile('atlas-vtt/collections/monsters/scenes/other.atlasmap', {
      tokenSettings: { showStressBars: true }, objects: { tokens: { old: { stress: 2 } } },
    }),
    { path: 'atlas-vtt/collections/heroes/tokens/token.json', extension: 'json', content: '{}' },
  ];
  const app = { vault: { getFiles: () => files, cachedRead: async (file) => file.content } };

  assert.equal(await atlasCollectionUsesLegacySecondaryResource(app, 'heroes', (path) =>
    path.includes('/heroes/') ? 'heroes' : path.includes('/monsters/') ? 'monsters' : null), true);
  assert.equal(await atlasCollectionUsesLegacySecondaryResource(app, 'monsters', (path) =>
    path.includes('/heroes/') ? 'heroes' : path.includes('/monsters/') ? 'monsters' : null), true);
  assert.equal(await atlasCollectionUsesLegacySecondaryResource(app, 'empty', () => null), false);
});
