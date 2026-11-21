import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTemplateField,
  createBlankTemplate,
  createForgeLayout,
  parseForgeLayout,
  blockLabel,
  registerTableStorageField,
} from '../src/templates/forgeTemplate.ts';
import { removeMetricSlot } from '../src/templates/metricEditorModel.ts';
import { isInternalTemplateField, templateFields } from '../src/templates/fieldEditorModel.ts';
import { addLayoutBlock, bindLayoutBlock, layoutBlockAllowsFieldBinding } from '../src/templates/layoutEditorModel.ts';
import {
  addFieldToContainer,
  containerAcceptsField,
  createForgeContainer,
  ensureForgeContainers,
  forgeContainers,
  isContainerDataField,
  removeFieldFromContainer,
  moveFieldWithinContainer,
} from '../src/templates/containerEditorModel.ts';

test('legacy Metric and Table blocks migrate while Pair columns are detached and data is preserved', () => {
  const template = createBlankTemplate('Container migration');
  const strength = addTemplateField(template, 'Strength', 'number');
  const resistances = addTemplateField(template, 'Resistances', 'pairs');
  const scores = registerTableStorageField(template, 'Ability Scores');
  delete scores.forgeInternal; // simulate an older Template's visible Scores storage Field
  template.layout.blocks.push(
    { id: 'metric-legacy', type: 'metric', fields: [strength.key] },
    { id: 'table-legacy', type: 'scores', field: scores.key, fields: [resistances.key], pairRows: [resistances.key], orientation: 'table', perLine: 4, columns: [{ label: 'Resistance', field: resistances.key }] },
  );

  const layout = createForgeLayout(template);
  const containers = forgeContainers(template, layout);
  assert.deepEqual(containers.map(({ id, kind }) => ({ id, kind })), [
    { id: 'metric-legacy', kind: 'metric' },
    { id: 'table-legacy', kind: 'table' },
  ]);
  assert.deepEqual(containers[0].fields.map((field) => field.key), [strength.key]);
  assert.deepEqual(containers[1].fields.map((field) => field.key), []);
  assert.equal(template.layout.blocks[1].pairRows, undefined);
  assert.equal(template.layout.blocks[1].columns, undefined);
  assert.equal(template.layout.blocks[1].orientation, undefined);
  assert.equal(template.layout.blocks[1].perLine, undefined);
  assert.equal(template.layout.blocks[1].fields, undefined);
  assert.equal(template.sample[resistances.key] !== undefined, true);
  assert.equal(template.fields.some((field) => field.key === resistances.key && field.type === 'pairs'), true);
  assert.equal(containers[1].dataFieldKey, scores.key);
  assert.equal(isContainerDataField(layout, scores.key), true);
  assert.equal(template.layout.blocks[0].fields[0], strength.key);
});

test('Metric and Table Containers accept their supported Fields while Table rejects Pairs', () => {
  const template = createBlankTemplate('Container children');
  const score = addTemplateField(template, 'Might', 'number');
  const pair = addTemplateField(template, 'Defenses', 'pairs');
  const other = addTemplateField(template, 'Description', 'markdown');
  const layout = createForgeLayout(template);
  const metric = createForgeContainer(template, layout, 'metric');
  const table = createForgeContainer(template, layout, 'table');

  assert.equal(containerAcceptsField('metric', score), true);
  assert.equal(containerAcceptsField('metric', pair), false);
  assert.equal(containerAcceptsField('table', pair), false);
  assert.equal(containerAcceptsField('table', score), true);
  assert.equal(containerAcceptsField('table', other), true);
  assert.equal(addFieldToContainer(template, layout, metric.id, score.key), true);
  assert.equal(addFieldToContainer(template, layout, metric.id, score.key), false);
  assert.equal(addFieldToContainer(template, layout, table.id, pair.key), false);
  assert.equal(addFieldToContainer(template, layout, table.id, score.key), true);
  assert.equal(addFieldToContainer(template, layout, table.id, score.key), false);

  const containers = forgeContainers(template, layout);
  assert.deepEqual(containers.find((item) => item.id === metric.id).fields.map((field) => field.key), [score.key]);
  assert.deepEqual(containers.find((item) => item.id === table.id).fields.map((field) => field.key), [score.key]);
  assert.equal(table.block.pairRows, undefined);
  assert.deepEqual(table.block.fields, [score.key]);
  assert.equal(removeFieldFromContainer(template, layout, metric.id, score.key), true);
  assert.equal(removeFieldFromContainer(template, layout, table.id, pair.key), false);
  assert.equal(removeFieldFromContainer(template, layout, table.id, score.key), true);
  assert.equal(template.fields.some((field) => field.key === score.key), true);
  assert.equal(template.fields.some((field) => field.key === pair.key), true);
});

test('Table is a Block only: its native Scores adapter is hidden and cannot be bound as a Field', () => {
  const template = createBlankTemplate('Table block only');
  const layout = createForgeLayout(template);
  const armor = addTemplateField(template, 'Armor', 'number');
  const table = createForgeContainer(template, layout, 'table');
  assert.equal(table.block.orientation, undefined);
  const storage = template.fields.find((field) => field.key === table.dataFieldKey);

  assert.ok(storage);
  assert.equal(storage.type, 'scores');
  assert.equal(storage.forgeInternal, 'table-storage');
  assert.equal(isInternalTemplateField(storage), true);
  assert.equal(templateFields(template).some((field) => field.key === storage.key), false);
  assert.equal(layoutBlockAllowsFieldBinding(table.block), false);
  assert.throws(() => bindLayoutBlock(template, table.id, armor.key), /não pode ser vinculado/);
  const stat = addLayoutBlock(template, layout, 'stat', armor.key);
  assert.equal(layoutBlockAllowsFieldBinding(stat), true);
  assert.throws(() => bindLayoutBlock(template, stat.id, storage.key), /armazenamento interno/);
  assert.throws(() => addTemplateField(template, 'Visible Scores field', 'scores'), /Tipo de campo não suportado/);
});

test('orphan legacy Scores Fields are promoted to Table Blocks without losing their sample values', () => {
  const template = createBlankTemplate('Orphan legacy Table');
  const storage = registerTableStorageField(template, 'Legacy table values');
  delete storage.forgeInternal;
  template.sample[storage.key] = [[7, 9, 12]];
  const layout = createForgeLayout(template);
  layout.fieldKinds[storage.key] = 'table';

  ensureForgeContainers(template, layout);

  assert.equal(layout.fieldKinds[storage.key], undefined);
  assert.equal(template.layout.blocks.length, 1);
  assert.equal(template.layout.blocks[0].type, 'scores');
  assert.equal(template.layout.blocks[0].field, storage.key);
  assert.equal(storage.forgeInternal, 'table-storage');
  assert.deepEqual(template.sample[storage.key], [[7, 9, 12]]);
  assert.equal(layout.containers?.some((item) => item.blockId === template.layout.blocks[0].id && item.kind === 'table'), true);
});

test('two Table Blocks do not share the same private Scores adapter', () => {
  const template = createBlankTemplate('Separate Table storage');
  const layout = createForgeLayout(template);
  const first = createForgeContainer(template, layout, 'table');
  const second = createForgeContainer(template, layout, 'table');
  assert.notEqual(first.dataFieldKey, second.dataFieldKey);
  assert.notEqual(first.block.field, second.block.field);
});

test('Container registry survives Forge layout serialization and repairs legacy sidecars', () => {
  const template = createBlankTemplate('Container sidecar');
  const field = addTemplateField(template, 'Might', 'number');
  template.layout.blocks.push({ id: 'metric-one', type: 'metric', fields: [field.key] });
  const initial = createForgeLayout(template);
  const serialized = JSON.stringify(initial);
  const parsed = parseForgeLayout(serialized, template);
  assert.equal(parsed.containers?.some((item) => item.blockId === 'metric-one' && item.kind === 'metric'), true);

  const legacySidecar = { ...initial };
  delete legacySidecar.containers;
  const migrated = parseForgeLayout(JSON.stringify(legacySidecar), template);
  assert.equal(migrated.containers?.some((item) => item.blockId === 'metric-one' && item.kind === 'metric'), true);
  ensureForgeContainers(template, migrated);
  assert.equal(migrated.containers?.length, 1);
});


test('Metric is a removable empty Container and does not require a placeholder Field', () => {
  const template = createBlankTemplate('Empty Metric');
  const layout = createForgeLayout(template);
  const strength = addTemplateField(template, 'Strength', 'number');
  const metric = createForgeContainer(template, layout, 'metric');
  assert.equal(addFieldToContainer(template, layout, metric.id, strength.key), true);
  assert.equal(removeMetricSlot(template, metric.id, 0), true);
  assert.deepEqual(metric.block.fields, []);
  assert.equal(template.fields.some((field) => field.key === strength.key), true);
  assert.equal(blockLabel(metric.block, template.fields), 'Metric');
  const table = createForgeContainer(template, layout, 'table');
  assert.equal(blockLabel(table.block, template.fields), 'Table');
});

test('Container sidecar retains unrecognized per-Container metadata', () => {
  const template = createBlankTemplate('Future Container metadata');
  const layout = createForgeLayout(template);
  const metric = createForgeContainer(template, layout, 'metric');
  const definition = layout.containers.find((item) => item.blockId === metric.id);
  definition.futureSetting = { keep: true };
  ensureForgeContainers(template, layout);
  assert.deepEqual(layout.containers.find((item) => item.blockId === metric.id).futureSetting, { keep: true });
});

test('legacy Table column links migrate only non-Pairs Fields into ordered slots', () => {
  const template = createBlankTemplate('Legacy Table slots');
  const armor = addTemplateField(template, 'Armor', 'number');
  const pairs = addTemplateField(template, 'Defenses', 'pairs');
  const scores = registerTableStorageField(template, 'Table data');
  delete scores.forgeInternal; // simulate an older Template's visible Scores storage Field
  template.layout.blocks.push({
    id: 'table-legacy-slots', type: 'scores', field: scores.key, orientation: 'row', perLine: 2, pairRows: [pairs.key],
    columns: [
      { label: 'Defenses', field: pairs.key },
      { label: 'Armor', field: armor.key },
    ],
  });
  const layout = createForgeLayout(template);
  ensureForgeContainers(template, layout);
  const block = template.layout.blocks[0];
  assert.equal(block.pairRows, undefined);
  assert.deepEqual(block.fields, [armor.key]);
  assert.equal(template.fields.some((field) => field.key === pairs.key && field.type === 'pairs'), true);
  assert.equal(block.columns, undefined);
  assert.equal(block.orientation, undefined);
  assert.equal(block.perLine, undefined);
  assert.equal(block.pairRows, undefined);
});


test('Table Fields can be reordered without changing their Field data', () => {
  const template = createBlankTemplate('Table reorder');
  const layout = createForgeLayout(template);
  const armor = addTemplateField(template, 'Armor', 'number');
  const speed = addTemplateField(template, 'Speed', 'number');
  const weight = addTemplateField(template, 'Weight', 'number');
  template.sample = { ...template.sample, armor: 14, speed: 30, weight: 8 };
  const table = createForgeContainer(template, layout, 'table');
  for (const field of [armor, speed, weight]) addFieldToContainer(template, layout, table.id, field.key);

  assert.equal(moveFieldWithinContainer(template, layout, table.id, weight.key, -1), true);
  assert.deepEqual(table.block.fields, [armor.key, weight.key, speed.key]);
  assert.equal(template.sample.armor, 14);
  assert.equal(template.sample.speed, 30);
  assert.equal(template.sample.weight, 8);
  assert.equal(moveFieldWithinContainer(template, layout, table.id, armor.key, -1), false);
});
