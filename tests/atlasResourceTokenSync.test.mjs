import assert from 'node:assert/strict';
import test from 'node:test';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import { serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';
import { createForgeStatblockTemplateLink } from '../src/statblocks/forgeTemplateLink.ts';
import { AtlasForgeResourceTokenSync } from '../src/atlas/atlasResourceTokenSync.ts';

const RESOURCE_DEFINITIONS = [
  { key: 'hp', name: 'HP', field: 'hp', direction: 'drains', color: '#22c55e', defeatedWhenSpent: true, visibleToPlayers: false },
  { key: 'stress', name: 'Stress', field: 'stress', direction: 'fills', color: '#a855f7', visibleToPlayers: false },
];

function createFixture({ version = '0.17.0', isPlayerView = false, collectionResources = RESOURCE_DEFINITIONS, campaignId = null, campaignSystem = null } = {}) {
  const template = createBlankTemplate('Resource Sync');
  template.fields.push({ key: 'stress', label: 'Stress', type: 'number' });
  const templateFile = {
    path: 'Templates/hero.forgetemplate', basename: 'hero', extension: 'forgetemplate',
  };
  const noteFile = { path: 'Characters/Ayla.md', basename: 'Ayla', extension: 'md' };
  const campaignFile = campaignId ? { path: 'atlas-vtt/campaigns/table/campaign.json', basename: 'campaign', extension: 'json' } : null;
  let campaignSystemPayload = campaignSystem;
  const frontmatter = {
    'statblock-forge': createForgeStatblockTemplateLink({ templatePath: templateFile.path, templateId: template.id }),
    hp: 8,
    stress: 4,
  };
  let updateCalls = 0;
  let untrackedCalls = 0;
  let metadataCallback;
  let vaultModifyCallback;
  let vaultRenameCallback;
  const vaultCallbacks = new Map();
  const tokens = {
    injured: {
      kind: 'character', statblockPath: noteFile.path,
      resources: { hp: { current: 5, max: 12 }, stress: { current: 3, max: 9 } },
    },
    overridden: {
      kind: 'character', statblockPath: noteFile.path,
      resources: { hp: { current: 5, max: 20 } }, overriddenMax: ['hp'],
    },
    unrelated: { kind: 'character', statblockPath: 'Characters/Other.md', resources: { hp: { current: 2, max: 3 } } },
  };
  const store = {
    state: {
      mapPath: 'atlas-vtt/collections/heroes/scenes/test.atlasmap',
      mapLoaded: true, isMapLoading: false, isPlayerView,
      objects: { tokens },
    },
    getState() { return this.state; },
    temporal: { getState: () => ({ untracked(operation) { untrackedCalls += 1; operation(); } }) },
  };
  const assetService = {
    loadedTokenAssets: () => [],
    getCollectionForMap: () => 'heroes',
    getCollectionSettings: () => ({ resources: collectionResources }),
  };
  const rendererService = { getRenderer: () => ({}), isInitialized: () => true };
  const toolController = { getDiceTool: () => ({ rollDice() {} }) };
  const previewManager = { showOrCreatePreview() {}, hideAllUnpinnedPreviews() {} };
  const serviceManager = {
    getRendererService: () => rendererService,
    getToolController: () => toolController,
    getNotePreviewUIManager: () => previewManager,
    getAssetService: () => assetService,
    getStore: () => store,
  };
  const view = {
    getViewType: () => 'atlas-vtt',
    serviceManager,
    atlasStore: store,
  };
  const app = {
    plugins: { plugins: { 'atlas-vtt': { manifest: { id: 'atlas-vtt', version } } } },
    workspace: {
      getLeavesOfType: (type) => type === 'atlas-vtt' ? [{ view }] : [],
      on: (name, callback) => ({ name, callback }),
      offref() {},
      onLayoutReady(callback) { callback(); },
    },
    metadataCache: {
      on: (name, callback) => { metadataCallback = callback; return { name }; },
      offref() {},
      getFileCache: (file) => file.path === noteFile.path ? { frontmatter } : null,
      getFirstLinkpathDest: () => null,
    },
    vault: {
      on: (name, callback) => {
        vaultCallbacks.set(name, callback);
        if (name === 'modify') vaultModifyCallback = callback;
        if (name === 'rename') vaultRenameCallback = callback;
        return { name };
      },
      offref() {},
      getAbstractFileByPath: (path) => path === noteFile.path ? noteFile : path === templateFile.path ? templateFile : null,
      getFiles: () => [templateFile, ...(campaignFile ? [campaignFile] : [])],
      cachedRead: async (file) => file.path === templateFile.path
        ? serializeForgeTemplateFile(template, createForgeLayout(template))
        : file.path === campaignFile?.path
          ? JSON.stringify({ id: campaignId, system: campaignSystemPayload })
          : '',
    },
    loadLocalStorage: (key) => key === 'atlas-vtt:table-campaign' ? campaignId : null,
  };
  store.state.updateTokens = (entries) => {
    updateCalls += 1;
    for (const entry of entries) {
      const current = store.state.objects.tokens[entry.id];
      if (current) current.resources = entry.changes.resources;
    }
  };
  return {
    app, noteFile, templateFile, campaignFile, frontmatter, tokens, store, vaultCallbacks,
    setCampaignSystem(value) { campaignSystemPayload = value; },
    get updateCalls() { return updateCalls; },
    get untrackedCalls() { return untrackedCalls; },
    get metadataCallback() { return metadataCallback; },
    get vaultModifyCallback() { return vaultModifyCallback; },
    get vaultRenameCallback() { return vaultRenameCallback; },
  };
}

test('syncs Forge v2 Fields into matching linked-token Resources through Atlas updateTokens()', async () => {
  const fixture = createFixture();
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    const updated = await sync.syncNote(fixture.noteFile.path);
    assert.equal(updated, 2);
    assert.equal(fixture.updateCalls, 1);
    assert.equal(fixture.untrackedCalls, 1);
    assert.deepEqual(fixture.tokens.injured.resources, {
      hp: { current: 5, max: 8 },
      stress: { current: 3, max: 4 },
    });
    assert.deepEqual(fixture.tokens.overridden.resources, {
      hp: { current: 5, max: 20 },
      stress: { current: 0, max: 4 },
    });
    assert.deepEqual(fixture.tokens.unrelated.resources, { hp: { current: 2, max: 3 } });
  } finally {
    sync.stop();
  }
});

test('synchronizes Resources on the verified Atlas 0.18.0 runtime', async () => {
  const fixture = createFixture({ version: '0.18.0' });
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    assert.equal(await sync.syncNote(fixture.noteFile.path), 2);
    assert.equal(fixture.updateCalls, 1);
    assert.equal(fixture.untrackedCalls, 1);
  } finally { sync.stop(); }
});

test('does not update Atlas player views and attempts future versions with the required runtime shape', async () => {
  const player = createFixture({ isPlayerView: true });
  const playerSync = new AtlasForgeResourceTokenSync(player.app);
  try { assert.equal(await playerSync.syncNote(player.noteFile.path), 0); } finally { playerSync.stop(); }

  const future = createFixture({ version: '0.19.0' });
  const futureSync = new AtlasForgeResourceTokenSync(future.app);
  try {
    assert.equal(await futureSync.syncNote(future.noteFile.path), 2);
    assert.equal(future.updateCalls, 1);
  } finally { futureSync.stop(); }

  const tooOld = createFixture({ version: '0.16.9' });
  const tooOldSync = new AtlasForgeResourceTokenSync(tooOld.app);
  try { assert.equal(await tooOldSync.syncNote(tooOld.noteFile.path), 0); } finally { tooOldSync.stop(); }
});

test('ignores Atlas-native v1 published Forge notes and malformed template links', async () => {
  const fixture = createFixture();
  fixture.frontmatter['statblock-forge'] = createForgeStatblockTemplateLink({
    templatePath: fixture.templateFile.path,
    templateId: 'not-used-here',
    atlasTemplateId: 'native-template',
  });
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try { assert.equal(await sync.syncNote(fixture.noteFile.path), 0); } finally { sync.stop(); }
});

test('updates Resource maxima after template Fields change and preserves tokens on absent source values', async () => {
  const fixture = createFixture();
  fixture.frontmatter.stress = undefined;
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    const updated = await sync.syncNote(fixture.noteFile.path);
    assert.equal(updated, 1);
    assert.equal(fixture.tokens.injured.resources.stress.current, 3);
    assert.equal(fixture.tokens.injured.resources.stress.max, 9);
  } finally { sync.stop(); }
});

test('cleans event subscriptions and queued sync work when stopped', async () => {
  const fixture = createFixture();
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  sync.start();
  sync.stop();
  assert.equal(await sync.syncNote(fixture.noteFile.path), 0);
});


test('played campaign preset Resources take precedence over the map collection', async () => {
  const fixture = createFixture({
    collectionResources: [RESOURCE_DEFINITIONS[0]],
    campaignId: 'campaign-daggerheart',
    campaignSystem: {
      systemPresetId: 'builtin:daggerheart',
      gridDefaults: { unitType: 'feet', measurementMode: 'metric', unitDistance: 5 },
      conditions: [],
    },
  });
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    const updated = await sync.syncNote(fixture.noteFile.path);
    assert.equal(updated, 2);
    assert.deepEqual(fixture.tokens.injured.resources.stress, { current: 3, max: 4 });
    assert.deepEqual(fixture.tokens.overridden.resources.stress, { current: 0, max: 4 });
  } finally { sync.stop(); }
});


test('ignores an invalid played campaign system and falls back to the map collection', async () => {
  const fixture = createFixture({
    collectionResources: RESOURCE_DEFINITIONS,
    campaignId: 'campaign-invalid-system',
    campaignSystem: {
      systemPresetId: 'builtin:cairn',
      gridDefaults: {},
      conditions: [],
    },
  });
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    const updated = await sync.syncNote(fixture.noteFile.path);
    assert.equal(updated, 2);
    assert.deepEqual(fixture.tokens.injured.resources.stress, { current: 3, max: 4 });
  } finally { sync.stop(); }
});

test('played campaign with an explicitly empty Resource list does not fall back to its preset', async () => {
  const fixture = createFixture({
    collectionResources: RESOURCE_DEFINITIONS,
    campaignId: 'campaign-empty',
    campaignSystem: {
      systemPresetId: 'builtin:daggerheart',
      resources: [],
      gridDefaults: { unitType: 'feet', measurementMode: 'metric', unitDistance: 5 },
      conditions: [],
    },
  });
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    assert.equal(await sync.syncNote(fixture.noteFile.path), 0);
    assert.equal(fixture.updateCalls, 0);
  } finally { sync.stop(); }
});


test('campaign file edits trigger a fresh Resource sync using the campaign rules', async () => {
  const fixture = createFixture({
    campaignId: 'campaign-change',
    campaignSystem: {
      systemPresetId: 'builtin:daggerheart',
      gridDefaults: { unitType: 'feet', measurementMode: 'metric', unitDistance: 5 },
      conditions: [],
    },
  });
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  try {
    assert.equal(await sync.syncNote(fixture.noteFile.path), 2);
    assert.equal(fixture.tokens.injured.resources.stress.max, 4);
    fixture.setCampaignSystem({
      systemPresetId: 'builtin:daggerheart',
      resources: [{ key: 'stress', name: 'Stress', field: 'hp', direction: 'fills', color: '#a855f7', visibleToPlayers: false }],
      gridDefaults: { unitType: 'feet', measurementMode: 'metric', unitDistance: 5 },
      conditions: [],
    });
    fixture.vaultCallbacks.get('modify')(fixture.campaignFile);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fixture.tokens.injured.resources.stress.max, 8);
  } finally { sync.stop(); }
});

test('subscribes to campaign and custom preset file changes and releases every vault listener', () => {
  const fixture = createFixture();
  const sync = new AtlasForgeResourceTokenSync(fixture.app);
  for (const eventName of ['modify', 'create', 'delete', 'rename']) {
    assert.equal(typeof fixture.vaultCallbacks.get(eventName), 'function');
  }
  sync.stop();
});
