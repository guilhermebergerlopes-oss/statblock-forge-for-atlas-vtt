import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Forge registers its native renderer with the Forked Atlas public sheet API', async () => {
  const [main, provider] = await Promise.all([
    read('../main.ts'),
    read('../src/atlas/atlasSheetProvider.ts'),
  ]);
  assert.match(main, /getForgeAtlasPublicAPI, registerForgeAtlasSheetProvider/);
  assert.match(main, /registerForgeAtlasSheetProvider\(this\.app, this, currentAtlasAPI\)/);
  assert.match(main, /onLayoutReady\(tryRegisterAtlasProvider\)/);
  assert.match(provider, /id: FORGE_SHEET_PROVIDER_ID/);
  assert.match(provider, /registerProvider\(createForgeSheetProvider\(app, plugin\)\)/);
  assert.match(provider, /pluginManager\?\.plugins\?\.\[ATLAS_PLUGIN_ID\]\?\.publicAPI/);
  assert.match(provider, /renderStatblock\(/);
  assert.match(provider, /loadStatblockSource\(/);
});

test('Forge uses the current Fork plugin id for the public Atlas integration', async () => {
  const [detection, dice] = await Promise.all([
    read('../src/atlas/atlasRuntimeDetection.ts'),
    read('../src/statblocks/atlasRestDiceTool.ts'),
  ]);
  assert.match(detection, /ATLAS_PLUGIN_ID = 'forked-atlas-vtt-compatibility-for-statblock-forge'/);
  assert.match(dice, /import \{ ATLAS_PLUGIN_ID \}/);
  assert.match(dice, /pluginManager\?\.plugins\?\.\[ATLAS_PLUGIN_ID\]\?\.publicAPI/);
  assert.doesNotMatch(detection + dice, /statblock-forge-forked-atlas-vtt-compatibility/);
});


test('Forge provider previews create a bounded scroll viewport for Atlas Ctrl-hover', async () => {
  const [provider, styles] = await Promise.all([
    read('../src/atlas/atlasSheetProvider.ts'),
    read('../styles.css'),
  ]);
  assert.match(provider, /activeContext\.container\.classList\.toggle\([\s\S]*?statblock-forge__atlas-preview-mount[\s\S]*?activeContext\.variant === 'preview'/);
  assert.match(styles, /\.atlas-sheet-render-container\.statblock-forge__atlas-preview-mount\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/);
  assert.match(styles, /\.statblock-forge__atlas-preview-mount\s*>\s*\.statblock-forge__final-card\.atlas-statblock\s*\{[\s\S]*?display:\s*flex;[\s\S]*?min-height:\s*0;/);
  assert.match(styles, /\.statblock-forge__preview-body\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/);
});


test('Forge can register on demand when the fork requests the Ctrl-hover renderer', async () => {
  const main = await read('../main.ts');
  assert.match(main, /statblock-forge-atlas-provider-registration-requested/);
  assert.match(main, /getForgeAtlasPublicAPI\(this\.app\)/);
  assert.match(main, /registeredAtlasAPI !== currentAtlasAPI/);
});
