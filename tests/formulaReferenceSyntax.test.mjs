import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePreviewFormula } from '../src/render/previewValueModel.ts';
import { calculateNumericFieldValue } from '../src/templates/numericFieldModel.ts';
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

test('bare value reads the current slot while {value} explicitly reads a Field named value', () => {
  const fields = [
    { key: 'value', label: 'Value', type: 'number' },
    { key: 'mod', label: 'Mod', type: 'number' },
  ];
  const sample = { value: 10, mod: null };
  assert.equal(evaluatePreviewFormula('floor(({value}-10)/2)', sample, null, fields), 0);
  assert.equal(evaluatePreviewFormula('floor(({value}-10)/2)', { ...sample, value: 15 }, null, fields), 2);
  assert.equal(evaluatePreviewFormula('value + 2', sample, 7, fields), 9,
    'the unbraced keyword still reads the target cell’s original stored value');
});

test('references to Number and Rating Fields use their displayed formula result, not their stored input', async () => {
  const { calculateNumericFieldValue } = await import('../src/templates/numericFieldModel.ts');
  const fields = [
    { key: 'base', label: 'Base', type: 'number' },
    { key: 'strength', label: 'Strength', type: 'number', formula: 'floor((value - 10) / 2)' },
    { key: 'attack', label: 'Attack', type: 'number', formula: '{strength} + 4' },
    { key: 'rating', label: 'Rating', type: 'rating', formula: 'value / 2' },
    { key: 'rating_total', label: 'Rating total', type: 'number', formula: '{rating} * 4' },
  ];
  const sample = { base: 0, strength: 18, attack: 999, rating: '1/2', rating_total: 999 };
  const evaluate = (formula, values, slotValue) => evaluatePreviewFormula(formula, values, slotValue, fields);

  assert.equal(evaluate('{strength}', sample, undefined), 4);
  assert.equal(calculateNumericFieldValue(fields[2], sample, evaluate), 8);
  assert.equal(calculateNumericFieldValue(fields[4], sample, evaluate), 1);
  assert.equal(sample.strength, 18, 'resolving a displayed value must not overwrite the source input');
  assert.equal(sample.attack, 999, 'resolving a dependent Field must not overwrite its source input');
});

test('a Field formula reads its own stored input while external references read its displayed result', () => {
  const fields = [
    { key: 'strength', label: 'Strength', type: 'number', formula: '{strength} + 2' },
    { key: 'attack', label: 'Attack', type: 'number', formula: '{strength} + 4' },
    { key: 'rating', label: 'Rating', type: 'rating', formula: '{rating} * 2' },
    { key: 'self_at', label: 'Self @', type: 'number', formula: '@self_at + 2' },
    { key: 'self_bare', label: 'Self bare', type: 'number', formula: 'self_bare + 2' },
  ];
  const sample = { strength: 18, attack: 999, rating: '1/2', self_at: 5, self_bare: 7 };
  const evaluate = (formula, values, slotValue, selfFieldKey) =>
    evaluatePreviewFormula(formula, values, slotValue, fields, {}, values, selfFieldKey);

  assert.equal(calculateNumericFieldValue(fields[0], sample, evaluate), 20,
    'an explicit self-reference uses Strength input 18, then adds 2');
  assert.equal(calculateNumericFieldValue(fields[1], sample, evaluate), 24,
    'Attack references Strength from outside and therefore uses its displayed result 20');
  assert.equal(calculateNumericFieldValue(fields[2], sample, evaluate), 1,
    'a self-reference to a fractional Rating uses its numeric input 0.5');
  assert.equal(calculateNumericFieldValue(fields[3], sample, evaluate), 7,
    'the @ spelling also uses the current Field input');
  assert.equal(calculateNumericFieldValue(fields[4], sample, evaluate), 9,
    'a bare key matching the current Field also uses its input');
  assert.equal(sample.strength, 18);
  assert.equal(sample.rating, '1/2');
});

test('passing evaluatePreviewFormula directly keeps self references on the source input', () => {
  const field = { key: 'armor', label: 'Armor', type: 'number', formula: '{armor} + 3' };
  assert.equal(calculateNumericFieldValue(field, { armor: 12 }, evaluatePreviewFormula), 15);
});

test('calculated Field references resolve chains and reject circular formulas', async () => {
  const { calculateNumericFieldValue } = await import('../src/templates/numericFieldModel.ts');
  const fields = [
    { key: 'raw', label: 'Raw', type: 'number' },
    { key: 'first', label: 'First', type: 'number', formula: 'value + 2' },
    { key: 'second', label: 'Second', type: 'number', formula: '{first} * 3' },
    { key: 'cycle_a', label: 'Cycle A', type: 'number', formula: '{cycle_b} + 1' },
    { key: 'cycle_b', label: 'Cycle B', type: 'number', formula: '{cycle_a} + 1' },
  ];
  const sample = { raw: 0, first: 5, second: 999, cycle_a: 10, cycle_b: 20 };
  const evaluate = (formula, values, slotValue) => evaluatePreviewFormula(formula, values, slotValue, fields);

  assert.equal(calculateNumericFieldValue(fields[2], sample, evaluate), 21);
  assert.equal(calculateNumericFieldValue(fields[3], sample, evaluate), null);
  assert.equal(calculateNumericFieldValue(fields[4], sample, evaluate), null);
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

test('Rest formulas use displayed Number/Rating results when one formula references another', () => {
  const chainedTemplate = {
    ...structuredClone(template),
    fields: [
      { key: 'strength', label: 'Strength', type: 'number', formula: 'floor((value - 10) / 2)' },
      { key: 'proficiency', label: 'Proficiency', type: 'number', formula: '{strength} + 2' },
    ],
    sample: { strength: 18, proficiency: 999 },
  };
  assert.deepEqual(fillRestFormula('{proficiency}d4', chainedTemplate, chainedTemplate.sample).ok, true);
  assert.equal(fillRestFormula('{proficiency}d4', chainedTemplate, chainedTemplate.sample).formula, '6d4',
    'Rest uses Proficiency display value 6, derived from Strength display value 4');
});

test('Rest formulas do not fall back to a raw input when the referenced Field has no displayed result', () => {
  const invalidTemplate = {
    ...structuredClone(template),
    fields: [
      { key: 'strength', label: 'Strength', type: 'number', formula: '{missing_field} + 2' },
    ],
    sample: { strength: 18 },
  };
  const result = fillRestFormula('{strength}d4', invalidTemplate, invalidTemplate.sample);
  assert.equal(result.ok, false, 'an unavailable displayed result must not expose the stored input 18');
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

test('Selection options can be referenced as per-option booleans in numeric formulas', async () => {
  const { selectionOptionReferences } = await import('../src/templates/selectionFieldModel.ts');
  const selection = {
    key: 'stance', label: 'Stance', type: 'choice',
    options: ['Aggressive', 'Defensive', 'Visão Noturna'],
  };
  const references = selectionOptionReferences(selection);
  assert.deepEqual(references.map((item) => item.key), ['aggressive', 'defensive', 'visao_noturna']);

  const fields = [selection, { key: 'attack', label: 'Attack', type: 'number' }];
  const selected = { stance: 'Aggressive', attack: 4 };
  assert.equal(evaluatePreviewFormula('@stance.aggressive', selected, undefined, fields), 1);
  assert.equal(evaluatePreviewFormula('stance.defensive', selected, undefined, fields), 0);
  assert.equal(evaluatePreviewFormula('{stance.visao_noturna}', selected, undefined, fields), 0);
  assert.equal(evaluatePreviewFormula('@stance', selected, undefined, fields), 1, 'the Field itself is true when any option is selected');
  assert.equal(evaluatePreviewFormula('@attack + @stance.aggressive * 3', selected, undefined, fields), 7);
  assert.equal(evaluatePreviewFormula('@stance.aggressive', { stance: '' }, undefined, fields), 0);
  assert.equal(evaluatePreviewFormula('@stance', { stance: '' }, undefined, fields), 0);
});

test('Selection boolean references support multi-pick and numbered values', async () => {
  const { selectionOptionReferences } = await import('../src/templates/selectionFieldModel.ts');
  const selection = {
    key: 'languages', label: 'Languages', type: 'choice', several: true,
    options: ['Common', 'Elvish', 'Draconic'],
  };
  const fields = [selection];
  assert.equal(evaluatePreviewFormula('@languages.common', { languages: ['Common', 'Elvish'] }, undefined, fields), 1);
  assert.equal(evaluatePreviewFormula('@languages.draconic', { languages: ['Common', 'Elvish'] }, undefined, fields), 0);
  assert.equal(evaluatePreviewFormula('@languages.elvish + @languages.common', { languages: 'Common, Elvish' }, undefined, fields), 2);

  const numbered = { ...selection, several: false, numbered: true };
  assert.equal(evaluatePreviewFormula('@languages.common', { languages: 'Common 60' }, undefined, [numbered]), 1);
  assert.equal(evaluatePreviewFormula('@languages.common', { languages: 'Common 0' }, undefined, [numbered]), 1,
    'a zero-number pick is still selected; its numeric reference is zero');
  assert.equal(evaluatePreviewFormula('@languages.common.number', { languages: 'Common 60' }, undefined, [numbered]), 60);
  assert.equal(evaluatePreviewFormula('@languages.common.number', { languages: 'Common' }, undefined, [numbered]), 0,
    'a pick can be selected without having a number yet');
  assert.equal(selectionOptionReferences(numbered).length, 3);

  const numberedSeveral = { ...selection, numbered: true, unit: 'ft.' };
  const numberedValues = { languages: 'Common 60 ft., Elvish 30 ft.' };
  assert.equal(evaluatePreviewFormula('@languages.common', numberedValues, undefined, [numberedSeveral]), 1);
  assert.equal(evaluatePreviewFormula('@languages.elvish', numberedValues, undefined, [numberedSeveral]), 1);
  assert.equal(evaluatePreviewFormula('@languages.draconic', numberedValues, undefined, [numberedSeveral]), 0);
  assert.equal(evaluatePreviewFormula('@languages.common.number + @languages.elvish.number', numberedValues, undefined, [numberedSeveral]), 90);
  const mixedNumberedValues = { languages: 'Common, Elvish 30 ft.' };
  assert.equal(evaluatePreviewFormula('@languages.common', mixedNumberedValues, undefined, [numberedSeveral]), 1,
    'a pick without a number remains selected in multi-pick mode');
  assert.equal(evaluatePreviewFormula('@languages.common.number', mixedNumberedValues, undefined, [numberedSeveral]), 0,
    'a pick without a number contributes zero to its numeric reference');
  assert.equal(evaluatePreviewFormula('@languages.elvish.number', mixedNumberedValues, undefined, [numberedSeveral]), 30);
});

test('Number/Rating formula evaluation receives Selection metadata for boolean option references', async () => {
  const { calculateNumericFieldValue } = await import('../src/templates/numericFieldModel.ts');
  const fields = [
    { key: 'stance', label: 'Stance', type: 'choice', options: ['Guarded', 'Focused'] },
    { key: 'defense', label: 'Defense', type: 'number', formula: '10 + @stance.guarded * 2' },
  ];
  const field = fields[1];
  const evaluate = (formula, sample, slotValue) => evaluatePreviewFormula(formula, sample, slotValue, fields);
  assert.equal(calculateNumericFieldValue(field, { stance: 'Guarded' }, evaluate), 12);
  assert.equal(calculateNumericFieldValue(field, { stance: 'Focused' }, evaluate), 10);
});

test('Selection option formula dependencies follow Field key renames', () => {
  const localTemplate = {
    format: 'atlas-statblock-template', version: 1, id: 'selection-rename-test',
    fields: [
      { key: 'stance', label: 'Stance', type: 'choice', options: ['Aggressive', 'Defensive'] },
      { key: 'attack', label: 'Attack', type: 'number', formula: '4 + @stance.aggressive * 2' },
    ],
    layout: { maxColumns: 12, blocks: [] },
    sample: { stance: 'Aggressive', attack: 6 },
  };
  assert.equal(findFieldReferences(localTemplate, 'stance').some((item) => item.property === 'formula'), true);
  renameTemplateFieldKey(localTemplate, 'stance', 'combat_mode');
  assert.equal(localTemplate.fields[1].formula, '4 + @combat_mode.aggressive * 2');
  assert.equal(evaluatePreviewFormula(localTemplate.fields[1].formula, localTemplate.sample, undefined, localTemplate.fields), 6);
});

test('Selection formula option keys disambiguate different labels with the same normalized slug', async () => {
  const { selectionOptionReferences } = await import('../src/templates/selectionFieldModel.ts');
  const field = { key: 'movement', label: 'Movement', type: 'choice', options: ['Night-Vision', 'Night Vision'] };
  const refs = selectionOptionReferences(field);
  assert.deepEqual(refs.map((option) => option.key), ['night_vision', 'night_vision_2']);
  const fields = [field];
  assert.equal(evaluatePreviewFormula('@movement.night_vision', { movement: 'Night Vision' }, undefined, fields), 0);
  assert.equal(evaluatePreviewFormula('@movement.night_vision_2', { movement: 'Night Vision' }, undefined, fields), 1);
});


test('Number/Rating formulas resolve complete Counter rows, aliases, totals, and preset defaults', async () => {
  const fields = [
    { key: 'spell_slots', label: 'Spell Slots', type: 'counters', counterRows: [
      { name: 'First Circle', max: 4 },
      { name: 'Second Circle', max: 3 },
      { name: 'Hidden row', max: 0 },
    ] },
    { key: 'remaining_first', label: 'Remaining first', type: 'number', formula: '{spell_slots.0.remaining}' },
    { key: 'remaining_total', label: 'Remaining total', type: 'number', formula: '@spell_slots.total.available' },
  ];
  const sample = {
    spell_slots: [
      { max: 4, used: 2 },
      { max: 3, used: 1 },
      { max: 0, used: 0 },
    ],
    remaining_first: 999,
    remaining_total: 999,
  };
  const evaluate = (formula, values, slotValue, selfFieldKey) =>
    evaluatePreviewFormula(formula, values, slotValue, fields, {}, values, selfFieldKey);

  assert.equal(evaluate('{spell_slots.0.max}', sample, undefined), 4);
  assert.equal(evaluate('@spell_slots.0.used', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.0.spent}', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.0.remaining}', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.0.current}', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.0.available}', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.total.max}', sample, undefined), 7);
  assert.equal(evaluate('{spell_slots.total.used}', sample, undefined), 3);
  assert.equal(evaluate('{spell_slots.total.spent}', sample, undefined), 3);
  assert.equal(evaluate('{spell_slots.total.remaining}', sample, undefined), 4);
  assert.equal(evaluate('{spell_slots.total.current}', sample, undefined), 4);
  assert.equal(evaluate('{spell_slots.total.available}', sample, undefined), 4);
  assert.equal(evaluate('{spell_slots.count}', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.total.count}', sample, undefined), 2);
  assert.equal(evaluate('{spell_slots.max}', sample, undefined), 7,
    'root aggregate aliases provide a shorter form when no individual row is needed');
  assert.equal(evaluate('{spell_slots.remaining}', sample, undefined), 4);
  assert.equal(evaluate('{spell_slots.spent}', sample, undefined), 3);
  assert.equal(evaluate('{spell_slots.0.percent}', sample, undefined), 50);
  assert.equal(evaluate('{spell_slots.0.remaining_percent}', sample, undefined), 50);
  assert.equal(evaluate('{spell_slots.0.availablePercent}', sample, undefined), 50);
  assert.equal(evaluate('{spell_slots.0.currentPercent}', sample, undefined), 50);
  assert.equal(evaluate('{spell_slots.0.spentPercent}', sample, undefined), 50);
  assert.equal(evaluate('{spell_slots.0.used_percent}', sample, undefined), 50);
  assert.equal(evaluate('{spell_slots.0.isFull}', sample, undefined), 0);
  assert.equal(evaluate('{spell_slots.0.isEmpty}', sample, undefined), 0);
  assert.equal(evaluate('{spell_slots.1.remainingPercent}', sample, undefined), (2 / 3) * 100);
  assert.equal(evaluate('{spell_slots.total.remainingPercent}', sample, undefined), (4 / 7) * 100);
  assert.equal(evaluate('{spell_slots.total.spentPercent}', sample, undefined), (3 / 7) * 100);
  assert.equal(evaluate('{spell_slots.total.isFull}', sample, undefined), 0);
  assert.equal(evaluate('{spell_slots.total.isEmpty}', sample, undefined), 0);
  assert.equal(evaluate('{spell_slots.remaining_percent}', sample, undefined), (4 / 7) * 100);
  assert.equal(evaluate('{spell_slots.remainingPercent}', sample, undefined), (4 / 7) * 100);
  assert.equal(evaluate('{spell_slots.isFull}', sample, undefined), 0);
  assert.equal(evaluate('{spell_slots.count}', sample, undefined), 2);
  assert.equal(calculateNumericFieldValue(fields[1], sample, evaluate), 2);
  assert.equal(calculateNumericFieldValue(fields[2], sample, evaluate), 4);
  assert.deepEqual(sample.spell_slots, [
    { max: 4, used: 2 }, { max: 3, used: 1 }, { max: 0, used: 0 },
  ], 'resolving formulas must not mutate Counter state');

  const defaultsOnly = {};
  assert.equal(evaluatePreviewFormula('{spell_slots.0.remaining}', defaultsOnly, undefined, fields), 4,
    'unmaterialized rows use Template presets and begin with zero spent uses');
  assert.equal(evaluatePreviewFormula('{spell_slots.total.remaining}', defaultsOnly, undefined, fields), 7);
  assert.equal(evaluatePreviewFormula('{spell_slots.0.isFull}', defaultsOnly, undefined, fields), 1);
  assert.equal(evaluatePreviewFormula('{spell_slots.0.isEmpty}', defaultsOnly, undefined, fields), 0);

  const exhausted = { spell_slots: [{ max: 4, used: 4 }, { max: 3, used: 3 }, { max: 0, used: 0 }] };
  assert.equal(evaluate('{spell_slots.0.isEmpty}', exhausted, undefined), 1);
  assert.equal(evaluate('{spell_slots.total.isEmpty}', exhausted, undefined), 1);
  assert.equal(evaluate('{spell_slots.total.isFull}', exhausted, undefined), 0);
  assert.equal(evaluate('{spell_slots.0.percent}', { spell_slots: [{ max: 0, used: 0 }] }, undefined), null,
    'hidden zero-maximum rows do not have a percentage');
});

test('Dice Formula can build dynamic dice expressions from Counter remaining, spent, and totals', () => {
  const fields = [
    { key: 'uses', label: 'Uses', type: 'counters', counterRows: [
      { name: 'Focus', max: 5 }, { name: 'Charges', max: 2 },
    ] },
    { key: 'cast', label: 'Cast', type: 'dice', diceFormula: '{uses.total.remaining}d{uses.0.max}kh{uses.0.available}' },
  ];
  const sample = { uses: [{ max: 5, used: 2 }, { max: 2, used: 1 }] };
  const resolved = resolveDiceFieldFormula(fields[1], fields, sample, undefined, (reference) =>
    evaluatePreviewFormula(`{${reference}}`, sample, undefined, fields));
  assert.equal(resolved, '4d5kh3');
});

test('Rest formulas and Counter regain formulas can read effective Counter references', async () => {
  const localTemplate = {
    ...structuredClone(template),
    fields: [
      { key: 'spell_slots', label: 'Spell Slots', type: 'counters', counterRows: [
        { name: 'First Circle', max: 4 }, { name: 'Second Circle', max: 3 },
      ] },
    ],
    sample: { spell_slots: [{ max: 4, used: 2 }, { max: 3, used: 1 }] },
  };
  const filled = fillRestFormula('{spell_slots.0.remaining}d4+@spell_slots.total.used', localTemplate, localTemplate.sample);
  assert.equal(filled.ok, true);
  assert.equal(filled.formula, '2d4+(3)');
  assert.deepEqual(evaluateRestFormula('@spell_slots.total.remaining', localTemplate, localTemplate.sample, 'Counter reference'), { value: 4 });

  const { isCounterRegainFormula } = await import('../src/statblocks/counterRegainModel.ts');
  assert.equal(isCounterRegainFormula('{spell_slots.0.remaining}d4'), true);
  let rolled = '';
  const result = evaluateRestFormula('{spell_slots.0.remaining}d4', localTemplate, localTemplate.sample, 'Counter regain', (formula) => {
    rolled = formula;
    return 2;
  });
  assert.deepEqual(result, { value: 2 });
  assert.equal(rolled, '2d4');
});
