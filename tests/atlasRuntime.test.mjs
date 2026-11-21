import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_PLUGIN_ID,
  ATLAS_VIEW_TYPE,
  getAtlasMapLeaves,
  getAtlasMapViewContexts,
  getLoadedAtlasPlugin,
  inspectAtlasMapLeaf,
  inspectAtlasRuntime,
} from '../src/atlas/atlasRuntime.ts';

function makeRuntimeMap({ complete = true, shown = true } = {}) {
  const store = { getState: () => ({ mapPath: 'Maps/Forest.atlasmap' }) };
  const tokenStatblockLinkService = { linkTokenToStatblock() {} };
  const tokenRenderer = { statblockSync: { tokenStatblockLinkService } };
  const renderer = { getTokenRenderer: () => tokenRenderer };
  const rendererService = { getRenderer: () => renderer, isInitialized: () => true };
  const toolController = { getDiceTool: () => ({ rollDice() {} }) };
  const previewManager = { showOrCreatePreview() {}, hideAllUnpinnedPreviews() {} };
  const assetService = { loadedTokenAssets: () => [] };
  const serviceManager = complete ? {
    getRendererService: () => rendererService,
    getToolController: () => toolController,
    getNotePreviewUIManager: () => previewManager,
    getAssetService: () => assetService,
    getStore: () => store,
  } : {
    getRendererService: () => rendererService,
    getToolController: () => null,
  };
  const view = {
    getViewType: () => ATLAS_VIEW_TYPE,
    get serviceManager() { return serviceManager; },
    atlasStore: store,
    containerEl: { isShown: () => shown },
  };
  return { view, store, serviceManager, rendererService, renderer, tokenRenderer, tokenStatblockLinkService, toolController, previewManager, assetService };
}

function makeApp({ plugin = null, views = [] } = {}) {
  return {
    plugins: { plugins: plugin ? { [ATLAS_PLUGIN_ID]: plugin } : {} },
    workspace: {
      getLeavesOfType(type) {
        return type === ATLAS_VIEW_TYPE ? views.map((view) => ({ view })) : [];
      },
    },
  };
}

test('uses only the original Atlas plugin and map view IDs', () => {
  assert.equal(ATLAS_PLUGIN_ID, 'atlas-vtt');
  assert.equal(ATLAS_VIEW_TYPE, 'atlas-vtt');
});

test('returns no runtime when the original Atlas plugin is not loaded', () => {
  const snapshot = inspectAtlasRuntime(makeApp());
  assert.equal(snapshot.status, 'not-loaded');
  assert.equal(snapshot.pluginLoaded, false);
  assert.equal(snapshot.version, null);
  assert.equal(snapshot.mapCount, 0);
  assert.match(snapshot.diagnostics.join(' '), /not currently loaded/i);
});

test('distinguishes a loaded Atlas plugin with no open map', () => {
  const app = makeApp({ plugin: { manifest: { id: ATLAS_PLUGIN_ID, version: '0.17.0' } } });
  const snapshot = inspectAtlasRuntime(app);
  assert.equal(getLoadedAtlasPlugin(app), app.plugins.plugins[ATLAS_PLUGIN_ID]);
  assert.equal(snapshot.status, 'loaded-no-maps');
  assert.equal(snapshot.pluginLoaded, true);
  assert.equal(snapshot.version, '0.17.0');
  assert.equal(snapshot.mapCount, 0);
});

test('keeps internal runtime hooks disabled below the minimum Atlas runtime version', () => {
  const fixture = makeRuntimeMap();
  const app = makeApp({
    plugin: { manifest: { id: ATLAS_PLUGIN_ID, version: '0.16.9' } },
    views: [fixture.view],
  });
  const snapshot = inspectAtlasRuntime(app);
  assert.equal(snapshot.status, 'unsupported-version');
  assert.equal(snapshot.runtimeSupported, false);
  assert.equal(snapshot.adapterId, 'atlas-generic-template-file-compatibility');
  assert.ok(snapshot.diagnostics.some((entry) => /minimum supported runtime version 0\.17\.0/i.test(entry)));
});

test('discovers a ready Atlas 0.17.0 map and resolves its internal service handles', () => {
  const fixture = makeRuntimeMap();
  const app = makeApp({
    plugin: { manifest: { id: ATLAS_PLUGIN_ID, version: '0.17.0' } },
    views: [fixture.view],
  });
  const snapshot = inspectAtlasRuntime(app);
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.mapCount, 1);
  assert.equal(snapshot.readyMapCount, 1);
  assert.equal(snapshot.maps[0].serviceManager, fixture.serviceManager);
  assert.equal(snapshot.maps[0].store, fixture.store);
  assert.equal(snapshot.maps[0].rendererService, fixture.rendererService);
  assert.equal(snapshot.maps[0].renderer, fixture.renderer);
  assert.equal(snapshot.maps[0].rendererInitialized, true);
  assert.equal(snapshot.maps[0].tokenRenderer, fixture.tokenRenderer);
  assert.equal(snapshot.maps[0].tokenStatblockLinkService, fixture.tokenStatblockLinkService);
  assert.equal(snapshot.maps[0].toolController, fixture.toolController);
  assert.equal(snapshot.maps[0].notePreviewUIManager, fixture.previewManager);
  assert.equal(snapshot.maps[0].assetService, fixture.assetService);
  assert.equal(snapshot.maps[0].diagnostics.ready, true);
});

test('discovers a ready Atlas 0.18.0 map using the same verified runtime entry points', () => {
  const fixture = makeRuntimeMap();
  const app = makeApp({
    plugin: { manifest: { id: ATLAS_PLUGIN_ID, version: '0.18.0' } },
    views: [fixture.view],
  });
  const snapshot = inspectAtlasRuntime(app);
  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.version, '0.18.0');
  assert.equal(snapshot.runtimeSupported, true);
  assert.equal(snapshot.adapterId, 'atlas-0.18.0-internal-runtime');
  assert.equal(snapshot.maps[0].toolController, fixture.toolController);
  assert.equal(snapshot.maps[0].notePreviewUIManager, fixture.previewManager);
  assert.equal(snapshot.maps[0].assetService, fixture.assetService);
});

test('allows later Atlas versions when the required runtime shape is still present', () => {
  for (const version of ['0.17.1', '0.18.1', '0.19.0', '1.0.0']) {
    const fixture = makeRuntimeMap();
    const app = makeApp({
      plugin: { manifest: { id: ATLAS_PLUGIN_ID, version } },
      views: [fixture.view],
    });
    const snapshot = inspectAtlasRuntime(app);
    assert.equal(snapshot.status, 'ready', version);
    assert.equal(snapshot.runtimeSupported, true, version);
    assert.match(snapshot.adapterId, /^atlas-forward-compatible-/);
    assert.equal(snapshot.maps[0].diagnostics.ready, true);
    assert.ok(snapshot.diagnostics.some((entry) => /newer than the inspected runtime baseline/i.test(entry)));
  }
});

test('does not treat a newer Atlas version as fully ready when required methods disappeared', () => {
  const fixture = makeRuntimeMap({ complete: false });
  const app = makeApp({
    plugin: { manifest: { id: ATLAS_PLUGIN_ID, version: '1.0.0' } },
    views: [fixture.view],
  });
  const snapshot = inspectAtlasRuntime(app);
  assert.equal(snapshot.runtimeSupported, true);
  assert.equal(snapshot.status, 'partial');
  assert.equal(snapshot.maps[0].diagnostics.ready, false);
  assert.ok(snapshot.diagnostics.some((entry) => /lacks runtime members/i.test(entry)));
});

test('reports partial maps during initialization instead of treating them as ready', () => {
  const fixture = makeRuntimeMap({ complete: false });
  const app = makeApp({
    plugin: { manifest: { id: ATLAS_PLUGIN_ID, version: '0.17.0' } },
    views: [fixture.view],
  });
  const snapshot = inspectAtlasRuntime(app);
  assert.equal(snapshot.status, 'partial');
  assert.equal(snapshot.mapCount, 1);
  assert.equal(snapshot.readyMapCount, 0);
  assert.equal(snapshot.maps[0].diagnostics.ready, false);
  assert.ok(snapshot.diagnostics.some((entry) => /initializing or lacks runtime members/i.test(entry)));
});

test('uses live lookups so a plugin loaded after Forge is immediately discoverable', () => {
  const app = makeApp();
  assert.equal(inspectAtlasRuntime(app).status, 'not-loaded');
  app.plugins.plugins[ATLAS_PLUGIN_ID] = { manifest: { id: ATLAS_PLUGIN_ID, version: '0.17.0' } };
  assert.equal(inspectAtlasRuntime(app).status, 'loaded-no-maps');
  app.plugins.plugins[ATLAS_PLUGIN_ID] = undefined;
  assert.equal(inspectAtlasRuntime(app).status, 'not-loaded');
});

test('filters unrelated views and safely handles workspace or plugin-registry failures', () => {
  const fixture = makeRuntimeMap();
  const wrongView = { getViewType: () => 'markdown' };
  const leaves = [
    { view: fixture.view },
    { view: wrongView },
    { view: null },
  ];
  const app = {
    plugins: { plugins: { [ATLAS_PLUGIN_ID]: { manifest: { version: '0.17.0' } } } },
    workspace: { getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? leaves : [] },
  };
  assert.deepEqual(getAtlasMapLeaves(app), leaves);
  assert.equal(getAtlasMapViewContexts(app).length, 1);
  assert.equal(inspectAtlasMapLeaf({ view: wrongView }), null);
  assert.deepEqual(getAtlasMapViewContexts({ workspace: { getLeavesOfType: () => { throw new Error('closed'); } } }), []);
  assert.equal(inspectAtlasRuntime({ plugins: null, workspace: null }).status, 'not-loaded');
});
