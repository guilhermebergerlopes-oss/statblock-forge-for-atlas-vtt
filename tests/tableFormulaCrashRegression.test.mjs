import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';
import { tableCellReferenceIndex } from '../src/statblocks/tableFormulaModel.ts';

const previewUrl = new URL('../src/render/previewValueModel.ts', import.meta.url);

test('preview formula evaluator has no runtime import cycle through tableFormulaModel', async () => {
  const source = await readFile(previewUrl, 'utf8');
  assert.match(source, /import\s*\{[^}]*resolveTableRowFormulaValues[^}]*\}\s*from\s*['"]\.\.\/statblocks\/tableRowFormulaResolver\.ts['"]/);
  assert.match(source, /import\s+type\s+\{\s*TableCellReferenceIndex\s*\}\s+from\s+['"]\.\.\/statblocks\/tableFormulaModel\.ts['"]/);
  assert.doesNotMatch(source, /import\s*\{[^}]*\}\s*from\s*['"]\.\.\/statblocks\/tableFormulaModel\.ts['"]/);
});

test('displayed Table reference resolves child formulas and lazily resolves external formula Fields', () => {
  const fields = [
    { key: 'table_1', label: 'Table', type: 'scores', forgeInternal: 'table-storage' },
    { key: 'amount', label: 'Amount', type: 'number', formula: 'value * 2' },
    { key: 'total', label: 'Total', type: 'number' },
    { key: 'bonus', label: 'Bonus', type: 'number', formula: 'value + 3' },
    { key: 'result', label: 'Result', type: 'number', formula: '{table_1.row1.total} * 2' },
  ];
  const references = tableCellReferenceIndex([{
    id: 'table-block',
    type: 'scores',
    field: 'table_1',
    fields: ['amount', 'total'],
    rowFormulas: { total: '{amount} + {bonus}' },
  }]);
  const sample = {
    table_1: { format: 'statblock-forge-table-rows-v1', extraRows: [] },
    amount: 5,
    total: 999,
    bonus: 4,
    result: null,
  };

  assert.equal(evaluatePreviewFormula(
    '{table_1.row1.total}', sample, undefined, fields, references, sample,
  ), 17, 'Table Row Formula uses the child Field result (10) and external Field result (7)');
  assert.equal(evaluatePreviewFormula(
    '{result}', sample, undefined, fields, references, sample,
  ), 34, 'a Number Field can consume the same displayed Table cell');
  assert.equal(sample.amount, 5);
  assert.equal(sample.bonus, 4);
  assert.equal(sample.total, 999);
});
