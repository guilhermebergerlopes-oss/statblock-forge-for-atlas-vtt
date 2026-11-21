import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAtlasNativeAssetService,
  getAtlasNativeTokenStatblockLinkService,
  inspectSelectedAtlasTokenLinks,
  linkSelectedAtlasTokensToStatblock,
  resolveAtlasLibraryTokenAsset,
  resolveAtlasTokenStatblockPath,
  unlinkSelectedAtlasTokensFromStatblock,
} from '../src/atlas/atlasTokenLinkAdapter.ts';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';

const TARGET = 'Bestiary/Wolf.md';
const FORGE_FRONTMATTER = {
  'statblock-forge': {
    format: 'statblock-forge-template-link',
    version: 2,
    templatePath: 'Templates/Creature.forgetemplate',
    templateId: 'creature-template',
  },
};

function makeTokenAsset({ id = 'wolf-asset', imagePath = 'Tokens/Wolf.webp', statblockPath = null, type = 'token' } = {}) {
  return { id, type, imagePath, name: 'Wolf', ...(statblockPath ? { statblockPath } : {}) };
}

function makeAtlasApp({
  tokens = { wolf: { kind: 'character', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', name: 'Wolf' } },
  assets = [makeTokenAsset()],
  selectedIds = Object.keys(tokens),
  serviceAvailable = true,
  linkSucceeds = true,
  extraSelections = [],
  targetFrontmatter = FORGE_FRONTMATTER,
  activeMap = true,
} = {}) {
  const calls = { link: [], unlink: [], refresh: 0, updates: [] };
  const linkOutcomes = Array.isArray(linkSucceeds) ? [...linkSucceeds] : [linkSucceeds];
  const assetList = assets.map((asset) => ({ ...asset }));
  const assetService = {
    loadedTokenAssets: () => assetList,
    getTokenAssets: async () => assetList,
    updateAsset: async (id, updates) => {
      calls.updates.push({ id, updates });
      const asset = assetList.find((item) => item.id === id);
      if (asset) {
        if (updates.statblockPath === undefined) delete asset.statblockPath;
        else Object.assign(asset, updates);
      }
    },
    refreshMetadata: async () => { calls.refresh += 1; },
  };
  const linkService = serviceAvailable ? {
    getStatblockLinkedToToken: async (imagePath) => assetList.find((asset) => asset.imagePath === imagePath)?.statblockPath ?? null,
    getTokensLinkedToStatblock: async (path) => assetList.filter((asset) => asset.statblockPath === path).map((asset) => asset.imagePath),
    linkTokenToStatblock: async (imagePath, path, options) => {
      calls.link.push({ imagePath, path, options });
      const asset = assetList.find((item) => item.imagePath === imagePath);
      const succeeds = linkOutcomes.length > 0 ? linkOutcomes.shift() : true;
      if (!succeeds) return false;
      if (asset) asset.statblockPath = path;
      return true;
    },
    unlinkToken: async (imagePath, options) => {
      calls.unlink.push({ imagePath, options });
      const asset = assetList.find((item) => item.imagePath === imagePath);
      if (asset) delete asset.statblockPath;
      return true;
    },
    findAssetByAnyPath: async (path) => assetList.find((asset) => asset.imagePath === path) ?? null,
  } : null;

  const makeLeaf = (mapPath, mapTokens, mapSelection) => {
    const tokenRenderer = { statblockSync: { tokenStatblockLinkService: linkService } };
    const renderer = { getTokenRenderer: () => tokenRenderer };
    const store = {
      getState: () => ({
        mapPath,
        activeTool: 'select',
        selectedIds: mapSelection,
        objects: { tokens: mapTokens },
        updateTokens: (entries) => {
          for (const entry of entries) Object.assign(mapTokens[entry.id], entry.changes);
        },
      }),
    };
    const view = {
      getViewType: () => ATLAS_VIEW_TYPE,
      atlasStore: store,
      serviceManager: {
        getRendererService: () => ({ isInitialized: () => true, getRenderer: () => renderer }),
        getAssetService: () => assetService,
      },
    };
    return { view };
  };

  const leaf = makeLeaf('Maps/Forest.atlasmap', tokens, selectedIds);
  const leaves = [leaf, ...extraSelections.map((entry, index) => makeLeaf(`Maps/Other-${index}.atlasmap`, entry.tokens, entry.selectedIds))];
  const file = { path: TARGET, extension: 'md' };
  const app = {
    workspace: {
      activeLeaf: activeMap ? leaf : { view: { getViewType: () => 'markdown' } },
      getLeavesOfType: (viewType) => viewType === ATLAS_VIEW_TYPE ? leaves : [],
    },
    vault: { getAbstractFileByPath: (path) => path === TARGET ? file : null },
    metadataCache: { getFileCache: () => ({ frontmatter: targetFrontmatter }) },
  };
  return { app, calls, assetList, assetService, linkService, leaves, leaf };
}

test('resolves a TokenAsset by asset ID first and uses image path only as fallback', () => {
  const token = { assetId: 'exact', imagePath: 'Tokens/old.webp' };
  const assets = [
    { id: 'image-match', type: 'token', imagePath: 'Tokens/old.webp' },
    { id: 'exact', type: 'token', imagePath: 'Tokens/new.webp' },
    { id: 'not-a-token', type: 'other', imagePath: 'Tokens/old.webp' },
  ];
  assert.equal(resolveAtlasLibraryTokenAsset(token, assets), assets[1]);
  assert.equal(resolveAtlasLibraryTokenAsset({ assetId: 'missing', imagePath: 'Tokens/old.webp' }, assets), assets[0]);
  assert.equal(resolveAtlasLibraryTokenAsset({ assetId: null, imagePath: 'Tokens/old.webp' }, assets), assets[0]);
});

test('placed-token link overrides the shared TokenAsset link', () => {
  const assets = [makeTokenAsset({ statblockPath: 'Bestiary/Shared.md' })];
  assert.deepEqual(resolveAtlasTokenStatblockPath({ assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', statblockPath: 'Bestiary/Instance.md' }, assets), {
    statblockPath: 'Bestiary/Instance.md', source: 'instance', asset: assets[0],
  });
  assert.deepEqual(resolveAtlasTokenStatblockPath({ assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', statblockPath: null }, assets), {
    statblockPath: 'Bestiary/Shared.md', source: 'asset', asset: assets[0],
  });
});

test('discovers Atlas native AssetService and TokenStatblockLinkService through map runtime handles', () => {
  const { app, assetService } = makeAtlasApp();
  const view = app.workspace.activeLeaf.view;
  const tokenRenderer = view.serviceManager.getRendererService().getRenderer().getTokenRenderer();
  assert.equal(getAtlasNativeAssetService({ assetService }), assetService);
  assert.equal(getAtlasNativeTokenStatblockLinkService({ tokenStatblockLinkService: tokenRenderer.statblockSync.tokenStatblockLinkService }), tokenRenderer.statblockSync.tokenStatblockLinkService);
  assert.equal(getAtlasNativeTokenStatblockLinkService({ tokenStatblockLinkService: null }), null);
});

test('inspects selected tokens, deduplicates shared artwork, and reads current asset links', () => {
  const { app } = makeAtlasApp({
    tokens: {
      wolfA: { kind: 'token', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', name: 'Wolf A' },
      wolfB: { kind: 'character', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', name: 'Wolf B' },
      noImage: { kind: 'character', statblockPath: TARGET, name: 'No image' },
    },
    selectedIds: ['wolfA', 'wolfB', 'noImage'],
  });
  const inspection = inspectSelectedAtlasTokenLinks(app, TARGET);
  assert.equal(inspection.status, 'ready');
  assert.equal(inspection.selectedTokenCount, 3);
  assert.equal(inspection.targets.length, 1);
  assert.equal(inspection.skippedUnlinkableTokenCount, 1);
  assert.equal(inspection.targets[0].imagePath, 'Tokens/Wolf.webp');
  assert.equal(inspection.targets[0].alreadyLinkedToTarget, false);
  assert.equal(inspection.mapPath, 'Maps/Forest.atlasmap');
});

test('uses Atlas link service for selected-token linking without rewriting Forge statblock image data', async () => {
  const { app, calls } = makeAtlasApp();
  const result = await linkSelectedAtlasTokensToStatblock(app, TARGET, { notice: false });
  assert.deepEqual(result, { status: 'linked', changedCount: 1, skippedCount: 0, mapPath: 'Maps/Forest.atlasmap' });
  assert.deepEqual(calls.link, [{
    imagePath: 'Tokens/Wolf.webp', path: TARGET,
    options: { updateStatblockAvatar: false, notice: false },
  }]);
  assert.equal(app.workspace.activeLeaf.view.atlasStore.getState().objects.tokens.wolf.statblockPath, TARGET);
});

test('linking updates generic Tokens and Characters on every open map using shared artwork', async () => {
  const { app } = makeAtlasApp({
    extraSelections: [{
      tokens: { wolfCopy: { kind: 'token', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp' } },
      selectedIds: [],
    }],
  });
  const result = await linkSelectedAtlasTokensToStatblock(app, TARGET, { notice: false });
  assert.equal(result.changedCount, 1);
  assert.equal(app.workspace.activeLeaf.view.atlasStore.getState().objects.tokens.wolf.statblockPath, TARGET);
  const otherLeaf = app.workspace.getLeavesOfType(ATLAS_VIEW_TYPE)[1];
  assert.equal(otherLeaf.view.atlasStore.getState().objects.tokens.wolfCopy.statblockPath, TARGET);
});

test('unlinks only selected assets linked to the current Forge statblock', async () => {
  const { app, calls } = makeAtlasApp({ assets: [makeTokenAsset({ statblockPath: TARGET })] });
  const result = await unlinkSelectedAtlasTokensFromStatblock(app, TARGET, { notify: false, notice: false });
  assert.deepEqual(result, { status: 'unlinked', changedCount: 1, skippedCount: 0, mapPath: 'Maps/Forest.atlasmap' });
  assert.deepEqual(calls.unlink, [{
    imagePath: 'Tokens/Wolf.webp', options: { updateStatblockAvatar: false, notify: false, notice: false },
  }]);
});

test('selects the only map with selected tokens when the Forge note is focused', () => {
  const { app } = makeAtlasApp({ activeMap: false });
  assert.equal(inspectSelectedAtlasTokenLinks(app, TARGET).status, 'ready');
});

test('rejects ambiguous selections across multiple Atlas maps', () => {
  const { app } = makeAtlasApp({
    activeMap: false,
    extraSelections: [{ tokens: { fox: { kind: 'token', imagePath: 'Tokens/Fox.webp' } }, selectedIds: ['fox'] }],
  });
  const inspection = inspectSelectedAtlasTokenLinks(app, TARGET);
  assert.equal(inspection.status, 'ambiguous-map');
});

test('reports missing map selection, unavailable link service, and invalid Forge note', () => {
  const noSelection = makeAtlasApp({ selectedIds: [] });
  assert.equal(inspectSelectedAtlasTokenLinks(noSelection.app, TARGET).status, 'no-selection');

  const noService = makeAtlasApp({ serviceAvailable: false });
  assert.equal(inspectSelectedAtlasTokenLinks(noService.app, TARGET).status, 'link-service-unavailable');

  const invalid = makeAtlasApp({ targetFrontmatter: { statblock: true } });
  assert.equal(inspectSelectedAtlasTokenLinks(invalid.app, TARGET).status, 'invalid-statblock');
});

test('accepts legacy Forge v1 only when the matching Atlas template marker is preserved', () => {
  const legacy = {
    'statblock-forge': {
      format: 'statblock-forge-template-link', version: 1,
      templatePath: 'Templates/Creature.forgetemplate', templateId: 'creature-template', atlasTemplateId: 'atlas-creature',
    },
    'atlas-template': 'atlas-creature',
  };
  const valid = makeAtlasApp({ targetFrontmatter: legacy });
  assert.equal(inspectSelectedAtlasTokenLinks(valid.app, TARGET).status, 'ready');
  const invalid = makeAtlasApp({ targetFrontmatter: { ...legacy, 'atlas-template': 'different' } });
  assert.equal(inspectSelectedAtlasTokenLinks(invalid.app, TARGET).status, 'invalid-statblock');
});


test('allows a selected generic Atlas Token to link to a Forge statblock', async () => {
  const { app, calls } = makeAtlasApp({
    tokens: { marker: { kind: 'token', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp' } },
    selectedIds: ['marker'],
  });
  const inspection = inspectSelectedAtlasTokenLinks(app, TARGET);
  assert.equal(inspection.status, 'ready');
  assert.equal(inspection.targets.length, 1);
  assert.equal(inspection.skippedUnlinkableTokenCount, 0);
  const result = await linkSelectedAtlasTokensToStatblock(app, TARGET, { notice: false });
  assert.deepEqual(result, { status: 'linked', changedCount: 1, skippedCount: 0, mapPath: 'Maps/Forest.atlasmap' });
  assert.deepEqual(calls.link[0], {
    imagePath: 'Tokens/Wolf.webp', path: TARGET,
    options: { updateStatblockAvatar: false, notice: false },
  });
  assert.equal(app.workspace.activeLeaf.view.atlasStore.getState().objects.tokens.marker.statblockPath, TARGET);
});


test('relinks an asset without allowing Atlas to rewrite the previous Forge note image', async () => {
  const { app, calls } = makeAtlasApp({ assets: [makeTokenAsset({ statblockPath: 'Bestiary/Old-Wolf.md' })] });
  const result = await linkSelectedAtlasTokensToStatblock(app, TARGET, { notice: false });
  assert.deepEqual(result, { status: 'linked', changedCount: 1, skippedCount: 0, mapPath: 'Maps/Forest.atlasmap' });
  assert.deepEqual(calls.unlink, [{
    imagePath: 'Tokens/Wolf.webp', options: { updateStatblockAvatar: false, notify: false, notice: false },
  }]);
  assert.deepEqual(calls.link, [{
    imagePath: 'Tokens/Wolf.webp', path: TARGET,
    options: { updateStatblockAvatar: false, notice: false },
  }]);
});

test('restores the previous link if an Atlas replacement link is rejected', async () => {
  const { app, calls, assetList } = makeAtlasApp({
    assets: [makeTokenAsset({ statblockPath: 'Bestiary/Old-Wolf.md' })],
    linkSucceeds: [false, true],
  });
  const result = await linkSelectedAtlasTokensToStatblock(app, TARGET, { notice: false });
  assert.equal(result.changedCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(assetList[0].statblockPath, 'Bestiary/Old-Wolf.md');
  assert.equal(calls.link.length, 2);
  assert.equal(calls.link[1].path, 'Bestiary/Old-Wolf.md');
});

test('unlinking an instance-only link clears only that placed Character and preserves its shared TokenAsset link', async () => {
  const { app, calls, assetList } = makeAtlasApp({
    tokens: {
      wolf: {
        kind: 'character', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp',
        name: 'Wolf', statblockPath: TARGET, resources: { hp: 4 }, difficulty: 2,
      },
    },
    assets: [makeTokenAsset({ statblockPath: 'Bestiary/Shared-Wolf.md' })],
  });
  const inspection = inspectSelectedAtlasTokenLinks(app, TARGET);
  assert.equal(inspection.status, 'ready');
  assert.equal(inspection.targets[0].assetLinkedToTarget, false);
  assert.deepEqual(inspection.targets[0].instanceTokenIdsLinkedToTarget, ['wolf']);

  const result = await unlinkSelectedAtlasTokensFromStatblock(app, TARGET, { notify: false, notice: false });
  assert.deepEqual(result, { status: 'unlinked', changedCount: 1, skippedCount: 0, mapPath: 'Maps/Forest.atlasmap' });
  const token = app.workspace.activeLeaf.view.atlasStore.getState().objects.tokens.wolf;
  assert.equal(token.statblockPath, undefined);
  assert.equal(token.resources, undefined);
  assert.equal(token.difficulty, undefined);
  assert.equal(token.name, undefined);
  assert.equal(assetList[0].statblockPath, 'Bestiary/Shared-Wolf.md');
  assert.equal(calls.unlink.length, 0);
});

test('unlinks a generic Token instance override without removing a separate shared TokenAsset link', async () => {
  const { app, calls, assetList } = makeAtlasApp({
    tokens: {
      marker: { kind: 'token', assetId: 'wolf-asset', imagePath: 'Tokens/Wolf.webp', statblockPath: TARGET },
    },
    assets: [makeTokenAsset({ statblockPath: 'Bestiary/Shared-Wolf.md' })],
    selectedIds: ['marker'],
  });
  const result = await unlinkSelectedAtlasTokensFromStatblock(app, TARGET, { notify: false, notice: false });
  assert.deepEqual(result, { status: 'unlinked', changedCount: 1, skippedCount: 0, mapPath: 'Maps/Forest.atlasmap' });
  assert.equal(app.workspace.activeLeaf.view.atlasStore.getState().objects.tokens.marker.statblockPath, undefined);
  assert.equal(assetList[0].statblockPath, 'Bestiary/Shared-Wolf.md');
  assert.equal(calls.unlink.length, 0);
});

test('rejects duplicate Atlas TokenAssets that share an image path before linking', () => {
  const { app } = makeAtlasApp({
    assets: [
      makeTokenAsset({ id: 'wolf-a' }),
      makeTokenAsset({ id: 'wolf-b' }),
    ],
  });
  assert.equal(inspectSelectedAtlasTokenLinks(app, TARGET).status, 'ambiguous-image-assets');
});
