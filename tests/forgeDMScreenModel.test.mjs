import assert from 'node:assert/strict';
import test from 'node:test';
import { readForgeDMScreenStoreState, 
  filterForgeDMScreenGroups,
  groupForgeDMScreenTokens,
  readForgeDMScreenScope,
  matchForgeDMScreenFeedCandidate,
} from '../src/atlas/forgeDMScreenModel.ts';

const tokens = {
  hero: { kind: 'character', name: 'Hero', statblockPath: 'Creatures/Hero.md#Stats', imagePath: 'hero.png', assetId: 'hero-asset' },
  heroCopy: { kind: 'character', name: 'Hero Copy', statblockPath: 'Creatures/Hero.md', imagePath: 'hero-copy.png', assetId: 'hero-copy-asset' },
  goblin: { kind: 'character', name: 'Goblin', statblockPath: 'Creatures/Goblin.md', imagePath: 'goblin.png', assetId: 'goblin-asset' },
  summoned: { kind: 'token', statblockPath: 'Creatures/Summoned-Blade.md', imagePath: 'blade.png', assetId: 'blade-asset' },
  prop: { kind: 'prop', name: 'Chest', statblockPath: 'Creatures/Hero.md' },
  unlinked: { kind: 'character', name: 'Unlinked' },
};

test('groups linked Atlas Characters and generic Tokens for Forge-native statblocks and strips headings', () => {
  const groups = groupForgeDMScreenTokens(tokens, (path) => path.startsWith('Creatures/'), [
    { id: 'blade-asset', imagePath: 'blade.png', name: 'Summoned Blade' },
  ]);
  assert.deepEqual(groups.map(({ path, tokens: groupTokens }) => [path, groupTokens.map(({ id }) => id)]), [
    ['Creatures/Hero.md', ['hero', 'heroCopy']],
    ['Creatures/Goblin.md', ['goblin']],
    ['Creatures/Summoned-Blade.md', ['summoned']],
  ]);
  assert.equal(groups[2]?.tokens[0]?.name, 'Summoned Blade');
});

test('scope reader follows Atlas accessible radio labels and safely defaults to all', () => {
  const root = (label) => ({ querySelector: () => label === null ? null : ({ textContent: label }) });
  assert.equal(readForgeDMScreenScope(root('This fight (2)')), 'fight');
  assert.equal(readForgeDMScreenScope(root('Personagens jogadores (3)')), 'players');
  assert.equal(readForgeDMScreenScope(root('All creatures (8)')), 'all');
  assert.equal(readForgeDMScreenScope(null), 'all');
});

test('fight scope filters and orders Forge statblock groups by initiative token order', () => {
  const groups = groupForgeDMScreenTokens(tokens, (path) => path.startsWith('Creatures/'));
  const filtered = filterForgeDMScreenGroups(groups, 'fight', [
    { tokenId: 'goblin', order: 2 },
    { tokenId: 'hero', order: 1 },
  ], () => false);
  assert.deepEqual(filtered.map((group) => group.path), ['Creatures/Hero.md', 'Creatures/Goblin.md']);
  assert.deepEqual(filtered[0]?.tokens.map((token) => token.id), ['hero']);
});

test('players scope filters individual linked tokens and drops empty groups', () => {
  const groups = groupForgeDMScreenTokens(tokens, (path) => path.startsWith('Creatures/'));
  const filtered = filterForgeDMScreenGroups(groups, 'players', [], (token) => token.assetId === 'hero-copy-asset');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.path, 'Creatures/Hero.md');
  assert.deepEqual(filtered[0]?.tokens.map((token) => token.id), ['heroCopy']);
});


test('resolves Forge statblocks from Atlas TokenAsset links when placed Tokens have no instance statblockPath', () => {
  const assetLinkedTokens = {
    sharedGoblin: { kind: 'token', name: 'Goblin', imagePath: 'goblin.webp', assetId: 'goblin-asset' },
    instanceOverride: { kind: 'character', name: 'Hero', statblockPath: 'Creatures/Hero-Variant.md', imagePath: 'hero.webp', assetId: 'hero-asset' },
    unrelated: { kind: 'token', name: 'Chest', imagePath: 'chest.webp', assetId: 'chest-asset' },
  };
  const assets = [
    { id: 'goblin-asset', imagePath: 'goblin.webp', name: 'Goblin Asset', statblockPath: 'Creatures/Goblin.md' },
    { id: 'hero-asset', imagePath: 'hero.webp', name: 'Hero Asset', statblockPath: 'Creatures/Hero.md' },
    { id: 'chest-asset', imagePath: 'chest.webp', name: 'Chest Asset', statblockPath: 'Creatures/Hero.md' },
  ];
  const groups = groupForgeDMScreenTokens(assetLinkedTokens, (path) => path.startsWith('Creatures/'), assets);
  assert.deepEqual(groups.map(({ path, tokens: groupTokens }) => [path, groupTokens.map(({ id }) => id)]), [
    ['Creatures/Goblin.md', ['sharedGoblin']],
    ['Creatures/Hero-Variant.md', ['instanceOverride']],
    ['Creatures/Hero.md', ['unrelated']],
  ]);
});

test('prefers a placed-token statblock path over the inherited TokenAsset link', () => {
  const groups = groupForgeDMScreenTokens({
    token: { kind: 'token', statblockPath: 'Creatures/Instance.md', assetId: 'asset', imagePath: 'token.webp' },
  }, (path) => path.startsWith('Creatures/'), [
    { id: 'asset', imagePath: 'token.webp', statblockPath: 'Creatures/Asset.md' },
  ]);
  assert.deepEqual(groups.map((group) => group.path), ['Creatures/Instance.md']);
});


test('matches a Forge sheet to the exact Atlas DM Screen feed item by visible heading', () => {
  const candidates = [
    { heading: 'Goblin Warrior', imagePaths: ['app://vault/goblin.png'] },
    { heading: 'Ancient Dragon', imagePaths: ['app://vault/dragon.png'] },
  ];
  assert.equal(matchForgeDMScreenFeedCandidate(['Goblin Warrior', 'Goblin.md'], ['goblin.png'], candidates), 0);
});

test('disambiguates duplicate Atlas headings by the linked Token portrait', () => {
  const candidates = [
    { heading: 'Goblin', imagePaths: ['app://vault/green-goblin.png'] },
    { heading: 'Goblin', imagePaths: ['app://vault/red-goblin.png'] },
  ];
  assert.equal(matchForgeDMScreenFeedCandidate(['Goblin'], ['red-goblin.png'], candidates), 1);
  assert.equal(matchForgeDMScreenFeedCandidate(['Goblin'], [], candidates), null);
});

test('does not replace an Atlas feed item when neither heading nor portrait uniquely identifies a Forge sheet', () => {
  const candidates = [
    { heading: 'Goblin', imagePaths: ['app://vault/a.png'] },
    { heading: 'Orc', imagePaths: ['app://vault/b.png'] },
  ];
  assert.equal(matchForgeDMScreenFeedCandidate(['Goblin Warrior'], ['unknown.png'], candidates), null);
});


test('Atlas callable Zustand stores expose DM Screen state through getState', () => {
  const state = { objects: { tokens: { goblin: { kind: 'character', statblockPath: 'Bestiary/Goblin.md' } } } };
  const store = Object.assign(() => state, { getState: () => state, subscribe: () => () => {} });
  assert.equal(readForgeDMScreenStoreState(store), state);
  assert.equal(readForgeDMScreenStoreState({ getState: () => state }), state);
  assert.equal(readForgeDMScreenStoreState({}), null);
});
