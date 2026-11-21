import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_DICE_PRESET_LIMITS,
  getAtlasDicePresetPinStates,
  resolveAtlasSavedRollCollection,
  saveAtlasDicePreset,
  toggleAtlasDicePresetPin,
} from '../src/atlas/atlasSavedRolls.ts';

const COLLECTIONS = [
  { id: 'Heroes', name: 'Heroes' },
  { id: 'Monsters', name: 'Monsters' },
  { id: 'Default', name: 'Default' },
];

function makeApp({
  version = '0.18.0',
  tokens = [],
  settings = {},
  collections = COLLECTIONS,
  defaultCollection = 'Default',
  playerView = false,
  shown = true,
  collectionSettingsWritable = true,
} = {}) {
  let currentSettings = structuredClone(settings);
  const updates = [];
  const service = {
    async getCollections() { return structuredClone(collections); },
    async getTokenAssets() { return structuredClone(tokens); },
    getDefaultCollectionId() { return defaultCollection; },
    getCollectionSettings(id) { return id === 'Heroes' || id === 'Monsters' || id === 'Default' ? currentSettings : null; },
    async updateCollectionSettings(id, partial) {
      updates.push({ id, partial: structuredClone(partial) });
      currentSettings = { ...currentSettings, ...structuredClone(partial) };
    },
  };
  if (!collectionSettingsWritable) delete service.updateCollectionSettings;
  const store = { getState: () => ({ isPlayerView: playerView }) };
  const renderer = { getTokenRenderer: () => ({ statblockSync: { tokenStatblockLinkService: {} } }) };
  const view = {
    getViewType: () => 'atlas-vtt',
    containerEl: { isShown: () => shown },
    serviceManager: {
      getRendererService: () => ({ isInitialized: () => true, getRenderer: () => renderer }),
      getToolController: () => ({ getDiceTool: () => ({ rollDice() {} }) }),
      getNotePreviewUIManager: () => ({ showOrCreatePreview() {}, hideAllUnpinnedPreviews() {} }),
      getAssetService: () => service,
      getStore: () => store,
    },
  };
  const app = {
    plugins: { plugins: { 'atlas-vtt': { manifest: { id: 'atlas-vtt', version } } } },
    workspace: { getLeavesOfType: (type) => type === 'atlas-vtt' ? [{ view }] : [] },
  };
  return { app, service, updates, getSettings: () => structuredClone(currentSettings) };
}

test('resolves a collection from an Atlas collection folder path', async () => {
  const { app } = makeApp();
  const collection = await resolveAtlasSavedRollCollection(app, 'atlas-vtt/collections/Heroes/statblocks/Aria.md');
  assert.equal(collection?.collectionId, 'Heroes');
  assert.equal(collection?.collectionName, 'Heroes');
});

test('resolves a collection from a token linked to the statblock', async () => {
  const { app } = makeApp({ tokens: [
    { id: 'npc', collection: 'Monsters', statblockPath: 'Creatures/Ogre.md' },
  ] });
  const collection = await resolveAtlasSavedRollCollection(app, 'Creatures/Ogre.md');
  assert.equal(collection?.collectionId, 'Monsters');
});

test('falls back to Atlas default collection when the note has no collection link', async () => {
  const { app } = makeApp({ defaultCollection: 'Heroes' });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.equal(collection?.collectionId, 'Heroes');
});

test('uses saved-roll settings on Atlas 0.18.0 and newer, but not older versions or player-view-only services', async () => {
  for (const version of ['0.18.0', '0.18.1', '0.19.0', '1.0.0']) {
    const supported = makeApp({ version });
    assert.ok(await resolveAtlasSavedRollCollection(supported.app, 'Notes/Roll.md'), version);
  }
  const older = makeApp({ version: '0.17.0' });
  assert.equal(await resolveAtlasSavedRollCollection(older.app, 'Notes/Roll.md'), null);
  const tooOld = makeApp({ version: '0.16.9' });
  assert.equal(await resolveAtlasSavedRollCollection(tooOld.app, 'Notes/Roll.md'), null);
  const player = makeApp({ playerView: true });
  assert.equal(await resolveAtlasSavedRollCollection(player.app, 'Notes/Roll.md'), null);
});

test('does not expose saved-roll actions when a later Atlas AssetService lacks collection write methods', async () => {
  const changedApi = makeApp({ version: '1.0.0', collectionSettingsWritable: false });
  assert.equal(await resolveAtlasSavedRollCollection(changedApi.app, 'Notes/Roll.md'), null);
});

test('saves a named roll through updateCollectionSettings and preserves other collection settings', async () => {
  const { app, updates, getSettings } = makeApp({ settings: { diceSetId: 'builtin:d20', resources: [{ key: 'hp' }] } });
  const collection = await resolveAtlasSavedRollCollection(app, 'atlas-vtt/collections/Heroes/Aria.md');
  assert.ok(collection);
  const saved = await saveAtlasDicePreset(collection, 'Sword Attack', '1d8+3', 'preset-1');
  assert.deepEqual(saved, { ok: true, preset: { id: 'preset-1', name: 'Sword Attack', formula: '1d8+3' } });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].id, 'Heroes');
  assert.deepEqual(getSettings(), {
    diceSetId: 'builtin:d20',
    resources: [{ key: 'hp' }],
    dicePresets: [{ id: 'preset-1', name: 'Sword Attack', formula: '1d8+3' }],
  });
});

test('saves a Dice Lab look as an independent copy of the active set', async () => {
  const { app, getSettings, updates } = makeApp();
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  const look = {
    dice: [{ count: 1, sides: 20, name: 'Ember', colour: '#cc6633' }],
    crit: 'roll-under',
    explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 0 },
    advantage: { kind: 'keep' },
    disadvantage: { kind: 'die', sides: 6, name: 'Penalty', colour: '#555555' },
  };
  const saved = await saveAtlasDicePreset(collection, 'Ember Strike', '+3', 'preset-look', look);
  assert.deepEqual(saved, { ok: true, preset: { id: 'preset-look', name: 'Ember Strike', formula: '+3', look } });
  assert.deepEqual(getSettings().dicePresets, [{ id: 'preset-look', name: 'Ember Strike', formula: '+3', look }]);
  assert.equal(updates.length, 1);
});

test('rejects malformed or incompatible look formulas rather than writing invalid Atlas presets', async () => {
  const { app, updates } = makeApp();
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  const look = { dice: [{ count: 1, sides: 20 }], crit: 'natural' };
  assert.deepEqual(await saveAtlasDicePreset(collection, 'Bad bonus', '1d20+3', 'bad-look-formula', look), { ok: false, reason: 'invalid-formula' });
  assert.deepEqual(await saveAtlasDicePreset(collection, 'Bad rule', '+3', 'bad-look-rule', { dice: [{ count: 1, sides: 20 }], crit: 'unknown' }), { ok: false, reason: 'invalid-formula' });
  assert.equal(updates.length, 0);
});

test('rejects Dice Lab looks with unreadable rules or a newer read-only format', async () => {
  const { app, updates } = makeApp();
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  const dice = [{ count: 1, sides: 20 }];
  assert.deepEqual(await saveAtlasDicePreset(collection, 'Bad advantage', '+3', 'bad-advantage', {
    dice, crit: 'natural', advantage: { kind: 'mystery' },
  }), { ok: false, reason: 'invalid-formula' });
  assert.deepEqual(await saveAtlasDicePreset(collection, 'New look format', '+3', 'new-format', {
    dice, crit: 'natural', format: 2,
  }), { ok: false, reason: 'invalid-formula' });
  assert.equal(updates.length, 0);
});

test('does not offer invalid or newer read-only looks in the pin menu', async () => {
  const { app } = makeApp({ settings: { dicePresets: [
    { id: 'bad-rule', name: 'Bad Rule', formula: '+3', look: {
      dice: [{ count: 1, sides: 20 }], crit: 'natural', advantage: { kind: 'mystery' },
    } },
    { id: 'new-format', name: 'New Format', formula: '+3', look: {
      dice: [{ count: 1, sides: 20 }], crit: 'natural', format: 2,
    } },
  ] } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  const activeSet = {
    id: 'active-d20', name: 'Active d20', builtIn: false,
    dice: [{ count: 1, sides: 20 }], crit: 'natural',
  };
  assert.deepEqual(getAtlasDicePresetPinStates(collection, '1d20+3', activeSet), []);
});

test('matches a Dice Lab preset to its original statblock formula for pin and unpin actions', async () => {
  const { app } = makeApp({ settings: {
    dicePresets: [{ id: 'sword-look', name: 'Sword Attack', formula: '+3', look: {
      dice: [{ count: 1, sides: 8, name: 'Flame', colour: '#cc6633' }], crit: 'natural',
    } }],
    diceRow: [{ kind: 'preset', id: 'sword-look' }],
  } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  const activeSet = {
    id: 'changed-set', name: 'Changed Set', builtIn: false,
    dice: [{ count: 1, sides: 8, name: 'Different Name', colour: '#ffffff' }], crit: 'doubles',
  };
  assert.deepEqual(getAtlasDicePresetPinStates(collection, '1d8+3', activeSet), [{
    id: 'sword-look', name: 'Sword Attack', formula: '+3', pinned: true,
  }]);
});

test('preserves written advantage and disadvantage in saved formulas', async () => {
  const { app } = makeApp();
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  const advantage = await saveAtlasDicePreset(collection, 'Sneak Attack', '1d20+5 adv', 'preset-adv');
  const disadvantage = await saveAtlasDicePreset(collection, 'Stealth', '1d20+5 dis', 'preset-dis');
  assert.equal(advantage.ok && advantage.preset.formula, '1d20+5 adv');
  assert.equal(disadvantage.ok && disadvantage.preset.formula, '1d20+5 dis');
});

test('rejects invalid names, malformed formulas, and formula strings over Atlas limit', async () => {
  const { app } = makeApp();
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  assert.deepEqual(await saveAtlasDicePreset(collection, '   ', '1d20', 'bad-name'), { ok: false, reason: 'invalid-name' });
  assert.deepEqual(await saveAtlasDicePreset(collection, 'Broken', '1d20++2', 'bad-formula'), { ok: false, reason: 'invalid-formula' });
  assert.deepEqual(await saveAtlasDicePreset(collection, 'Long', `1d20+${'1'.repeat(ATLAS_DICE_PRESET_LIMITS.formulaLength)}`, 'long'), { ok: false, reason: 'invalid-formula' });
});

test('enforces Atlas saved-roll and name limits while retaining existing presets', async () => {
  const presets = Array.from({ length: ATLAS_DICE_PRESET_LIMITS.count }, (_, index) => ({
    id: `preset-${index}`, name: `Roll ${index}`, formula: '1d6',
  }));
  const { app } = makeApp({ settings: { dicePresets: presets } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  assert.deepEqual(await saveAtlasDicePreset(collection, 'One more', '1d6', 'overflow'), { ok: false, reason: 'limit-reached' });
  assert.deepEqual(await saveAtlasDicePreset(collection, 'x'.repeat(ATLAS_DICE_PRESET_LIMITS.nameLength + 1), '1d6', 'long-name'), { ok: false, reason: 'invalid-name' });
});


test('pins a saved roll after the seven standard Atlas dice and preserves saved rolls', async () => {
  const { app, updates, getSettings } = makeApp({ settings: {
    dicePresets: [{ id: 'sword', name: 'Sword Attack', formula: '1d8+3' }],
    diceSetId: 'builtin:d20',
  } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);

  const result = await toggleAtlasDicePresetPin(collection, 'sword');
  assert.deepEqual(result, { ok: true, pinned: true, presetName: 'Sword Attack' });
  assert.deepEqual(getSettings().diceRow, [
    { kind: 'die', sides: 4 }, { kind: 'die', sides: 6 }, { kind: 'die', sides: 8 },
    { kind: 'die', sides: 10 }, { kind: 'die', sides: 12 }, { kind: 'die', sides: 20 },
    { kind: 'die', sides: 100 }, { kind: 'preset', id: 'sword' },
  ]);
  assert.deepEqual(getSettings().dicePresets, [{ id: 'sword', name: 'Sword Attack', formula: '1d8+3' }]);
  assert.equal(updates.length, 1);
  assert.deepEqual(getAtlasDicePresetPinStates(collection, '1d8+3'), [{
    id: 'sword', name: 'Sword Attack', formula: '1d8+3', pinned: true,
  }]);
});

test('unpins only the selected saved roll and preserves custom row order and dice', async () => {
  const { app, updates, getSettings } = makeApp({ settings: {
    dicePresets: [
      { id: 'sword', name: 'Sword Attack', formula: '1d8+3' },
      { id: 'fire', name: 'Fireball', formula: '8d6' },
    ],
    diceRow: [
      { kind: 'die', sides: 12 }, { kind: 'preset', id: 'sword' },
      { kind: 'die', sides: 3 }, { kind: 'preset', id: 'fire' },
    ],
  } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);

  const result = await toggleAtlasDicePresetPin(collection, 'sword');
  assert.deepEqual(result, { ok: true, pinned: false, presetName: 'Sword Attack' });
  assert.deepEqual(getSettings().diceRow, [
    { kind: 'die', sides: 12 }, { kind: 'die', sides: 3 }, { kind: 'preset', id: 'fire' },
  ]);
  assert.equal(updates.length, 1);
  assert.deepEqual(getAtlasDicePresetPinStates(collection, '8d6'), [{
    id: 'fire', name: 'Fireball', formula: '8d6', pinned: true,
  }]);
});

test('refuses to pin when the Atlas row already contains ten positions, but still allows unpinning', async () => {
  const { app, updates, getSettings } = makeApp({ settings: {
    dicePresets: [
      { id: 'sword', name: 'Sword Attack', formula: '1d8+3' },
      { id: 'fire', name: 'Fireball', formula: '8d6' },
    ],
    diceRow: [
      { kind: 'die', sides: 4 }, { kind: 'die', sides: 6 }, { kind: 'die', sides: 8 },
      { kind: 'die', sides: 10 }, { kind: 'die', sides: 12 }, { kind: 'die', sides: 20 },
      { kind: 'die', sides: 100 }, { kind: 'die', sides: 3 },
      { kind: 'preset', id: 'fire' }, { kind: 'die', sides: 5 },
    ],
  } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);

  assert.deepEqual(await toggleAtlasDicePresetPin(collection, 'sword'), { ok: false, reason: 'row-full' });
  assert.equal(updates.length, 0);
  assert.deepEqual(await toggleAtlasDicePresetPin(collection, 'fire'), { ok: true, pinned: false, presetName: 'Fireball' });
  assert.equal(getSettings().diceRow.length, 9);
  assert.equal(updates.length, 1);
});

test('does not write a dice row for an unknown saved-roll id or unreadable collection settings', async () => {
  const { app, updates } = makeApp({ settings: { dicePresets: [{ id: 'sword', name: 'Sword Attack', formula: '1d8+3' }] } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  assert.deepEqual(await toggleAtlasDicePresetPin(collection, 'missing'), { ok: false, reason: 'preset-not-found' });
  assert.equal(updates.length, 0);
});

test('reports matching saved rolls separately when several presets use the same formula', async () => {
  const { app } = makeApp({ settings: {
    dicePresets: [
      { id: 'sword', name: 'Sword Attack', formula: '1d8+3' },
      { id: 'claw', name: 'Claw Attack', formula: '1d8+3' },
    ],
    diceRow: [{ kind: 'preset', id: 'claw' }],
  } });
  const collection = await resolveAtlasSavedRollCollection(app, 'Notes/Roll.md');
  assert.ok(collection);
  assert.deepEqual(getAtlasDicePresetPinStates(collection, '1d8+3'), [
    { id: 'sword', name: 'Sword Attack', formula: '1d8+3', pinned: false },
    { id: 'claw', name: 'Claw Attack', formula: '1d8+3', pinned: true },
  ]);
});
