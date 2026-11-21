import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ATLAS_TOKEN_ASSET_DIRECTORY,
  assessForgeTokenAssetCreation,
  createForgeTokenAssetFromImage,
  forgeTokenAssetImagePath,
} from '../src/atlas/atlasForgeTokenAssetCreation.ts';
import { ATLAS_VIEW_TYPE } from '../src/atlas/atlasRuntime.ts';

const NOTE_PATH = 'Bestiary/Ash Wolf.md';
const IMAGE_PATH = 'Art/Ash Wolf.png';
const FRONTMATTER = {
  'statblock-forge': {
    format: 'statblock-forge-template-link',
    version: 2,
    templatePath: 'Templates/Creature.forgetemplate',
    templateId: 'creature-template',
  },
};

function makeApp({
  version = '0.17.0',
  imagePath = IMAGE_PATH,
  imageExtension = 'png',
  assets = [],
  addFails = false,
  verifyFails = false,
  mapOpen = true,
  addDelay = 0,
} = {}) {
  const files = new Map();
  const folders = new Map();
  const calls = { add: [], refresh: 0, trash: [], createdBinary: [] };
  const image = { path: imagePath, extension: imageExtension, basename: imagePath.split('/').at(-1).replace(/\.[^.]+$/, '') };
  files.set(imagePath, image);
  const note = { path: NOTE_PATH, extension: 'md', basename: 'Ash Wolf' };
  files.set(NOTE_PATH, note);
  const assetList = assets.map((asset) => ({ ...asset }));
  let tokenAssetReads = 0;
  const assetService = {
    loadedTokenAssets: () => assetList,
    getTokenAssets: async () => {
      tokenAssetReads += 1;
      if (verifyFails && tokenAssetReads > 1) throw new Error('asset index unavailable');
      return assetList;
    },
    getDefaultCollectionId: () => 'creatures',
    addTokenAsset: async (asset, options) => {
      calls.add.push({ asset: { ...asset }, options });
      if (addDelay) await new Promise((resolve) => setTimeout(resolve, addDelay));
      if (addFails) throw new Error('registration failed');
      const saved = { ...asset, id: `token-${assetList.length + 1}`, type: 'token', createdAt: Date.now(), modifiedAt: Date.now() };
      assetList.push(saved);
      return saved;
    },
  };
  const linkService = {
    getStatblockLinkedToToken: async () => null,
    getTokensLinkedToStatblock: async () => [],
    linkTokenToStatblock: async () => true,
    unlinkToken: async () => true,
    findAssetByAnyPath: async () => null,
  };
  const atlasStore = { getState: () => ({ mapPath: 'Maps/Forest.atlasmap', activeTool: 'select', selectedIds: [], objects: { tokens: {} } }) };
  const renderer = { getTokenRenderer: () => ({ statblockSync: { tokenStatblockLinkService: linkService } }) };
  const rendererService = { isInitialized: () => true, getRenderer: () => renderer };
  const toolController = { getDiceTool: () => ({}) };
  const notePreviewUIManager = { showOrCreatePreview() {}, hideAllUnpinnedPreviews() {} };
  const serviceManager = {
    getRendererService: () => rendererService,
    getToolController: () => toolController,
    getNotePreviewUIManager: () => notePreviewUIManager,
    getAssetService: () => assetService,
    getStore: () => atlasStore,
  };
  const leaf = { view: { getViewType: () => ATLAS_VIEW_TYPE, atlasStore, serviceManager } };
  const dirs = new Set(['']);
  const app = {
    plugins: { plugins: { 'atlas-vtt': { manifest: { version } } }, manifests: { 'atlas-vtt': { version } } },
    workspace: {
      getLeavesOfType: (type) => type === ATLAS_VIEW_TYPE && mapOpen ? [leaf] : [],
      trigger: (event) => { if (event === 'atlas-vtt:refresh-assets') calls.refresh += 1; },
    },
    metadataCache: {
      getFileCache: (file) => file?.path === NOTE_PATH ? { frontmatter: FRONTMATTER } : null,
      getFirstLinkpathDest: (path) => files.get(path) ?? null,
    },
    vault: {
      getAbstractFileByPath: (path) => files.get(path) ?? folders.get(path) ?? null,
      getFiles: () => [...files.values()],
      createFolder: async (path) => { dirs.add(path); const folder = { path, children: [] }; folders.set(path, folder); return folder; },
      readBinary: async (file) => new Uint8Array([1, 2, 3, 4]).buffer,
      createBinary: async (path, bytes) => {
        const file = { path, extension: path.split('.').at(-1), basename: path.split('/').at(-1).replace(/\.[^.]+$/, ''), bytes: new Uint8Array(bytes) };
        files.set(path, file);
        calls.createdBinary.push(path);
        return file;
      },
      delete: async (file) => files.delete(file.path),
    },
    fileManager: {
      trashFile: async (file) => { calls.trash.push(file.path); files.delete(file.path); },
    },
  };
  return { app, calls, assetList, assetService, files, folders, note, image };
}

test('assessment accepts a local Atlas-supported image on a Forge v2 note', () => {
  const { app } = makeApp();
  const result = assessForgeTokenAssetCreation(app, NOTE_PATH, IMAGE_PATH);
  assert.equal(result.status, 'ready');
  assert.equal(result.imagePath, IMAGE_PATH);
});

test('assessment rejects remote, missing and unsupported images', () => {
  const { app } = makeApp();
  assert.equal(assessForgeTokenAssetCreation(app, NOTE_PATH, 'https://example.com/wolf.png').status, 'remote-image');
  assert.equal(assessForgeTokenAssetCreation(app, NOTE_PATH, '').status, 'missing-image');
  const unsupported = makeApp({ imageExtension: 'tiff' });
  assert.equal(assessForgeTokenAssetCreation(unsupported.app, NOTE_PATH, IMAGE_PATH).status, 'unsupported-image');
});

test('assessment accepts forward-compatible Atlas versions when AssetService capabilities are present', () => {
  for (const version of ['0.18.0', '0.18.1', '0.19.0', '1.0.0']) {
    const supported = makeApp({ version });
    assert.equal(assessForgeTokenAssetCreation(supported.app, NOTE_PATH, IMAGE_PATH).status, 'ready', version);
  }
  const unsupported = makeApp({ version: '0.16.9' });
  assert.equal(assessForgeTokenAssetCreation(unsupported.app, NOTE_PATH, IMAGE_PATH).status, 'unsupported-atlas-version');
  const noMap = makeApp({ mapOpen: false });
  assert.equal(assessForgeTokenAssetCreation(noMap.app, NOTE_PATH, IMAGE_PATH).status, 'map-required');
});

test('creates an Atlas TokenAsset in the default collection and stores a copy under atlas-vtt/assets', async () => {
  const { app, calls, assetList, files } = makeApp();
  const beforeNoteFrontmatter = FRONTMATTER;
  const result = await createForgeTokenAssetFromImage(app, NOTE_PATH, 'Ash Wolf', IMAGE_PATH);
  assert.equal(result.status, 'created');
  assert.equal(assetList.length, 1);
  assert.equal(assetList[0].type, 'token');
  assert.equal(assetList[0].name, 'Ash Wolf');
  assert.equal(assetList[0].statblockPath, NOTE_PATH);
  assert.equal(assetList[0].collection, 'creatures');
  assert.equal(assetList[0].showRing, false);
  assert.deepEqual(assetList[0].tags, []);
  assert.ok(assetList[0].imagePath.startsWith(`${ATLAS_TOKEN_ASSET_DIRECTORY}/`));
  assert.ok(files.has(assetList[0].imagePath));
  assert.deepEqual(calls.add[0].options, { userImport: true });
  assert.equal(calls.refresh, 1);
  assert.equal(FRONTMATTER, beforeNoteFrontmatter, 'Forge source note is not modified');
});

test('coalesces concurrent create actions for one Forge note into a single TokenAsset', async () => {
  const { app, calls, assetList } = makeApp({ addDelay: 15 });
  const [first, second] = await Promise.all([
    createForgeTokenAssetFromImage(app, NOTE_PATH, 'Ash Wolf', IMAGE_PATH),
    createForgeTokenAssetFromImage(app, NOTE_PATH, 'Ash Wolf', IMAGE_PATH),
  ]);
  assert.equal(first.status, 'created');
  assert.equal(second.status, 'created');
  assert.equal(calls.add.length, 1);
  assert.equal(assetList.length, 1);
  assert.equal(first.asset.id, second.asset.id);
});

test('assessment identifies a TokenAsset already linked to the same Forge note', () => {
  const existing = { id: 'existing', type: 'token', name: 'Ash Wolf', imagePath: 'atlas-vtt/assets/ash.webp', collection: 'creatures', statblockPath: NOTE_PATH };
  const { app } = makeApp({ assets: [existing] });
  assert.equal(assessForgeTokenAssetCreation(app, NOTE_PATH, IMAGE_PATH).status, 'already-exists');
});

test('does not create a duplicate TokenAsset for a Forge note already represented in the Atlas library', async () => {
  const existing = { id: 'existing', type: 'token', name: 'Ash Wolf', imagePath: 'atlas-vtt/assets/ash.webp', collection: 'creatures', statblockPath: NOTE_PATH };
  const { app, calls, assetList } = makeApp({ assets: [existing] });
  const result = await createForgeTokenAssetFromImage(app, NOTE_PATH, 'Ash Wolf', IMAGE_PATH);
  assert.equal(result.status, 'already-exists');
  assert.equal(assetList.length, 1);
  assert.equal(calls.add.length, 0);
  assert.equal(calls.createdBinary.length, 0);
});

test('cleans up a copied image when TokenAsset registration fails and can be verified absent', async () => {
  const { app, calls, assetList, files } = makeApp({ addFails: true });
  const result = await createForgeTokenAssetFromImage(app, NOTE_PATH, 'Ash Wolf', IMAGE_PATH);
  assert.equal(result.status, 'failed');
  assert.equal(assetList.length, 0);
  assert.equal(calls.createdBinary.length, 1);
  assert.deepEqual(calls.trash, calls.createdBinary);
  assert.equal(files.has(calls.createdBinary[0]), false);
  assert.equal(calls.refresh, 0);
});

test('preserves the copied image when registration outcome cannot be verified', async () => {
  const { app, calls, files } = makeApp({ addFails: true, verifyFails: true });
  const result = await createForgeTokenAssetFromImage(app, NOTE_PATH, 'Ash Wolf', IMAGE_PATH);
  assert.equal(result.status, 'uncertain');
  assert.equal(calls.trash.length, 0);
  assert.equal(files.has(result.imagePath), true);
});

test('builds sanitized unique Atlas asset image paths while preserving the source extension', () => {
  assert.equal(forgeTokenAssetImagePath('Ash Wolf / Alpha', 'PNG', 123, 'abc1234'), 'atlas-vtt/assets/Ash_Wolf_Alpha_123_abc1234.png');
});
