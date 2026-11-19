import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('cross-tab Entry drag resolves the actual pointerup target before settling', async () => {
  const source = await readFile(resolve(root, 'src/render/statblockPreviewRenderer.ts'), 'utf8');
  assert.match(source, /const resolveCrossDestinationAtPoint\s*=\s*\(clientX: number, clientY: number\)/);
  assert.match(source, /resolveCrossDestinationAtPoint\(event\.clientX, event\.clientY\);\s*settle\(true\);/);
  assert.match(source, /document\.elementFromPoint\(clientX, clientY\)/);
  assert.match(source, /setCrossDestination\(targetEntriesRoot, targetEntriesRoot\.getBoundingClientRect\(\)\.bottom\)/);
});

test('cross-tab Entry drag uses the actual destination Entries Field, not the tab label', async () => {
  const source = await readFile(resolve(root, 'src/render/statblockPreviewRenderer.ts'), 'utf8');
  assert.match(source, /targetTabId = tabButton\?\.dataset\.tabBlockId\s*\?\?\s*targetPanel\?\.dataset\.tabPanelId/);
  assert.match(source, /const targetEntriesRoot = entriesForTab\(targetTabId\)/);
  assert.match(source, /const targetKey = targetEntries\.dataset\.forgeEntryField/);
});

test('dropping on a different tab button activates it and appends to its Entries Field', async () => {
  const source = await readFile(resolve(root, 'src/render/statblockPreviewRenderer.ts'), 'utf8');
  assert.match(source, /targetTabPanel\?\.hidden && targetTabButton/);
  assert.match(source, /targetTabButton\.dataset\.forgeDragActivate = 'true';\s*targetTabButton\.click\(\)/);
  assert.match(source, /setCrossDestination\(targetEntriesRoot, targetEntriesRoot\.getBoundingClientRect\(\)\.bottom\)/);
});
