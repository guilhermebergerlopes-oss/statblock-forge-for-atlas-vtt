import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bridgePath = new URL('../src/atlas/forgeStatblockLinkDialogBridge.ts', import.meta.url);
const previewBridgePath = new URL('../src/atlas/forgeAtlasPreviewBridge.ts', import.meta.url);
const rendererPath = new URL('../src/atlas/atlasForgePreviewRenderer.ts', import.meta.url);
const stylePath = new URL('../src/styles/atlas-statblock-link.scss', import.meta.url);
const stylesCssPath = new URL('../styles.css', import.meta.url);

const [bridge, previewBridge, renderer, scss, css] = await Promise.all([
  readFile(bridgePath, 'utf8'),
  readFile(previewBridgePath, 'utf8'),
  readFile(rendererPath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(stylesCssPath, 'utf8'),
]);

test('Atlas link dialog bridge decorates native option rows with a Forge marker', () => {
  assert.match(bridge, /\.atlas-statblock-link__option/);
  assert.match(bridge, /statblock-forge__atlas-picker-badge/);
  assert.match(bridge, /forgePickerEntryForAtlasOption\(option, entries, name, detail\)/);
  assert.match(bridge, /const selectedEntry = selectedPath \? entries\.find/);
  assert.match(bridge, /option === activeOption && selectedEntry/);
  assert.match(bridge, /applyPickerBadges\(dialog, entries\);[\s\S]*const preview = dialog\.querySelector/);
  assert.match(bridge, /option\.dataset\.forgeStatblockPath/);
});

test('Forge link dialog preview uses the Forge renderer and selected Atlas note path', () => {
  assert.match(bridge, /\.atlas-statblock-link__preview-path span/);
  assert.match(bridge, /renderForgeStatblockPreview\(app, plugin/);
  assert.match(bridge, /variant: 'preview'/);
  assert.match(bridge, /preferTokenImage: true/);
  assert.match(bridge, /HIDDEN_NATIVE_CLASS/);
  assert.match(bridge, /previewSession\?\.dispose\(\)/);
});

test('link dialog bridge is started and disposed with the existing Atlas preview bridge', () => {
  assert.match(previewBridge, /startForgeAtlasStatblockLinkDialogBridge\(app, plugin\)/);
  assert.match(previewBridge, /stopStatblockLinkDialogBridge\(\)/);
});

test('Forge picker metadata is limited to v2 notes and mirrors Atlas name fallback', () => {
  assert.match(renderer, /readForgeTemplateLink\(app, file\)\?\.version === 2/);
  assert.match(renderer, /metadataCache\.getFileCache\(file\)\?\.frontmatter/);
  assert.match(renderer, /name: forgePickerScalar\(fields\.name\) \?\? file\.basename/);
  assert.doesNotMatch(renderer, /if \(resolved\) fields = resolved\.data/);
  assert.match(renderer, /renderContext\.preferTokenImage === true/);
});

test('Atlas picker badge and preview styles are available in SCSS and Obsidian-loaded CSS', () => {
  assert.match(scss, /\.statblock-forge__atlas-picker-badge/);
  assert.match(scss, /\.statblock-forge__atlas-link-preview/);
  assert.match(css, /BEGIN GENERATED FORGE ATLAS STATBLOCK LINK STYLES/);
  assert.match(css, /\.statblock-forge__atlas-picker-badge/);
});
