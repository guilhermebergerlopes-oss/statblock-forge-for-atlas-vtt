import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diceAverageHint,
  isDiceFieldValue,
  parseDiceAverage,
  parseDiceField,
} from '../src/statblocks/diceFieldEditorModel.ts';

const supportedFormulas = [
  '2d6+3',
  '(2d6+3)*2',
  '4d6r1',
  '2d6!',
  '4d6kh3',
  '2d20kl1',
  '8d10cs>=8',
  '2d6[fire]',
  'd%',
  '3dF',
  '2d6/2',
];

test('Dice Field validation accepts every formula feature supported by the roll parser', () => {
  for (const formula of supportedFormulas) {
    assert.equal(isDiceFieldValue(formula), true, `${formula} should be valid`);
    const parsed = parseDiceField(formula);
    assert.equal(parsed?.ok, true, `${formula} should produce a parsed formula`);
  }
});

test('Dice Field validation accepts numeric statblock references alongside dice', () => {
  assert.equal(isDiceFieldValue('2d6+@damage'), true);
  assert.equal(isDiceFieldValue('2d6+@attributes.damage'), true);
  assert.equal(isDiceFieldValue('@damage'), false, 'a constant reference alone is not a dice field');
});

test('Dice Field validation rejects malformed notation and engine-limit violations', () => {
  const invalidFormulas = [
    'Damage 2d6',
    '2d0',
    '101d6',
    '4d6kh0',
    'd20++2',
    '2d6[an excessively long label]',
    '2d6/0',
    '2d6 +',
    '',
  ];
  for (const formula of invalidFormulas) {
    assert.equal(isDiceFieldValue(formula), false, `${formula} should be invalid`);
  }
});

test('average hints remain available for ordinary additive dice formulas', () => {
  assert.deepEqual(parseDiceAverage('2d6+3'), { average: 10, diceCount: 2 });
  assert.deepEqual(parseDiceAverage('2d6-1d4'), { average: 4.5, diceCount: 3 });
  assert.equal(diceAverageHint('2d6+3'), 'avg 10');
});

test('average hints are suppressed when modifiers or arithmetic make the simple estimate unreliable', () => {
  for (const formula of ['4d6r1', '2d6!', '4d6kh3', '8d10cs>=8', '(2d6+3)*2', '2d6/2']) {
    assert.equal(parseDiceAverage(formula), null, `${formula} should not show a simple average`);
    assert.equal(diceAverageHint(formula), null, `${formula} should not show an average hint`);
  }
});

test('Fate and percentile dice are valid and ordinary additive averages remain bounded hints', () => {
  assert.deepEqual(parseDiceAverage('3dF'), { average: 0, diceCount: 3 });
  assert.deepEqual(parseDiceAverage('d%'), { average: 50.5, diceCount: 1 });
  assert.equal(diceAverageHint('3dF'), 'avg 0');
  assert.equal(diceAverageHint('d%'), 'avg 50.5');
});

test('the editor normalizes the same Unicode arithmetic signs as the roll-link parser', () => {
  assert.equal(isDiceFieldValue('2d6 − 1'), true);
  assert.equal(isDiceFieldValue('(2d6+1) × 2'), true);
  assert.equal(isDiceFieldValue('2d6 + -1'), true);
});

test('references suppress average hints because their runtime values are not known in the editor', () => {
  assert.equal(diceAverageHint('2d6+@damage'), null);
});
