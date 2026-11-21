import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Token linking is discoverable from the statblock card menu above the rendered sheet even when Atlas needs to show an inspection reason', async () => {
  const [surface, menu] = await Promise.all([
    read('../src/views/StatblockRenderSurface.ts'),
    read('../src/render/statblockCardActionsMenu.ts'),
  ]);
  assert.match(surface, /id: 'link-selected-atlas-tokens'/);
  assert.match(surface, /run: \(\) => this\.applySelectedAtlasTokenLinks\(source\.path, language, false\)/);
  assert.match(surface, /disabled: false/);
  assert.match(menu, /if \(action\.title\) item\.title = action\.title/);
  assert.match(surface, /root\.append\(sheetWidthControl, cardMenu, renderedCard\)/);
  assert.match(surface, /Link the selected Atlas Tokens and Characters/);
});

test('reserved Token-art aliases keep the Token linking menu available', async () => {
  const surface = await read('../src/views/StatblockRenderSurface.ts');
  assert.match(surface, /function isTokenArtFieldKey\(fieldKey: string\): boolean/);
  assert.match(surface, /\['image', 'token-image', 'token'\]\.includes\(fieldKey\)/);
  assert.match(surface, /const isNativeImageField = isTokenArtFieldKey\(fieldKey\)/);
  assert.match(surface, /if \(isNativeImageField\) \{/);
});

test('Atlas DM Screen keeps its native compact statblock card; Forge does not replace or duplicate it', async () => {
  const [previewBridge, renderer, readme] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/atlasForgePreviewRenderer.ts'),
    read('../README.md'),
  ]);
  assert.doesNotMatch(previewBridge, /startForgeAtlasDMScreenBridge|forgeDMScreenBridge/);
  assert.doesNotMatch(renderer, /variant: 'feed'|atlas-feed-mount/);
  assert.match(readme, /Atlas' own compact statblock presentation/);
  assert.match(readme, /full Forge layout/);
});

test('Removing Forge DM Screen rendering does not affect Token linking or Ctrl-hover preview', async () => {
  const [bridge, surface] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/views/StatblockRenderSurface.ts'),
  ]);
  assert.match(bridge, /startForgeAtlasStatblockLinkDialogBridge\(app, plugin\)/);
  assert.match(bridge, /new ForgeStatblockPreviewWindow/);
  assert.match(surface, /id: 'link-selected-atlas-tokens'/);
});

test('card actions remain visible instead of being hidden behind hover-only interaction', async () => {
  const styles = await read('../styles.css');
  const rule = styles.match(/\.statblock-forge__card-actions-row\s*\{[^}]+\}/)?.[0] ?? '';
  assert.match(rule, /opacity:\s*1/);
  assert.match(rule, /pointer-events:\s*auto/);
});
