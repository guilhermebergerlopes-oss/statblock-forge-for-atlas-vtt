import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTemplateField,
  createBlankTemplate,
  createForgeLayout,
} from '../src/templates/forgeTemplate.ts';
import { createForgeContainer, forgeContainers } from '../src/templates/containerEditorModel.ts';
import { addLayoutBlock } from '../src/templates/layoutEditorModel.ts';
import { templateFields } from '../src/templates/fieldEditorModel.ts';
import {
  applyCanvasDrop,
  findCanvasBlockTarget,
  findFirstBlockForField,
  resolveCanvasDropLocation,
} from '../src/views/templateCanvasDragDrop.ts';

const inside = (parentId) => ({ parentId, index: 0, position: 'inside', axis: 'none' });
const append = () => ({ parentId: null, index: 99, position: 'append', axis: 'none' });

test('dropping a scalar Field inside a Metric binds it as a child instead of creating a standalone block', () => {
  const template = createBlankTemplate('Metric drop');
  const layout = createForgeLayout(template);
  const strength = addTemplateField(template, 'Strength', 'number');
  const metric = createForgeContainer(template, layout, 'metric');

  const selected = applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: strength.key }, inside(metric.id));

  assert.equal(selected.id, metric.id);
  assert.deepEqual(metric.block.fields, [strength.key]);
  assert.equal(findFirstBlockForField(template, strength.key).id, metric.id);
  assert.deepEqual(forgeContainers(template, layout)[0].fields.map((field) => field.key), [strength.key]);
});

test('dropping a Pairs Field into a Table is rejected and does not create a Table reference', () => {
  const template = createBlankTemplate('Table drop');
  const layout = createForgeLayout(template);
  const resistance = addTemplateField(template, 'Resistance', 'pairs');
  const table = createForgeContainer(template, layout, 'table');

  assert.throws(
    () => applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: resistance.key }, inside(table.id)),
    /não pode ser usado em um slot da Table/,
  );
  assert.equal(table.block.pairRows, undefined);
  assert.deepEqual(table.block.fields ?? [], []);
  assert.equal(template.fields.some((field) => field.key === resistance.key && field.type === 'pairs'), true);
});


test('dropping an ordinary Field inside a Table appends it to the ordered Field list', () => {
  const template = createBlankTemplate('Table slot drop');
  const layout = createForgeLayout(template);
  const armor = addTemplateField(template, 'Armor', 'number');
  const table = createForgeContainer(template, layout, 'table');
  const selected = applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: armor.key }, inside(table.id));
  assert.equal(selected.id, table.id);
  assert.deepEqual(table.block.fields, [armor.key]);
  assert.deepEqual(table.block.pairRows ?? [], []);
});

test('the private Scores adapter is hidden and cannot be placed as a user Field', () => {
  const template = createBlankTemplate('Table block only');
  const layout = createForgeLayout(template);
  const table = createForgeContainer(template, layout, 'table');
  const storageKey = table.dataFieldKey;

  assert.ok(storageKey);
  assert.equal(templateFields(template).some((field) => field.key === storageKey), false);
  assert.equal(findFirstBlockForField(template, storageKey).id, table.id);
  assert.throws(() => addLayoutBlock(template, layout, 'stat', storageKey), /armazenamento interno/);
  assert.throws(
    () => applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: storageKey }, append()),
    /internal and cannot be placed/,
  );
  assert.equal(findFirstBlockForField(template, storageKey).id, table.id);
});

test('moving a Field out of a Metric removes only its child reference and creates a normal placement', () => {
  const template = createBlankTemplate('Move out');
  const layout = createForgeLayout(template);
  const strength = addTemplateField(template, 'Strength', 'number');
  const metric = createForgeContainer(template, layout, 'metric');
  applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: strength.key }, inside(metric.id));

  const selected = applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: strength.key }, append());

  assert.notEqual(selected.id, metric.id);
  assert.deepEqual(metric.block.fields, []);
  assert.equal(findFirstBlockForField(template, strength.key).id, selected.id);
  assert.equal(template.fields.some((field) => field.key === strength.key), true);
});

test('moving a Field from a normal block into a Metric deletes only the old block placement', () => {
  const template = createBlankTemplate('Move into');
  const layout = createForgeLayout(template);
  const strength = addTemplateField(template, 'Strength', 'number');
  const stat = addLayoutBlock(template, layout, 'stat', strength.key);
  const metric = createForgeContainer(template, layout, 'metric');

  applyCanvasDrop(template, layout, new Map(), { blockId: '', fieldKey: strength.key }, inside(metric.id));

  assert.equal(template.layout.blocks.some((block) => block.id === stat.id), false);
  assert.deepEqual(metric.block.fields, [strength.key]);
  assert.equal(template.fields.some((field) => field.key === strength.key), true);
});


test('Field palette drops target the full Metric surface, including its edges', () => {
  const template = createBlankTemplate('Metric surface drop');
  const layout = createForgeLayout(template);
  const metric = createForgeContainer(template, layout, 'metric');
  const target = {
    dataset: { blockId: metric.id },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 80 }),
  };

  const location = resolveCanvasDropLocation(
    template,
    target,
    { clientX: 2, clientY: 2 },
    { blockId: '', fieldKey: 'strength' },
  );

  assert.deepEqual(location, { parentId: metric.id, index: 0, position: 'inside', axis: 'none' });
});

test('Field palette drops target the full Table surface while block moves keep edge ordering', () => {
  const template = createBlankTemplate('Table surface drop');
  const layout = createForgeLayout(template);
  const table = createForgeContainer(template, layout, 'table');
  const target = {
    dataset: { blockId: table.id },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 80 }),
  };

  const fieldLocation = resolveCanvasDropLocation(
    template,
    target,
    { clientX: 2, clientY: 2 },
    { blockId: '', fieldKey: 'resistances' },
  );
  const blockLocation = resolveCanvasDropLocation(
    template,
    target,
    { clientX: 2, clientY: 2 },
    { blockId: 'existing-block', fieldKey: '' },
  );

  assert.equal(fieldLocation.parentId, table.id);
  assert.equal(fieldLocation.position, 'inside');
  assert.equal(blockLocation.position, 'before');
  assert.equal(blockLocation.parentId, null);
});

test('drop target lookup ignores nested Atlas data-block-id elements and resolves the Forge block wrapper', () => {
  const wrapper = { dataset: { blockId: 'metric-one' } };
  const nestedAtlasElement = {
    closest: (selector) => {
      assert.equal(selector, '.statblock-forge__preview-block[data-block-id]');
      return wrapper;
    },
  };

  assert.equal(findCanvasBlockTarget(nestedAtlasElement), wrapper);
});
