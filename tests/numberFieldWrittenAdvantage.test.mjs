import assert from 'node:assert/strict';
import test from 'node:test';
import {
  numberFieldAdvantageRollFormula,
  parseInlineNumericFieldDraft,
} from '../src/statblocks/inlineNumericFieldEditorModel.ts';
import {
  parseStatblockFieldEditorValue,
  statblockFieldEditorInitialValue,
} from '../src/statblocks/statblockFieldEditorModel.ts';

const numberField = { key: 'attack', label: 'Attack', type: 'number' };

test('Number Values accept valid dice expressions ending in adv/dis without numeric coercion', () => {
  for (const value of ['1d20+5 adv', '1d20+5 dis', '+5 adv', '-2 dis']) {
    assert.equal(parseInlineNumericFieldDraft(numberField, value), value);
    assert.equal(parseStatblockFieldEditorValue(numberField, 'number', value), value);
  }
});

test('bare numeric bonuses with adv/dis are normalized for the dice engine', () => {
  assert.equal(numberFieldAdvantageRollFormula('5 adv'), '+5 adv');
  assert.equal(numberFieldAdvantageRollFormula('5 dis'), '+5 dis');
  assert.equal(numberFieldAdvantageRollFormula('1d20+5 adv'), '1d20+5 adv');
});

test('Number Values keep ordinary numeric storage and reject unrelated alphabetic text', () => {
  assert.equal(parseInlineNumericFieldDraft(numberField, '12'), 12);
  assert.equal(parseInlineNumericFieldDraft(numberField, '12,5'), 12.5);
  assert.equal(numberFieldAdvantageRollFormula('high adv'), null);
  assert.equal(numberFieldAdvantageRollFormula('1d20 advantage'), null);
  assert.throws(() => parseInlineNumericFieldDraft(numberField, 'high adv'), /número válido|valid number/);
});

test('the standalone statblock value editor preserves valid adv/dis expressions as strings', () => {
  const initial = statblockFieldEditorInitialValue('number', '1d20+5 adv', 'number');
  assert.equal(initial, '1d20+5 adv');
  assert.equal(parseStatblockFieldEditorValue(numberField, 'number', initial), '1d20+5 adv');
});

test('alphabetic adv/dis values do not throw when numeric formula consumers inspect a Number Field', async () => {
  const { calculateNumericFieldValue } = await import('../src/templates/numericFieldModel.ts');
  const { evaluatePreviewFormula } = await import('../src/render/previewValueModel.ts');
  const data = { attack: '1d20+5 adv' };
  assert.equal(calculateNumericFieldValue(numberField, data, evaluatePreviewFormula), null);
  assert.equal(calculateNumericFieldValue(
    { key: 'doubleAttack', label: 'Double Attack', type: 'number', formula: '@attack * 2' },
    data,
    evaluatePreviewFormula,
  ), null);
  data.attack = '1d20+5 dis';
  assert.equal(calculateNumericFieldValue(numberField, data, evaluatePreviewFormula), null);
  assert.equal(calculateNumericFieldValue(
    { key: 'doubleAttack', label: 'Double Attack', type: 'number', formula: '@attack * 2' },
    data,
    evaluatePreviewFormula,
  ), null);
});

test('Number Field written adv/dis formulas are exposed as complete Table roll links', async () => {
  const { tableCellRollFormulas } = await import('../src/statblocks/tableCellRollsModel.ts');
  assert.deepEqual(tableCellRollFormulas(numberFieldAdvantageRollFormula('1d20+5 adv'), false), ['1d20+5 adv']);
  assert.deepEqual(tableCellRollFormulas(numberFieldAdvantageRollFormula('5 dis'), false), ['+5 dis']);
});

test('Number editor rendering keeps the written roll visible and links it without changing Rating input behavior', async () => {
  const { readFile } = await import('node:fs/promises');
  const renderer = await readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8');
  const surface = await readFile(new URL('../src/views/StatblockRenderSurface.ts', import.meta.url), 'utf8');
  assert.match(renderer, /numberFieldAdvantageRollFormula\(sample\[field\.key\]\)/);
  assert.match(renderer, /setForgeStatblockDiceLink\(value, rollFormula\)/);
  assert.match(renderer, /input\.type = field\.type === 'rating' \? 'number' : 'text'/);
  const inlineNumericEditor = renderer.slice(
    renderer.indexOf('function createInlineNumericFieldValue'),
    renderer.indexOf('function createInlineTextFieldValue'),
  );
  assert.match(inlineNumericEditor, /input\.inputMode = 'text'/, 'the inline Number editor must allow alphabetic adv/dis input on mobile keyboards');
  assert.doesNotMatch(inlineNumericEditor, /input\.inputMode = 'decimal'/);
  assert.match(surface, /control\.type = 'text'/);
});
