import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRestCounters } from '../src/statblocks/restRecoveryModel.ts';
import { runRestNotePersistenceWithAtlasRollback } from '../src/statblocks/restPersistenceTransaction.ts';
import {
  atlasResourceFieldKeysForTemplate,
  atlasResourceMatchesForTemplate,
  atlasRestResourceContextForNote,
  atlasRestResourceDefinitionsForNote,
  persistAtlasRestResourceChangesWithReceipt,
  rollbackAtlasRestResourceChanges,
} from '../src/atlas/atlasRestResources.ts';
import { loadAtlasSystemPresetRules } from '../src/atlas/atlasSystemPresetRules.ts';

const NOTE = 'Characters/Ayla.md';
const COLLECTION = 'heroes';
const RESOURCE_SETTINGS = {
  resources: [
    { key: 'hp', name: 'Health', field: 'hp', direction: 'drains', color: '#22c55e' },
    { key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', color: '#a855f7' },
    { key: 'guard', name: 'Guard', field: 'guard', direction: 'static', color: '#64748b' },
  ],
};
const TEMPLATE = {
  format: 'atlas-statblock-template',
  version: 1,
  id: 'hero-template',
  fields: [
    { key: 'hp', label: 'Hit Points', type: 'number', meaning: 'hit-points' },
    { key: 'stress', label: 'Stress', type: 'number' },
    { key: 'guard', label: 'Guard', type: 'number' },
  ],
  layout: { maxColumns: 2, blocks: [] },
};

function makeStore(tokens = {}, partyValues = {}, stateExtras = {}) {
  let state = {
    mapLoaded: true,
    isMapLoading: false,
    isPlayerView: false,
    objects: { tokens: structuredClone(tokens) },
    partyValues: structuredClone(partyValues),
    ...stateExtras,
  };
  state.updateTokens = (entries) => {
    const next = { ...state.objects.tokens };
    for (const entry of entries) {
      const previous = next[entry.id] ?? {};
      next[entry.id] = { ...previous, ...structuredClone(entry.changes) };
    }
    state = { ...state, objects: { ...state.objects, tokens: next } };
  };
  return {
    getState: () => state,
    setState(partial) { state = { ...state, ...partial }; },
  };
}

function makeView(store, assets, { shown = true, settings = RESOURCE_SETTINGS } = {}) {
  const service = {
    loadedTokenAssets: () => assets,
    getCollectionSettings: (collectionId) => collectionId === COLLECTION ? settings : null,
  };
  return {
    containerEl: { isShown: () => shown },
    serviceManager: {
      getAssetService: () => service,
      getStore: () => store,
    },
  };
}

function makeApp(views) {
  return { workspace: { getLeavesOfType: (type) => type === 'atlas-vtt' ? views.map((view) => ({ view })) : [] } };
}

function linkedAssets() {
  return [
    { id: 'pc-main', name: 'Ayla', collection: COLLECTION, statblockPath: NOTE, playerCharacter: true, createdAt: 10, imagePath: 'ayla.webp' },
    { id: 'pc-wolf', name: 'Ayla — Wolf Form', collection: COLLECTION, statblockPath: NOTE, playerCharacter: true, createdAt: 20, imagePath: 'ayla-wolf.webp' },
    { id: 'not-player', name: 'Unlinked Creature', collection: COLLECTION, statblockPath: NOTE, imagePath: 'creature.webp' },
  ];
}

function recoveryButton(rule, name = 'Rest') {
  return { id: 'rest', name, rules: [rule] };
}

function calculate(context, rule, { data = { hp: 4, stress: 4, guard: 2 }, roll } = {}) {
  return calculateRestCounters({
    template: TEMPLATE,
    data,
    button: recoveryButton(rule),
    collectionResources: context.resources,
    ...(roll ? { roll } : {}),
  });
}

test('context discovery selects the canonical linked character and gathers every open-map form', () => {
  const assets = linkedAssets();
  const visible = makeStore({
    main: { assetId: 'pc-main', resources: { hp: { current: 4, max: 20 }, stress: { current: 5, max: 8 }, guard: { current: 2, max: 2 } } },
    wolf: { assetId: 'pc-wolf', resources: { hp: { current: 10, max: 30 }, stress: { current: 3, max: 9 }, guard: { current: 2, max: 2 } }, overriddenMax: ['hp'] },
    unrelated: { assetId: 'not-player', resources: { hp: { current: 1, max: 1 } } },
  });
  const hidden = makeStore({ extra: { assetId: 'pc-main', resources: { hp: { current: 6, max: 20 }, stress: { current: 6, max: 8 }, guard: { current: 2, max: 2 } } } });
  const playerStore = makeStore({ player: { assetId: 'pc-main', resources: { hp: { current: 99, max: 99 } } } }, {}, { isPlayerView: true });
  const app = makeApp([
    makeView(hidden, assets, { shown: false }),
    makeView(playerStore, assets),
    makeView(visible, assets, { shown: true }),
  ]);

  const context = atlasRestResourceContextForNote(app, NOTE);
  assert.ok(context);
  assert.equal(context.characterAssetId, 'pc-main');
  assert.equal(context.characterName, 'Ayla');
  assert.equal(context.collectionId, COLLECTION);
  assert.equal(context.resources.find((resource) => resource.key === 'hp')?.holder, 'token');
  assert.deepEqual(context.resources.find((resource) => resource.key === 'hp'), {
    key: 'hp', name: 'Health', field: 'hp', direction: 'drains', color: '#22c55e', visibleToPlayers: false,
    current: 4, max: 20, holder: 'token',
    tokenEntries: [
      { store: visible, tokenId: 'main', value: { current: 4, max: 20 }, rawValue: { current: 4, max: 20 }, overriddenMax: undefined },
      { store: visible, tokenId: 'wolf', value: { current: 10, max: 30 }, rawValue: { current: 10, max: 30 }, overriddenMax: ['hp'] },
      { store: hidden, tokenId: 'extra', value: { current: 6, max: 20 }, rawValue: { current: 6, max: 20 }, overriddenMax: undefined },
    ],
  });
  assert.deepEqual(context.stores.map((entry) => entry.tokenIds), [['main', 'wolf'], ['extra']]);
});

test('Forge calculates an Atlas-owned partial recovery without mutating the Forge note data', () => {
  const store = makeStore({ main: { assetId: 'pc-main', resources: { hp: { current: 4, max: 20 } } } });
  const context = atlasRestResourceContextForNote(makeApp([makeView(store, linkedAssets())]), NOTE);
  assert.ok(context);
  const data = { hp: 4 };
  const result = calculate(context, { target: { kind: 'resource', field: 'hp' }, does: 'amount', formula: '1d4' }, {
    data,
    roll: () => 3,
  });

  assert.deepEqual(data, { hp: 4 });
  assert.deepEqual(result.resourceChanges, [{
    field: 'hp', label: 'Health', from: 4, to: 7, max: 20, direction: 'down', resourceKey: 'hp', storage: 'atlas',
  }]);
  assert.deepEqual(result.skipped, []);

  const commit = persistAtlasRestResourceChangesWithReceipt(context, result.resourceChanges.map(({ resourceKey, from, to, max, direction }) => ({ resourceKey, from, to, max, direction })));
  assert.equal(commit.updated, 1);
  assert.deepEqual(store.getState().objects.tokens.main.resources.hp, { current: 7, max: 20 });
  assert.deepEqual(data, { hp: 4 });
});

test('full recovery writes every form to its own maximum and rollback restores the exact values', () => {
  const assets = linkedAssets();
  const visible = makeStore({
    main: { assetId: 'pc-main', resources: { hp: { current: 4, max: 20 }, stress: { current: 5, max: 8 } } },
    wolf: { assetId: 'pc-wolf', resources: { hp: { current: 10, max: 30 }, stress: { current: 3, max: 9 } }, overriddenMax: ['hp'] },
  });
  const hidden = makeStore({ extra: { assetId: 'pc-main', resources: { hp: { current: 6, max: 20 }, stress: { current: 6, max: 8 } } } });
  const context = atlasRestResourceContextForNote(makeApp([
    makeView(visible, assets), makeView(hidden, assets, { shown: false }),
  ]), NOTE);
  assert.ok(context);
  const hpResult = calculate(context, { target: { kind: 'resource', field: 'hp' }, does: 'full' });
  const change = hpResult.resourceChanges.map(({ resourceKey, from, to, max, direction }) => ({ resourceKey, from, to, max, direction }));
  const beforeVisible = structuredClone(visible.getState().objects.tokens);
  const beforeHidden = structuredClone(hidden.getState().objects.tokens);
  const commit = persistAtlasRestResourceChangesWithReceipt(context, change);

  assert.equal(commit.updated, 3);
  assert.deepEqual(visible.getState().objects.tokens.main.resources.hp, { current: 20, max: 20 });
  assert.deepEqual(visible.getState().objects.tokens.wolf.resources.hp, { current: 30, max: 30 });
  assert.deepEqual(visible.getState().objects.tokens.wolf.overriddenMax, ['hp']);
  assert.deepEqual(hidden.getState().objects.tokens.extra.resources.hp, { current: 20, max: 20 });

  rollbackAtlasRestResourceChanges(commit.receipt);
  assert.deepEqual(visible.getState().objects.tokens, beforeVisible);
  assert.deepEqual(hidden.getState().objects.tokens, beforeHidden);
});

test('filling Resources recover toward zero and static collection Resources are rejected', () => {
  const store = makeStore({ main: { assetId: 'pc-main', resources: { stress: { current: 5, max: 8 }, guard: { current: 2, max: 2 } } } });
  const context = atlasRestResourceContextForNote(makeApp([makeView(store, linkedAssets())]), NOTE);
  assert.ok(context);

  const stress = calculate(context, { target: { kind: 'resource', field: 'stress' }, does: 'full' });
  assert.deepEqual(stress.resourceChanges, [{
    field: 'stress', label: 'Stress', from: 5, to: 0, max: 8, direction: 'up', resourceKey: 'stress', storage: 'atlas',
  }]);
  persistAtlasRestResourceChangesWithReceipt(context, stress.resourceChanges.map(({ resourceKey, from, to, max, direction }) => ({ resourceKey, from, to, max, direction })));
  assert.deepEqual(store.getState().objects.tokens.main.resources.stress, { current: 0, max: 8 });

  const guard = calculate(context, { target: { kind: 'resource', field: 'guard' }, does: 'full' });
  assert.deepEqual(guard.resourceChanges, []);
  assert.deepEqual(guard.skipped.map((item) => item.reason), ['static-resource']);

  const missing = calculate(context, { target: { kind: 'resource', field: 'hp' }, does: 'full' }, { data: { stress: 4, guard: 2 } });
  assert.deepEqual(missing.resourceChanges, []);
  assert.deepEqual(missing.skipped.map((item) => item.reason), ['no-resource-value']);
});

test('a stale token form aborts the whole Atlas rest write before any form changes', () => {
  const assets = linkedAssets();
  const store = makeStore({
    main: { assetId: 'pc-main', resources: { hp: { current: 4, max: 20 } } },
    wolf: { assetId: 'pc-wolf', resources: { hp: { current: 10, max: 30 } }, overriddenMax: ['hp'] },
  });
  const context = atlasRestResourceContextForNote(makeApp([makeView(store, assets)]), NOTE);
  assert.ok(context);
  const result = calculate(context, { target: { kind: 'resource', field: 'hp' }, does: 'full' });
  store.getState().updateTokens([{ id: 'wolf', changes: { resources: { hp: { current: 11, max: 30 } } } }]);

  assert.throws(() => persistAtlasRestResourceChangesWithReceipt(context, result.resourceChanges.map(({ resourceKey, from, to, max, direction }) => ({ resourceKey, from, to, max, direction }))), /mudou desde o cálculo/);
  assert.deepEqual(store.getState().objects.tokens.main.resources.hp, { current: 4, max: 20 });
  assert.deepEqual(store.getState().objects.tokens.wolf.resources.hp, { current: 11, max: 30 });
});

test('a campaign-held Resource is used only when no linked token currently holds it', () => {
  const assets = linkedAssets();
  const partyKey = JSON.stringify(['campaign', 'pc-main', 'hp']);
  const partyValues = { [partyKey]: { current: 7, max: 20, maxByHand: true } };
  const first = makeStore({}, partyValues);
  const second = makeStore({}, partyValues);
  const context = atlasRestResourceContextForNote(makeApp([
    makeView(first, assets), makeView(second, assets, { shown: false }),
  ]), NOTE);
  assert.ok(context);
  const hp = context.resources.find((resource) => resource.key === 'hp');
  assert.equal(hp?.holder, 'party');
  assert.equal(hp?.current, 7);
  assert.equal(hp?.maxByHand, true);

  const result = calculate(context, { target: { kind: 'resource', field: 'hp' }, does: 'full' });
  const commit = persistAtlasRestResourceChangesWithReceipt(context, result.resourceChanges.map(({ resourceKey, from, to, max, direction }) => ({ resourceKey, from, to, max, direction })));
  assert.equal(commit.updated, 2);
  assert.deepEqual(first.getState().partyValues[partyKey], { current: 20, max: 20, maxByHand: true });
  assert.deepEqual(second.getState().partyValues[partyKey], { current: 20, max: 20, maxByHand: true });
  rollbackAtlasRestResourceChanges(commit.receipt);
  assert.deepEqual(first.getState().partyValues[partyKey], partyValues[partyKey]);
  assert.deepEqual(second.getState().partyValues[partyKey], partyValues[partyKey]);
});


test('Template Resource catalog identifies every matching collection Resource without writing Atlas state', () => {
  const template = {
    ...TEMPLATE,
    fields: [
      { key: 'hp', label: 'Hit Points', type: 'number', meaning: 'hit-points' },
      { key: 'stress', label: 'Stress', type: 'number' },
      { key: 'guard', label: 'Guard', type: 'number' },
    ],
  };
  let updateCalls = 0;
  const store = makeStore({}, {}, { updateTokens: () => { updateCalls += 1; } });
  const collections = [
    { id: COLLECTION, name: 'Heroes', settings: { statblockRoles: [{ id: 'hero', name: 'Hero', templateId: template.id }], resources: [
      { key: 'hp', name: 'Health', field: 'hp', direction: 'drains', color: '#22c55e', defeatedWhenSpent: true },
      { key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', color: '#a855f7' },
      { key: 'guard', name: 'Guard', field: 'guard', direction: 'static', color: '#64748b' },
    ] } },
    { id: 'other', name: 'Other', settings: { statblockRoles: [{ id: 'npc', name: 'NPC', templateId: 'another-template' }], resources: [
      { key: 'hp', name: 'Health', field: 'hp', direction: 'drains', color: '#22c55e' },
    ] } },
  ];
  const service = {
    loadedTokenAssets: () => [],
    loadedCollections: () => collections,
    getCollectionSettings: (id) => collections.find((entry) => entry.id === id)?.settings,
  };
  const view = {
    containerEl: { isShown: () => true },
    serviceManager: { getAssetService: () => service, getStore: () => store },
  };
  const app = makeApp([view]);

  const matches = atlasResourceMatchesForTemplate(app, template);
  assert.deepEqual(matches.map((match) => [match.collectionId, match.resource.key, match.fieldKey, match.recoverable]), [
    [COLLECTION, 'hp', 'hp', true],
    [COLLECTION, 'stress', 'stress', true],
    [COLLECTION, 'guard', 'guard', false],
  ]);
  assert.deepEqual(atlasResourceFieldKeysForTemplate(app, template), ['hp', 'stress']);
  assert.equal(updateCalls, 0);
});


test('REST Resource catalog follows custom preset Roles and collection Resources saved when the preset is applied', async () => {
  const template = {
    ...TEMPLATE,
    id: 'custom-hero-template',
    fields: [...TEMPLATE.fields, { key: 'focus', label: 'Focus', type: 'number' }],
  };
  const customPresetFile = {
    path: 'atlas-vtt/system-presets/renamed-file.json',
    content: JSON.stringify({
      id: 'custom-system-id',
      rules: {
        statblockRoles: [{ id: 'hero', name: 'Hero', templateId: template.id }],
        resources: [{ key: 'focus', name: 'Focus', field: 'focus', direction: 'fills', color: '#0ea5e9' }],
      },
    }),
  };
  const store = makeStore();
  const collection = { id: COLLECTION, name: 'Heroes', settings: {
    systemPresetId: 'custom-system-id',
    resources: [{ key: 'focus', name: 'Focus', field: 'focus', direction: 'fills', color: '#0ea5e9' }],
  } };
  const service = {
    loadedTokenAssets: () => [],
    loadedCollections: () => [collection],
    getCollectionSettings: () => collection.settings,
    getCollectionForMap: () => COLLECTION,
  };
  const app = makeApp([{ serviceManager: { getAssetService: () => service, getStore: () => store } }]);
  app.vault = {
    getFiles: () => [customPresetFile],
    cachedRead: async (file) => file.content,
  };
  await loadAtlasSystemPresetRules(app, 'custom-system-id');

  const matches = atlasResourceMatchesForTemplate(app, template);
  assert.deepEqual(matches.map((match) => [match.collectionId, match.resource.key, match.fieldKey, match.recoverable]), [
    [COLLECTION, 'focus', 'focus', true],
  ]);
  assert.deepEqual(atlasResourceFieldKeysForTemplate(app, template), ['focus']);
});

test('REST definitions include a legacy secondary Resource used by a closed scene', async () => {
  const assets = linkedAssets();
  const store = makeStore({}, {}, { mapPath: 'atlas-vtt/collections/heroes/scenes/hero.atlasmap' });
  const collection = {
    id: COLLECTION, name: 'Heroes',
    settings: { systemPresetId: 'unknown-system', defaultWidgets: { stressBar: false } },
  };
  const service = {
    loadedTokenAssets: () => assets,
    loadedCollections: () => [collection],
    getCollectionSettings: () => collection.settings,
    getCollectionForMap: (path) => path.includes('/heroes/') ? COLLECTION : null,
  };
  const sceneFile = {
    path: 'atlas-vtt/collections/heroes/scenes/closed.atlasmap', extension: 'atlasmap',
    content: JSON.stringify({ state: {
      tokenSettings: { showStressBars: true },
      objects: { tokens: { old: { stress: 2, maxStress: 10 } } },
    } }),
  };
  const app = makeApp([{
    containerEl: { isShown: () => true },
    serviceManager: { getAssetService: () => service, getStore: () => store },
  }]);
  app.vault = { getFiles: () => [sceneFile], cachedRead: async (file) => file.content };

  const definitions = await atlasRestResourceDefinitionsForNote(app, NOTE);
  assert.deepEqual(definitions.map(({ key, name }) => [key, name]), [
    ['hp', 'HP'], ['stress', 'Secondary resource'],
  ]);
});

test('REST definitions include a legacy secondary Resource stored in statblockResources on a closed scene', async () => {
  const assets = linkedAssets();
  const store = makeStore({}, {}, { mapPath: 'atlas-vtt/collections/heroes/scenes/hero.atlasmap' });
  const collection = {
    id: COLLECTION, name: 'Heroes',
    settings: { systemPresetId: 'unknown-system', defaultWidgets: { stressBar: false } },
  };
  const service = {
    loadedTokenAssets: () => assets,
    loadedCollections: () => [collection],
    getCollectionSettings: () => collection.settings,
    getCollectionForMap: (path) => path.includes('/heroes/') ? COLLECTION : null,
  };
  const sceneFile = {
    path: 'atlas-vtt/collections/heroes/scenes/closed.atlasmap', extension: 'atlasmap',
    content: JSON.stringify({ state: {
      tokenSettings: { hiddenResources: [] },
      objects: { tokens: { old: { statblockResources: { stress: { current: 2, max: 10 } } } } },
    } }),
  };
  const app = makeApp([{
    containerEl: { isShown: () => true },
    serviceManager: { getAssetService: () => service, getStore: () => store },
  }]);
  app.vault = { getFiles: () => [sceneFile], cachedRead: async (file) => file.content };

  const definitions = await atlasRestResourceDefinitionsForNote(app, NOTE);
  assert.deepEqual(definitions.map(({ key, name }) => [key, name]), [
    ['hp', 'HP'], ['stress', 'Secondary resource'],
  ]);
});

test('played campaign Resources override collection Resources for the Rest chooser context', async () => {
  const assets = linkedAssets();
  const store = makeStore({
    main: { assetId: 'pc-main', resources: { resolve: { current: 2, max: 6 }, hp: { current: 4, max: 20 } } },
  }, {}, { mapPath: 'atlas-vtt/collections/heroes/scenes/hero.atlasmap' });
  const collection = {
    id: COLLECTION, name: 'Heroes',
    settings: { resources: [{ key: 'hp', name: 'Health', field: 'hp', direction: 'drains', color: '#22c55e' }] },
  };
  const service = {
    loadedTokenAssets: () => assets,
    loadedCollections: () => [collection],
    getCollectionSettings: () => collection.settings,
    getCollectionForMap: () => COLLECTION,
  };
  const view = {
    containerEl: { isShown: () => true },
    serviceManager: { getAssetService: () => service, getStore: () => store },
  };
  const campaignFile = {
    path: 'atlas-vtt/campaigns/session/campaign.json', extension: 'json',
    content: JSON.stringify({
      id: 'session',
      system: {
        resources: [{ key: 'resolve', name: 'Resolve', field: 'stress', direction: 'fills', color: '#0ea5e9' }],
        gridDefaults: { unitType: 'feet', measurementMode: 'metric', unitDistance: 5 },
        conditions: [],
      },
    }),
  };
  const app = makeApp([view]);
  app.loadLocalStorage = (key) => key === 'atlas-vtt:table-campaign' ? 'session' : null;
  app.vault = {
    getFiles: () => [campaignFile],
    cachedRead: async (file) => file.content,
  };

  const definitions = await atlasRestResourceDefinitionsForNote(app, NOTE);
  assert.deepEqual(definitions.map(({ key, name, direction }) => [key, name, direction]), [
    ['resolve', 'Resolve', 'fills'],
  ]);
  const context = atlasRestResourceContextForNote(app, NOTE, definitions);
  assert.ok(context);
  assert.deepEqual(context.resources.map(({ key, current, max, holder }) => [key, current, max, holder]), [
    ['resolve', 2, 6, 'token'],
  ]);
});

test('a calculated Atlas Resource recovery is compensated when frontmatter persistence fails', async () => {
  const store = makeStore({
    main: { assetId: 'pc-main', resources: { hp: { current: 4, max: 20 } } },
  });
  const context = atlasRestResourceContextForNote(makeApp([makeView(store, linkedAssets())]), NOTE);
  assert.ok(context);
  const before = structuredClone(store.getState().objects.tokens);
  const calculated = calculate(context, {
    target: { kind: 'resource', field: 'hp' },
    does: 'amount',
    formula: '1d4',
  }, { data: { hp: 4 }, roll: () => 3 });
  assert.equal(calculated.resourceChanges[0]?.to, 7);

  await assert.rejects(runRestNotePersistenceWithAtlasRollback(async (registerReceipt) => {
    const changes = calculated.resourceChanges.map(({ resourceKey, from, to, max, direction }) => ({
      resourceKey, from, to, max, direction,
    }));
    const commit = persistAtlasRestResourceChangesWithReceipt(context, changes);
    registerReceipt(commit.receipt);
    // Models a failure from Obsidian after processFrontMatter's mutation callback returns.
    throw new Error('simulated frontmatter write failure after recovery calculation');
  }, rollbackAtlasRestResourceChanges), /frontmatter write failure/);

  assert.deepEqual(store.getState().objects.tokens, before);
});
