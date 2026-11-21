import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('verified Atlas Ctrl-hover is intercepted only for Forge-native v2 token notes', async () => {
  const [main, bridge, renderer, runtime] = await Promise.all([
    read('../main.ts'),
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
    read('../src/atlas/atlasRuntime.ts'),
  ]);

  assert.match(main, /startForgeAtlasPreviewBridge\(this\.app, this\)/);
  assert.doesNotMatch(main, /getForgeAtlasPublicAPI|registerForgeAtlasSheetProvider|provider-registration-requested/);
  assert.match(bridge, /isTokenAnchor\(pin\)/);
  assert.match(bridge, /isForgeNativeV2Statblock\(app, sourcePath\)/);
  assert.match(bridge, /originalShowOrCreatePreview\.call\(manager, pin, screenX, screenY, sourceLeaf, originContext\)/);
  assert.match(bridge, /capturedTokenRollContext\(originContext, manager, pin\.id\)/);
  assert.match(renderer, /link\?\.version === 2 && !link\.atlasTemplateId/);
  assert.match(runtime, /ATLAS_PLUGIN_ID = 'atlas-vtt'/);
});

test('direct preview reuses the Forge renderer, Fields, dice links, and source resolver', async () => {
  const renderer = await read('../src/atlas/atlasForgePreviewRenderer.ts');
  assert.match(renderer, /renderStatblock\(/);
  assert.match(renderer, /loadStatblockSource\(/);
  assert.match(renderer, /attachForgeStatblockDiceRolling\(/);
  assert.match(renderer, /atlasRollContext: \{ viewId: renderContext\.atlasViewId/);
  assert.match(renderer, /renderForgeStatblockPreview\(/);
  assert.match(renderer, /variant: 'preview'/);
  assert.match(renderer, /signal: options\.signal/);
  assert.match(renderer, /handle\.update\(activeContext\)/);
});

test('Forge previews participate in Atlas manager lifecycle and native previews remain untouched', async () => {
  const [bridge, window] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/forgeStatblockPreviewWindow.ts'),
  ]);
  assert.match(bridge, /manager\.activePreviews\.set\(`\$\{pin\.notePath\}::\$\{pin\.id\}`, preview\)/);
  assert.match(bridge, /manager\.hideAllUnpinnedPreviews\(\)/);
  assert.match(bridge, /preview instanceof ForgeStatblockPreviewWindow/);
  assert.match(window, /handlePreviewClosed\?\.\(this\)/);
  assert.match(bridge, /originalShowStatblocksWithMap\.call\(manager\)/);
  assert.match(bridge, /manager\.showOrCreatePreview === wrappedShowOrCreatePreview/);
  assert.match(window, /atlas-statblock-preview-window/);
  assert.match(window, /atlas-statblock-preview-window__controls/);
  assert.match(window, /this\.controller\.abort\(\)/);
  assert.match(window, /if \(pinned\) this\.initialPosition = null/);
  assert.match(window, /this\.renderSession\?\.dispose\(\)/);
  assert.match(window, /subscribeToTokenUpdates/);
  assert.match(window, /values\.offMap === true/);
  assert.match(bridge, /preview\.destroy\(\)/);
});

test('Forge preview keeps Template width and a bounded scrollable body', async () => {
  const [renderer, previewWindow, styles] = await Promise.all([
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
    read('../src/atlas/forgeStatblockPreviewWindow.ts'),
    read('../styles.css'),
  ]);
  assert.match(renderer, /resolveForgeSheetWidth\(source\.raw\[FORGE_STATBLOCK_SHEET_WIDTH_KEY\], layout\.sheetWidth\)/);
  assert.match(renderer, /dataset\.forgeSheetWidth = String\(resolved\.sheetWidth\)/);
  assert.match(renderer, /--statblock-forge-sheet-width.*resolved\.sheetWidth/);
  assert.match(previewWindow, /outerWidth = Math\.min\(sheetWidth \+ horizontalPadding, maxWidth\)/);
  assert.match(previewWindow, /renderHost\.style\.flex = `0 0 \$\{availableContentWidth\}px`/);
  assert.match(previewWindow, /renderHost\.style\.width = `\$\{availableContentWidth\}px`/);
  assert.match(previewWindow, /Measure after applying the configured width/);
  assert.match(previewWindow, /PREVIEW_SCROLL_SELECTOR/);
  assert.match(styles, /atlas-statblock-preview-window\.statblock-forge__atlas-width-preview[\s\S]*?max-width: min\(calc\(var\(--statblock-forge-sheet-width/);
  assert.match(styles, /statblock-forge__atlas-preview-mount > \.statblock-forge__final-card\.atlas-statblock[\s\S]*?width: var\(--statblock-forge-sheet-width/);
  assert.match(styles, /statblock-forge__atlas-preview-mount > \.statblock-forge__final-card\.atlas-statblock > \.statblock-forge__preview-body[\s\S]*?overflow-y: auto/);
});

test('direct preview hooks are restricted to verified Atlas runtimes and cleaned up', async () => {
  const bridge = await read('../src/atlas/forgeAtlasPreviewBridge.ts');
  assert.doesNotMatch(bridge, /runtime\.version !== '0\.17\.0'/);
  assert.match(bridge, /if \(!runtime\.runtimeSupported\)/);
  assert.match(bridge, /runtime\.runtimeSupported/);
  assert.match(bridge, /app\.workspace\.on\('layout-change', reconcile\)/);
  assert.match(bridge, /app\.workspace\.on\('active-leaf-change', reconcile\)/);
  assert.match(bridge, /app\.workspace\.on\('file-open', reconcile\)/);
  assert.match(bridge, /for \(const patch of patches\.values\(\)\) patch\(\)/);
  assert.match(bridge, /app\.workspace\.offref\(ref\)/);
});

test('Ctrl-hover roll links forward the captured Atlas origin into the native DiceTool call', async () => {
  const [window, renderer, diceLinks, diceTool] = await Promise.all([
    read('../src/atlas/forgeStatblockPreviewWindow.ts'),
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
    read('../src/render/statblockDiceLinks.ts'),
    read('../src/statblocks/atlasRestDiceTool.ts'),
  ]);
  assert.match(window, /originContext: this\.originContext/);
  assert.match(renderer, /atlasOriginContext: options\.originContext/);
  assert.match(renderer, /originContext: renderContext\.atlasOriginContext/);
  assert.match(diceLinks, /originContext: options\.atlasRollContext\.originContext/);
  assert.match(diceTool, /originContext\?: AtlasDiceTokenRollContextLike/);
  assert.match(diceTool, /resolveAtlasDiceRollTarget\(app, source\.viewId, source\.originContext\?\.mapPath\)/);
});
