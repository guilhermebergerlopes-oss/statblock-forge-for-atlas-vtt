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

const SET = {
  id: 'custom-d12',
  name: 'Custom d12',
  builtIn: false,
  dice: [{ count: 1, sides: 12 }],
  crit: 'natural',
  advantage: { kind: 'keep' },
  disadvantage: { kind: 'keep' },
};

function appWithoutScene(publicAPI) {
  return {
    workspace: { getLeavesOfType: () => [] },
    plugins: { plugins: { 'statblock-forge-atlas-compat': { publicAPI } } },
  };
}

function publicAPI(overrides = {}) {
  const calls = { roll: [], rules: [] };
  const dice = {
    rollStatblock(request) {
      calls.roll.push(request);
      return { id: 'roll-off-map-1', formula: request.formula, total: 9, timestamp: 123 };
    },
    rollingDiceForStatblock(request) {
      calls.rules.push(request);
      return {
        dice: [{ count: 1, sides: 12 }],
        advantage: { kind: 'keep' },
        disadvantage: { kind: 'keep' },
      };
    },
    ...overrides,
  };
  return {
    calls,
    value: {
      apiVersion: 1,
      capabilities: ['sheets.contract', 'dice.statblock-rolls'],
      dice,
    },
  };
}

test('a statblock roll uses Atlas public off-map roller when no map scene is open', () => {
  const atlas = publicAPI();
  const app = appWithoutScene(atlas.value);
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+4', {
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack',
  }, SET, 'advantage');

  assert.equal(result.available, true);
  assert.deepEqual(result.roll, { id: 'roll-off-map-1', formula: 'd20+4', total: 9 });
  assert.equal(atlas.calls.roll.length, 1);
  assert.deepEqual(atlas.calls.roll[0], {
    formula: 'd20+4',
    source: { type: 'statblock', statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack' },
    set: SET,
    advantage: 'advantage',
  });
});

test('off-map default bonus formula and advantage menu use Atlas collection or explicit set rules', () => {
  const atlas = publicAPI();
  const app = appWithoutScene(atlas.value);

  assert.equal(forgeStatblockDefaultRollFormula(app, SET, 'Characters/Ayla.md'), '1d12');
  assert.deepEqual(forgeStatblockRollMenuSides(app, 'd12+3', SET, 'Characters/Ayla.md'), ['advantage', 'disadvantage']);
  assert.equal(atlas.calls.rules.length, 2);
  assert.equal(atlas.calls.rules[0].source.statblockPath, 'Characters/Ayla.md');
  assert.deepEqual(atlas.calls.rules[0].set, SET);
});

test('Rest rolls share the same scene-independent Atlas route', () => {
  const atlas = publicAPI();
  const app = appWithoutScene(atlas.value);
  const result = rollForgeRestWithAtlasDiceTool(app, '2d8+2', {
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Rest',
  }, SET);
  assert.equal(result.available, true);
  assert.equal(atlas.calls.roll[0].source.abilityName, 'Rest');
});


test('the public history capability exposes statblock-scoped recent rolls and repeats by id', () => {
  const history = [{
    id: 'history-1', formula: '2d6+3', total: 11, timestamp: 456,
    statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack', advantage: 'advantage', repeatable: true,
  }];
  const calls = { history: [], repeat: [] };
  const atlas = publicAPI({
    getStatblockRollHistory(request) { calls.history.push(request); return history; },
    repeatStatblockRoll(request) {
      calls.repeat.push(request);
      return { id: 'history-2', formula: '2d6+3', total: 8, timestamp: 789 };
    },
  });
  atlas.value.capabilities.push('dice.statblock-history');
  const app = appWithoutScene(atlas.value);

  assert.equal(hasForgeStatblockRollHistory(app), true);
  assert.deepEqual(getForgeStatblockRollHistory(app, 'Characters/Ayla.md', 5), history);
  assert.deepEqual(calls.history, [{ statblockPath: 'Characters/Ayla.md', limit: 5 }]);
  assert.deepEqual(repeatForgeStatblockRollFromHistory(app, 'history-1'), {
    available: true, roll: { id: 'history-2', formula: '2d6+3', total: 8 },
  });
  assert.deepEqual(calls.repeat, [{ id: 'history-1' }]);
});

test('Forge preserves Atlas non-repeatable history markers and refuses to replay them', () => {
  const atlas = publicAPI({
    getStatblockRollHistory: () => [{
      id: 'legacy-custom-set', formula: '+2', total: 14, timestamp: 456,
      statblockPath: 'Characters/Ayla.md', repeatable: false,
    }],
    repeatStatblockRoll: () => null,
  });
  atlas.value.capabilities.push('dice.statblock-history');
  const app = appWithoutScene(atlas.value);

  const entries = getForgeStatblockRollHistory(app, 'Characters/Ayla.md');
  assert.equal(entries[0].repeatable, false);
  assert.deepEqual(repeatForgeStatblockRollFromHistory(app, entries[0].id), { available: true, roll: null });
});

test('Forge routes through the versioned history API when available, even with a visible map', () => {
  const atlas = publicAPI({
    getStatblockRollHistory: () => [],
    repeatStatblockRoll: () => null,
  });
  atlas.value.capabilities.push('dice.statblock-history');
  const mapCalls = [];
  const mapTool = {
    rollDice(formula) { mapCalls.push(formula); return { id: 'map-roll', formula, total: 20 }; },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }] }),
  };
  const app = {
    ...appWithoutScene(atlas.value),
    workspace: { getLeavesOfType: () => [{ view: {
      containerEl: { isShown: () => true },
      serviceManager: { getToolController: () => ({ getDiceTool: () => mapTool }) },
    } }] },
  };

  const attempt = rollForgeStatblockWithAtlasDiceTool(app, 'd20+2', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(attempt.available, true);
  assert.equal(atlas.calls.roll.length, 1);
  assert.deepEqual(mapCalls, []);
});

test('a hidden Atlas map tab does not capture a roll whose display would be hidden', () => {
  const atlas = publicAPI();
  const mapCalls = [];
  const hiddenMapTool = {
    rollDice(formula) {
      mapCalls.push(formula);
      return { id: 'hidden-map-roll', formula, total: 14 };
    },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }] }),
  };
  const app = {
    ...appWithoutScene(atlas.value),
    workspace: {
      getLeavesOfType: () => [{ view: {
        containerEl: { isShown: () => false },
        serviceManager: { getToolController: () => ({ getDiceTool: () => hiddenMapTool }) },
      } }],
    },
  };

  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+1', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.roll.total, 9);
  assert.equal(mapCalls.length, 0);
  assert.equal(atlas.calls.roll.length, 1);
});

test('an open map Dice Tool remains preferred over the app-wide roller', () => {
  const atlas = publicAPI();
  const mapCalls = [];
  const mapTool = {
    rollDice(formula, source, origin, options) {
      mapCalls.push({ formula, source, origin, options });
      return { id: 'map-roll-1', formula, total: 14 };
    },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }], advantage: { kind: 'keep' } }),
  };
  const app = {
    ...appWithoutScene(atlas.value),
    workspace: {
      getLeavesOfType: () => [{ view: {
        containerEl: { isShown: () => true },
        serviceManager: { getToolController: () => ({ getDiceTool: () => mapTool }) },
      } }],
    },
  };

  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+2', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.roll.total, 14);
  assert.equal(mapCalls.length, 1);
  assert.equal(atlas.calls.roll.length, 0);
});

test('older Atlas versions without the off-map capability remain unavailable without a scene', () => {
  const app = appWithoutScene({ apiVersion: 1, capabilities: ['sheets.contract'], dice: publicAPI().value.dice });
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', { statblockPath: 'Characters/Ayla.md' });
  assert.deepEqual(result, { available: false, roll: null });
});

test('wrong API versions are not called for scene-independent rolls', () => {
  const atlas = publicAPI();
  const app = appWithoutScene({ ...atlas.value, apiVersion: 2 });
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.available, false);
  assert.equal(atlas.calls.roll.length, 0);
});
