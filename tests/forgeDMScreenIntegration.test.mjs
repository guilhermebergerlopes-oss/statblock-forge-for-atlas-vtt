import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Forge keeps Atlas DM Screen rendering native and does not mount a second Forge feed', async () => {
  const [previewBridge, renderer, readme] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
    read('../README.md'),
  ]);
  assert.doesNotMatch(previewBridge, /startForgeAtlasDMScreenBridge|forgeDMScreenBridge/);
  assert.doesNotMatch(renderer, /variant: 'feed'|atlas-feed-mount/);
  assert.match(previewBridge, /startForgeAtlasStatblockLinkDialogBridge\(app, plugin\)/);
  assert.match(previewBridge, /installForgePreviewHooksForManager/);
  assert.match(readme, /native compact Atlas presentation/);
  assert.match(readme, /does not replace those cards with a full Forge sheet/);
});

test('Full Forge renderer remains available for Atlas Ctrl-hover and Link Statblock previews', async () => {
  const [previewBridge, renderer, linkDialog] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
    read('../src/atlas/forgeStatblockLinkDialogBridge.ts'),
  ]);
  assert.match(previewBridge, /new ForgeStatblockPreviewWindow/);
  assert.match(previewBridge, /isForgeNativeV2Statblock\(app, sourcePath\)/);
  assert.match(renderer, /renderStatblock\(/);
  assert.match(renderer, /variant\?: 'preview'/);
  assert.match(linkDialog, /renderForgeStatblockPreview\(/);
});

test('Custom Forge DM Screen feed runtime and styles are removed', async () => {
  const [styleCompiler, css, previewBridge] = await Promise.all([
    read('../scripts/compile-styles.mjs'),
    read('../styles.css'),
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
  ]);
  assert.doesNotMatch(styleCompiler, /dm-screen\.scss/);
  assert.doesNotMatch(css, /GENERATED FORGE DM SCREEN STYLES|statblock-forge__dm-screen-feed/);
  assert.doesNotMatch(previewBridge, /DM Screen integration could not start/);
});

test('Token linking and Atlas Link Statblock registration remain independent of DM Screen presentation', async () => {
  const [previewBridge, notes] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/views/StatblockNotePanels.ts'),
  ]);
  assert.match(previewBridge, /startForgeAtlasStatblockLinkDialogBridge\(app, plugin\)/);
  assert.match(notes, /registerForgeStatblockNoteInAtlasPicker/);
  assert.match(notes, /registerExistingForgeStatblocksInAtlasPicker/);
});
