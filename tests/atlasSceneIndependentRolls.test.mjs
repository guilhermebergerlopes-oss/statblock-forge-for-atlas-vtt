import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgeStatblockDefaultRollFormula,
  forgeStatblockRollMenuSides,
  getForgeStatblockRollHistory,
  hasForgeStatblockRollHistory,
  repeatForgeStatblockRollFromHistory,
  rollForgeRestWithAtlasDiceTool,
  rollForgeStatblockWithAtlasDiceTool,
} from '../src/statblocks/atlasRestDiceTool.ts';
import { upsertForgeDiceHistory } from '../src/statblocks/forgeDiceHistoryStorage.ts';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';

const SET = {
  id: 'custom-d12', name: 'Custom d12', builtIn: false,
  dice: [{ count: 1, sides: 12 }], crit: 'natural',
  advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};

function appWithoutScene() {
  let history = [];
  const forgePlugin = {
    getForgeDiceHistoryEntries(path, limit = 20) { return history.filter((entry) => entry.statblockPath === path).slice(0, limit); },
    getForgeDiceHistoryEntry(id) { return history.find((entry) => entry.id === id) ?? null; },
    recordForgeDiceHistoryEntry(entry) { history = upsertForgeDiceHistory(history, entry); },
  };
  return {
    __forgeHistory: () => history,
    workspace: { getLeavesOfType: () => [] },
    plugins: { plugins: { 'statblock-forge': forgePlugin } },
  };
}

function appWithMap(mapTool, visible = true) {
  const leaf = { view: {
    viewId: 'map-1',
    containerEl: { isShown: () => visible },
    serviceManager: { getToolController: () => ({ getDiceTool: () => mapTool }) },
  } };
  const app = appWithoutScene();
  app.workspace = {
    activeLeaf: leaf,
    getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? [leaf] : [],
  };
  return app;
}

test('a statblock roll uses Forge local roller when no Atlas map scene is open', () => {
  const app = appWithoutScene();
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+4', {
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack',
  }, SET, 'advantage', SET);

  assert.equal(result.available, true);
  assert.equal(result.engine, 'forge');
  assert.equal(typeof result.roll.total, 'number');
  assert.equal(result.roll.formula, 'd20+4');
  assert.equal(result.details.diceSet.id, 'custom-d12');
  assert.equal(result.details.source.statblockPath, 'Characters/Ayla.md');
  assert.equal(result.details.source.tokenName, 'Ayla');
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
});

test('off-map default bonus formula and advantage menu use Forge-resolved Dice Set rules', () => {
  const app = appWithoutScene();

  assert.equal(forgeStatblockDefaultRollFormula(app, SET, 'Characters/Ayla.md', undefined, SET), '1d12');
  assert.deepEqual(forgeStatblockRollMenuSides(app, 'd12+3', SET, 'Characters/Ayla.md', undefined, SET), ['advantage', 'disadvantage']);
});

test('Rest rolls use the Forge local roller without an Atlas or fork dice service', () => {
  const app = appWithoutScene();
  const result = rollForgeRestWithAtlasDiceTool(app, '2d8+2', {
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Rest',
  }, SET);
  assert.equal(result.available, true);
  assert.equal(result.engine, 'forge');
  assert.ok(result.roll);
});

test('Forge-owned history is statblock-scoped and repeats locally without an Atlas or fork plugin', () => {
  const app = appWithoutScene();
  const entry = {
    id: 'history-1', formula: '2d6+3', total: 11, timestamp: 456,
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack',
    advantage: 'advantage', repeatable: true, engine: 'forge',
    recipe: { engine: 'forge', source: { statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack' }, diceSet: SET, advantage: 'advantage' },
  };
  app.plugins.plugins['statblock-forge'].recordForgeDiceHistoryEntry(entry);

  assert.equal(hasForgeStatblockRollHistory(app), true);
  assert.deepEqual(getForgeStatblockRollHistory(app, 'Characters/Ayla.md', 5), [entry]);
  assert.deepEqual(getForgeStatblockRollHistory(app, 'Characters/Borin.md'), []);
  const repeated = repeatForgeStatblockRollFromHistory(app, 'history-1');
  assert.equal(repeated.available, true);
  assert.equal(repeated.engine, 'forge');
  assert.equal(repeated.roll.formula, '2d6+3');
  assert.ok(repeated.details);
  assert.equal(app.__forgeHistory().length, 2);
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
});

test('non-repeatable Forge history entries remain visible but cannot be replayed', () => {
  const app = appWithoutScene();
  app.plugins.plugins['statblock-forge'].recordForgeDiceHistoryEntry({
    id: 'legacy-custom-set', formula: '+2', total: 14, timestamp: 456,
    statblockPath: 'Characters/Ayla.md', repeatable: false, engine: 'forge',
  });
  const entries = getForgeStatblockRollHistory(app, 'Characters/Ayla.md');
  assert.equal(entries[0].repeatable, false);
  assert.deepEqual(repeatForgeStatblockRollFromHistory(app, entries[0].id), { available: false, roll: null });
});

test('the map DiceTool remains the roll destination when an Atlas map is open', () => {
  const mapCalls = [];
  const mapTool = {
    rollDice(formula) { mapCalls.push(formula); return { id: 'map-roll', formula, total: 20, timestamp: 123 }; },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }] }),
  };
  const app = appWithMap(mapTool);
  const attempt = rollForgeStatblockWithAtlasDiceTool(app, 'd20+2', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(attempt.available, true);
  assert.equal(attempt.engine, 'atlas');
  assert.deepEqual(mapCalls, ['d20+2']);
});

test('a hidden Atlas map does not capture a roll whose display would be hidden', () => {
  const mapCalls = [];
  const hiddenMapTool = {
    rollDice(formula) { mapCalls.push(formula); return { id: 'hidden-map-roll', formula, total: 14, timestamp: 123 }; },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }] }),
  };
  const app = appWithMap(hiddenMapTool, false);

  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+1', { statblockPath: 'Characters/Ayla.md' }, SET, null, SET);
  assert.equal(result.engine, 'forge');
  assert.equal(typeof result.roll.total, 'number');
  assert.equal(mapCalls.length, 0);
});

test('an open map DiceTool is preferred over Forge local rolling', () => {
  const mapCalls = [];
  const mapTool = {
    rollDice(formula, source, origin, options) {
      mapCalls.push({ formula, source, origin, options });
      return { id: 'map-roll-1', formula, total: 14, timestamp: 123 };
    },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }], advantage: { kind: 'keep' } }),
  };
  const app = appWithMap(mapTool);

  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+2', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.roll.total, 14);
  assert.equal(mapCalls.length, 1);
});

test('off-map rolls work without the Atlas plugin or the compatibility fork', () => {
  const app = appWithoutScene();
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', { statblockPath: 'Characters/Ayla.md' }, null, null, SET);
  assert.equal(result.available, true);
  assert.equal(result.engine, 'forge');
  assert.equal('atlas-vtt' in app.plugins.plugins, false);
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
});

test('local formula failures are identified as Forge rolls, not Atlas DiceTool failures', () => {
  const app = appWithoutScene();
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'not-a-dice-formula', {
    statblockPath: 'Characters/Ayla.md',
  }, SET, null, SET);
  assert.equal(result.available, true);
  assert.equal(result.engine, 'forge');
  assert.equal(result.roll, null);
  assert.equal(result.error, 'syntax');
});

test('missing local Dice Set is reported as Forge roller unavailable', () => {
  const app = appWithoutScene();
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.available, false);
  assert.equal(result.engine, 'forge');
});
