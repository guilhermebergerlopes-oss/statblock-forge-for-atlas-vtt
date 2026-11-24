import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import { parseTemplateFileText, serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';
import {
  fieldTypographyForField,
  normalizeFieldTypographyAppearance,
  normalizeFieldTypographyMap,
  resetFieldTypographyForField,
  setFieldTypographyForField,
} from '../src/templates/fieldTypographyModel.ts';
import { removeFieldCompendium, renameFieldCompendiumIdentity } from '../src/templates/fieldCompendiumModel.ts';

const root = new URL('../', import.meta.url);

function makeFieldFixture() {
  const template = createBlankTemplate('Field typography test');
  const field = { key: 'mana', label: 'Mana', type: 'number' };
  template.fields.push(field);
  const layout = createForgeLayout(template);
  return { template, field, layout };
}

test('Field typography accepts only supported text properties and clamps numeric values', () => {
  const appearance = normalizeFieldTypographyAppearance({
    fontSize: 60,
    fontWeight: '700',
    fontStyle: 'italic',
    textDecoration: 'underline',
    letterSpacing: -5,
    labelFontSize: 4,
    labelFontWeight: '900',
    valueFontSize: 21,
    valueFontStyle: 'normal',
    valueTextDecoration: 'line-through',
    unexpected: 'discard me',
  });

  assert.equal(appearance.fontSize, 48);
  assert.equal(appearance.fontWeight, '700');
  assert.equal(appearance.fontStyle, 'italic');
  assert.equal(appearance.textDecoration, 'underline');
  assert.equal(appearance.letterSpacing, -1);
  assert.equal(appearance.labelFontSize, 8);
  assert.equal(appearance.labelFontWeight, undefined);
  assert.equal(appearance.valueFontSize, 21);
  assert.equal(appearance.valueFontStyle, 'normal');
  assert.equal(appearance.valueTextDecoration, 'line-through');
  assert.equal(appearance.unexpected, undefined);
});

test('Field typography is isolated by stable Field ID and ignores orphaned IDs', () => {
  const { field, layout } = makeFieldFixture();
  const fieldId = layout.fieldIds.mana;
  setFieldTypographyForField(layout, field, { fontSize: 18, fontWeight: '700', valueFontStyle: 'italic' });
  layout.fieldTypography.orphaned_field_id = { fontSize: 30 };

  assert.equal(fieldTypographyForField(layout, field).fontSize, 18);
  assert.deepEqual(normalizeFieldTypographyMap(layout.fieldTypography, new Set([fieldId])), {
    [fieldId]: { fontSize: 18, fontWeight: '700', valueFontStyle: 'italic' },
  });
  assert.equal(fieldTypographyForField(layout, { key: 'unrelated' }).fontSize, undefined);
});

test('Field typography survives a Field key rename and Forge sidecar save/reload', () => {
  const { template, field, layout } = makeFieldFixture();
  const originalId = layout.fieldIds.mana;
  setFieldTypographyForField(layout, field, {
    fontSize: 19,
    fontWeight: '700',
    fontStyle: 'italic',
    labelFontSize: 11,
    labelFontWeight: '500',
    valueFontSize: 22,
    valueTextDecoration: 'underline',
  });

  renameFieldCompendiumIdentity(layout, 'mana', 'mana_points');
  field.formerKeys = ['mana'];
  field.key = 'mana_points';

  const serialized = serializeForgeTemplateFile(template, layout);
  const reopened = parseTemplateFileText(serialized, 'forgetemplate');
  const reopenedField = reopened.template.fields.find((candidate) => candidate.key === 'mana_points');

  assert.equal(reopened.fileFormat, 'forge');
  assert.equal(reopened.layout.fieldIds.mana_points, originalId);
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).fontSize, 19);
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).fontWeight, '700');
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).fontStyle, 'italic');
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).labelFontSize, 11);
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).labelFontWeight, '500');
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).valueFontSize, 22);
  assert.equal(fieldTypographyForField(reopened.layout, reopenedField).valueTextDecoration, 'underline');
});

test('deleting a Field removes its typography metadata immediately', () => {
  const { field, layout } = makeFieldFixture();
  const fieldId = layout.fieldIds.mana;
  setFieldTypographyForField(layout, field, { fontWeight: '700' });
  assert.ok(layout.fieldTypography[fieldId]);

  removeFieldCompendium(layout, field.key);
  assert.equal(layout.fieldIds.mana, undefined);
  assert.equal(layout.fieldTypography[fieldId], undefined);
});

test('resetting one Field typography leaves other Fields unchanged', () => {
  const template = createBlankTemplate('Field typography reset test');
  const mana = { key: 'mana', label: 'Mana', type: 'number' };
  const stamina = { key: 'stamina', label: 'Stamina', type: 'number' };
  template.fields.push(mana, stamina);
  const layout = createForgeLayout(template);
  setFieldTypographyForField(layout, mana, { fontWeight: '700' });
  setFieldTypographyForField(layout, stamina, { fontStyle: 'italic' });

  resetFieldTypographyForField(layout, mana);
  assert.deepEqual(fieldTypographyForField(layout, mana), {});
  assert.deepEqual(fieldTypographyForField(layout, stamina), { fontStyle: 'italic' });
});

test('Appearance tab exposes a Field selector and independent general, label and value groups', async () => {
  const [editor, inspector, blockInspector] = await Promise.all([
    readFile(new URL('src/views/TemplateEditorView.ts', root), 'utf8'),
    readFile(new URL('src/views/templateFieldTypographyInspector.ts', root), 'utf8'),
    readFile(new URL('src/views/templateBlockAppearanceInspector.ts', root), 'utf8'),
  ]);

  assert.match(editor, /renderTemplateFieldTypographyInspector\(/);
  assert.match(editor, /appearanceFieldKey/);
  assert.match(inspector, /Field to customize/);
  assert.match(inspector, /fieldTypographyForField/);
  assert.match(inspector, /setFieldTypographyForField/);
  assert.match(inspector, /Reset field typography/);
  for (const label of ["'All text'", "'Labels'", "'Values'"]) {
    assert.ok(inspector.includes(label), `missing ${label} typography group`);
  }
  for (const option of ['Font size (px)', 'Font weight', 'Font style', 'Text decoration', 'Letter spacing (px)']) {
    assert.ok(blockInspector.includes(`'${option}'`), `missing control ${option}`);
  }
});

test('Field typography is applied to values in Lists, Pairs, Checkboxes, Spells, Tags, Tracks and Tables', async () => {
  const renderer = await readFile(new URL('src/render/statblockPreviewRenderer.ts', root), 'utf8');
  const selectors = [
    '.statblock-forge__preview-inline-text-value',
    '.statblock-forge__preview-tags-value',
    '.statblock-forge__preview-pair-value',
    '.statblock-forge__preview-checkbox-option',
    '.statblock-forge__preview-spell-name',
    '.statblock-forge__preview-spell-header',
    '.statblock-forge__preview-numeric-field-value',
    '.statblock-forge__preview-table-column-label',
    '.statblock-forge__preview-table-formula-value',
  ];
  for (const selector of selectors) assert.ok(renderer.includes(selector), `missing typography selector ${selector}`);
  assert.match(renderer, /applyFieldTypographyToNode\(maximumNumber, layout, maximumField\.key\)/);
  assert.match(renderer, /applyFieldTypographyToNode\(th, layout, field\.key\)/);
  assert.match(renderer, /applyFieldTypographyToNode\(cell, layout, field\.key\)/);
  assert.match(renderer, /applyFieldTypographyToNode\(fieldGroup, layout, field\?\.key\)/);
});
