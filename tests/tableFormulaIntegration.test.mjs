import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { findFieldReferences, renameTemplateFieldKey, removeTemplateField } from '../src/templates/fieldEditorModel.ts';
import { removeFieldFromContainer } from '../src/templates/containerEditorModel.ts';

const root = new URL('../src/', import.meta.url);

function makeTemplate() {
  return {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'table-formula-integration',
    fields: [
      { key: 'quantity', label: 'Quantity', type: 'number' },
      { key: 'unit_price', label: 'Unit price', type: 'number' },
      { key: 'total', label: 'Total', type: 'number' },
      { key: 'table_data', label: 'Table data', type: 'scores' },
    ],
    layout: {
      maxColumns: 12,
      blocks: [{ id: 'table-1', type: 'scores', field: 'table_data', fields: ['quantity', 'unit_price', 'total'], rowFormulas: { total: '{quantity} * {unit_price}' }, columnFormulas: { total: 'value' } }],
    },
    sample: { quantity: 2, unit_price: 5, total: 0 },
  };
}

test('renaming a Field updates Table formula map keys and same-table references', () => {
  const template = makeTemplate();
  renameTemplateFieldKey(template, 'unit_price', 'price');
  const table = template.layout.blocks[0];
  assert.deepEqual(table.fields, ['quantity', 'price', 'total']);
  assert.deepEqual(table.rowFormulas, { total: '{quantity} * {price}' });
  assert.equal(findFieldReferences(template, 'quantity').some((reference) => reference.property === 'rowFormulas'), true);
  assert.equal(findFieldReferences(template, 'price').some((reference) => reference.property === 'rowFormulas'), true);
  assert.equal(findFieldReferences(template, 'total').some((reference) => reference.property === 'columnFormulas'), true);
});

test('removing a calculated Field from a Table also removes its formula targets', () => {
  const template = makeTemplate();
  const layout = { format: 'statblock-forge-layout', version: 1, templateId: template.id, columns: 12, dense: true, blocks: {}, containers: [{ blockId: 'table-1', kind: 'table', dataFieldKey: 'table_data' }] };
  assert.equal(removeFieldFromContainer(template, layout, 'table-1', 'total'), true);
  const table = template.layout.blocks[0];
  assert.deepEqual(table.fields, ['quantity', 'unit_price']);
  assert.equal(table.rowFormulas, undefined);
  assert.equal(table.columnFormulas, undefined);
});

test('Table inspector exposes both formula modes with their context help', async () => {
  const inspector = await readFile(new URL('views/templateScoresBlockInspector.ts', root), 'utf8');
  assert.match(inspector, /tableFormulaText\(block, 'row'/);
  assert.match(inspector, /tableFormulaText\(block, 'column'/);
  assert.match(inspector, /setScoresTableFormula\(block, 'row'/);
  assert.match(inspector, /setScoresTableFormula\(block, 'column'/);
  assert.match(inspector, /Row Formula/);
  assert.match(inspector, /Column Formula/);
});

test('Table renderer computes same-row formulas and adds a Column Formula summary footer', async () => {
  const renderer = await readFile(new URL('render/statblockPreviewRenderer.ts', root), 'utf8');
  assert.match(renderer, /resolveTableFormulaRowValues\(/);
  assert.match(renderer, /const rowFormulaMap = tableFormulaMap\(block, 'row'\)/);
  assert.match(renderer, /const columnFormulaMap = tableFormulaMap\(block, 'column'\)/);
  assert.match(renderer, /tableColumnAggregateContext\(childFields, rowValues\)/);
  assert.match(renderer, /resolveTableFormulaRowValues\(childFields, rowSample, rowFormulaMap, fields, runtime\)/);
  assert.match(renderer, /runtime\?\.value\(field, rowSample\)/, 'column aggregates should use each Number/Rating Field display value');
  assert.match(renderer, /if \(rowFormulaMap\[field\.key\] \|\| !isFormulaCapableNumericField\(field\)\) continue/);
  assert.match(renderer, /resolveTableFormulaRowValues\(\[\], current, \{\}, fields, runtime\)/);
  assert.match(renderer, /statblock-forge__preview-table-formula-footer/);
  assert.match(renderer, /tableColumnFormulaValue\([\s\S]*?columnFormulaExternalValues/);
});


test('Table formula reference protection recognizes Fields outside that Table as dependencies', () => {
  const template = makeTemplate();
  template.fields.push({ key: 'external_field', label: 'External', type: 'number' });
  template.layout.blocks[0].rowFormulas.total = '{external_field} + {quantity}';
  assert.equal(findFieldReferences(template, 'quantity').some((reference) => reference.property === 'rowFormulas'), true);
  assert.equal(findFieldReferences(template, 'external_field').some((reference) => reference.property === 'rowFormulas'), true);
});

test('renaming an external Field updates references in Table formulas', () => {
  const template = makeTemplate();
  template.fields.push({ key: 'external_field', label: 'External', type: 'number' });
  template.layout.blocks[0].rowFormulas.total = '{external_field} + {quantity}';
  renameTemplateFieldKey(template, 'external_field', 'bonus');
  assert.equal(template.layout.blocks[0].rowFormulas.total, '{bonus} + {quantity}');
});

test('removing an external Field used by a Table formula is blocked', () => {
  const template = makeTemplate();
  template.fields.push({ key: 'external_field', label: 'External', type: 'number' });
  template.layout.blocks[0].rowFormulas.total = '{external_field} + {quantity}';
  assert.throws(() => removeTemplateField(template, 'external_field'), /ainda é usado por fórmulas/i);
});

test('empty Table renderer branch does not access formula-footer state declared later', async () => {
  const renderer = await readFile(new URL('render/statblockPreviewRenderer.ts', root), 'utf8');
  const emptyBranchStart = renderer.indexOf('if (childFields.length === 0)');
  const formulaMapsStart = renderer.indexOf("const rowFormulaMap = tableFormulaMap(block, 'row')", emptyBranchStart);
  assert.ok(emptyBranchStart >= 0 && formulaMapsStart > emptyBranchStart);
  const emptyBranch = renderer.slice(emptyBranchStart, formulaMapsStart);
  assert.doesNotMatch(emptyBranch, /columnFormulaMap|columnFormulaContext|numericChildFields|showRowLabels|editableRows/);
});


test('unlinking a Table dependency clears formulas that would otherwise point outside the Table', () => {
  const template = makeTemplate();
  const layout = { format: 'statblock-forge-layout', version: 1, templateId: template.id, columns: 12, dense: true, blocks: {}, containers: [{ blockId: 'table-1', kind: 'table', dataFieldKey: 'table_data' }] };
  template.layout.blocks[0].rowFormulas = { total: '{quantity} * {unit_price}' };
  template.layout.blocks[0].columnFormulas = { total: '{quantity.sum}' };
  assert.equal(removeFieldFromContainer(template, layout, 'table-1', 'quantity'), true);
  const table = template.layout.blocks[0];
  assert.deepEqual(table.rowFormulas, undefined);
  assert.deepEqual(table.columnFormulas, undefined);
});
