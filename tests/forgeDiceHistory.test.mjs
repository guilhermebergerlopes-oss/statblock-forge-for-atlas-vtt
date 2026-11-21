import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  forgeDiceHistoryForStatblock,
  isForgeDiceHistorySnapshotCurrent,
  readForgeDiceHistory,
  upsertForgeDiceHistory,
} from '../src/statblocks/forgeDiceHistoryStorage.ts';
import {
  getForgeStatblockRollHistory,
  repeatForgeStatblockRollFromHistory,
  rollForgeStatblockWithAtlasDiceTool,
} from '../src/statblocks/atlasRestDiceTool.ts';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';

const SET = {
  id: 'forge-custom-d12', name: 'Custom d12', builtIn: false,
  dice: [{ count: 1, sides: 12, name: 'Arcane', colour: '#8844cc' }], crit: 'natural',
  advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
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
  };
}

function makeMap({ viewId = 'view-1', mapPath = 'Maps/Forest.atlasmap', visible = true, diceLog = [], memory = [] } = {}) {
  const calls = [];
  const tool = {
    rollDice(formula, source, origin, options) {
      const result = {
        id: `${viewId}-roll-${calls.length + 1}`, timestamp: 500 + calls.length,
        formula, total: 17 + calls.length, source,
        ...(options?.advantage ? { advantage: options.advantage } : {}),
      };
      calls.push({ formula, source, origin, options, result });
      memory.unshift(result);
      return result;
    },
    rollingDice(set) { return { dice: set?.dice ?? [{ count: 1, sides: 20 }], advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' } }; },
    getState() { return { rollHistory: memory }; },
  };
  const store = { getState: () => ({ mapPath, diceLog, objects: { tokens: { goblin: { offMap: false } } } }) };
  const eventBus = { on() {}, off() {} };
  const serviceManager = {
    getRendererService: () => ({ getRenderer() {}, isInitialized: () => true }),
    getToolController: () => ({ getDiceTool: () => tool }),
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
  return { view, tool, calls, store, memory };
}

function makeApp({ maps = [], history = [] } = {}) {
  const plugin = makeHistoryPlugin(history);
  const leaves = maps.map((map) => ({ view: map.view }));
  const app = {
    plugins: { plugins: {
      'statblock-forge': plugin,
      'atlas-vtt': { manifest: { version: '0.17.0' } },
    } },
    workspace: {
      activeLeaf: leaves[0],
      getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? leaves : [],
    },
  };
  return { app, plugin };
}

test('history parser validates recipes and rejects malformed or duplicate entries', () => {
  const raw = [
    { id: 'a', timestamp: 10, formula: 'd12+2', total: 8, statblockPath: 'Ayla.md', repeatable: true, engine: 'forge', recipe: { engine: 'forge', source: { statblockPath: 'Ayla.md' }, diceSet: SET } },
    { id: 'a', timestamp: 11, formula: 'd12', total: 3, statblockPath: 'Ayla.md', repeatable: true, engine: 'forge', recipe: { engine: 'forge', source: { statblockPath: 'Ayla.md' }, diceSet: SET } },
    { id: 'bad', timestamp: NaN, formula: 'd20', total: 5, statblockPath: 'Ayla.md', repeatable: true, engine: 'forge' },
    { id: 'other', timestamp: 9, formula: 'd20', total: 5, statblockPath: 'Borin.md', repeatable: false, engine: 'forge' },
  ];
  const parsed = readForgeDiceHistory(raw);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].id, 'a');
  assert.equal(parsed[0].repeatable, true);
  assert.equal(parsed[1].repeatable, false);
  assert.deepEqual(forgeDiceHistoryForStatblock(parsed, 'Ayla.md').map((entry) => entry.id), ['a']);
});

test('history storage deduplicates ids, keeps newest rolls per statblock, and applies a global bound', () => {
  let entries = [];
  for (let index = 0; index < 23; index++) {
    const entry = { id: `roll-${index}`, timestamp: index, formula: 'd20', total: index, statblockPath: 'Ayla.md', repeatable: false, engine: 'forge' };
    entries = upsertForgeDiceHistory(entries, entry);
  }
  assert.equal(forgeDiceHistoryForStatblock(entries, 'Ayla.md', 50).length, 20);
  assert.equal(forgeDiceHistoryForStatblock(entries, 'Ayla.md')[0].id, 'roll-22');
  entries = upsertForgeDiceHistory(entries, { ...entries[0], timestamp: 100, total: 99 });
  assert.equal(forgeDiceHistoryForStatblock(entries, 'Ayla.md')[0].total, 99);
});

test('Forge off-map history survives JSON serialization and plugin reload before repetition', () => {
  const firstSession = makeApp();
  const first = rollForgeStatblockWithAtlasDiceTool(firstSession.app, 'd12+2', {
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack',
  }, SET, 'advantage', SET);
  assert.equal(first.engine, 'forge');
  assert.equal(first.available, true);
  assert.equal(firstSession.plugin.entries.length, 1);
  assert.equal(firstSession.plugin.entries[0].repeatable, true);
  assert.equal(firstSession.plugin.entries[0].recipe.diceSet.id, SET.id);
  assert.equal(firstSession.plugin.entries[0].recipe.advantage, 'advantage');

  // Model Obsidian data.json as it crosses an unload/reload boundary.
  const persistedData = JSON.parse(JSON.stringify({ forgeDiceHistory: firstSession.plugin.entries }));
  const reloaded = makeApp({ history: persistedData.forgeDiceHistory });
  assert.equal(getForgeStatblockRollHistory(reloaded.app, 'Characters/Ayla.md')[0].id, first.roll.id);

  const repeated = repeatForgeStatblockRollFromHistory(reloaded.app, first.roll.id);
  assert.equal(repeated.available, true);
  assert.equal(repeated.engine, 'forge');
  assert.equal(repeated.details.diceSet.id, SET.id);
  assert.equal(reloaded.plugin.entries.length, 2);
  assert.notEqual(reloaded.plugin.entries[0].id, first.roll.id);
});

test('Atlas map rolls are copied into Forge history with their originating map and replay on that map', () => {
  const map = makeMap();
  const { app, plugin } = makeApp({ maps: [map] });
  const first = rollForgeStatblockWithAtlasDiceTool(app, 'd20+4', {
    statblockPath: 'Characters/Ayla.md', viewId: 'view-1', tokenId: 'goblin', tokenName: 'Ayla', abilityName: 'Attack',
  }, SET, 'disadvantage', SET);
  assert.equal(first.engine, 'atlas');
  assert.equal(plugin.entries.length, 1);
  assert.equal(plugin.entries[0].recipe.mapPath, 'Maps/Forest.atlasmap');
  assert.equal(plugin.entries[0].recipe.viewId, 'view-1');
  assert.equal(plugin.entries[0].recipe.diceSet.id, SET.id);
  assert.equal(plugin.entries[0].advantage, 'disadvantage');

  const repeated = repeatForgeStatblockRollFromHistory(app, first.roll.id);
  assert.equal(repeated.engine, 'atlas');
  assert.equal(map.calls.length, 2);
  assert.equal(map.calls[1].formula, 'd20+4');
  assert.equal(map.calls[1].options.advantage, 'disadvantage');
  assert.equal(map.calls[1].options.set.id, SET.id);
});

test('Atlas history merges persisted diceLog and transient DiceTool history by id and filters by statblock', () => {
  const persisted = [
    { id: 'shared', timestamp: 30, formula: 'd20', total: 12, source: { type: 'statblock', statblockPath: 'Characters/Ayla.md', abilityName: 'Attack' } },
    { id: 'other', timestamp: 29, formula: 'd6', total: 4, source: { type: 'statblock', statblockPath: 'Characters/Borin.md' } },
  ];
  const transient = [
    { id: 'shared', timestamp: 30, formula: 'd20', total: 12, source: { type: 'statblock', statblockPath: 'Characters/Ayla.md', abilityName: 'Attack' } },
    { id: 'newer', timestamp: 31, formula: '2d6', total: 7, source: { type: 'statblock', statblockPath: 'Characters/Ayla.md', abilityName: 'Damage' } },
  ];
  const map = makeMap({ diceLog: persisted, memory: transient });
  const { app } = makeApp({ maps: [map] });
  const history = getForgeStatblockRollHistory(app, 'Characters/Ayla.md', 10);
  assert.deepEqual(history.map((entry) => entry.id), ['newer', 'shared']);
  assert.equal(history.every((entry) => entry.engine === 'atlas'), true);
  assert.equal(history.every((entry) => entry.repeatable), true);
});

test('Forge history remains available after the map closes when no compatibility fork is installed', () => {
  const { app, plugin } = makeApp();
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
  const roll = rollForgeStatblockWithAtlasDiceTool(app, 'd12+1', { statblockPath: 'Characters/Ayla.md' }, SET, null, SET);
  assert.equal(getForgeStatblockRollHistory(app, 'Characters/Ayla.md').length, 1);
  assert.equal(repeatForgeStatblockRollFromHistory(app, roll.roll.id).available, true);
  assert.equal(plugin.entries.length, 2);
});

test('an Atlas-origin history entry falls back to the Forge roller when its original map is closed', () => {
  const map = makeMap();
  const { app, plugin } = makeApp({ maps: [map] });
  const roll = rollForgeStatblockWithAtlasDiceTool(app, 'd20+2', { statblockPath: 'Characters/Ayla.md' }, SET, null, SET);
  const saved = plugin.entries[0];
  app.workspace.getLeavesOfType = () => [];
  const repeated = repeatForgeStatblockRollFromHistory(app, saved.id);
  assert.equal(roll.engine, 'atlas');
  assert.equal(repeated.available, true);
  assert.equal(repeated.engine, 'forge');
  assert.ok(repeated.details);
});


test('a queued history save is stale when another roll is recorded during the write', () => {
  assert.equal(isForgeDiceHistorySnapshotCurrent(4, 4), true);
  assert.equal(isForgeDiceHistorySnapshotCurrent(4, 5), false);
  assert.equal(isForgeDiceHistorySnapshotCurrent(Number.NaN, 4), false);
});

test('a live Atlas map snapshot remains repeatable when its persisted Forge entry lacks a Dice Set', () => {
  const id = 'legacy-without-saved-set';
  const saved = [{
    id, timestamp: 700, formula: 'd20+2', total: 14, statblockPath: 'Characters/Ayla.md',
    repeatable: true, engine: 'atlas',
    recipe: { engine: 'atlas', source: { statblockPath: 'Characters/Ayla.md', tokenId: 'goblin' }, mapPath: 'Maps/Forest.atlasmap', viewId: 'view-1' },
  }];
  const persisted = [{
    id, timestamp: 700, formula: 'd20+2', total: 14,
    source: { type: 'statblock', statblockPath: 'Characters/Ayla.md', tokenId: 'goblin' },
  }];
  const map = makeMap({ diceLog: persisted });
  const { app } = makeApp({ maps: [map], history: saved });
  const history = getForgeStatblockRollHistory(app, 'Characters/Ayla.md');
  assert.equal(history.length, 1);
  assert.equal(history[0].repeatable, true);
  const repeated = repeatForgeStatblockRollFromHistory(app, id);
  assert.equal(repeated.available, true);
  assert.equal(repeated.engine, 'atlas');
  assert.equal(map.calls.length, 1);
});


test('history parser applies the 500-entry global bound across statblocks', () => {
  const raw = [];
  for (let sheet = 0; sheet < 25; sheet++) {
    for (let roll = 0; roll < 21; roll++) {
      raw.push({
        id: `sheet-${sheet}-roll-${roll}`, timestamp: sheet * 100 + roll,
        formula: 'd20', total: 10, statblockPath: `Characters/Sheet-${sheet}.md`,
        repeatable: false, engine: 'forge',
      });
    }
  }
  const parsed = readForgeDiceHistory(raw);
  assert.equal(parsed.length, 500);
  for (let sheet = 0; sheet < 25; sheet++) {
    assert.equal(forgeDiceHistoryForStatblock(parsed, `Characters/Sheet-${sheet}.md`, 20).length, 20);
  }
});

test('plugin persistence uses a revision guard for history writes', async () => {
  const mainSource = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
  assert.match(mainSource, /import\s*\{[\s\S]*?isForgeDiceHistorySnapshotCurrent[\s\S]*?\}\s*from\s*['"]\.\/src\/statblocks\/forgeDiceHistoryStorage\.ts['"]/);
  assert.match(mainSource, /forgeDiceHistoryRevision\s*\+=\s*1/);
  assert.match(mainSource, /const historyRevisionAtSnapshot\s*=\s*this\.forgeDiceHistoryRevision/);
  assert.match(mainSource, /isForgeDiceHistorySnapshotCurrent\(historyRevisionAtSnapshot, this\.forgeDiceHistoryRevision\)/);
  assert.match(mainSource, /this\.saveData\(snapshot\)/);
});
