import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasDiceFieldFormula,
  isDiceFieldFormulaSyntaxValid,
  resolveDiceFieldFormula,
  setDiceFieldFormula,
} from '../src/statblocks/diceFieldFormulaModel.ts';
import { calculateNumericFieldValue } from '../src/templates/numericFieldModel.ts';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';
import {
  changeTemplateFieldType,
  findFieldReferences,
  renameTemplateFieldKey,
  validateTemplateFields,
} from '../src/templates/fieldEditorModel.ts';

function fixture() {
  const fields = [
    { key: 'proficiency', label: 'Proficiency', type: 'number' },
    { key: 'might', label: 'Might', type: 'rating' },
    { key: 'level', label: 'Level', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '{proficiency}d{might}+{level}' },
  ];
  const data = { proficiency: 2, might: 8, level: 3 };
  const resolve = (field, sample = data) => resolveDiceFieldFormula(
    field,
    fields,
    sample,
    (sourceField) => calculateNumericFieldValue(sourceField, sample, evaluatePreviewFormula),
  );
  return { fields, data, resolve };
}

test('Dice Field formulas substitute live Number and Rating Values into the roll notation', () => {
  const { fields, resolve } = fixture();
  assert.equal(resolve(fields[3]), '2d8+3');
  assert.equal(resolve(fields[3], { proficiency: 3, might: 10, level: 5 }), '3d10+5');
});

test('Dice Field formulas can reference Number/Rating Values that themselves use numeric formulas', () => {
  const fields = [
    { key: 'base', label: 'Base', type: 'number' },
    { key: 'proficiency', label: 'Proficiency', type: 'number', formula: 'base + 1' },
    { key: 'might', label: 'Might', type: 'rating' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '{proficiency}d{might}' },
  ];
  const sample = { base: 1, proficiency: 1, might: 6 };
  const resolved = resolveDiceFieldFormula(fields[3], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(resolved, '2d6');
});

test('Dice Field formula supports a calculated dice count together with a dynamic keep-highest count', async () => {
  const fields = [
    { key: 'power', label: 'Power', type: 'number' },
    { key: 'damage', label: 'Damage', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '({power}+{damage})d6kh{damage}' },
  ];
  const sample = { power: 3, damage: 2 };
  const resolved = resolveDiceFieldFormula(fields[2], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(isDiceFieldFormulaSyntaxValid(fields[2].diceFormula), true);
  assert.equal(resolved, '5d6kh2');
  const parsed = (await import('../src/statblocks/diceFieldEditorModel.ts')).parseDiceField(resolved);
  assert.equal(parsed?.terms[0]?.count, 5);
  assert.deepEqual(parsed?.terms[0]?.keep, { mode: 'keep', end: 'highest', count: 2 });
});

test('Dice Field formulas display the evaluated dice count instead of the arithmetic group', async () => {
  const fields = [
    { key: 'power', label: 'Power', type: 'number' },
    { key: 'damage', label: 'Damage', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '({power}+{damage})d6kh{damage}' },
  ];
  const sample = { power: 10, damage: 10 };
  const resolved = resolveDiceFieldFormula(fields[2], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(resolved, '20d6kh10');
  const parsed = (await import('../src/statblocks/diceFieldEditorModel.ts')).parseDiceField(resolved);
  assert.equal(parsed?.terms[0]?.count, 20);
  assert.deepEqual(parsed?.terms[0]?.keep, { mode: 'keep', end: 'highest', count: 10 });
});

test('literal arithmetic dice counts are summed before the d even without Field references', () => {
  const field = { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '(10+10)d6kh10' };
  assert.equal(resolveDiceFieldFormula(field, [], {}, () => null), '20d6kh10');
});

test('Dice Field normalization preserves ordinary parentheses and only sums dice counts', () => {
  const fields = [
    { key: 'power', label: 'Power', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '({power}+2)d6kh2+(1d8+2)*2' },
  ];
  const sample = { power: 3 };
  const resolved = resolveDiceFieldFormula(fields[1], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(resolved, '5d6kh2+(1d8+2)*2');
});

test('Dice Field formula syntax accepts placeholders in dice counts, sides, and arithmetic', () => {
  assert.equal(isDiceFieldFormulaSyntaxValid('{proficiency}d{might}+{level}'), true);
  assert.equal(isDiceFieldFormulaSyntaxValid('({proficiency}d{might}+2)*{level}'), true);
  assert.equal(isDiceFieldFormulaSyntaxValid('{level}+{proficiency}'), false, 'a Dice Field must still contain a die');
  assert.equal(isDiceFieldFormulaSyntaxValid('{proficiency}d{might}+{level'), false);
  assert.equal(isDiceFieldFormulaSyntaxValid(''), false);
});

test('unresolved, non-numeric, fractional, self, and non-Number/Rating references do not produce roll links', () => {
  const { fields, resolve } = fixture();
  assert.equal(resolve(fields[3], { proficiency: 2, might: 8 }), '');
  assert.equal(resolve(fields[3], { proficiency: 2, might: 8, level: 'not a number' }), '');
  assert.equal(resolve(fields[3], { proficiency: 1.5, might: 8, level: 3 }), '');
  const textField = { key: 'weaponName', label: 'Weapon', type: 'text' };
  fields.push(textField);
  fields[3].diceFormula = '{weaponName}d{might}';
  assert.equal(resolve(fields[3]), '');
  fields[3].diceFormula = '{attack}d{might}';
  assert.equal(resolve(fields[3]), '');
});

test('Dice Field formula configuration trims input and supports clearing', () => {
  const field = { key: 'attack', label: 'Attack', type: 'dice' };
  assert.equal(setDiceFieldFormula(field, '  {proficiency}d{might}+{level}  '), true);
  assert.equal(field.diceFormula, '{proficiency}d{might}+{level}');
  assert.equal(hasDiceFieldFormula(field), true);
  assert.equal(setDiceFieldFormula(field, ''), true);
  assert.equal(hasDiceFieldFormula(field), false);
});

test('renaming a Number/Rating Field updates Dice Formula references and dependency discovery', () => {
  const { fields } = fixture();
  const template = {
    format: 'atlas-statblock-template', version: 1, id: 'test', fields,
    layout: { maxColumns: 12, blocks: [] },
    sample: { proficiency: 2, might: 8, level: 3 },
  };
  assert.equal(findFieldReferences(template, 'proficiency').some((ref) => ref.property === 'diceFormula'), true);
  renameTemplateFieldKey(template, 'proficiency', 'training');
  assert.equal(fields[3].diceFormula, '{training}d{might}+{level}');
  assert.equal(findFieldReferences(template, 'training').some((ref) => ref.property === 'diceFormula'), true);
});

test('template validation requires Dice Formula references to resolve to another Number/Rating Field', () => {
  const { fields } = fixture();
  const template = {
    format: 'atlas-statblock-template', version: 1, id: 'test', fields,
    layout: { maxColumns: 12, blocks: [] }, sample: {},
  };
  assert.equal(validateTemplateFields(template).some((issue) => issue.fieldKey === 'attack' && issue.code === 'missing-reference'), false);
  fields[3].diceFormula = '{weapon}d{might}';
  fields.push({ key: 'weapon', label: 'Weapon', type: 'text' });
  assert.equal(validateTemplateFields(template).some((issue) => issue.fieldKey === 'attack' && issue.code === 'missing-reference'), true);
});

test('the renderer recalculates a formula-backed Dice Field when any source Value changes', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const start = renderer.indexOf('function createInlineTextFieldValue(');
  const end = renderer.indexOf('\nfunction renderNumericFieldValue(', start);
  assert.ok(start >= 0 && end > start, 'the inline Field renderer should exist');
  const implementation = renderer.slice(start, end);
  assert.match(implementation, /const formulaBackedDice = field\.type === 'dice' && hasDiceFieldFormula\(field\)/);
  assert.match(implementation, /runtime\?\.diceFormula\(field, sample\)/);
  assert.match(implementation, /runtime\?\.subscribe\(field\.key, redraw\)/);
  assert.match(implementation, /runtime\?\.canEdit && !formulaBackedDice/);
  assert.match(renderer, /const notifyAll = \(\): void => \{[\s\S]*?for \(const group of listeners\.values\(\)\)/);
});

test('Dice Field formula editor exposes the placeholder syntax and validates it without changing the stored formula', async () => {
  const { readFile } = await import('node:fs/promises');
  const editor = await readFile(new URL('../src/views/templateFieldEditor.ts', import.meta.url), 'utf8');
  assert.match(editor, /else if \(field\.type === 'dice'\)/);
  assert.match(editor, /\{proficiency\}d\{might\}\+\{level\}/);
  assert.match(editor, /isDiceFieldFormulaSyntaxValid\(formula\.value\)/);
  assert.match(editor, /setDiceFieldFormula\(field, formula\.value\)/);
});


test('formula-backed Dice Fields also render as live roll links in Metric blocks', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const start = renderer.indexOf('function renderMetric(');
  const end = renderer.indexOf('\nfunction renderTableSlotValue(', start);
  assert.ok(start >= 0 && end > start, 'Metric renderer should exist');
  const implementation = renderer.slice(start, end);
  assert.match(implementation, /const formulaBackedDice = Boolean\(diceField && hasDiceFieldFormula\(diceField\)\)/);
  assert.match(implementation, /numericRuntime\?\.diceFormula\(diceField, sample\)/);
  assert.match(implementation, /numericRuntime\.subscribeAll\(syncDiceMetric\)/);
  assert.match(implementation, /appendForgeStatblockDiceText\(metricValue, expression\)/);
});


test('a Number/Rating source cannot be changed to a non-numeric type while Dice Formulas depend on it', () => {
  const { fields } = fixture();
  const template = {
    format: 'atlas-statblock-template', version: 1, id: 'test', fields,
    layout: { maxColumns: 12, blocks: [] }, sample: { proficiency: 2, might: 8, level: 3 },
  };
  assert.throws(() => changeTemplateFieldType(template, 'proficiency', 'text'), /usado por Dice Formulas/);
  assert.equal(fields[0].type, 'number', 'the failed change must not mutate the source Field');
  changeTemplateFieldType(template, 'proficiency', 'rating');
  assert.equal(fields[0].type, 'rating', 'Number and Rating remain interchangeable formula sources');
});


test('the Add Field form preserves numeric and Dice formulas independently when switching types', async () => {
  const { readFile } = await import('node:fs/promises');
  const editor = await readFile(new URL('../src/views/templateFieldEditor.ts', import.meta.url), 'utf8');
  assert.match(editor, /let formulaInputKind: 'numeric' \| 'dice' \| null = null/);
  assert.match(editor, /if \(formulaInputKind === 'dice'\) diceFormulaValue = formula\.value/);
  assert.match(editor, /else if \(formulaInputKind === 'numeric'\) formulaValue = formula\.value/);
});

test('Dice Field formulas accept written advantage and preserve it after resolving references', () => {
  const { fields, resolve } = fixture();
  fields[3].diceFormula = '{proficiency}d{might}+{level} adv';
  assert.equal(isDiceFieldFormulaSyntaxValid(fields[3].diceFormula), true);
  assert.equal(resolve(fields[3]), '2d8+3 adv');
  fields[3].diceFormula = '{proficiency}d{might}+{level} dis';
  assert.equal(resolve(fields[3]), '2d8+3 dis');
});
