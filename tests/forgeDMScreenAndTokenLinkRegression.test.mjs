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

test('Forge statblocks replace the matching Atlas DM Screen card instead of rendering a duplicate Forge section', async () => {
  const bridge = await read('../src/atlas/forgeDMScreenBridge.ts');
  assert.match(bridge, /findNativeFeedMount\(/);
  assert.match(bridge, /attachCard\(card, nativeMount\.target, nativeMount\.nativeSheet\)/);
  assert.match(bridge, /nativeSheet\.hidden = true/);
  assert.match(bridge, /restoreNativeSheet\(/);
  assert.doesNotMatch(bridge, /No Forge sheets are linked to Tokens or Characters in this scene/);
});

test('DM Screen bridge startup and reconciliation failures are isolated from existing token-link and preview features', async () => {
  const [bridge, runtime] = await Promise.all([
    read('../src/atlas/forgeAtlasPreviewBridge.ts'),
    read('../src/atlas/forgeDMScreenBridge.ts'),
  ]);
  assert.match(bridge, /try \{\s*stopDMScreenBridge = startForgeAtlasDMScreenBridge/);
  assert.match(bridge, /DM Screen integration could not start/);
  assert.match(runtime, /Could not synchronize the Atlas DM Screen feed/);
  assert.match(runtime, /catch \(error\)/);
});

test('card actions remain visible instead of being hidden behind hover-only interaction', async () => {
  const styles = await read('../styles.css');
  const rule = styles.match(/\.statblock-forge__card-actions-row\s*\{[^}]+\}/)?.[0] ?? '';
  assert.match(rule, /opacity:\s*1/);
  assert.match(rule, /pointer-events:\s*auto/);
});
