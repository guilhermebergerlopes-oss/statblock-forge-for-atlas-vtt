import assert from 'node:assert/strict';
import test from 'node:test';
import {
  forgeStatblockDefaultRollFormula,
  forgeStatblockRollMenuSides,
  rollForgeStatblockWithAtlasDiceTool,
} from '../src/statblocks/atlasRestDiceTool.ts';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';

const SET = {
  id: 'custom-d12', name: 'Custom d12', builtIn: false,
  dice: [{ count: 1, sides: 12 }], crit: 'natural',
  advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};

function makeMap({ viewId, mapPath, visible = true, tokens = {}, dieSides = 20 } = {}) {
  const calls = { rolls: [], rules: [] };
  const diceTool = {
    rollDice(formula, source, origin, options) {
      calls.rolls.push({ formula, source, origin, options });
      return { id: `${viewId}-roll-${calls.rolls.length}`, formula, total: 17, timestamp: 123 };
    },
    rollingDice(set) {
      calls.rules.push(set);
      return { dice: set?.dice ?? [{ count: 1, sides: dieSides }], advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' } };
    },
    getState: () => ({ rollHistory: [] }),
  };
  const store = { getState: () => ({ mapPath, diceLog: [], objects: { tokens } }) };
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
  return { view, store, calls, diceTool };
}

function makeApp(maps, activeIndex = null, version = '0.17.0') {
  const leaves = maps.map((map) => ({ view: map.view }));
  return {
    workspace: {
      activeLeaf: activeIndex === null ? undefined : leaves[activeIndex],
      getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? leaves : [],
    },
    plugins: { plugins: { 'atlas-vtt': { manifest: { id: 'atlas-vtt', version } } } },
  };
}

test('Forge preview rolls through the exact originating map and supplies Atlas token origin without a fork', () => {
  const first = makeMap({ viewId: 'map-one', mapPath: 'Maps/One.atlasmap', tokens: { other: {} } });
  const origin = makeMap({ viewId: 'map-origin', mapPath: 'Maps/Origin.atlasmap', tokens: { 'token-7': { name: 'Ayla' } } });
  const app = makeApp([first, origin]);
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+4', {
    statblockPath: 'Characters/Ayla.md', viewId: 'map-origin', tokenId: 'token-7',
    tokenImagePath: 'assets/ayla.png', tokenName: 'Ayla', abilityName: 'Attack',
    originContext: { viewId: 'map-origin', mapPath: 'Maps/Origin.atlasmap', tokenIds: ['token-7'] },
  }, SET, 'advantage');

  assert.equal(result.available, true);
  assert.equal(result.roll.total, 17);
  assert.equal(first.calls.rolls.length, 0);
  assert.equal(origin.calls.rolls.length, 1);
  assert.deepEqual(origin.calls.rolls[0], {
    formula: 'd20+4',
    source: {
      type: 'statblock', statblockPath: 'Characters/Ayla.md', tokenId: 'token-7',
      tokenName: 'Ayla', tokenImagePath: 'assets/ayla.png', abilityName: 'Attack',
    },
    origin: { viewId: 'map-origin', mapPath: 'Maps/Origin.atlasmap', tokenId: 'token-7' },
    options: { set: SET, advantage: 'advantage' },
  });
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
});

test('Atlas 0.18.0 native DiceTool handles Forge statblock rolls through the verified runtime', () => {
  const map = makeMap({ viewId: 'map-018', mapPath: 'Maps/One.atlasmap' });
  const app = makeApp([map], null, '0.18.0');
  const result = rollForgeStatblockWithAtlasDiceTool(app, '2d6+3', { statblockPath: 'Characters/Borin.md' });
  assert.equal(result.available, true);
  assert.equal(result.roll.total, 17);
  assert.equal(map.calls.rolls.length, 1);
  assert.equal(map.calls.rolls[0].formula, '2d6+3');
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
});

test('native map DiceTool handles in-map rolls without the compatibility fork', () => {
  const map = makeMap({ viewId: 'map-one', mapPath: 'Maps/One.atlasmap' });
  const app = makeApp([map]);
  const result = rollForgeStatblockWithAtlasDiceTool(app, '2d6', { statblockPath: 'Characters/Borin.md' });
  assert.equal(result.roll.total, 17);
  assert.equal(map.calls.rolls.length, 1);
  assert.equal('forked-atlas-vtt-compatibility-for-statblock-forge' in app.plugins.plugins, false);
});

test('origin map is not replaced by a different visible map after it becomes hidden', () => {
  const hiddenOrigin = makeMap({ viewId: 'origin', mapPath: 'Maps/Origin.atlasmap', visible: false });
  const visibleOther = makeMap({ viewId: 'other', mapPath: 'Maps/Other.atlasmap' });
  const app = makeApp([hiddenOrigin, visibleOther]);
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', {
    statblockPath: 'Characters/Ayla.md', viewId: 'origin', tokenId: 'token-1',
  });
  assert.equal(result.available, true);
  assert.equal(result.roll, null);
  assert.match(result.error, /hidden/);
  assert.equal(hiddenOrigin.calls.rolls.length, 0);
  assert.equal(visibleOther.calls.rolls.length, 0);
});

test('captured scene mismatch refuses to roll into a newly loaded map in the same Atlas view', () => {
  const map = makeMap({ viewId: 'view-1', mapPath: 'Maps/New.atlasmap' });
  const app = makeApp([map]);
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', {
    statblockPath: 'Characters/Ayla.md', viewId: 'view-1', tokenId: 'token-1',
    originContext: { viewId: 'view-1', mapPath: 'Maps/Old.atlasmap', tokenIds: ['token-1'] },
  });
  assert.equal(result.roll, null);
  assert.match(result.error, /no longer available/);
  assert.equal(map.calls.rolls.length, 0);
});

test('multiple visible maps are disambiguated by the active Atlas leaf', () => {
  const first = makeMap({ viewId: 'first', mapPath: 'Maps/First.atlasmap' });
  const second = makeMap({ viewId: 'second', mapPath: 'Maps/Second.atlasmap' });
  const app = makeApp([first, second], 1);
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20+1', { statblockPath: 'Characters/Borin.md' });
  assert.equal(result.roll.total, 17);
  assert.equal(first.calls.rolls.length, 0);
  assert.equal(second.calls.rolls.length, 1);
});

test('map-specific default formula and advantage menu read rules from the originating map', () => {
  const first = makeMap({ viewId: 'first', mapPath: 'Maps/First.atlasmap', dieSides: 20 });
  const second = makeMap({ viewId: 'second', mapPath: 'Maps/Second.atlasmap', dieSides: 8 });
  const app = makeApp([first, second]);
  const context = { viewId: 'second' };
  assert.equal(forgeStatblockDefaultRollFormula(app, null, 'Characters/Ayla.md', context), '1d8');
  assert.deepEqual(forgeStatblockRollMenuSides(app, 'd8+2', null, 'Characters/Ayla.md', context), ['advantage', 'disadvantage']);
  assert.equal(first.calls.rules.length, 0);
  assert.equal(second.calls.rules.length, 2);
});

test('ambiguous visible map panes refuse a roll instead of selecting an arbitrary DiceTool', () => {
  const first = makeMap({ viewId: 'first', mapPath: 'Maps/First.atlasmap' });
  const second = makeMap({ viewId: 'second', mapPath: 'Maps/Second.atlasmap' });
  const app = makeApp([first, second]);
  const result = rollForgeStatblockWithAtlasDiceTool(app, 'd20', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.roll, null);
  assert.match(result.error, /more than one Atlas map/i);
  assert.equal(first.calls.rolls.length + second.calls.rolls.length, 0);
});

test('stale captured origin also blocks default formula and advantage menu lookups', () => {
  const map = makeMap({ viewId: 'view-1', mapPath: 'Maps/New.atlasmap' });
  const app = makeApp([map]);
  const context = {
    viewId: 'view-1',
    originContext: { viewId: 'view-1', mapPath: 'Maps/Old.atlasmap', tokenIds: ['token-1'] },
  };
  assert.equal(forgeStatblockDefaultRollFormula(app, null, 'Characters/Ayla.md', context), null);
  assert.deepEqual(forgeStatblockRollMenuSides(app, 'd20', null, 'Characters/Ayla.md', context), []);
  assert.equal(map.calls.rules.length, 0);
});


test('written adv/dis suffixes are passed intact to the Atlas Dice Tool', () => {
  const map = makeMap({ viewId: 'map-written-side', mapPath: 'Maps/WrittenSide.atlasmap' });
  const app = makeApp([map], null, '0.18.0');
  const result = rollForgeStatblockWithAtlasDiceTool(app, '1d20+5 adv', { statblockPath: 'Characters/Ayla.md' });
  assert.equal(result.available, true);
  assert.equal(result.roll.total, 17);
  assert.equal(map.calls.rolls.length, 1);
  assert.equal(map.calls.rolls[0].formula, '1d20+5 adv');
  assert.equal(map.calls.rolls[0].options, undefined);
});

test('the explicit opposite click side is forwarded so Atlas can cancel a written side', () => {
  const map = makeMap({ viewId: 'map-opposite-side', mapPath: 'Maps/OppositeSide.atlasmap' });
  const app = makeApp([map], null, '0.18.0');
  const result = rollForgeStatblockWithAtlasDiceTool(
    app, '1d20+5 adv', { statblockPath: 'Characters/Ayla.md' }, undefined, 'disadvantage',
  );
  assert.equal(result.available, true);
  assert.deepEqual(map.calls.rolls[0]?.options, { advantage: 'disadvantage' });
});
