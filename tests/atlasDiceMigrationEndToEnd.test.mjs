import assert from 'node:assert/strict';
import test from 'node:test';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';
import {
  getForgeStatblockRollHistory,
  repeatForgeStatblockRollFromHistory,
  rollForgeStatblockWithAtlasDiceTool,
} from '../src/statblocks/atlasRestDiceTool.ts';
import { readForgeDiceHistory, upsertForgeDiceHistory } from '../src/statblocks/forgeDiceHistoryStorage.ts';

const D12 = {
  id: 'migration-d12', name: 'Migration d12', builtIn: false,
  dice: [{ count: 1, sides: 12, name: 'Arcane', colour: '#8844cc' }],
  crit: 'natural', advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};
const D8 = {
  id: 'migration-d8', name: 'Migration d8', builtIn: false,
  dice: [{ count: 2, sides: 8, name: 'Frost', colour: '#4488cc' }],
  crit: 'natural', advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};

function makeHistoryPlugin(initial = []) {
  let entries = readForgeDiceHistory(initial);
  return {
    getForgeDiceHistoryEntries(path, limit = 20) {
      return entries.filter((entry) => entry.statblockPath === path).slice(0, limit);
    },
    getForgeDiceHistoryEntry(id) { return entries.find((entry) => entry.id === id) ?? null; },
    recordForgeDiceHistoryEntry(entry) { entries = upsertForgeDiceHistory(entries, entry); },
    get entries() { return entries; },
    snapshotData() { return JSON.parse(JSON.stringify({ forgeDiceHistory: entries })); },
  };
}

function makeMap({ viewId, mapPath, visible = true, persistedHistory = [], tokens = {} }) {
  const calls = [];
  const memory = [];
  const diceTool = {
    rollDice(formula, source, origin, options) {
      const result = {
        id: `${viewId}-roll-${calls.length + 1}`,
        timestamp: 1000 + calls.length,
        formula,
        total: 8 + calls.length,
        source,
        ...(options?.advantage ? { advantage: options.advantage } : {}),
      };
      calls.push({ formula, source, origin, options, result });
      memory.unshift(result);
      return result;
    },
    rollingDice(set) {
      return {
        dice: set?.dice ?? [{ count: 1, sides: 20 }],
        advantage: { kind: 'keep' },
        disadvantage: { kind: 'keep' },
      };
    },
    getState() { return { rollHistory: memory }; },
  };
  const store = { getState: () => ({ mapPath, diceLog: persistedHistory, objects: { tokens } }) };
  const eventBus = { on() {}, off() {} };
  const serviceManager = {
    getRendererService: () => ({ getRenderer() {}, isInitialized: () => true }),
    getToolController: () => ({ getDiceTool: () => diceTool }),
    getNotePreviewUIManager: () => ({ showOrCreatePreview() {}, hideAllUnpinnedPreviews() {} }),
    getAssetService: () => null,
    getStore: () => store,
    getEventBus: () => eventBus,
  };
  const view = {
    viewId,
    getViewType: () => ATLAS_VIEW_TYPE,
    serviceManager,
    atlasStore: store,
    containerEl: { isShown: () => visible },
  };
  return { view, calls, memory, store, diceTool };
}

function makeApp({ maps = [], history = [] } = {}) {
  const plugin = makeHistoryPlugin(history);
  const leaves = maps.map((map) => ({ view: map.view }));
  const app = {
    plugins: { plugins: {
      'statblock-forge': plugin,
      'atlas-vtt': { manifest: { id: 'atlas-vtt', version: '0.17.0' } },
    } },
    workspace: {
      activeLeaf: leaves[0],
      getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? leaves : [],
    },
  };
  return { app, plugin, leaves };
}

test('two statblocks roll through different map DiceTools and remain isolated after plugin reload', () => {
  const forest = makeMap({ viewId: 'view-forest', mapPath: 'Maps/Forest.atlasmap', tokens: { 'ayla-token': { name: 'Ayla', offMap: false } } });
  const citadel = makeMap({ viewId: 'view-citadel', mapPath: 'Maps/Citadel.atlasmap', tokens: { 'borin-token': { name: 'Borin', offMap: false } } });
  const session = makeApp({ maps: [forest, citadel] });

  const ayla = rollForgeStatblockWithAtlasDiceTool(session.app, 'd12+2', {
    statblockPath: 'Characters/Ayla.md', viewId: 'view-forest', tokenId: 'ayla-token', tokenName: 'Ayla', abilityName: 'Arcane Bolt',
    originContext: { viewId: 'view-forest', mapPath: 'Maps/Forest.atlasmap', tokenIds: ['ayla-token'] },
  }, D12, 'advantage', D12);
  const borin = rollForgeStatblockWithAtlasDiceTool(session.app, '2d8+1', {
    statblockPath: 'Characters/Borin.md', viewId: 'view-citadel', tokenId: 'borin-token', tokenName: 'Borin', abilityName: 'Frost Strike',
    originContext: { viewId: 'view-citadel', mapPath: 'Maps/Citadel.atlasmap', tokenIds: ['borin-token'] },
  }, D8, 'disadvantage', D8);

  assert.equal(ayla.engine, 'atlas');
  assert.equal(borin.engine, 'atlas');
  assert.equal(forest.calls.length, 1);
  assert.equal(citadel.calls.length, 1);
  assert.equal(forest.calls[0].origin.mapPath, 'Maps/Forest.atlasmap');
  assert.equal(citadel.calls[0].origin.mapPath, 'Maps/Citadel.atlasmap');
  assert.equal(session.plugin.entries.length, 2);
  assert.equal(getForgeStatblockRollHistory(session.app, 'Characters/Ayla.md').length, 1);
  assert.equal(getForgeStatblockRollHistory(session.app, 'Characters/Borin.md').length, 1);
  assert.equal(getForgeStatblockRollHistory(session.app, 'Characters/Other.md').length, 0);
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in session.app.plugins.plugins, false);

  // Save the same JSON value that the Forge plugin stores in Obsidian data.json.
  const persistedData = session.plugin.snapshotData();
  const reloaded = makeApp({ history: persistedData.forgeDiceHistory });
  assert.equal(getForgeStatblockRollHistory(reloaded.app, 'Characters/Ayla.md')[0].id, ayla.roll.id);
  assert.equal(getForgeStatblockRollHistory(reloaded.app, 'Characters/Borin.md')[0].id, borin.roll.id);

  // Both original maps are closed after restart, so each saved recipe is replayed by Forge.
  const aylaRepeat = repeatForgeStatblockRollFromHistory(reloaded.app, ayla.roll.id);
  const borinRepeat = repeatForgeStatblockRollFromHistory(reloaded.app, borin.roll.id);
  assert.equal(aylaRepeat.available, true);
  assert.equal(borinRepeat.available, true);
  assert.equal(aylaRepeat.engine, 'forge');
  assert.equal(borinRepeat.engine, 'forge');
  assert.equal(aylaRepeat.details.diceSet.id, D12.id);
  assert.equal(borinRepeat.details.diceSet.id, D8.id);
  assert.equal(getForgeStatblockRollHistory(reloaded.app, 'Characters/Ayla.md').length, 2);
  assert.equal(getForgeStatblockRollHistory(reloaded.app, 'Characters/Borin.md').length, 2);
});

test('history merges several open map logs and Forge persistence without duplicate IDs or cross-sheet leakage', () => {
  const shared = {
    id: 'same-map-roll', timestamp: 300, formula: 'd20+4', total: 19,
    source: { type: 'statblock', statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack' },
  };
  const forest = makeMap({
    viewId: 'view-forest', mapPath: 'Maps/Forest.atlasmap',
    persistedHistory: [shared, { id: 'toolbar-roll', timestamp: 299, formula: 'd6', total: 3, source: { type: 'toolbar' } }],
  });
  const citadel = makeMap({
    viewId: 'view-citadel', mapPath: 'Maps/Citadel.atlasmap',
    persistedHistory: [{ id: 'other-sheet-roll', timestamp: 301, formula: '2d6', total: 8, source: { type: 'statblock', statblockPath: 'Characters/Borin.md' } }],
  });
  const savedForgeEntry = {
    id: 'same-map-roll', timestamp: 300, formula: 'd20+4', total: 19, statblockPath: 'Characters/Ayla.md',
    repeatable: true, engine: 'atlas',
    recipe: { engine: 'atlas', source: { statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack' }, diceSet: D12, mapPath: 'Maps/Forest.atlasmap', viewId: 'view-forest' },
  };
  const session = makeApp({ maps: [forest, citadel], history: [savedForgeEntry] });

  const aylaHistory = getForgeStatblockRollHistory(session.app, 'Characters/Ayla.md', 20);
  const borinHistory = getForgeStatblockRollHistory(session.app, 'Characters/Borin.md', 20);
  assert.deepEqual(aylaHistory.map((entry) => entry.id), ['same-map-roll']);
  assert.deepEqual(borinHistory.map((entry) => entry.id), ['other-sheet-roll']);
  assert.equal(aylaHistory[0].recipe.mapPath, 'Maps/Forest.atlasmap');
  assert.equal(aylaHistory[0].recipe.viewId, 'view-forest');
});

test('an unrelated native Atlas roll remains in its map log but never enters a Forge statblock history', () => {
  const map = makeMap({
    viewId: 'view-table',
    mapPath: 'Maps/Table.atlasmap',
    persistedHistory: [
      { id: 'toolbar', timestamp: 500, formula: 'd20', total: 12, source: { type: 'toolbar' } },
      { id: 'native-statblock', timestamp: 499, formula: 'd20+1', total: 15, source: { type: 'statblock', statblockPath: 'Characters/Native.md' } },
      { id: 'forge-statblock', timestamp: 498, formula: 'd20+2', total: 16, source: { type: 'statblock', statblockPath: 'Characters/Ayla.md' } },
    ],
  });
  const session = makeApp({ maps: [map] });
  const history = getForgeStatblockRollHistory(session.app, 'Characters/Ayla.md');
  assert.deepEqual(history.map((entry) => entry.id), ['forge-statblock']);
  assert.equal(getForgeStatblockRollHistory(session.app, 'Characters/Native.md')[0].id, 'native-statblock');
});

test('an Atlas map roll can be repeated on its original visible map, but never redirected to a different map', () => {
  const original = makeMap({ viewId: 'origin', mapPath: 'Maps/Origin.atlasmap', tokens: { 'ayla-token': { name: 'Ayla', offMap: false } } });
  const other = makeMap({ viewId: 'other', mapPath: 'Maps/Other.atlasmap' });
  const session = makeApp({ maps: [original, other] });
  const first = rollForgeStatblockWithAtlasDiceTool(session.app, 'd12+1', {
    statblockPath: 'Characters/Ayla.md', viewId: 'origin', tokenId: 'ayla-token', tokenName: 'Ayla',
    originContext: { viewId: 'origin', mapPath: 'Maps/Origin.atlasmap', tokenIds: ['ayla-token'] },
  }, D12, null, D12);
  assert.equal(first.engine, 'atlas');

  const repeated = repeatForgeStatblockRollFromHistory(session.app, first.roll.id);
  assert.equal(repeated.engine, 'atlas');
  assert.equal(original.calls.length, 2);
  assert.equal(other.calls.length, 0);
  assert.equal(original.calls[1].formula, 'd12+1');
});
