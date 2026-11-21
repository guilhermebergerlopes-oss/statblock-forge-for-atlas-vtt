import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIELD_CATEGORY_DEFAULT_TYPES,
  FIELD_CATEGORY_TYPES,
  fieldTypesForCategory,
  resolveFieldCategory,
} from '../src/templates/fieldCategoryModel.ts';
import { FIELD_TYPE_OPTIONS, fieldTypeLabel } from '../src/views/templateEditorDom.ts';
import { componentHelpEntry } from '../src/views/componentHelp.ts';

const field = (key, type) => ({ key, label: key, type });

test('Field presentation groups expose the requested categories and exact type order', () => {
  assert.deepEqual(Object.keys(FIELD_CATEGORY_TYPES), ['values', 'text', 'choice', 'image', 'collections']);
  assert.deepEqual(fieldTypesForCategory('values'), ['number', 'rating', 'dice', 'counters']);
  assert.deepEqual(fieldTypesForCategory('text'), ['text', 'markdown']);
  assert.deepEqual(fieldTypesForCategory('choice'), ['checkboxes', 'choice']);
  assert.deepEqual(fieldTypesForCategory('image'), ['image']);
  assert.deepEqual(fieldTypesForCategory('collections'), ['list', 'entries', 'pairs', 'spells']);
});

test('new Field groups choose a sensible default type', () => {
  assert.deepEqual(FIELD_CATEGORY_DEFAULT_TYPES, {
    values: 'number', text: 'text', choice: 'checkboxes', image: 'image', collections: 'list',
  });
});

test('legacy category names migrate to the new presentation group based on Field type', () => {
  const cases = [
    ['metric', 'number', 'values'],
    ['value', 'text', 'text'],
    ['resources', 'counters', 'values'],
    ['resources', 'checkboxes', 'choice'],
    ['checkboxes', 'checkboxes', 'choice'],
    ['pairs', 'pairs', 'collections'],
    ['spells', 'spells', 'collections'],
    ['abilities', 'entries', 'collections'],
  ];

  for (const [legacyCategory, type, expected] of cases) {
    const layout = { fieldKinds: { sample: legacyCategory } };
    assert.equal(resolveFieldCategory(layout, field('sample', type)), expected);
    assert.equal(layout.fieldKinds.sample, expected);
  }
});

test('current saved categories are retained when compatible with the Field type', () => {
  for (const [category, type] of [
    ['values', 'number'], ['text', 'markdown'], ['choice', 'choice'],
    ['image', 'image'], ['collections', 'spells'],
  ]) {
    const layout = { fieldKinds: { sample: category } };
    assert.equal(resolveFieldCategory(layout, field('sample', type)), category);
    assert.equal(layout.fieldKinds.sample, category);
  }
});

test('Field type picker follows the new groups and hides internal Scores storage', () => {
  assert.deepEqual(FIELD_TYPE_OPTIONS.map((option) => option.value), [
    'number', 'rating', 'dice', 'counters',
    'text', 'markdown',
    'checkboxes', 'choice',
    'image',
    'list', 'entries', 'pairs', 'spells',
  ]);
  assert.equal(FIELD_TYPE_OPTIONS.some((option) => option.value === 'scores'), false);
});

test('legacy native Field IDs receive the new presentation labels without changing their IDs', () => {
  assert.equal(fieldTypeLabel('text'), 'In-line');
  assert.equal(fieldTypeLabel('choice'), 'Selection');
  assert.equal(fieldTypeLabel('checkboxes'), 'Checkboxes');
  assert.equal(fieldTypeLabel('counters'), 'Counter');
  assert.equal(fieldTypeLabel('spells'), 'Groups');
  assert.equal(fieldTypeLabel('scores'), 'Table storage (internal)');
});

test('every Field category and selectable Field type has a help entry', () => {
  for (const key of Object.keys(FIELD_CATEGORY_TYPES)) {
    assert.ok(componentHelpEntry('fields', key), `Missing help for Field category ${key}`);
  }
  for (const option of FIELD_TYPE_OPTIONS) {
    assert.ok(componentHelpEntry('fieldTypes', option.value), `Missing help for Field type ${option.value}`);
  }
});
