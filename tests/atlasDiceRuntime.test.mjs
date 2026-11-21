import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findAtlasDiceRuntimeContext,
  findVisibleAtlasDiceTool,
  getAtlasDiceHistorySnapshots,
  getAtlasDiceRuntimeContexts,
  resolveAtlasDiceRollTarget,
  atlasDiceRollOriginForToken,
} from '../src/atlas/atlasDiceRuntime.ts';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';

function makeMap({
  viewId = 'view-1',
  mapPath = 'Maps/Forest.atlasmap',
  visible = true,
  shownThrows = false,
  tool = null,
  persistedHistory = [],
  inMemoryHistory = [],
  eventBus = null,
  stateThrows = false,
  omitVisibility = false,
  tokens = {},
} = {}) {
  const diceTool = tool ?? {
    rollDice(formula) { return { id: `roll-${formula}`, formula, total: 7 }; },
    rollingDice: () => ({ dice: [{ count: 1, sides: 20 }] }),
    getState: () => ({ rollHistory: inMemoryHistory }),
  };
  const store = {
    getState() {
      if (stateThrows) throw new Error('store is closing');
      return { mapPath, diceLog: persistedHistory, objects: { tokens } };
    },
  };
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
    containerEl: omitVisibility ? {} : {
      isShown() {
        if (shownThrows) throw new Error('visibility unavailable');
        return visible;
      },
    },
  };
  return { view, store, serviceManager, diceTool, eventBus };
}

function makeApp(views = []) {
  const leaves = views.map((view) => ({ view }));
  return {
    workspace: {
      getLeavesOfType(type) {
        return type === ATLAS_VIEW_TYPE ? leaves : [];
      },
    },
  };
}

test('discovers Atlas 0.17.0 DiceTool through ServiceManager and ToolController', () => {
  const fixture = makeMap();
  const app = makeApp([fixture.view]);
  const contexts = getAtlasDiceRuntimeContexts(app);

  assert.equal(contexts.length, 1);
  assert.equal(contexts[0].diceTool, fixture.diceTool);
  assert.equal(contexts[0].serviceManager, fixture.serviceManager);
  assert.equal(contexts[0].store, fixture.store);
  assert.equal(contexts[0].viewId, 'view-1');
  assert.equal(contexts[0].mapPath, 'Maps/Forest.atlasmap');
  assert.equal(contexts[0].visible, true);
});

test('visible map DiceTool is preferred over a hidden map DiceTool', () => {
  const hidden = makeMap({ viewId: 'hidden', visible: false });
  const visible = makeMap({ viewId: 'visible', visible: true });
  const app = makeApp([hidden.view, visible.view]);

  assert.equal(findVisibleAtlasDiceTool(app), visible.diceTool);
  assert.equal(findAtlasDiceRuntimeContext(app)?.viewId, 'visible');
});

test('hidden maps are excluded by default but can be targeted explicitly by viewId', () => {
  const hidden = makeMap({ viewId: 'hidden', visible: false });
  const app = makeApp([hidden.view]);

  assert.equal(findAtlasDiceRuntimeContext(app), null);
  assert.equal(findAtlasDiceRuntimeContext(app, { viewId: 'hidden' }), null);
  const context = findAtlasDiceRuntimeContext(app, { viewId: 'hidden', includeHidden: true });
  assert.equal(context?.diceTool, hidden.diceTool);
  assert.equal(context?.visible, false);
});

test('a view wrapper without isShown follows the visible-map fallback convention', () => {
  const fixture = makeMap({ omitVisibility: true });
  const context = findAtlasDiceRuntimeContext(makeApp([fixture.view]));
  assert.equal(context?.visible, true);
  assert.equal(context?.diceTool, fixture.diceTool);
});

test('a throwing visibility getter fails closed instead of capturing a hidden-tab roll', () => {
  const fixture = makeMap({ shownThrows: true });
  const app = makeApp([fixture.view]);
  assert.equal(getAtlasDiceRuntimeContexts(app)[0]?.visible, false);
  assert.equal(findVisibleAtlasDiceTool(app), null);
  assert.equal(findAtlasDiceRuntimeContext(app, { viewId: 'view-1', includeHidden: true })?.diceTool, fixture.diceTool);
});

test('exposes separate transient DiceTool history and persisted per-map diceLog snapshots', () => {
  const persisted = [{ id: 'stored-1', formula: '2d6+1', total: 9, source: { type: 'statblock', statblockPath: 'Characters/Ayla.md' } }];
  const transient = [{ id: 'memory-1', formula: 'd20', total: 14 }];
  const eventBus = { on() {}, off() {} };
  const fixture = makeMap({ persistedHistory: persisted, inMemoryHistory: transient, eventBus });
  const [snapshot] = getAtlasDiceHistorySnapshots(makeApp([fixture.view]));

  assert.deepEqual(snapshot.persistedHistory, persisted);
  assert.deepEqual(snapshot.inMemoryHistory, transient);
  assert.equal(snapshot.eventBus, eventBus);
  assert.equal(snapshot.mapPath, 'Maps/Forest.atlasmap');
  assert.notEqual(snapshot.persistedHistory, persisted);
  assert.notEqual(snapshot.inMemoryHistory, transient);
});

test('history snapshot keeps map boundaries when several Atlas maps are open', () => {
  const first = makeMap({ viewId: 'one', mapPath: 'Maps/One.atlasmap', persistedHistory: [{ id: 'one-roll', formula: 'd20', total: 10 }] });
  const second = makeMap({ viewId: 'two', mapPath: 'Maps/Two.atlasmap', persistedHistory: [{ id: 'two-roll', formula: 'd20', total: 12 }] });
  const snapshots = getAtlasDiceHistorySnapshots(makeApp([first.view, second.view]));

  assert.deepEqual(snapshots.map(({ viewId, mapPath }) => [viewId, mapPath]), [
    ['one', 'Maps/One.atlasmap'],
    ['two', 'Maps/Two.atlasmap'],
  ]);
  assert.deepEqual(snapshots.map(({ persistedHistory }) => persistedHistory[0]?.id), ['one-roll', 'two-roll']);
});

test('resolves live map references on every call after a map is replaced', () => {
  const first = makeMap({ viewId: 'same-view' });
  let current = first.view;
  const app = {
    workspace: { getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? [{ view: current }] : [] },
  };
  assert.equal(findVisibleAtlasDiceTool(app), first.diceTool);

  const replacement = makeMap({ viewId: 'same-view' });
  current = replacement.view;
  assert.equal(findVisibleAtlasDiceTool(app), replacement.diceTool);
});

test('handles stores that are closing and malformed history fields without throwing', () => {
  const fixture = makeMap({ stateThrows: true });
  fixture.diceTool.getState = () => ({ rollHistory: 'not-an-array' });
  const [snapshot] = getAtlasDiceHistorySnapshots(makeApp([fixture.view]));
  assert.equal(snapshot.mapPath, null);
  assert.deepEqual(snapshot.persistedHistory, []);
  assert.deepEqual(snapshot.inMemoryHistory, []);
});

test('does not return a DiceTool when an Atlas map has no callable rollDice method', () => {
  const fixture = makeMap({ tool: { rollingDice: () => ({ dice: [] }) } });
  assert.deepEqual(getAtlasDiceRuntimeContexts(makeApp([fixture.view])), []);
});


test('roll target resolves an explicit originating view even when another map is earlier in workspace order', () => {
  const first = makeMap({ viewId: 'first', visible: true });
  const second = makeMap({ viewId: 'origin', visible: true });
  const app = makeApp([first.view, second.view]);
  const resolution = resolveAtlasDiceRollTarget(app, 'origin');
  assert.equal(resolution.status, 'ready');
  assert.equal(resolution.context.viewId, 'origin');
});

test('roll target uses the active Atlas leaf when multiple maps are visible', () => {
  const first = makeMap({ viewId: 'first', visible: true });
  const second = makeMap({ viewId: 'second', visible: true });
  const app = makeApp([first.view, second.view]);
  // Atlas contexts contain the actual WorkspaceLeaf, so use the same leaf object.
  const leaves = app.workspace.getLeavesOfType(ATLAS_VIEW_TYPE);
  app.workspace.activeLeaf = leaves[1];
  const resolution = resolveAtlasDiceRollTarget(app);
  assert.equal(resolution.status, 'ready');
  assert.equal(resolution.context.viewId, 'second');
});

test('roll target refuses ambiguous visible maps instead of choosing an arbitrary map', () => {
  const first = makeMap({ viewId: 'first', visible: true });
  const second = makeMap({ viewId: 'second', visible: true });
  assert.deepEqual(resolveAtlasDiceRollTarget(makeApp([first.view, second.view])), { status: 'ambiguous' });
});

test('captured token origin is emitted only for the same view, scene, and extant placed token', () => {
  const fixture = makeMap({
    viewId: 'origin-view', mapPath: 'Maps/Forest.atlasmap',
    tokens: { goblin: { name: 'Goblin', offMap: false } },
  });
  const context = getAtlasDiceRuntimeContexts(makeApp([fixture.view]))[0];
  const captured = { viewId: 'origin-view', mapPath: 'Maps/Forest.atlasmap', tokenIds: ['goblin'] };
  assert.deepEqual(atlasDiceRollOriginForToken(context, 'goblin', captured), {
    viewId: 'origin-view', mapPath: 'Maps/Forest.atlasmap', tokenId: 'goblin',
  });
  assert.equal(atlasDiceRollOriginForToken(context, 'other', captured), undefined);
  assert.equal(atlasDiceRollOriginForToken(context, 'goblin', { ...captured, mapPath: 'Maps/Other.atlasmap' }), undefined);
  assert.equal(atlasDiceRollOriginForToken(context, 'missing', captured), undefined);
});
