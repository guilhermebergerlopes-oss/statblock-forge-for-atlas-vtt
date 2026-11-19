import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';
import { resolveDiceFieldFormula, isDiceFieldFormulaSyntaxValid, diceFieldFormulaUsesField, renameDiceFieldFormulaReference } from '../src/statblocks/diceFieldFormulaModel.ts';
import { fillRestFormula, evaluateRestFormula } from '../src/statblocks/restFormulaModel.ts';
import { findFieldReferences, renameTemplateFieldKey } from '../src/templates/fieldEditorModel.ts';

const template = {
  format: 'atlas-statblock-template', version: 1, id: 'formula-ref-test',
  fields: [
    { key: 'might-score', label: 'Might', type: 'number' },
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
    { key: 'level', label: 'Level', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '@proficiency d{might-score}+@level' },
  ],
  layout: { maxColumns: 12, blocks: [] },
  sample: { 'might-score': 8, proficiency: 2, level: 3 },
};

test('Number, Rating, Metric and Scores arithmetic accepts @ and braces in mixed expressions', () => {
  const sample = { 'might-score': 8, proficiency: 2, level: 3 };
  assert.equal(evaluatePreviewFormula('{might-score} + @proficiency * 2', sample, undefined), 12);
  assert.equal(evaluatePreviewFormula('floor(({might-score} + @level) / 2)', sample, undefined), 5);
  assert.equal(evaluatePreviewFormula('max(@proficiency, {level})', sample, undefined), 3);
  assert.equal(evaluatePreviewFormula('@proficiency-1', sample, undefined), 1, 'minus remains an operator after an @ reference');
});

test('Dice Field formula syntax and runtime resolution accept both reference spellings', () => {
  const localTemplate = structuredClone(template);
  const fields = localTemplate.fields;
  const formulaField = fields[3];
  assert.equal(isDiceFieldFormulaSyntaxValid('@proficiency d{might-score}+@level'), true);
  const configuredFormula = formulaField.diceFormula;
  assert.equal(resolveDiceFieldFormula(formulaField, fields, localTemplate.sample), '2d8+3');
  assert.equal(formulaField.diceFormula, configuredFormula, 'evaluation must not rewrite the stored formula');
  formulaField.diceFormula = '{proficiency}d{might-score}+{level}';
  assert.equal(resolveDiceFieldFormula(formulaField, fields, localTemplate.sample), '2d8+3');
  assert.equal(diceFieldFormulaUsesField(formulaField.diceFormula, 'might-score'), true);
  assert.equal(renameDiceFieldFormulaReference(formulaField.diceFormula, 'might-score', 'might'), '{proficiency}d{might}+{level}');
});

test('Rest formulas accept @ and brace references without changing their roll grammar', () => {
  const storedRestFormula = '{level}d4+@proficiency';
  const filled = fillRestFormula(storedRestFormula, template, template.sample);
  assert.equal(storedRestFormula, '{level}d4+@proficiency', 'evaluation keeps the saved expression text unchanged');
  assert.equal(filled.ok, true);
  assert.equal(filled.formula, '3d4+(2)');
  const deterministic = evaluateRestFormula('@proficiency+{level}', template, template.sample, 'test');
  assert.deepEqual(deterministic, { value: 5 });
});

test('dependency discovery and field renaming recognize both explicit syntaxes', () => {
  const localTemplate = structuredClone(template);
  localTemplate.fields[1].formula = '{might-score} + 1';
  localTemplate.fields[3].diceFormula = '{proficiency}d@proficiency';
  assert.equal(findFieldReferences(localTemplate, 'might-score').some((item) => item.property === 'formula'), true);
  assert.equal(findFieldReferences(localTemplate, 'proficiency').some((item) => item.property === 'diceFormula'), true);
  renameTemplateFieldKey(localTemplate, 'might-score', 'might');
  assert.equal(localTemplate.fields[1].formula, '{might} + 1');
});

test('Counter row regain formulas accept both reference forms while still requiring dice', async () => {
  const localTemplate = structuredClone(template);
  const { isCounterRegainFormula } = await import('../src/statblocks/counterRegainModel.ts');
  assert.equal(isCounterRegainFormula('@level d4'), true);
  assert.equal(isCounterRegainFormula('{level}d4'), true);
  assert.equal(isCounterRegainFormula('{level}d4+@proficiency'), true);
  assert.equal(isCounterRegainFormula('@proficiency+{level}'), false);
  let rolled = '';
  const result = evaluateRestFormula('{level}d4+@proficiency', localTemplate, localTemplate.sample, 'Counter regain', (formula) => {
    rolled = formula;
    return 8;
  });
  assert.deepEqual(result, { value: 8 });
  assert.equal(rolled, '3d4+(2)');
});
