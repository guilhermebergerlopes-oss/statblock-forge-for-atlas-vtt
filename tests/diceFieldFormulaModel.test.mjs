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
import { tableCellReferenceIndex } from '../src/statblocks/tableFormulaModel.ts';
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

test('unresolved, non-numeric, fractional, and self references do not produce roll links', () => {
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

test('template validation accepts Number Formula-compatible Field references but rejects missing and self references', () => {
  const { fields } = fixture();
  const template = {
    format: 'atlas-statblock-template', version: 1, id: 'test', fields,
    layout: { maxColumns: 12, blocks: [] }, sample: {},
  };
  assert.equal(validateTemplateFields(template).some((issue) => issue.fieldKey === 'attack' && issue.code === 'missing-reference'), false);
  fields[3].diceFormula = '{weapon}d{might}';
  fields.push({ key: 'weapon', label: 'Weapon', type: 'text' });
  assert.equal(validateTemplateFields(template).some((issue) => issue.fieldKey === 'attack' && issue.code === 'missing-reference'), false, 'numeric-compatible values from non-Number Fields are valid references');
  fields[3].diceFormula = '{missing}d{might}';
  assert.equal(validateTemplateFields(template).some((issue) => issue.fieldKey === 'attack' && issue.code === 'missing-reference'), true);
  fields[3].diceFormula = '{attack}d{might}';
  assert.equal(validateTemplateFields(template).some((issue) => issue.fieldKey === 'attack' && issue.code === 'missing-reference'), true, 'a Dice Field cannot reference itself');
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
  assert.match(editor, /isDiceFieldFormulaSyntaxValid\(formula\.value, context\.template\.fields\)/);
  assert.match(editor, /Checkboxes, Selection, calculated Fields, structured values, and Table cells/);
  assert.match(editor, /outer expression must remain valid dice notation/);
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


test('a Dice Formula source can change type because runtime uses Number Formula-compatible values', () => {
  const { fields } = fixture();
  const template = {
    format: 'atlas-statblock-template', version: 1, id: 'test', fields,
    layout: { maxColumns: 12, blocks: [] }, sample: { proficiency: 2, might: 8, level: 3 },
  };
  changeTemplateFieldType(template, 'proficiency', 'text');
  assert.equal(fields[0].type, 'text', 'numeric-compatible text and structured values can remain valid formula sources');
  changeTemplateFieldType(template, 'proficiency', 'rating');
  assert.equal(fields[0].type, 'rating', 'the source Field can later change back without rewriting the Dice Formula');
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


test('Dice Formula accepts Checkboxes boolean options and Selection options like Number Formula', () => {
  const fields = [
    { key: 'traits', label: 'Traits', type: 'checkboxes', options: [{ key: 'flying', label: 'Flying' }, { key: 'strong', label: 'Strong' }] },
    { key: 'stance', label: 'Stance', type: 'choice', options: ['Aggressive', 'Defensive'] },
    { key: 'strength', label: 'Strength', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '({traits.strong}*{strength}+{stance.aggressive})d{strength}kh{strength}' },
  ];
  const sample = { traits: { flying: false, strong: true }, stance: 'Aggressive', strength: 4 };
  const resolved = resolveDiceFieldFormula(fields[3], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolved, '5d4kh4');
  sample.traits.strong = false;
  sample.stance = 'Defensive';
  assert.equal(resolveDiceFieldFormula(fields[3], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields)), '', 'keeping four results from zero rolled dice is invalid');
});

test('Dice Formula supports checkbox-weighted dice pools with the requested dynamic die size and keep-highest count', () => {
  const fields = [
    { key: 'cb_strength', label: 'Use Strength', type: 'checkboxes', options: [{ key: 'enabled', label: 'Enabled' }] },
    { key: 'cb_skill1', label: 'Use Skill 1', type: 'checkboxes', options: [{ key: 'enabled', label: 'Enabled' }] },
    { key: 'cb_skill2', label: 'Use Skill 2', type: 'checkboxes', options: [{ key: 'enabled', label: 'Enabled' }] },
    { key: 'strength', label: 'Strength', type: 'number' },
    { key: 'skill1', label: 'Skill 1', type: 'number' },
    { key: 'skill2', label: 'Skill 2', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '({cb_strength}*{strength} + {cb_skill1}*{skill1} + {cb_skill2}*{skill2}) d {strength}kh{strength}' },
  ];
  const sample = {
    cb_strength: { enabled: true },
    cb_skill1: { enabled: true },
    cb_skill2: { enabled: false },
    strength: 3,
    skill1: 2,
    skill2: 4,
  };
  assert.equal(isDiceFieldFormulaSyntaxValid(fields[6].diceFormula, fields), true);
  const resolve = () => resolveDiceFieldFormula(fields[6], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolve(), '5d3kh3');
  sample.cb_strength.enabled = false;
  sample.cb_skill2.enabled = true;
  assert.equal(resolve(), '6d3kh3', 'unselected Checkboxes contribute zero while checked options contribute one');
});

test('Dice Formula evaluates checkbox-weighted keep counts from arithmetic Field references', () => {
  const fields = [
    ...['cb_strength', 'cb_attribute2', 'cb_skill1', 'cb_skill2'].map((key) => ({
      key, label: key, type: 'checkboxes', options: [{ key: 'enabled', label: 'Enabled' }],
    })),
    ...['strength', 'attribute2', 'skill1', 'skill2'].map((key) => ({ key, label: key, type: 'number' })),
    {
      key: 'attack', label: 'Attack', type: 'dice',
      diceFormula: '({cb_strength} * {strength} + {cb_attribute2} * {attribute2} + {cb_skill1} * {skill1} + {cb_skill2} * {skill2})d6kh({cb_strength} * {strength} + {cb_attribute2} * {attribute2})',
    },
  ];
  const sample = {
    cb_strength: { enabled: true }, cb_attribute2: { enabled: true },
    cb_skill1: { enabled: true }, cb_skill2: { enabled: false },
    strength: 3, attribute2: 2, skill1: 4, skill2: 5,
  };
  const field = fields.at(-1);
  assert.equal(isDiceFieldFormulaSyntaxValid(field.diceFormula, fields), true);
  const resolved = resolveDiceFieldFormula(field, fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolved, '9d6kh5');
});

test('Dice Formula can consume the full Number Formula calculation of a referenced Field', () => {
  const fields = [
    { key: 'base', label: 'Base', type: 'number' },
    { key: 'strength', label: 'Strength', type: 'number' },
    { key: 'pool', label: 'Pool', type: 'number', formula: 'strength >= 3 && true ? floor(base / 2) : ceil(base / 3)' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '{pool}d6kh{pool}' },
  ];
  const sample = { base: 9, strength: 4, pool: 0 };
  const resolved = resolveDiceFieldFormula(fields[3], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolved, '4d6kh4');
});

test('Dice Formula accepts computed Number/Rating dependencies and numeric properties in structured Fields', () => {
  const fields = [
    { key: 'base', label: 'Base', type: 'number' },
    { key: 'strength', label: 'Strength', type: 'number', formula: 'floor(base / 2) + 1' },
    { key: 'slots', label: 'Slots', type: 'counters' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '({strength}+{slots.0.max})d6kh{slots.0.used}' },
  ];
  const sample = { base: 5, strength: 0, slots: [{ used: 2, max: 4 }] };
  const resolved = resolveDiceFieldFormula(fields[3], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolved, '7d6kh2');
});

test('Dice Formula accepts Table cell references and uses the same displayed cell value as Number Formula', () => {
  const fields = [
    { key: 'scores', label: 'Scores storage', type: 'scores', forgeInternal: 'table-storage' },
    { key: 'power', label: 'Power', type: 'number', formula: 'value + 1' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '{scores.row2.power}d6kh{scores.row2.power}' },
  ];
  const layout = { maxColumns: 12, blocks: [{ id: 'scores-block', type: 'scores', field: 'scores', fields: ['power'] }] };
  const tableReferences = tableCellReferenceIndex(layout.blocks);
  const sample = {
    scores: {
      format: 'statblock-forge-table-rows-v1', firstRowLabel: '',
      extraRows: [{ label: 'Second', values: { power: 3 } }],
    },
    power: 9,
  };
  const resolved = resolveDiceFieldFormula(fields[2], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields, tableReferences, sample));
  assert.equal(resolved, '4d6kh4');
});

test('Dice Formula supports bare Field keys and @ references, preserving labels and dice modifiers', () => {
  const fields = [
    { key: 'strength', label: 'Strength', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '(strength)d@strength+1[fire]' },
  ];
  const sample = { strength: 4 };
  assert.equal(isDiceFieldFormulaSyntaxValid(fields[1].diceFormula, fields), true);
  const resolved = resolveDiceFieldFormula(fields[1], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolved, '4d4+1[fire]');
});

test('Dice Formula dependency tracking and renaming include dotted references and Table columns', () => {
  const fields = [
    { key: 'traits', label: 'Traits', type: 'checkboxes' },
    { key: 'scores', label: 'Scores', type: 'scores', forgeInternal: 'table-storage' },
    { key: 'power', label: 'Power', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '{traits.flying}d{scores.row2.power}kh{power}' },
  ];
  const template = { format: 'atlas-statblock-template', version: 1, id: 'test', fields,
    layout: { maxColumns: 12, blocks: [] }, sample: {} };
  assert.equal(findFieldReferences(template, 'traits').some((ref) => ref.property === 'diceFormula'), true);
  assert.equal(findFieldReferences(template, 'power').some((ref) => ref.property === 'diceFormula'), true);
  renameTemplateFieldKey(template, 'traits', 'features');
  renameTemplateFieldKey(template, 'power', 'might');
  assert.equal(fields[3].diceFormula, '{features.flying}d{scores.row2.might}kh{might}');
  assert.equal(findFieldReferences(template, 'features').some((ref) => ref.property === 'diceFormula'), true);
  assert.equal(findFieldReferences(template, 'might').some((ref) => ref.property === 'diceFormula'), true);
});

test('Dice Field formulas evaluate arithmetic expressions in keep/drop and other numeric modifiers', () => {
  const fields = [
    { key: 'strength', label: 'Strength', type: 'number' },
    { key: 'skill', label: 'Skill', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '8d6kh({strength} + {skill})' },
  ];
  const sample = { strength: 3, skill: 2 };
  const resolved = resolveDiceFieldFormula(fields[2], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(isDiceFieldFormulaSyntaxValid(fields[2].diceFormula), true);
  assert.equal(resolved, '8d6kh5');
  fields[2].diceFormula = '8d6dl({strength} - 1)';
  assert.equal(resolveDiceFieldFormula(fields[2], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula)), '8d6dl2');
});

test('Dice Formula accepts multiline text and resolves line breaks as formula whitespace', () => {
  const fields = [
    { key: 'strength', label: 'Strength', type: 'number' },
    { key: 'skill', label: 'Skill', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice' },
  ];
  const sample = { strength: 2, skill: 1 };
  const formula = '({strength} * {strength}\n  + {skill})d6kh(\n  {strength} + 1\n)';
  fields[2].diceFormula = formula;
  const resolved = resolveDiceFieldFormula(fields[2], fields, sample, (sourceField) =>
    calculateNumericFieldValue(sourceField, sample, evaluatePreviewFormula));
  assert.equal(isDiceFieldFormulaSyntaxValid(formula, fields), true);
  assert.equal(resolved, '5d6kh3');
  assert.equal(fields[2].diceFormula, formula, 'resolving must preserve the original multiline text');
});

test('Dice Field formulas reject invalid or non-integer modifier expressions', () => {
  const field = { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '8d6kh(3 / 0)' };
  assert.equal(isDiceFieldFormulaSyntaxValid(field.diceFormula), false);
  assert.equal(resolveDiceFieldFormula(field, [], {}, () => null), '');
});

test('Dice Field formulas evaluate comparison thresholds in reroll, explosion, and tally modifiers', async () => {
  const fields = [
    { key: 'difficulty', label: 'Difficulty', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '4d6r>=({difficulty} + 1)x>=({difficulty} * 2)' },
  ];
  const sample = { difficulty: 3 };
  const resolved = resolveDiceFieldFormula(fields[1], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(isDiceFieldFormulaSyntaxValid(fields[1].diceFormula), true);
  assert.equal(resolved, '4d6r>=4x>=6');
  const parsed = (await import('../src/statblocks/diceFieldEditorModel.ts')).parseDiceField(resolved);
  assert.equal(parsed?.terms[0]?.reroll?.when.value, 4);
  assert.equal(parsed?.terms[0]?.explode?.highFaces, 1);
});

test('Dice Field formulas evaluate arithmetic success and failure counting thresholds', async () => {
  const fields = [
    { key: 'difficulty', label: 'Difficulty', type: 'number' },
    { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '4d6cs>=({difficulty} + 1)' },
  ];
  const sample = { difficulty: 3 };
  const resolved = resolveDiceFieldFormula(fields[1], fields, sample, (field) =>
    calculateNumericFieldValue(field, sample, evaluatePreviewFormula));
  assert.equal(resolved, '4d6cs>=4');
  const parsed = (await import('../src/statblocks/diceFieldEditorModel.ts')).parseDiceField(resolved);
  assert.equal(parsed?.terms[0]?.tally?.when.value, 4);
});
