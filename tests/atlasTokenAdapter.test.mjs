import assert from 'node:assert/strict';
import test from 'node:test';
import * as atlasTokenAdapterApi from '../src/atlas/atlasTokenAdapter.ts';
const { getAtlasTokenAdapterContexts, inspectAtlasTokenView } = atlasTokenAdapterApi;
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';
import {
  getSelectedAtlasToken,
  readAtlasTokenState,
  readAtlasTokenStateFromContext,
} from '../src/atlas/atlasTokenStateReader.ts';

function atlasLeaf({ rendererInitialized = true, renderer = {}, store = { getState: () => ({}) }, viewType = ATLAS_VIEW_TYPE } = {}) {
  return {
    view: {
      getViewType: () => viewType,
      atlasStore: store,
      serviceManager: {
        getRendererService: () => ({
          isInitialized: () => rendererInitialized,
          getRenderer: () => renderer,
        }),
      },
    },
  };
}


test('token adapter does not re-export a duplicate Atlas view-type constant', () => {
  assert.equal('ATLAS_TOKEN_VIEW_TYPE' in atlasTokenAdapterApi, false);
});

test('ignores leaves that are not Atlas map views', () => {
  assert.equal(inspectAtlasTokenView(atlasLeaf({ viewType: 'markdown' })), null);
});

test('reports partial runtime structure without attempting writes', () => {
  const leaf = { view: { getViewType: () => ATLAS_VIEW_TYPE, atlasStore: {} } };
  const result = inspectAtlasTokenView(leaf);
  assert.equal(result.status, 'partial');
  assert.equal(result.rendererService, null);
  assert.equal(result.tokenRenderer, null);
});


test('projects renderer and token-link handles from the central Atlas runtime without a second service lookup', () => {
  const tokenStatblockLinkService = { linkTokenToStatblock() {} };
  const tokenRenderer = { statblockSync: { tokenStatblockLinkService } };
  const renderer = { getTokenRenderer: () => tokenRenderer };
  let rendererServiceReads = 0;
  const leaf = {
    view: {
      getViewType: () => ATLAS_VIEW_TYPE,
      atlasStore: { getState: () => ({}) },
      serviceManager: {
        getRendererService: () => {
          rendererServiceReads += 1;
          return { isInitialized: () => true, getRenderer: () => renderer };
        },
      },
    },
  };
  const result = inspectAtlasTokenView(leaf);
  assert.equal(result.status, 'ready');
  assert.equal(result.renderer, renderer);
  assert.equal(result.tokenRenderer, tokenRenderer);
  assert.equal(result.tokenStatblockLinkService, tokenStatblockLinkService);
  assert.equal(rendererServiceReads, 1);
});

test('distinguishes renderer not ready, unavailable and fully ready states', () => {
  assert.equal(inspectAtlasTokenView(atlasLeaf({ rendererInitialized: false })).status, 'renderer-not-ready');
  assert.equal(inspectAtlasTokenView(atlasLeaf({ rendererInitialized: true, renderer: null })).status, 'renderer-unavailable');
  assert.equal(inspectAtlasTokenView(atlasLeaf()).status, 'ready');
});

test('collects open Atlas map contexts and contains workspace failures', () => {
  const ready = atlasLeaf();
  const partial = { view: { getViewType: () => ATLAS_VIEW_TYPE } };
  const app = { workspace: { getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE ? [ready, partial] : [] } };
  assert.equal(getAtlasTokenAdapterContexts(app).length, 2);
  assert.deepEqual(getAtlasTokenAdapterContexts(app).map((item) => item.status), ['ready', 'partial']);
  assert.deepEqual(getAtlasTokenAdapterContexts({ workspace: { getLeavesOfType: () => { throw new Error('closed'); } } }), []);
});

test('reads a detached, read-only token snapshot and narrows selection to actual token objects', () => {
  const token = {
    kind: 'token', assetId: 'asset-1', imagePath: 'wolf.webp', name: 'Wolf', statblockPath: 'Wolf.md',
  };
  const character = { kind: 'character', statblockName: 'Ayla', statblockPath: 'Ayla.md' };
  const state = {
    mapPath: 'Maps/Forest.atlasmap', activeTool: 'select', selectedIds: ['token-a', 'wall-1', 'token-b'],
    objects: { tokens: { 'token-a': token, 'token-b': character, invalid: { kind: 'pin' } } },
  };
  const writes = [];
  const store = { getState: () => state, setState: (value) => writes.push(value) };
  const snapshot = readAtlasTokenState(store);

  assert.equal(snapshot.status, 'ready');
  assert.equal(snapshot.mapPath, 'Maps/Forest.atlasmap');
  assert.deepEqual(snapshot.selectedIds, ['token-a', 'wall-1', 'token-b']);
  assert.deepEqual(snapshot.selectedTokenIds, ['token-a', 'token-b']);
  assert.deepEqual(snapshot.selectedTokens, [
    { id: 'token-a', kind: 'token', assetId: 'asset-1', imagePath: 'wolf.webp', name: 'Wolf', statblockPath: 'Wolf.md', assetStatblockPath: null, resolvedStatblockPath: 'Wolf.md', linkSource: 'instance' },
    { id: 'token-b', kind: 'character', assetId: null, imagePath: null, name: 'Ayla', statblockPath: 'Ayla.md', assetStatblockPath: null, resolvedStatblockPath: 'Ayla.md', linkSource: 'instance' },
  ]);
  assert.equal(snapshot.invalidTokenCount, 1);
  assert.deepEqual(getSelectedAtlasToken(snapshot), snapshot.selectedTokens[0]);
  assert.notEqual(snapshot.tokens, state.objects.tokens);
  assert.equal(writes.length, 0);

  token.name = 'Changed';
  snapshot.selectedIds.push('new-id');
  assert.equal(snapshot.selectedTokens[0].name, 'Wolf');
  assert.equal(state.selectedIds.length, 3);
});

test('resolves shared Atlas TokenAsset links when a placed token has no instance link', () => {
  const token = { kind: 'token', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', name: 'Wolf' };
  const store = { getState: () => ({ mapPath: 'Maps/Forest.atlasmap', activeTool: 'select', selectedIds: ['wolf'], objects: { tokens: { wolf: token } } }) };
  const assetService = { loadedTokenAssets: () => [
    { id: 'wolf-asset', type: 'token', imagePath: 'Tokens/Wolf.webp', statblockPath: 'Bestiary/Wolf.md' },
    { id: 'not-token', type: 'other', imagePath: 'Tokens/Wolf.webp', statblockPath: 'Wrong.md' },
  ] };
  const snapshot = readAtlasTokenStateFromContext({ atlasStore: store, assetService });
  assert.deepEqual(snapshot.selectedTokens[0], {
    id: 'wolf', kind: 'token', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', name: 'Wolf',
    statblockPath: null, assetStatblockPath: 'Bestiary/Wolf.md', resolvedStatblockPath: 'Bestiary/Wolf.md', linkSource: 'asset',
  });
});

test('returns explicit status for unavailable or malformed Atlas state', () => {
  assert.equal(readAtlasTokenState(null).status, 'store-unavailable');
  assert.equal(readAtlasTokenState({ getState: () => null }).status, 'state-unavailable');
  assert.equal(readAtlasTokenState({ getState: () => ({ objects: {} }) }).status, 'tokens-unavailable');
  assert.equal(readAtlasTokenState({ getState: () => ({ objects: { tokens: {} } }) }).status, 'partial');
  assert.equal(readAtlasTokenState({ getState: () => { throw new Error('unavailable'); } }).status, 'state-unavailable');
});

test('context wrapper reads the supplied Atlas store and selected-token helper handles empty selection', () => {
  const store = { getState: () => ({ mapPath: null, activeTool: '', selectedIds: [], objects: { tokens: {} } }) };
  const snapshot = readAtlasTokenStateFromContext({ atlasStore: store });
  assert.equal(snapshot.status, 'ready');
  assert.equal(getSelectedAtlasToken(snapshot), null);
});
