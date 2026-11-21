import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTableRowFormulaValues,
  setScoresTableFormula,
  tableColumnAggregateContext,
  tableColumnFormulaValue,
  tableFormulaMap,
  tableFormulaReferencedFieldKeys,
  tableFormulaReferencesField,
} from '../src/statblocks/tableFormulaModel.ts';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';

const fields = [
  { key: 'quantity', label: 'Quantity', type: 'number' },
  { key: 'unitPrice', label: 'Unit Price', type: 'number' },
  { key: 'discount', label: 'Discount', type: 'number' },
  { key: 'subtotal', label: 'Subtotal', type: 'number' },
  { key: 'total', label: 'Total', type: 'number' },
];

const evaluate = (formula, sample, slotValue, formulaFields) =>
  evaluatePreviewFormula(formula, sample, slotValue, formulaFields);

test('Row Formula calculates a target cell using other cells in the same row', () => {
  const result = resolveTableRowFormulaValues(
    fields,
    { quantity: 2, unitPrice: 10, discount: 3, total: 0 },
    { total: '{quantity} * {unitPrice} - {discount}' },
    evaluate,
  );
  assert.equal(result.total, 17);
  assert.equal(result.quantity, 2);
  assert.equal(result.unitPrice, 10);
});

test('Row Formula resolves dependencies between calculated columns regardless of order', () => {
  const result = resolveTableRowFormulaValues(
    fields,
    { quantity: 2, unitPrice: 10, discount: 1, total: 0 },
    {
      total: '{subtotal} - {discount}',
      subtotal: '{quantity} * {unitPrice}',
    },
    evaluate,
  );
  assert.equal(result.subtotal, 20);
  assert.equal(result.total, 19);
});

test('Row Formula cycles fail closed instead of using stale stored values', () => {
  const result = resolveTableRowFormulaValues(
    fields,
    { quantity: 2, unitPrice: 10, discount: 1, total: 99 },
    { total: '{subtotal} + 1', subtotal: '{total} + 1' },
    evaluate,
  );
  assert.equal(result.total, null);
  assert.equal(result.subtotal, null);
});

test('Column Formula exposes numeric aggregates from every row', () => {
  const context = tableColumnAggregateContext(fields, [
    { quantity: 2, unitPrice: 10, discount: 1, total: 20 },
    { quantity: 3, unitPrice: 10, discount: 2, total: 30 },
    { quantity: '', unitPrice: 12, discount: 0, total: 0 },
  ]);
  assert.deepEqual(context.quantity, { sum: 5, average: 2.5, avg: 2.5, min: 2, max: 3, count: 2 });
  assert.equal(tableColumnFormulaValue('value', 'quantity', context, fields.filter((field) => field.type !== 'choice'), evaluate), 5);
  assert.equal(tableColumnFormulaValue('{unitPrice.average} + {discount.sum}', 'quantity', context, fields, evaluate), 41 / 3);
  assert.equal(tableColumnFormulaValue('{total.max} - {total.min}', 'quantity', context, fields, evaluate), 30);
});

test('Table formula settings are stored by target Field and empty formulas remove the setting', () => {
  const block = { id: 'table-1', type: 'scores', fields: ['quantity', 'unitPrice', 'total'] };
  assert.equal(setScoresTableFormula(block, 'row', 'total', '{quantity} * {unitPrice}'), true);
  assert.equal(setScoresTableFormula(block, 'column', 'total', 'value'), true);
  assert.deepEqual(tableFormulaMap(block, 'row'), { total: '{quantity} * {unitPrice}' });
  assert.deepEqual(tableFormulaMap(block, 'column'), { total: 'value' });
  assert.equal(setScoresTableFormula(block, 'row', 'total', '  '), true);
  assert.deepEqual(tableFormulaMap(block, 'row'), {});
  assert.equal(setScoresTableFormula(block, 'row', 'notInTable', '1 + 1'), false);
});

test('Row Formula can reference any Template Field outside the Table', () => {
  const tableFields = fields;
  const allFields = [
    ...tableFields.slice(0, 3),
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
    { key: 'attributes', label: 'Attributes', type: 'checkboxes', options: [{ key: 'strong', label: 'Strong' }] },
    { key: 'languages', label: 'Languages', type: 'choice', options: ['Common', 'Elvish'] },
  ];
  const result = resolveTableRowFormulaValues(
    tableFields,
    { quantity: 2, unitPrice: 10, discount: 1, total: 0, proficiency: 3, attributes: { strong: true }, languages: 'Common' },
    { total: '{quantity} * {unitPrice} - {discount} + {proficiency} + {attributes.strong} + {languages.common}' },
    evaluate,
    allFields,
  );
  assert.equal(result.total, 24);
  assert.deepEqual(tableFormulaReferencedFieldKeys('{quantity} + @external + {field-with-hyphen}', allFields.concat({ key: 'external', label: 'External', type: 'number' }, { key: 'field-with-hyphen', label: 'Hyphen field', type: 'number' })), ['quantity', 'external', 'field-with-hyphen']);
});

test('Column Formula can read any non-Table Field alongside Table aggregates', () => {
  const allFields = [
    ...fields,
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
    { key: 'attributes', label: 'Attributes', type: 'checkboxes', options: [{ key: 'strong', label: 'Strong' }] },
  ];
  const context = tableColumnAggregateContext(fields, [
    { quantity: 2, unitPrice: 10, discount: 1, subtotal: 20, total: 20 },
    { quantity: 3, unitPrice: 10, discount: 2, subtotal: 30, total: 30 },
  ]);
  const external = { proficiency: 4, attributes: { strong: true } };
  assert.equal(tableColumnFormulaValue('{quantity.sum} + {proficiency} + {attributes.strong}', 'total', context, allFields, evaluate, external), 10);
});

test('Table formula reference discovery accepts every declared Template Field', () => {
  const tableFields = fields.slice(0, 3);
  const allFields = [...tableFields, { key: 'external', label: 'External', type: 'number' }];
  assert.deepEqual(tableFormulaReferencedFieldKeys('{quantity} * @unitPrice + {external}', allFields), ['quantity', 'unitPrice', 'external']);
  assert.equal(tableFormulaReferencesField('{quantity.sum} + {unitPrice.average}', 'quantity', allFields), true);
  assert.equal(tableFormulaReferencesField('{quantity.sum} + {unitPrice.average}', 'external', allFields), false);
  assert.equal(tableFormulaReferencesField('{quantity.sum} + {external}', 'external', allFields), true);
  assert.deepEqual(tableFormulaReferencedFieldKeys('value + true + false + max(quantity, external)', allFields), ['quantity', 'external']);
});
