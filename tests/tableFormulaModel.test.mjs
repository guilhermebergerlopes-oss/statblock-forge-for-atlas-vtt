import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveTableRowFormulaValues,
  setScoresTableFormula,
  tableColumnAggregateContext,
  tableColumnFormulaValue,
  tableCellReferenceIndex,
  tableFormulaMap,
  tableFormulaReferencedFieldKeys,
  tableFormulaReferencesField,
} from '../src/statblocks/tableFormulaModel.ts';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';
import { calculateNumericFieldValue } from '../src/templates/numericFieldModel.ts';

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

test('Row Formula can identify its one-based position with rowNumber', () => {
  const formulaFields = [{ key: 'save', label: 'Save', type: 'number' }];
  const formula = 'rowNumber == 1 ? 10 : rowNumber == 2 ? 20 : rowNumber == 3 ? 30 : 0';
  const results = [1, 2, 3, 4].map((rowNumber) => resolveTableRowFormulaValues(
    formulaFields,
    { save: null, __forgeTableRowNumber: rowNumber },
    { save: formula },
    evaluate,
  ).save);
  assert.deepEqual(results, [10, 20, 30, 0]);
  assert.deepEqual(tableFormulaReferencedFieldKeys('rowNumber + {quantity}', [...formulaFields, ...fields]), ['quantity']);
});

test('the Table renderer injects a one-based row number into each row formula sample', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  assert.match(renderer, /__forgeTableRowNumber:\s*rowIndex \+ 1/);
});

test('the D&D saving-throw formula maps proficiency options by rowNumber without sample ability scores', () => {
  const savingThrowOptions = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
  const formulaFields = [
    { key: 'mod', label: 'Modifier', type: 'number' },
    { key: 'save', label: 'Save', type: 'number' },
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
    { key: 'st_proficiencies', label: 'Saving Throws', type: 'checkboxes', options: savingThrowOptions.map((key) => ({ key, label: key })) },
  ];
  const formula = '{mod} + {proficiency} * (rowNumber == 1 ? {st_proficiencies.strength} : rowNumber == 2 ? {st_proficiencies.dexterity} : rowNumber == 3 ? {st_proficiencies.constitution} : rowNumber == 4 ? {st_proficiencies.intelligence} : rowNumber == 5 ? {st_proficiencies.wisdom} : rowNumber == 6 ? {st_proficiencies.charisma} : 0)';
  const results = savingThrowOptions.map((selectedOption, index) => {
    const proficiencies = Object.fromEntries(savingThrowOptions.map((key) => [key, key === selectedOption]));
    return resolveTableRowFormulaValues(
      formulaFields.slice(0, 2),
      { mod: index - 1, save: null, proficiency: 3, st_proficiencies: proficiencies, __forgeTableRowNumber: index + 1 },
      { save: formula },
      evaluate,
      formulaFields,
    ).save;
  });
  assert.deepEqual(results, [-1 + 3, 0 + 3, 1 + 3, 2 + 3, 3 + 3, 4 + 3]);
});

test('explicit {rowNumber} remains a Template Field reference', () => {
  const formulaFields = [
    { key: 'rowNumber', label: 'Stored Row Number', type: 'number' },
    { key: 'save', label: 'Save', type: 'number' },
  ];
  const result = resolveTableRowFormulaValues(
    formulaFields,
    { rowNumber: 42, save: null, __forgeTableRowNumber: 2 },
    { save: '{rowNumber}' },
    evaluate,
  );
  assert.equal(result.save, 42);
  assert.deepEqual(tableFormulaReferencedFieldKeys('{rowNumber}', formulaFields), ['rowNumber']);
});

test('Row Formula can read a same-row Field whose key is value', () => {
  const valueAndModFields = [
    { key: 'value', label: 'Value', type: 'number' },
    { key: 'mod', label: 'Mod', type: 'number' },
  ];
  const result = resolveTableRowFormulaValues(
    valueAndModFields,
    { value: 10, mod: null },
    { mod: 'floor(({value}-10)/2)' },
    evaluate,
  );
  assert.equal(result.mod, 0);
  assert.equal(resolveTableRowFormulaValues(
    valueAndModFields, { value: 8, mod: null }, { mod: 'floor(({value}-10)/2)' }, evaluate,
  ).mod, -1);
  assert.deepEqual(tableFormulaReferencedFieldKeys('{value}', valueAndModFields), ['value']);
  assert.deepEqual(tableFormulaReferencedFieldKeys('value', valueAndModFields), []);
});

test('Number formulas can address a specific cell in any Table by storage key, row, and column key', () => {
  const fields = [
    { key: 'table_1', label: 'Table 1', type: 'scores', forgeInternal: 'table-storage' },
    { key: 'value', label: 'Value', type: 'number' },
    { key: 'mod', label: 'Mod', type: 'number' },
    { key: 'external_mod', label: 'External Mod', type: 'number', formula: 'floor(({table_1.row2.value}-10)/2)' },
  ];
  const blocks = [{ id: 'table-block-1', type: 'scores', field: 'table_1', fields: ['value', 'mod'] }];
  const tableReferences = tableCellReferenceIndex(blocks);
  const sample = {
    value: 12,
    mod: 1,
    table_1: {
      format: 'statblock-forge-table-rows-v1',
      firstRowLabel: 'STR',
      extraRows: [
        { label: 'DEX', values: { value: 14, mod: 2 } },
        { label: 'CON', values: { value: 8, mod: -1 } },
      ],
    },
    external_mod: null,
  };
  const evaluateWithTables = (formula, values, slotValue) =>
    evaluatePreviewFormula(formula, values, slotValue, fields, tableReferences);

  assert.equal(tableReferences.table_1.columns.includes('value'), true);
  assert.equal(evaluateWithTables('{table_1.row1.value}', sample, undefined), 12);
  assert.equal(evaluateWithTables('{table_1.row2.value}', sample, undefined), 14);
  assert.equal(evaluateWithTables('{table_1.row3.mod}', sample, undefined), -1);
  assert.equal(evaluateWithTables('floor(({table_1.row2.value}-10)/2)', sample, undefined), 2);
  assert.equal(evaluateWithTables('floor((@table_1.row2.value-10)/2)', sample, undefined), 2);
  // Row Formula receives a row-specific sample where its child Fields are
  // overlaid with the active row. Absolute Table paths must keep using the
  // original statblock source values instead of that temporary row context.
  const rowTwoSample = { ...sample, value: 14, mod: null };
  const firstRowReference = resolveTableRowFormulaValues(
    fields.slice(1, 3),
    rowTwoSample,
    { mod: '{table_1.row1.value}' },
    (formula, values, slotValue) => evaluatePreviewFormula(formula, values, slotValue, fields, tableReferences, sample),
    fields,
  );
  assert.equal(firstRowReference.mod, 12);
  assert.equal(evaluateWithTables('{table_1.row4.value}', sample, undefined), null);
  assert.equal(evaluateWithTables('{table_1.row2.not_a_column}', sample, undefined), null);
  assert.equal(calculateNumericFieldValue(fields[3], sample, evaluateWithTables), 2);
});

test('Table cell references use the Number/Rating value shown after its Field formula', () => {
  const calculatedValueField = {
    key: 'value', label: 'Value', type: 'number', formula: 'value + {mod}',
  };
  const modField = { key: 'mod', label: 'Mod', type: 'number' };
  const tableField = { key: 'table_1', label: 'Table 1', type: 'scores', forgeInternal: 'table-storage' };
  const fields = [tableField, calculatedValueField, modField];
  const tableReferences = tableCellReferenceIndex([
    { id: 'table-block-1', type: 'scores', field: 'table_1', fields: ['value', 'mod'] },
  ]);
  const sample = {
    value: 12,
    mod: 1,
    table_1: {
      format: 'statblock-forge-table-rows-v1',
      extraRows: [{ label: 'DEX', values: { value: 14, mod: 2 } }],
    },
  };
  const evaluate = (formula, values, slotValue) =>
    evaluatePreviewFormula(formula, values, slotValue, fields, tableReferences, sample);

  // The value Field displays 13 in row 1 and 16 in row 2, although its inputs are 12 and 14.
  assert.equal(evaluate('{table_1.row1.value}', sample, undefined), 13);
  assert.equal(evaluate('{table_1.row2.value}', sample, undefined), 16);
  assert.equal(sample.value, 12, 'calculation does not mutate the first-row input');
  assert.equal(sample.table_1.extraRows[0].values.value, 14, 'calculation does not mutate the extra-row input');
});

test('Table cell references use the displayed Table Row Formula instead of the stored input', () => {
  const tableField = { key: 'table_1', label: 'Abilities', type: 'scores', forgeInternal: 'table-storage' };
  const quantity = { key: 'quantity', label: 'Quantity', type: 'number' };
  const unitPrice = { key: 'unitPrice', label: 'Unit Price', type: 'number' };
  const discount = { key: 'discount', label: 'Discount', type: 'number' };
  const subtotal = { key: 'subtotal', label: 'Subtotal', type: 'number' };
  // The global Field formula is intentionally different: the Table-level
  // Row Formula is what the Table visibly renders for this slot.
  const total = { key: 'total', label: 'Total', type: 'number', formula: '{quantity} * {unitPrice} + 100' };
  const external = { key: 'external', label: 'External', type: 'number', formula: '{table_1.row2.total} * 2' };
  const allFields = [tableField, quantity, unitPrice, discount, subtotal, total, external];
  const block = {
    id: 'table-block-1',
    type: 'scores',
    field: 'table_1',
    fields: ['quantity', 'unitPrice', 'discount', 'subtotal', 'total'],
    rowFormulas: {
      subtotal: '{quantity} * {unitPrice}',
      total: '{subtotal} - {discount} + rowNumber',
    },
  };
  const tableReferences = tableCellReferenceIndex([block]);
  const sample = {
    quantity: 2,
    unitPrice: 10,
    discount: 1,
    subtotal: 999,
    total: 777,
    external: null,
    table_1: {
      format: 'statblock-forge-table-rows-v1',
      extraRows: [{
        label: 'DEX',
        values: { quantity: 3, unitPrice: 5, discount: 2, subtotal: 888, total: 666 },
      }],
    },
  };
  const evaluate = (formula, values, slotValue, selfFieldKey) =>
    evaluatePreviewFormula(formula, values, slotValue, allFields, tableReferences, sample, selfFieldKey);

  // Row 1 displays subtotal 20 and total 20; row 2 displays subtotal 15 and
  // total 15 (the rowNumber addition is 2, less discount 2).
  assert.equal(evaluate('{table_1.row1.subtotal}', sample, undefined), 20);
  assert.equal(evaluate('{table_1.row1.total}', sample, undefined), 20);
  assert.equal(evaluate('{table_1.row2.subtotal}', sample, undefined), 15);
  assert.equal(evaluate('{table_1.row2.total}', sample, undefined), 15);
  assert.equal(calculateNumericFieldValue(external, sample, evaluate), 30,
    'a Number Field formula referencing a Table cell receives the visible row-formula result');

  assert.equal(sample.subtotal, 999, 'the first-row storage value is not overwritten');
  assert.equal(sample.total, 777, 'the first-row storage value is not overwritten');
  assert.equal(sample.table_1.extraRows[0].values.subtotal, 888, 'the extra-row storage value is not overwritten');
  assert.equal(sample.table_1.extraRows[0].values.total, 666, 'the extra-row storage value is not overwritten');
});

test('cyclic absolute Table cell references fail closed without returning stored inputs', () => {
  const storage = { key: 'table_1', label: 'Table 1', type: 'scores', forgeInternal: 'table-storage' };
  const first = { key: 'first', label: 'First', type: 'number' };
  const second = { key: 'second', label: 'Second', type: 'number' };
  const fields = [storage, first, second];
  const references = tableCellReferenceIndex([{
    id: 'table-1',
    type: 'scores',
    field: 'table_1',
    fields: ['first', 'second'],
    rowFormulas: {
      first: '{table_1.row1.second} + 1',
      second: '{table_1.row1.first} + 1',
    },
  }]);
  const sample = { first: 40, second: 50, table_1: { format: 'statblock-forge-table-rows-v1' } };
  const evaluate = (formula, values, slotValue, selfFieldKey) =>
    evaluatePreviewFormula(formula, values, slotValue, fields, references, sample, selfFieldKey);

  assert.equal(evaluate('{table_1.row1.first}', sample, undefined), null);
  assert.equal(evaluate('{table_1.row1.second}', sample, undefined), null);
  assert.equal(sample.first, 40);
  assert.equal(sample.second, 50);
});

test('Table cell references use the child Field display formula when no Table Row Formula exists', () => {
  const tableField = { key: 'table_1', label: 'Table 1', type: 'scores', forgeInternal: 'table-storage' };
  const valueField = { key: 'value', label: 'Value', type: 'number', formula: '{mod} + value' };
  const modField = { key: 'mod', label: 'Mod', type: 'number' };
  const fields = [tableField, valueField, modField];
  const references = tableCellReferenceIndex([
    { id: 'table-1', type: 'scores', field: 'table_1', fields: ['value', 'mod'] },
  ]);
  const sample = {
    value: 10,
    mod: 2,
    table_1: {
      format: 'statblock-forge-table-rows-v1',
      extraRows: [{ label: 'DEX', values: { value: 20, mod: 3 } }],
    },
  };
  const evaluate = (formula, values, slotValue, selfFieldKey) =>
    evaluatePreviewFormula(formula, values, slotValue, fields, references, sample, selfFieldKey);

  assert.equal(evaluate('{table_1.row1.value}', sample, undefined), 12);
  assert.equal(evaluate('{table_1.row2.value}', sample, undefined), 23);
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

test('a Table Row Formula self-reference reads that cell input, not a displayed Field formula', () => {
  const selfField = { key: 'total', label: 'Total', type: 'number', formula: '{total} + 1' };
  const rowResult = resolveTableRowFormulaValues(
    [selfField],
    { total: 7 },
    { total: '{total} + 2' },
  );
  assert.equal(rowResult.total, 9,
    'the Table Row Formula reads the current cell input of 7 when it references its own Field');
});

test('a Column Formula self-reference reads the current aggregate input', () => {
  const context = tableColumnAggregateContext(fields, [
    { quantity: 2, unitPrice: 10, discount: 1, total: 20 },
    { quantity: 3, unitPrice: 10, discount: 2, total: 30 },
  ]);
  assert.equal(tableColumnFormulaValue('{quantity} + 1', 'quantity', context, fields), 6,
    'the self-reference uses quantity sum 5, while other Field references still use their normal resolution');
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

test('Table Row Formula reads the displayed result of a referenced external Number Field', () => {
  const targetFields = [
    { key: 'quantity', label: 'Quantity', type: 'number' },
    { key: 'total', label: 'Total', type: 'number' },
    { key: 'strength', label: 'Strength', type: 'number', formula: 'floor((value - 10) / 2)' },
  ];
  const result = resolveTableRowFormulaValues(
    targetFields.slice(0, 2),
    { quantity: 2, total: 0, strength: 18 },
    { total: '{quantity} + {strength}' },
    evaluate,
    targetFields,
  );
  assert.equal(result.total, 6, 'the row formula uses Strength display value 4, not its stored input 18');
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

test('Column Formula references use the displayed value of an external formula-backed Field', () => {
  const allFields = [
    ...fields,
    { key: 'proficiency', label: 'Proficiency', type: 'number', formula: 'value + 2' },
  ];
  const context = tableColumnAggregateContext(fields, [
    { quantity: 2, unitPrice: 10, discount: 1, subtotal: 20, total: 20 },
  ]);
  const external = { proficiency: 3 };
  assert.equal(tableColumnFormulaValue('{quantity.sum} + {proficiency}', 'total', context, allFields, evaluate, external), 7,
    'the Column Formula adds displayed Proficiency 5 rather than its stored input 3');
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
test('Table cell references count as dependencies of both the Table and its child Field', async () => {
  const { findFieldReferences, renameTemplateFieldKey } = await import('../src/templates/fieldEditorModel.ts');
  const template = {
    format: 'atlas-statblock-template', version: 1, id: 'table-cell-reference-rename',
    fields: [
      { key: 'table_1', label: 'Table 1', type: 'scores', forgeInternal: 'table-storage' },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'outside', label: 'Outside', type: 'number', formula: 'floor(({table_1.row2.value}-10)/2)' },
    ],
    layout: { maxColumns: 12, blocks: [{ id: 'table-block-1', type: 'scores', field: 'table_1', fields: ['value'] }] },
    sample: { value: 10, outside: 0, table_1: { format: 'statblock-forge-table-rows-v1', extraRows: [{ label: '', values: { value: 14 } }] } },
  };
  assert.equal(findFieldReferences(template, 'table_1').some((entry) => entry.property === 'formula'), true);
  assert.equal(findFieldReferences(template, 'value').some((entry) => entry.property === 'formula'), true);
  renameTemplateFieldKey(template, 'value', 'strength');
  assert.equal(template.fields.find((field) => field.key === 'outside').formula, 'floor(({table_1.row2.strength}-10)/2)');
  assert.deepEqual(template.layout.blocks[0].fields, ['strength']);
});

