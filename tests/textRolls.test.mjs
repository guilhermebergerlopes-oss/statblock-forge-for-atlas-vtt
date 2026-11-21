import test from 'node:test';
import assert from 'node:assert/strict';
import { rollPieces, toRollFormula, writtenRoll } from '../src/statblocks/atlasDiceEngine/textRolls.ts';

function formulas(text) {
  return rollPieces(text)
    .filter((piece) => piece.formula !== null)
    .map((piece) => ({ text: piece.text, formula: piece.formula }));
}

test('running text keeps grouped arithmetic formulas together', () => {
  assert.deepEqual(rollPieces('Deals (2d6+3)*2 fire damage'), [
    { text: 'Deals ', formula: null },
    { text: '(2d6+3)*2', formula: '(2d6+3)*2' },
    { text: ' fire damage', formula: null },
  ]);

  assert.deepEqual(formulas('Deals (2d6 + 3)/2 fire damage.'), [
    { text: '(2d6 + 3)/2', formula: '(2d6+3)/2' },
  ]);
  assert.deepEqual(formulas('Damage: ((1d8 + 2) * 2) / 4.'), [
    { text: '((1d8 + 2) * 2) / 4', formula: '((1d8+2)*2)/4' },
  ]);
});

test('running text uses the full dice grammar inside expressions', () => {
  const text = 'Deal 4d6r1 fire, 2d6! cold, 4d6kh3 force, 8d10cs>=8 poison, 2d6[fire] and 3dF fate damage.';
  assert.deepEqual(formulas(text).map(({ formula }) => formula), [
    '4d6r1', '2d6!', '4d6kh3', '8d10cs>=8', '2d6[fire]', '3dF',
  ]);
  assert.deepEqual(formulas('Deal d% damage.'), [{ text: 'd%', formula: 'd%' }]);
});

test('running text keeps ordinary arithmetic and dice expressions in one link', () => {
  assert.deepEqual(formulas('Add 2 + 1d6 damage.'), [
    { text: '2 + 1d6', formula: '2+1d6' },
  ]);
  assert.deepEqual(formulas('Add 2d6 + 3d4 - 2 to the result.'), [
    { text: '2d6 + 3d4 - 2', formula: '2d6+3d4-2' },
  ]);
  assert.equal(writtenRoll('(2d6 + 3) × 2'), '(2d6+3)*2');
  assert.equal(toRollFormula('((2d6 + 3) × 2) / 4'), '((2d6+3)*2)/4');
  assert.deepEqual(formulas('Deal (2d6 − 1) × 2 damage.'), [
    { text: '(2d6 − 1) × 2', formula: '(2d6-1)*2' },
  ]);
});

test('attack bonus labels remain visible and spaced prose dashes do not become negative rolls', () => {
  assert.deepEqual(rollPieces('ATK: +4 to hit'), [
    { text: 'ATK: +4', formula: '+4' },
    { text: ' to hit', formula: null },
  ]);
  assert.deepEqual(rollPieces('Attack: +4+1 to hit'), [
    { text: 'Attack: +4+1', formula: '+4+1' },
    { text: ' to hit', formula: null },
  ]);
  assert.deepEqual(rollPieces('Very Close - 1d12+2'), [
    { text: 'Very Close - ', formula: null },
    { text: '1d12+2', formula: '1d12+2' },
  ]);
  assert.deepEqual(rollPieces('A bonus + 4 is not a signed bonus formula.'), [
    { text: 'A bonus + 4 is not a signed bonus formula.', formula: null },
  ]);
});

test('numbers in prose, decimals, identifiers and ranges are not turned into dice links', () => {
  const text = 'CR 1/4; Recharge 5-6; 3 goblins; x2d6; hd6; +5ft; +1.5; 1 + 1.';
  assert.deepEqual(rollPieces(text), [{ text, formula: null }]);
  assert.deepEqual(rollPieces('The ratio is 1.5 and the decimal is 2.25.'), [
    { text: 'The ratio is 1.5 and the decimal is 2.25.', formula: null },
  ]);
});

test('a roll joined to an unresolved statblock reference is left as plain text', () => {
  const after = 'Deals 2d6 + @int damage';
  const before = 'Deals @level d6 damage';
  assert.deepEqual(rollPieces(after), [{ text: after, formula: null }]);
  assert.deepEqual(rollPieces(before), [{ text: before, formula: null }]);
});

test('multiple roll expressions remain separate and all surrounding text is preserved', () => {
  const text = 'Deals 2d6[fire] damage and then (1d4+1)*2 cold damage.';
  const pieces = rollPieces(text);
  assert.equal(pieces.map((piece) => piece.text).join(''), text, 'linking must preserve every source character');
  assert.deepEqual(pieces, [
    { text: 'Deals ', formula: null },
    { text: '2d6[fire]', formula: '2d6[fire]' },
    { text: ' damage and then ', formula: null },
    { text: '(1d4+1)*2', formula: '(1d4+1)*2' },
    { text: ' cold damage.', formula: null },
  ]);
});

test('binary plus-minus shorthand follows the formula parser while unary signs stay attached', () => {
  assert.deepEqual(formulas('Deal 2d6 + -1 damage.'), [
    { text: '2d6 + -1', formula: '2d6-1' },
  ]);
  assert.deepEqual(formulas('Deal + 4 damage.'), []);
  assert.deepEqual(formulas('ATK: + 4 to hit'), []);
});

test('written advantage and disadvantage remain attached to statblock roll links', () => {
  assert.deepEqual(rollPieces('Stealth +5 adv'), [
    { text: 'Stealth ', formula: null },
    { text: '+5 adv', formula: '+5 adv' },
  ]);
  assert.deepEqual(rollPieces('Strike: 1d20+5 dis damage.'), [
    { text: 'Strike: ', formula: null },
    { text: '1d20+5 dis', formula: '1d20+5 dis' },
    { text: ' damage.', formula: null },
  ]);
  assert.deepEqual(rollPieces('ATK: +4 ADV'), [
    { text: 'ATK: +4 ADV', formula: '+4 ADV' },
  ]);
  assert.equal(writtenRoll('2d8 + 3 ADV'), '2d8+3 ADV');
  assert.equal(toRollFormula('(1d8 + 2) × 2 dis'), '(1d8+2)*2 dis');
});

test('advantage suffix requires its own word boundary', () => {
  assert.deepEqual(rollPieces('Roll 1d20+5 advantage now.'), [
    { text: 'Roll ', formula: null },
    { text: '1d20+5', formula: '1d20+5' },
    { text: ' advantage now.', formula: null },
  ]);
});
