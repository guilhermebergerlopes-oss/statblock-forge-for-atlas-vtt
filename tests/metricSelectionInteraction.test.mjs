import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing start marker: ${start}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `missing end marker: ${end}`);
  return source.slice(from, to);
}

test('all inline Selection slots are assigned to the nearest Forge-owned block', () => {
  const binder = between(renderer, 'function bindAtlasInlineBlockEditing(', 'function numericFieldDisplayText(');
  assert.match(binder, /'\.statblock-forge__preview-block\[data-block-id\], \.atlas-sb-header \[data-block-id\]'/);
  assert.match(binder, /const isForgeBlockRoot = root\.matches\('\.statblock-forge__preview-block\[data-block-id\]'\)/);
  assert.match(binder, /slot\.closest\('\.statblock-forge__preview-block\[data-block-id\]'\) === root/);
  assert.match(binder, /const definition = inlineSlotEditors\.get\(node\)/);
});

test('the card-level Selection click route covers regular blocks, nested Containers and Metrics', () => {
  const binder = between(renderer, 'function bindAtlasInlineBlockEditing(', 'function numericFieldDisplayText(');
  assert.match(binder, /const selectionRegionsBySlot = new Map<HTMLElement, InlineEditRegion>\(\)/);
  assert.match(binder, /if \(fieldsByKey\.get\(slot\.definition\.fieldKey\)\?\.type === 'choice'\)/);
  assert.match(binder, /const region = selectionRegionsBySlot\.get\(slot\)/);
  assert.match(binder, /void schedule\(\(\) => openRegion\(region, fieldKey\)\)/);
  assert.doesNotMatch(binder, /const metricSlot = target\?\.closest/);
});


test('Selection portal menu stays owned by the Atlas surface that opened it', () => {
  assert.match(renderer, /root\.closest<HTMLElement>\('\[data-atlas-surface\]'\)/);
  assert.match(renderer, /popup\.setAttribute\('data-atlas-owner', surface\)/);
  assert.match(renderer, /portalHost\(\)\.append\(popup\)/);
  assert.match(renderer, /element\('div', 'atlas-vtt-plugin atlas-sb-pane-options'\)/);
});

test('clicks inside an open Atlas Selection editor do not retrigger the block activation route', () => {
  const binder = between(renderer, 'function bindAtlasInlineBlockEditing(', 'function numericFieldDisplayText(');
  assert.match(binder, /target\.closest\('\.atlas-sb-pane-editor, \.statblock-forge__selection-atlas, input, textarea, select, button, \[data-no-block-edit\]'\)/);
  assert.match(binder, /if \(active === region && region\.sessions\.has\(fieldKey\)\) return/);
});
