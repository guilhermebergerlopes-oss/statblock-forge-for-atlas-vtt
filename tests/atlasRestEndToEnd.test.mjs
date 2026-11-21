import assert from 'node:assert/strict';
import test from 'node:test';
import { atlasRestResourceContextForNote, persistAtlasRestResourceChangesWithReceipt, rollbackAtlasRestResourceChanges } from '../src/atlas/atlasRestResources.ts';
import { calculateRestCounters } from '../src/statblocks/restRecoveryModel.ts';
import { runRestNotePersistenceWithAtlasRollback } from '../src/statblocks/restPersistenceTransaction.ts';

const NOTE = 'Characters/Ayla.md';
const COLLECTION = 'heroes';
const PARTY_STRESS_KEY = JSON.stringify(['campaign', 'pc-main', 'stress']);
const TEMPLATE = {
  format: 'atlas-statblock-template',
  version: 1,
  id: 'hero-template',
  fields: [
    { key: 'hp', label: 'Hit Points', type: 'number', meaning: 'hit-points' },
    { key: 'mana', label: 'Mana', type: 'number' },
    { key: 'stress', label: 'Stress', type: 'number' },
    { key: 'guard', label: 'Guard', type: 'number' },
  ],
  layout: { maxColumns: 2, blocks: [] },
};
const SETTINGS = {
  resources: [
    { key: 'hp', name: 'Health', field: 'hp', direction: 'drains', color: '#22c55e' },
    { key: 'mana', name: 'Mana', field: 'mana', direction: 'drains', color: '#3b82f6' },
    { key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', color: '#a855f7' },
    { key: 'guard', name: 'Guard', field: 'guard', direction: 'static', color: '#64748b' },
  ],
};
const ASSETS = [
  { id: 'pc-main', name: 'Ayla', collection: COLLECTION, statblockPath: NOTE, playerCharacter: true, createdAt: 10, imagePath: 'ayla.webp' },
  { id: 'pc-wolf', name: 'Ayla — Wolf Form', collection: COLLECTION, statblockPath: NOTE, playerCharacter: true, createdAt: 20, imagePath: 'ayla-wolf.webp' },
];

function makeStore(tokens, partyValues = {}, { playerView = false } = {}) {
  let state = {
    mapLoaded: true,
    isMapLoading: false,
    isPlayerView: playerView,
    objects: { tokens: structuredClone(tokens) },
    partyValues: structuredClone(partyValues),
  };
  const calls = { tokenWrites: 0, partyWrites: 0, tokenBatches: [], partySnapshots: [] };
  state.updateTokens = (entries) => {
    calls.tokenWrites += 1;
    calls.tokenBatches.push(structuredClone(entries));
    const next = { ...state.objects.tokens };
    for (const entry of entries) {
      const previous = next[entry.id] ?? {};
      next[entry.id] = { ...previous, ...structuredClone(entry.changes) };
    }
    state = { ...state, objects: { ...state.objects, tokens: next } };
  };
  return {
    calls,
    getState: () => state,
    setState(partial) {
      calls.partyWrites += 1;
      calls.partySnapshots.push(structuredClone(partial));
      state = { ...state, ...structuredClone(partial) };
    },
  };
}

function makeView(store, shown = true) {
  const assetService = {
    loadedTokenAssets: () => ASSETS,
    loadedCollections: () => [{ id: COLLECTION, name: 'Heroes', settings: SETTINGS }],
    getCollectionSettings: (id) => id === COLLECTION ? SETTINGS : null,
  };
  return {
    containerEl: { isShown: () => shown },
    serviceManager: {
      getAssetService: () => assetService,
      getStore: () => store,
    },
  };
}

function makeApp(views) {
  return { workspace: { getLeavesOfType: (type) => type === 'atlas-vtt' ? views.map((view) => ({ view })) : [] } };
}

function makeScenario() {
  const main = {
    id: 'main', assetId: 'pc-main',
    resources: {
      hp: { current: 4, max: 20 },
      mana: { current: 1, max: 5 },
      guard: { current: 2, max: 2 },
    },
  };
  const wolf = {
    id: 'wolf', assetId: 'pc-wolf',
    resources: {
      hp: { current: 10, max: 30 },
      mana: { current: 3, max: 8 },
      guard: { current: 3, max: 3 },
    },
    overriddenMax: ['hp', 'mana'],
  };
  const extra = {
    id: 'extra', assetId: 'pc-main',
    resources: {
      hp: { current: 6, max: 20 },
      mana: { current: 2, max: 6 },
      guard: { current: 4, max: 4 },
    },
  };
  const party = {
    [PARTY_STRESS_KEY]: { current: 5, max: 8, maxByHand: true },
    [JSON.stringify(['campaign', 'pc-main', 'unrelated'])]: { current: 2, max: 4 },
  };
  const visible = makeStore({ main, wolf }, party);
  const hidden = makeStore({ extra }, party);
  const player = makeStore({ playerCopy: { id: 'playerCopy', assetId: 'pc-main', resources: { hp: { current: 99, max: 99 } } } }, party, { playerView: true });
  const app = makeApp([makeView(visible, true), makeView(hidden, false), makeView(player, true)]);
  const context = atlasRestResourceContextForNote(app, NOTE);
  assert.ok(context, 'linked Forge character should resolve from the Atlas runtime');
  return { app, context, visible, hidden, player, partyBefore: party, tokenBefore: [main, wolf, extra] };
}

function calculateFullRest(context) {
  return calculateRestCounters({
    template: TEMPLATE,
    data: { hp: 4, mana: 1, stress: 5, guard: 2 },
    button: {
      id: 'full-rest',
      name: 'Full Rest',
      rules: [
        { target: { kind: 'resource', field: 'hp' }, does: 'full' },
        { target: { kind: 'resource', field: 'mana' }, does: 'full' },
        { target: { kind: 'resource', field: 'stress' }, does: 'full' },
        { target: { kind: 'resource', field: 'guard' }, does: 'full' },
      ],
    },
    collectionResources: context.resources,
  });
}

function toAtlasChanges(calculation) {
  return calculation.resourceChanges
    .filter((change) => change.storage === 'atlas' && typeof change.resourceKey === 'string')
    .map(({ resourceKey, from, to, max, direction }) => ({ resourceKey, from, to, max, direction }));
}

function assertFullRestState({ visible, hidden, player }) {
  const tokens = visible.getState().objects.tokens;
  assert.deepEqual(tokens.main.resources.hp, { current: 20, max: 20 });
  assert.deepEqual(tokens.main.resources.mana, { current: 5, max: 5 });
  assert.deepEqual(tokens.main.resources.guard, { current: 2, max: 2 });
  assert.deepEqual(tokens.wolf.resources.hp, { current: 30, max: 30 });
  assert.deepEqual(tokens.wolf.resources.mana, { current: 8, max: 8 });
  assert.deepEqual(tokens.wolf.resources.guard, { current: 3, max: 3 });
  assert.deepEqual(tokens.wolf.overriddenMax, ['hp', 'mana']);
  const extra = hidden.getState().objects.tokens.extra;
  assert.deepEqual(extra.resources.hp, { current: 20, max: 20 });
  assert.deepEqual(extra.resources.mana, { current: 6, max: 6 });
  assert.deepEqual(extra.resources.guard, { current: 4, max: 4 });
  assert.deepEqual(visible.getState().partyValues[PARTY_STRESS_KEY], { current: 0, max: 8, maxByHand: true });
  assert.deepEqual(hidden.getState().partyValues[PARTY_STRESS_KEY], { current: 0, max: 8, maxByHand: true });
  assert.deepEqual(visible.getState().partyValues[JSON.stringify(['campaign', 'pc-main', 'unrelated'])], { current: 2, max: 4 });
  assert.deepEqual(player.getState().objects.tokens.playerCopy.resources.hp, { current: 99, max: 99 });
}

test('end-to-end full Rest commits token-held and PartySync Resources across forms and maps', async () => {
  const scenario = makeScenario();
  const calculation = calculateFullRest(scenario.context);
  assert.deepEqual(calculation.resourceChanges.map((change) => [change.resourceKey, change.from, change.to, change.direction]), [
    ['hp', 4, 20, 'down'],
    ['mana', 1, 5, 'down'],
    ['stress', 5, 0, 'up'],
  ]);
  assert.deepEqual(calculation.skipped.map((item) => item.reason), ['static-resource']);

  let persistedNote = { restCount: 0 };
  await runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    const commit = persistAtlasRestResourceChangesWithReceipt(scenario.context, toAtlasChanges(calculation));
    registerReceipt(commit.receipt);
    assert.equal(commit.updated, 5); // three placed token copies and two PartySync stores
    persistedNote = { restCount: 1 };
  }, rollbackAtlasRestResourceChanges);

  assert.deepEqual(persistedNote, { restCount: 1 });
  assertFullRestState(scenario);
  assert.equal(scenario.visible.calls.tokenWrites, 1);
  assert.equal(scenario.hidden.calls.tokenWrites, 1);
  assert.equal(scenario.visible.calls.partyWrites, 1);
  assert.equal(scenario.hidden.calls.partyWrites, 1);
  assert.equal(scenario.player.calls.tokenWrites, 0);
  assert.equal(scenario.player.calls.partyWrites, 0);
});

test('end-to-end Markdown persistence failure rolls back all token forms and PartySync stores', async () => {
  const scenario = makeScenario();
  const beforeVisibleTokens = structuredClone(scenario.visible.getState().objects.tokens);
  const beforeHiddenTokens = structuredClone(scenario.hidden.getState().objects.tokens);
  const beforeVisibleParty = structuredClone(scenario.visible.getState().partyValues);
  const beforeHiddenParty = structuredClone(scenario.hidden.getState().partyValues);
  const calculation = calculateFullRest(scenario.context);

  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    const commit = persistAtlasRestResourceChangesWithReceipt(scenario.context, toAtlasChanges(calculation));
    registerReceipt(commit.receipt);
    // Models processFrontMatter succeeding in its callback but rejecting during the Vault write.
    throw new Error('Markdown/frontmatter persistence failed after Atlas commit');
  }, rollbackAtlasRestResourceChanges), /Markdown\/frontmatter persistence failed/);

  assert.deepEqual(scenario.visible.getState().objects.tokens, beforeVisibleTokens);
  assert.deepEqual(scenario.hidden.getState().objects.tokens, beforeHiddenTokens);
  assert.deepEqual(scenario.visible.getState().partyValues, beforeVisibleParty);
  assert.deepEqual(scenario.hidden.getState().partyValues, beforeHiddenParty);
  assert.equal(scenario.visible.calls.tokenWrites, 2); // commit + compensation
  assert.equal(scenario.hidden.calls.tokenWrites, 2);
  assert.equal(scenario.visible.calls.partyWrites, 2);
  assert.equal(scenario.hidden.calls.partyWrites, 2);
});

test('end-to-end JSON persistence failure rolls back all token forms and PartySync stores', async () => {
  const scenario = makeScenario();
  const beforeVisibleTokens = structuredClone(scenario.visible.getState().objects.tokens);
  const beforeHiddenTokens = structuredClone(scenario.hidden.getState().objects.tokens);
  const beforeVisibleParty = structuredClone(scenario.visible.getState().partyValues);
  const beforeHiddenParty = structuredClone(scenario.hidden.getState().partyValues);
  const originalJson = '{"restCount":0}\n';
  let persistedJson = originalJson;
  const calculation = calculateFullRest(scenario.context);

  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    const root = JSON.parse(originalJson);
    const commit = persistAtlasRestResourceChangesWithReceipt(scenario.context, toAtlasChanges(calculation));
    registerReceipt(commit.receipt);
    root.restCount = 1;
    const nextJson = `${JSON.stringify(root, null, 2)}\n`;
    assert.match(nextJson, /"restCount": 1/);
    throw new Error('JSON Vault persistence failed after Atlas commit');
  }, rollbackAtlasRestResourceChanges), /JSON Vault persistence failed/);

  assert.equal(persistedJson, originalJson);
  assert.deepEqual(scenario.visible.getState().objects.tokens, beforeVisibleTokens);
  assert.deepEqual(scenario.hidden.getState().objects.tokens, beforeHiddenTokens);
  assert.deepEqual(scenario.visible.getState().partyValues, beforeVisibleParty);
  assert.deepEqual(scenario.hidden.getState().partyValues, beforeHiddenParty);
});

test('an intervening edit to one form blocks the whole cross-map rollback without overwriting newer state', async () => {
  const scenario = makeScenario();
  const calculation = calculateFullRest(scenario.context);
  const beforeVisibleTokens = structuredClone(scenario.visible.getState().objects.tokens);

  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    const commit = persistAtlasRestResourceChangesWithReceipt(scenario.context, toAtlasChanges(calculation));
    registerReceipt(commit.receipt);
    // A later action changes one form after the Rest commit but before the note write rejects.
    scenario.hidden.getState().updateTokens([{ id: 'extra', changes: { resources: {
      ...scenario.hidden.getState().objects.tokens.extra.resources,
      mana: { current: 4, max: 6 },
    } } }]);
    throw new Error('note write failed after a concurrent token edit');
  }, rollbackAtlasRestResourceChanges), (error) => {
    assert.match(error.message, /note write failed/);
    assert.match(error.message, /mudou após a gravação/);
    return true;
  });

  // Rollback preflight is receipt-wide: it refuses before reverting any other store.
  assert.deepEqual(scenario.visible.getState().objects.tokens.main.resources.hp, { current: 20, max: 20 });
  assert.deepEqual(scenario.visible.getState().objects.tokens.wolf.resources.mana, { current: 8, max: 8 });
  assert.deepEqual(scenario.hidden.getState().objects.tokens.extra.resources.mana, { current: 4, max: 6 });
  assert.deepEqual(beforeVisibleTokens.main.resources.hp, { current: 4, max: 20 });
});

test('a stale Resource copy on a later map aborts the full multi-Resource Rest before any commit write', () => {
  const scenario = makeScenario();
  const calculation = calculateFullRest(scenario.context);
  scenario.hidden.getState().updateTokens([{ id: 'extra', changes: { resources: {
    ...scenario.hidden.getState().objects.tokens.extra.resources,
    mana: { current: 3, max: 6 },
  } } }]);
  const visibleAfterExternalChange = structuredClone(scenario.visible.getState().objects.tokens);
  const hiddenAfterExternalChange = structuredClone(scenario.hidden.getState().objects.tokens);

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(scenario.context, toAtlasChanges(calculation)), /mudou desde o cálculo/);
  assert.deepEqual(scenario.visible.getState().objects.tokens, visibleAfterExternalChange);
  assert.deepEqual(scenario.hidden.getState().objects.tokens, hiddenAfterExternalChange);
  assert.equal(scenario.visible.calls.tokenWrites, 0);
  assert.equal(scenario.hidden.calls.tokenWrites, 1); // only the deliberate external edit
  assert.equal(scenario.visible.calls.partyWrites, 0);
  assert.equal(scenario.hidden.calls.partyWrites, 0);
});
