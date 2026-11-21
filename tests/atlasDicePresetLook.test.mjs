import assert from 'node:assert/strict';
import test from 'node:test';
import { createAtlasDicePresetLookCandidate } from '../src/atlas/atlasDicePresetLook.ts';

const namedD20 = {
  id: 'custom:ember-d20',
  name: 'Ember d20',
  builtIn: false,
  dice: [{ count: 1, sides: 20, name: 'Ember', colour: '#cc6633' }],
  crit: 'roll-under',
  explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 0 },
  advantage: { kind: 'keep' },
  disadvantage: { kind: 'die', sides: 6, name: 'Penalty', colour: '#555555' },
};

test('copies the exact active Dice Set look and rules when the formula uses its dice', () => {
  const result = createAtlasDicePresetLookCandidate('1d20 + 5', namedD20);
  assert.deepEqual(result, {
    formula: '+5',
    look: {
      dice: [{ count: 1, sides: 20, name: 'Ember', colour: '#cc6633' }],
      crit: 'roll-under',
      explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 0 },
      advantage: { kind: 'keep' },
      disadvantage: { kind: 'die', sides: 6, name: 'Penalty', colour: '#555555' },
    },
    source: 'active-dice-set',
    setName: 'Ember d20',
  });
});

test('a bare bonus becomes a preset look using the active Dice Set', () => {
  const result = createAtlasDicePresetLookCandidate('+4', namedD20);
  assert.equal(result?.formula, '+4');
  assert.equal(result?.source, 'active-dice-set');
  assert.deepEqual(result?.look.dice, namedD20.dice);
  assert.equal(result?.look.crit, 'roll-under');
  assert.equal(createAtlasDicePresetLookCandidate('+4'), null);
});

test('a simple formula with different dice creates an independent editable look', () => {
  const result = createAtlasDicePresetLookCandidate('2d6[fire] + 1d8 + 3', namedD20);
  assert.deepEqual(result, {
    formula: '+3',
    look: {
      dice: [{ count: 2, sides: 6, name: 'fire' }, { count: 1, sides: 8 }],
      crit: 'natural',
    },
    source: 'formula',
  });
});

test('simple explicit dice formulas can create a look even without an available Atlas Dice Set', () => {
  const result = createAtlasDicePresetLookCandidate('4d6kh3');
  assert.equal(result, null);
  const simple = createAtlasDicePresetLookCandidate('3d8 - 2');
  assert.deepEqual(simple, {
    formula: '-2',
    look: { dice: [{ count: 3, sides: 8 }], crit: 'natural' },
    source: 'formula',
  });
});

test('keeps written advantage, disadvantage, and non-representable modifiers as formula rolls', () => {
  for (const formula of ['1d20+5 adv', '1d20+5 dis', '4d6kh3', '2d6!', '2d6-1d4', '(1d8+2)*2', '8d10cs>=8']) {
    assert.equal(createAtlasDicePresetLookCandidate(formula, namedD20), null, formula);
  }
});

test('refuses looks outside Atlas Dice Lab group, dice, sides, and bonus limits', () => {
  assert.equal(createAtlasDicePresetLookCandidate('21d6'), null);
  assert.equal(createAtlasDicePresetLookCandidate('1d1000'), null);
  assert.equal(createAtlasDicePresetLookCandidate('1d6+100'), null);
  assert.equal(createAtlasDicePresetLookCandidate('1d6+1d8+1d10+1d12+1d20+1d100+1d4'), null);
});
