import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  checkboxFieldAllowsMultiple,
  checkboxOptionIsEnabled,
  normalizeCheckboxFieldValue,
  withCheckboxOptionValue,
} from '../src/templates/checkboxFieldModel.ts';
import { createBlankTemplate, registerTemplateField } from '../src/templates/forgeTemplate.ts';

const options = [
  { key: 'strength', label: 'Strength' },
  { key: 'agility', label: 'Agility' },
  { key: 'wisdom', label: 'Wisdom' },
];

function checkboxField(key, allowMultiple) {
  return {
    key,
    label: key,
    type: 'checkboxes',
    ...(allowMultiple !== undefined ? { allowMultiple } : {}),
    options: structuredClone(options),
  };
}

test('new Checkboxes Fields default to single-choice mode', () => {
  const template = createBlankTemplate('Checkbox mode test');
  const field = registerTemplateField(template, 'Attributes', 'checkboxes');
  assert.equal(field.allowMultiple, false);
  assert.equal(checkboxFieldAllowsMultiple(field), false);
});

test('single-choice mode switches selections only inside the current Field', () => {
  const attributes = checkboxField('attributes', false);
  const proficiencies = checkboxField('proficiencies', false);
  const data = {
    attributes: { strength: true, agility: false, wisdom: false },
    proficiencies: { strength: false, agility: true, wisdom: false },
  };

  const next = withCheckboxOptionValue(data, attributes, 'wisdom', true);
  assert.deepEqual(next, {
    strength: false,
    agility: false,
    wisdom: true,
  });
  assert.deepEqual(data.proficiencies, { strength: false, agility: true, wisdom: false });
  assert.equal(checkboxOptionIsEnabled({ ...data, attributes: next }, attributes, 'strength'), false);
  assert.equal(checkboxOptionIsEnabled({ ...data, attributes: next }, attributes, 'wisdom'), true);
});

test('single-choice mode can be cleared by unchecking the selected option', () => {
  const field = checkboxField('attributes', false);
  const data = { attributes: { strength: true, agility: false, wisdom: false } };
  assert.deepEqual(withCheckboxOptionValue(data, field, 'strength', false), {
    strength: false,
    agility: false,
    wisdom: false,
  });
});

test('multiple-choice mode permits multiple selections in one Field', () => {
  const field = checkboxField('attributes', true);
  const data = { attributes: { strength: true, agility: false, wisdom: false } };
  const next = withCheckboxOptionValue(data, field, 'wisdom', true);
  assert.deepEqual(next, { strength: true, agility: false, wisdom: true });
  assert.equal(checkboxOptionIsEnabled({ attributes: next }, field, 'strength'), true);
  assert.equal(checkboxOptionIsEnabled({ attributes: next }, field, 'wisdom'), true);
});

test('legacy Checkboxes Fields without a mode retain multiple-choice behavior', () => {
  const field = checkboxField('legacy');
  assert.equal(checkboxFieldAllowsMultiple(field), true);
  const normalized = normalizeCheckboxFieldValue(field, { strength: true, agility: true });
  assert.deepEqual(normalized, { strength: true, agility: true, wisdom: false });
});

test('single-choice rendering exposes only the first configured option as selected', () => {
  const field = checkboxField('attributes', false);
  const data = { attributes: { strength: true, agility: true, wisdom: false } };
  assert.equal(checkboxOptionIsEnabled(data, field, 'strength'), true);
  assert.equal(checkboxOptionIsEnabled(data, field, 'agility'), false);
});

test('single-choice normalization keeps the first selected configured option', () => {
  const field = checkboxField('attributes', false);
  const normalized = normalizeCheckboxFieldValue(field, {
    strength: true,
    agility: true,
    wisdom: true,
    customExtension: 'preserve me',
  });
  assert.deepEqual(normalized, {
    strength: true,
    agility: false,
    wisdom: false,
    customExtension: 'preserve me',
  });
});

test('renderer synchronizes sibling checkboxes after a single-choice change', async () => {
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /const syncCheckboxInputs = \(\): void =>/);
  assert.match(renderer, /input\.checked = checkboxOptionIsEnabled\(data, field, optionKey\)/);
  assert.match(renderer, /data\[field\.key\] = next;\s*syncCheckboxInputs\(\);/);
});

test('Checkboxes editor exposes a localized per-set Multiple choices toggle', async () => {
  const editor = await readFile(new URL('../src/views/templateCheckboxFieldEditor.ts', import.meta.url), 'utf8');
  const localization = await readFile(new URL('../src/i18n/localization.ts', import.meta.url), 'utf8');
  assert.match(editor, /checkboxFieldAllowsMultiple\(field\)/);
  assert.match(editor, /translateForgeText\('Multiple choices', language\)/);
  assert.match(editor, /field\.allowMultiple = enabled/);
  assert.match(localization, /'Multiple choices':\s*\{\s*en:/);
  assert.match(localization, /Escolhas múltiplas/);
});
