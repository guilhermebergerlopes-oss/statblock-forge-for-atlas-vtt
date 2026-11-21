import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Atlas DM Screen bridge is started and stopped with the existing preview bridge lifecycle', async () => {
  const [previewBridge, feedBridge] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/forgeDMScreenBridge.ts'),
  ]);
  assert.match(previewBridge, /startForgeAtlasDMScreenBridge\(app, plugin\)/);
  assert.match(previewBridge, /stopDMScreenBridge\(\)/);
  assert.match(feedBridge, /inspectAtlasRuntime\(app\)/);
  assert.match(feedBridge, /getAtlasMapViewContexts\(app\)/);
  assert.match(feedBridge, /getTokenAssets/);
  assert.match(feedBridge, /loadedTokenAssets/);
  assert.match(feedBridge, /onTokenAssetsLoaded/);
  assert.match(feedBridge, /app\.workspace\.offref/);
  assert.match(feedBridge, /observer\.disconnect\(\)/);
});

test('Forge DM Screen feed renders native Forge notes and preserves Atlas map roll context', async () => {
  const [feedBridge, renderer] = await Promise.all([
    read('../src/atlas/forgeDMScreenBridge.ts'),
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
  ]);
  assert.match(feedBridge, /isForgeNativeV2Statblock\(app, path\)/);
  assert.match(feedBridge, /renderForgeStatblockPreview\(app, plugin/);
  assert.match(feedBridge, /variant: 'feed'/);
  assert.match(feedBridge, /statblock-forge__dm-screen-brand/);
  assert.match(feedBridge, /findNativeFeedMount\(/);
  assert.match(feedBridge, /attachCard\(card, nativeMount\.target, nativeMount\.nativeSheet\)/);
  assert.match(feedBridge, /\.atlas-dm-statblock-feeds/);
  assert.match(feedBridge, /\.atlas-linked-statblock, \.atlas-fantasy-statblock/);
  assert.match(feedBridge, /statblock-forge__dm-screen-token-chip/);
  assert.match(feedBridge, /Other Forge statblocks/);
  assert.match(feedBridge, /originContext/);
  assert.match(feedBridge, /tokenIds: Object\.freeze/);
  assert.match(feedBridge, /atlas-segmented atlas-dm-statblock-scope/);
  assert.match(feedBridge, /aria-checked/);
  assert.match(feedBridge, /ArrowLeft.*ArrowRight.*ArrowUp.*ArrowDown/);
  assert.match(renderer, /attachForgeStatblockDiceRolling\(/);
  assert.match(renderer, /variant: options\.variant \?\? 'preview'/);
  assert.match(renderer, /statblock-forge__atlas-feed-mount/);
});

test('DM Screen cards refresh on linked note and template changes', async () => {
  const feedBridge = await read('../src/atlas/forgeDMScreenBridge.ts');
  assert.match(feedBridge, /sourceRevision/);
  assert.match(feedBridge, /refreshSources\(\)/);
  assert.match(feedBridge, /app\.metadataCache\.on\('changed', \(\) => reconcile\(true\)\)/);
  assert.match(feedBridge, /app\.vault\.on\('modify', \(\) => reconcile\(true\)\)/);
});

test('DM Screen feed styles are compiled into the Obsidian stylesheet', async () => {
  const [compiler, scss, css] = await Promise.all([
    read('../scripts/compile-styles.mjs'),
    read('../src/styles/dm-screen.scss'),
    read('../styles.css'),
  ]);
  assert.match(compiler, /src\/styles\/dm-screen\.scss/);
  assert.match(scss, /\.statblock-forge__dm-screen-feed/);
  assert.match(scss, /min\(100%, 340px\)/);
  assert.match(scss, /statblock-forge__dm-screen-token-chip/);
  assert.match(css, /BEGIN GENERATED FORGE DM SCREEN STYLES/);
  assert.match(css, /\.statblock-forge__dm-screen-cards/);
  assert.match(css, /statblock-forge__dm-screen-token-chip/);
  assert.match(css, /statblock-forge__atlas-feed-mount/);
});

test('release metadata is consistently bumped to 0.5.2', async () => {
  const [packageJson, manifest, lock] = await Promise.all([
    read('../package.json').then(JSON.parse),
    read('../manifest.json').then(JSON.parse),
    read('../package-lock.json').then(JSON.parse),
  ]);
  assert.equal(packageJson.version, '0.5.2');
  assert.equal(manifest.version, '0.5.2');
  assert.equal(lock.version, '0.5.2');
  assert.equal(lock.packages[''].version, '0.5.2');
});

test('DM Screen reads callable Atlas Zustand stores and matches the native feed by its exact statblock path first', async () => {
  const [model, bridge] = await Promise.all([
    read('../src/atlas/forgeDMScreenModel.ts'),
    read('../src/atlas/forgeDMScreenBridge.ts'),
  ]);
  assert.match(model, /typeof store !== 'object' && typeof store !== 'function'/);
  assert.match(model, /readForgeDMScreenStoreState/);
  assert.match(bridge, /readForgeDMScreenStoreState\(context\.store\)/);
  assert.match(bridge, /readReactFiberPath\(item, app\) === group\.path/);
  assert.match(bridge, /exactPathMatch >= 0/);
  assert.match(bridge, /memoizedProps.*pendingProps/);
});
