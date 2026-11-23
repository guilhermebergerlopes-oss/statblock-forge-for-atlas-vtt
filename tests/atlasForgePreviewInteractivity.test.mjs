import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('Forge Ctrl-hover uses the shared editable statblock runtime and persists Field changes', async () => {
  const renderer = await read('../src/atlas/atlasForgePreviewRenderer.ts');
  assert.match(renderer, /interactiveCounters:\s*true/);
  assert.match(renderer, /onFieldValueChange:\s*\(fieldKey, value\) => persistFieldValue\(fieldKey, value\)/);
  assert.match(renderer, /getLiveFieldData:\s*\(\) => data/);
  assert.match(renderer, /projectForgeStatblockDataForLegacyNote/);
  assert.match(renderer, /app\.fileManager\.processFrontMatter\(sourceFile/);
});

test('Forge Ctrl-hover enables ability Counters, image fields and image framing', async () => {
  const renderer = await read('../src/atlas/atlasForgePreviewRenderer.ts');
  assert.match(renderer, /onAbilityCounterMaxChange:/);
  assert.match(renderer, /onImageFieldAction:\s*openImageActions/);
  assert.match(renderer, /new VaultImagePickerModal/);
  assert.match(renderer, /onImageFrameChange:/);
  assert.match(renderer, /FORGE_STATBLOCK_IMAGE_FRAMES_KEY/);
  assert.match(renderer, /readStatblockImageFrames\(source\.raw\)/);
});

test('first interaction pins the Ctrl-hover preview so keyboard editing can continue after Ctrl is released', async () => {
  const window = await read('../src/atlas/forgeStatblockPreviewWindow.ts');
  assert.match(window, /pointerdown/);
  assert.match(window, /focusin/);
  assert.match(window, /closest\('\.statblock-forge__final-card'\)/);
  assert.match(window, /this\.setPinned\(true\)/);
  assert.match(window, /if \(this\.pinned\) return/);
});
