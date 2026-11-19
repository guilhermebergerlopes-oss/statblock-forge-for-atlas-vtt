import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import {
  addLayoutBlock,
  canContainerAcceptBlockType,
  resolveLayoutInsertionTarget,
} from '../src/templates/layoutEditorModel.ts';

function makeTemplate(blocks = []) {
  const template = createBlankTemplate('Insertion test');
  template.fields.push({ key: 'hp', label: 'HP', type: 'number' });
  template.layout.blocks = blocks;
  return { template, layout: createForgeLayout(template) };
}

const block = (id, type = 'stat', children) => ({
  id,
  type,
  ...(children ? { blocks: children } : {}),
});

test('a compatible selected container receives the new block as a child', () => {
  const section = block('section-a', 'section', [block('existing')]);
  const { template } = makeTemplate([section]);

  assert.deepEqual(resolveLayoutInsertionTarget(template, 'section-a', 'heading'), {
    targetContainerId: 'section-a',
    insertAfterBlockId: null,
  });
});

test('a non-container selection inserts the new block immediately after it among siblings', () => {
  const section = block('section-a', 'section', [block('first'), block('selected'), block('last')]);
  const { template, layout } = makeTemplate([section]);
  const target = resolveLayoutInsertionTarget(template, 'selected', 'heading');
  const added = addLayoutBlock(template, layout, 'heading', null, target.targetContainerId, target.insertAfterBlockId);

  assert.deepEqual(section.blocks.map((item) => item.id), ['first', 'selected', added.id, 'last']);
});

test('a Row selected for another Row inserts beside it instead of trying to nest it', () => {
  const section = block('section-a', 'section', [block('row-a', 'row', [block('child')]), block('after-row')]);
  const { template, layout } = makeTemplate([section]);
  const target = resolveLayoutInsertionTarget(template, 'row-a', 'row');
  const added = addLayoutBlock(template, layout, 'row', null, target.targetContainerId, target.insertAfterBlockId);

  assert.equal(target.targetContainerId, 'section-a');
  assert.deepEqual(section.blocks.map((item) => item.id), ['row-a', added.id, 'after-row']);
});

test('a Tabs selection falls back to the nearest sibling level for a non-Section block', () => {
  const tabs = block('tabs-a', 'tabs', [block('tab-a', 'section')]);
  const { template, layout } = makeTemplate([block('before'), tabs, block('after')]);
  const target = resolveLayoutInsertionTarget(template, 'tabs-a', 'heading');
  const added = addLayoutBlock(template, layout, 'heading', null, target.targetContainerId, target.insertAfterBlockId);

  assert.equal(target.targetContainerId, null);
  assert.deepEqual(template.layout.blocks.map((item) => item.id), ['before', 'tabs-a', added.id, 'after']);
  assert.equal(tabs.blocks.length, 1);
});

test('a Section block selected inside a Row climbs to the nearest level that accepts a new Row', () => {
  const row = block('row-a', 'row', [block('selected-child'), block('row-child-after')]);
  const section = block('section-a', 'section', [block('before-row'), row, block('after-row')]);
  const { template, layout } = makeTemplate([section]);
  const target = resolveLayoutInsertionTarget(template, 'selected-child', 'row');
  const added = addLayoutBlock(template, layout, 'row', null, target.targetContainerId, target.insertAfterBlockId);

  assert.equal(target.targetContainerId, 'section-a');
  assert.equal(target.insertAfterBlockId, 'row-a');
  assert.deepEqual(section.blocks.map((item) => item.id), ['before-row', 'row-a', added.id, 'after-row']);
  assert.deepEqual(row.blocks.map((item) => item.id), ['selected-child', 'row-child-after']);
});

test('adding a Section while a Tabs container is selected still creates a tab inside it', () => {
  const tabs = block('tabs-a', 'tabs', [block('tab-a', 'section')]);
  const { template, layout } = makeTemplate([tabs]);
  const target = resolveLayoutInsertionTarget(template, 'tabs-a', 'section');
  const added = addLayoutBlock(template, layout, 'section', null, target.targetContainerId, target.insertAfterBlockId);

  assert.equal(target.targetContainerId, 'tabs-a');
  assert.equal(target.insertAfterBlockId, null);
  assert.deepEqual(tabs.blocks.map((item) => item.id), ['tab-a', added.id]);
});

test('root insertion without a selected block still appends normally', () => {
  const { template, layout } = makeTemplate([block('existing')]);
  const target = resolveLayoutInsertionTarget(template, null, 'heading');
  const added = addLayoutBlock(template, layout, 'heading', null, target.targetContainerId, target.insertAfterBlockId);

  assert.deepEqual(template.layout.blocks.map((item) => item.id), ['existing', added.id]);
});

test('container acceptance rules remain explicit and type-specific', () => {
  assert.equal(canContainerAcceptBlockType('section', 'tabs'), true);
  assert.equal(canContainerAcceptBlockType('row', 'row'), false);
  assert.equal(canContainerAcceptBlockType('row', 'tabs'), false);
  assert.equal(canContainerAcceptBlockType('tabs', 'section'), true);
  assert.equal(canContainerAcceptBlockType('tabs', 'heading'), false);
});


test('the newest selected nested block is the insertion anchor even when the toolbar predates the selection', async () => {
  const { readFile } = await import('node:fs/promises');
  const toolbarSource = await readFile(new URL('../src/views/templateCanvasToolbar.ts', import.meta.url), 'utf8');
  const viewSource = await readFile(new URL('../src/views/TemplateEditorView.ts', import.meta.url), 'utf8');

  assert.match(toolbarSource, /getInsertionSelectionId\(\),\s*resolvedBlockType/);
  assert.match(toolbarSource, /getInsertionSelectionId\(\),\s*containerType/);
  assert.match(viewSource, /getInsertionSelectionId:\s*\(\)\s*=>\s*this\.selectedBlockIds\[this\.selectedBlockIds\.length - 1\]\s*\?\?\s*this\.selectedBlockId/);

  const section = block('section-a', 'section', [block('first'), block('second'), block('third')]);
  const { template, layout } = makeTemplate([section]);
  // Simulate the toolbar being rendered before the user changes selection.
  let selectedIds = ['first'];
  const readLatestSelection = () => selectedIds[selectedIds.length - 1] ?? null;
  selectedIds = ['first', 'second'];
  const target = resolveLayoutInsertionTarget(template, readLatestSelection(), 'heading');
  const added = addLayoutBlock(template, layout, 'heading', null, target.targetContainerId, target.insertAfterBlockId);

  assert.deepEqual(section.blocks.map((item) => item.id), ['first', 'second', added.id, 'third']);
});

test('a newly added container is inserted beside the selected non-container block', () => {
  const section = block('section-a', 'section', [block('before'), block('selected'), block('after')]);
  const { template, layout } = makeTemplate([section]);
  const target = resolveLayoutInsertionTarget(template, 'selected', 'row');
  const added = addLayoutBlock(template, layout, 'row', null, target.targetContainerId, target.insertAfterBlockId);

  assert.equal(target.targetContainerId, 'section-a');
  assert.deepEqual(section.blocks.map((item) => item.id), ['before', 'selected', added.id, 'after']);
});
