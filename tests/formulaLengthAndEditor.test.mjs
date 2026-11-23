import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_MATH_FORMULA_LENGTH } from '../src/templates/formulaLimits.ts';
import { setNumericFieldFormula } from '../src/templates/numericFieldModel.ts';
import { setScoresTableFormula } from '../src/statblocks/tableFormulaModel.ts';
import { addMetricSlot, setMetricSlotFormula } from '../src/templates/metricEditorModel.ts';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';
import { readFile } from 'node:fs/promises';

function makeMetricTemplate() {
  const block = { id: 'metric-limit-test', type: 'metric', fields: [] };
  const template = {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'formula-limit-test',
    fields: [],
    layout: { maxColumns: 12, blocks: [block] },
    sample: {},
  };
  addMetricSlot(template, block.id);
  return { template, block };
}

test('shared numeric formula limit is 5,000 characters', () => {
  assert.equal(MAX_MATH_FORMULA_LENGTH, 5000);
});

test('Number/Rating formula setter accepts 5,000 characters and rejects longer formulas without truncating', () => {
  const field = { key: 'computed', label: 'Computed', type: 'number' };
  const maxFormula = `1${' '.repeat(4997)}+1`;
  assert.equal(maxFormula.length, MAX_MATH_FORMULA_LENGTH);
  assert.equal(setNumericFieldFormula(field, maxFormula), true);
  assert.equal(field.formula.length, MAX_MATH_FORMULA_LENGTH);
  assert.equal(setNumericFieldFormula(field, `${maxFormula}+1`), false);
  assert.equal(field.formula, maxFormula);
});

test('numeric formula evaluator accepts expressions longer than the old 500-character limit', () => {
  const formula = Array.from({ length: 301 }, () => '1').join('+');
  assert.ok(formula.length > 500);
  assert.equal(evaluatePreviewFormula(formula, {}, undefined), 301);
});

test('Table Row and Column formula setters share the 5,000-character limit', () => {
  const block = { id: 'table-test', type: 'scores', fields: ['total'] };
  const maxFormula = `1${' '.repeat(4997)}+1`;
  assert.equal(setScoresTableFormula(block, 'row', 'total', maxFormula), true);
  assert.equal(block.rowFormulas.total.length, MAX_MATH_FORMULA_LENGTH);
  assert.equal(setScoresTableFormula(block, 'column', 'total', `${maxFormula}+1`), false);
  assert.equal(block.columnFormulas, undefined);
});

test('Metric formulas share the 5,000-character limit', () => {
  const { template, block } = makeMetricTemplate();
  const maxFormula = `1${' '.repeat(4997)}+1`;
  assert.equal(setMetricSlotFormula(template, block.id, 0, maxFormula), true);
  assert.equal(block.formulas[0].length, MAX_MATH_FORMULA_LENGTH);
  assert.equal(setMetricSlotFormula(template, block.id, 0, `${maxFormula}+1`), false);
  assert.equal(block.formulas[0], maxFormula);
});

test('Number/Rating, Table, and Metric formula editors use multiline wrapping textareas', async () => {
  const [fieldEditor, tableEditor, metricEditor, styles] = await Promise.all([
    readFile(new URL('../src/views/templateFieldEditor.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/templateScoresBlockInspector.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/templateMetricBlockInspector.ts', import.meta.url), 'utf8'),
    readFile(new URL('../styles.css', import.meta.url), 'utf8'),
  ]);
  assert.match(fieldEditor, /textareaInput\(typeof field\.formula/);
  assert.match(tableEditor, /rowFormula\.classList\.add\('statblock-forge__formula-textarea'\)/);
  assert.match(tableEditor, /columnFormula\.classList\.add\('statblock-forge__formula-textarea'\)/);
  assert.match(metricEditor, /textareaInput\(currentFormula/);
  assert.match(styles, /\.statblock-forge__formula-textarea\s*\{[\s\S]*?overflow-wrap:\s*anywhere/);
});
