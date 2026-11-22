import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTemplateField,
  createBlankTemplate,
  createForgeLayout,
  parseTemplateForEditing,
} from '../src/templates/forgeTemplate.ts';
import { createForgeContainer, ensureForgeContainers, forgeContainers } from '../src/templates/containerEditorModel.ts';
import { isInternalTemplateField, reorderTemplateField, templateFields } from '../src/templates/fieldEditorModel.ts';

test('reordering user Fields preserves private Table storage and never inserts undefined slots', () => {
  const template = createBlankTemplate('Reorder around Table storage');
  const layout = createForgeLayout(template);
  const first = addTemplateField(template, 'First value', 'number');
  const middle = addTemplateField(template, 'Middle value', 'text');
  const last = addTemplateField(template, 'Last value', 'number');
  const table = createForgeContainer(template, layout, 'table');
  const storage = template.fields.find((field) => field.key === table.dataFieldKey);

  assert.ok(storage);
  assert.equal(isInternalTemplateField(storage), true);

  // Reproduce the most problematic arrangement: internal storage between
  // ordinary Fields rather than only at the end of the array.
  const headers = template.fields.filter((field) => ['name', 'image', 'level', 'type', 'hp', 'description'].includes(field.key));
  template.fields = [...headers, first, storage, middle, last];
  const originalStorageIndex = template.fields.indexOf(storage);

  assert.equal(reorderTemplateField(template, first.key, last.key, true), true);
  assert.deepEqual(templateFields(template).map((field) => field.key), [middle.key, last.key, first.key]);
  assert.equal(template.fields[originalStorageIndex], storage);
  assert.equal(template.fields.includes(storage), true);
  assert.equal(template.fields.every((field) => field !== undefined && field !== null), true);

  ensureForgeContainers(template, layout);
  const restoredTable = forgeContainers(template, layout).find((container) => container.id === table.id);
  assert.ok(restoredTable);
  assert.equal(restoredTable.dataFieldKey, storage.key);
  assert.equal(template.fields.find((field) => field.key === storage.key), storage);
});

test('opening a template repairs empty Field slots left by the previous reordering bug', () => {
  const template = createBlankTemplate('Recover empty Field slots');
  const layout = createForgeLayout(template);
  const strength = addTemplateField(template, 'Strength', 'number');
  const table = createForgeContainer(template, layout, 'table');
  const storageKey = table.dataFieldKey;
  const serialized = JSON.parse(JSON.stringify(template));
  serialized.fields.splice(2, 0, null);

  const recovered = parseTemplateForEditing(JSON.stringify(serialized));
  assert.ok(recovered.warnings.some((warning) => warning.includes('entrada(s) vazia(s)')));
  assert.equal(recovered.template.fields.some((field) => field === null || field === undefined), false);
  assert.equal(recovered.template.fields.some((field) => field.key === strength.key), true);
  assert.equal(recovered.template.fields.some((field) => field.key === storageKey), true);
  assert.equal(templateFields(recovered.template).some((field) => field.key === strength.key), true);
});

test('container normalization removes runtime empty Field slots without removing valid Fields', () => {
  const template = createBlankTemplate('Recover runtime Field slots');
  const layout = createForgeLayout(template);
  const armor = addTemplateField(template, 'Armor', 'number');
  const table = createForgeContainer(template, layout, 'table');
  template.fields.splice(2, 0, undefined);

  ensureForgeContainers(template, layout);

  assert.equal(template.fields.some((field) => field === null || field === undefined), false);
  assert.equal(template.fields.some((field) => field.key === armor.key), true);
  assert.equal(template.fields.some((field) => field.key === table.dataFieldKey), true);
  assert.equal(forgeContainers(template, layout).some((container) => container.id === table.id), true);
});
