import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSelectionFieldPicks,
  readSelectionField,
  selectionOptionIsSelected,
  selectionOptionNumber,
  serializeSelectionFieldPicks,
} from '../src/templates/selectionFieldModel.ts';

const languageField = (overrides = {}) => ({
  key: 'languages', label: 'Languages', type: 'choice',
  options: ['Common', 'Elvish', 'Draconic'],
  ...overrides,
});

test('Selection can keep several configured options in the native comma-separated Value', () => {
  const field = languageField({ several: true });
  const raw = 'Common, Elvish';
  assert.deepEqual(parseSelectionFieldPicks(field, raw), [
    { option: 'Common' },
    { option: 'Elvish' },
  ]);
  assert.equal(serializeSelectionFieldPicks(field, parseSelectionFieldPicks(field, raw)), raw);
  assert.equal(selectionOptionIsSelected(field, raw, 'Common'), true);
  assert.equal(selectionOptionIsSelected(field, raw, 'Elvish'), true);
  assert.equal(selectionOptionIsSelected(field, raw, 'Draconic'), false);
});

test('numbered Selection keeps a selected option when its number is still blank', () => {
  const field = languageField({ numbered: true, unit: 'ft.' });
  assert.deepEqual(parseSelectionFieldPicks(field, 'Common'), [{ option: 'Common', unit: 'ft.' }]);
  assert.equal(selectionOptionIsSelected(field, 'Common', 'Common'), true);
  assert.equal(selectionOptionNumber(field, 'Common', 'Common'), null);
  assert.equal(serializeSelectionFieldPicks(field, parseSelectionFieldPicks(field, 'Common')), 'Common');
});

test('numbered Selection parses and preserves each option number and written unit', () => {
  const field = languageField({ several: true, numbered: true, unit: 'ft.' });
  const raw = 'Common 60 ft., Elvish 30 ft.';
  const picks = parseSelectionFieldPicks(field, raw);
  assert.deepEqual(picks, [
    { option: 'Common', number: 60, unit: 'ft.' },
    { option: 'Elvish', number: 30, unit: 'ft.' },
  ]);
  assert.equal(serializeSelectionFieldPicks(field, picks), raw);
  assert.equal(selectionOptionNumber(field, raw, 'Common'), 60);
  assert.equal(selectionOptionNumber(field, raw, 'Elvish'), 30);
});

test('numbered Selection accepts zero, negative numbers, and a value without the configured unit', () => {
  const field = languageField({ numbered: true, unit: 'ft.' });
  assert.equal(selectionOptionIsSelected(field, 'Common 0', 'Common'), true);
  assert.equal(selectionOptionNumber(field, 'Common 0', 'Common'), 0);
  assert.equal(selectionOptionNumber(field, 'Common -5', 'Common'), -5);
  assert.equal(serializeSelectionFieldPicks(field, parseSelectionFieldPicks(field, 'Common 60')), 'Common 60');
  assert.equal(serializeSelectionFieldPicks(field, parseSelectionFieldPicks(field, 'Common 60 ft.')), 'Common 60 ft.');
});

test('Selection preserves unread legacy/custom text while configured picks are edited', () => {
  const field = languageField({ several: true, numbered: true, unit: 'ft.' });
  const read = readSelectionField(field, 'Old tongue, Common 60 ft.');
  assert.deepEqual(read.picks, [{ option: 'Common', number: 60, unit: 'ft.' }]);
  assert.deepEqual(read.unread, ['Old tongue']);
});

test('legacy object Values remain readable for Selection formula references', () => {
  const field = languageField({ several: true });
  assert.equal(selectionOptionIsSelected(field, { Common: true, Elvish: false }, 'Common'), true);
  assert.equal(selectionOptionIsSelected(field, { Common: true, Elvish: false }, 'Elvish'), false);
});

test('multi-pick numbered Selection can mix picks with and without numbers', () => {
  const field = languageField({ several: true, numbered: true, unit: 'ft.' });
  const raw = 'Common, Elvish 30 ft.';
  const picks = parseSelectionFieldPicks(field, raw);
  assert.deepEqual(picks, [
    { option: 'Common', unit: 'ft.' },
    { option: 'Elvish', number: 30, unit: 'ft.' },
  ]);
  assert.equal(serializeSelectionFieldPicks(field, picks), raw);
  assert.equal(selectionOptionIsSelected(field, raw, 'Common'), true);
  assert.equal(selectionOptionNumber(field, raw, 'Common'), null);
  assert.equal(selectionOptionNumber(field, raw, 'Elvish'), 30);
});

test('Allow other values stores custom numbered picks with their own number and unit', () => {
  const field = languageField({ several: true, numbered: true, open: true, unit: 'ft.' });
  const raw = 'Common 60 ft., Homebrew tongue 25 ft., Secret language';
  const read = readSelectionField(field, raw);

  assert.deepEqual(read.picks, [
    { option: 'Common', number: 60, unit: 'ft.' },
    { option: 'Homebrew tongue', custom: true, number: 25, unit: 'ft.' },
    { option: 'Secret language', custom: true, unit: 'ft.' },
  ]);
  assert.deepEqual(read.unread, []);
  assert.equal(serializeSelectionFieldPicks(field, read.picks), raw);
  assert.equal(selectionOptionNumber(field, raw, 'Common'), 60);
  assert.equal(selectionOptionNumber(field, raw, 'Homebrew tongue'), null,
    'custom values do not masquerade as configured formula options');
  assert.equal(selectionOptionIsSelected(field, raw, 'Homebrew tongue'), false);
});

test('single custom numbered Selection accepts zero, negative values, and an optional unit', () => {
  const field = languageField({ numbered: true, open: true, unit: 'kg' });
  const zero = readSelectionField(field, 'Custom material 0 kg');
  assert.deepEqual(zero.picks, [{ option: 'Custom material', custom: true, number: 0, unit: 'kg' }]);
  assert.equal(serializeSelectionFieldPicks(field, zero.picks), 'Custom material 0 kg');

  const negative = parseSelectionFieldPicks(field, 'Rare alloy -2');
  assert.deepEqual(negative, [{ option: 'Rare alloy', custom: true, number: -2, unit: 'kg' }]);
  assert.equal(serializeSelectionFieldPicks(field, negative), 'Rare alloy -2 kg');
});

test('custom number suffix is only parsed when Allow other values is enabled', () => {
  const field = languageField({ numbered: true, unit: 'ft.' });
  const read = readSelectionField(field, 'Homebrew tongue 25 ft.');
  assert.deepEqual(read.picks, []);
  assert.deepEqual(read.unread, ['Homebrew tongue 25 ft.']);
});
