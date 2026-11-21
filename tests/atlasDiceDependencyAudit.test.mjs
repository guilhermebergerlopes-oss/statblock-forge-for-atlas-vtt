import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const ROLL_INTEGRATION_FILES = [
  '../main.ts',
  '../src/atlas/atlasDiceRuntime.ts',
  '../src/statblocks/atlasRestDiceTool.ts',
  '../src/statblocks/atlasOffMapDiceRoller.ts',
  '../src/statblocks/forgeDiceHistoryStorage.ts',
  '../src/render/statblockDiceLinks.ts',
];
const LEGACY_FORK_ROLL_API = /forked-atlas-vtt-compatibility-for-statblock-forge|publicAPI|dice\.statblock-(?:rolls|history)|rollStatblock\s*\(|rollingDiceForStatblock|getStatblockRollHistory|repeatStatblockRoll/;

test('roll, history, and repeat modules no longer reference the compatibility fork API', async () => {
  for (const path of ROLL_INTEGRATION_FILES) {
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, LEGACY_FORK_ROLL_API, `${path} must use Atlas-native or Forge-owned roll services`);
  }
});

test('the original Atlas remains the only map runtime ID in the roll integration', async () => {
  const source = await readFile(new URL('../src/atlas/atlasDiceRuntime.ts', import.meta.url), 'utf8');
  assert.match(source, /getAtlasMapViewContexts\(app\)/);
  assert.doesNotMatch(source, /plugins\?\.plugins\?\.\[['"]forked-atlas-vtt-compatibility-for-statblock-forge/);
});

test('the live Atlas runtime is the only production discovery path', async () => {
  const runtime = await readFile(new URL('../src/atlas/atlasRuntime.ts', import.meta.url), 'utf8');
  const tokenAdapter = await readFile(new URL('../src/atlas/atlasTokenAdapter.ts', import.meta.url), 'utf8');
  assert.match(runtime, /getLoadedAtlasPlugin/);
  assert.match(runtime, /getAtlasMapViewContexts/);
  assert.match(tokenAdapter, /getAtlasMapViewContexts/);
  assert.doesNotMatch(tokenAdapter, /getLeavesOfType/);
  await assert.rejects(
    readFile(new URL('../src/atlas/atlasRuntimeDetection.ts', import.meta.url), 'utf8'),
    { code: 'ENOENT' },
  );
});
