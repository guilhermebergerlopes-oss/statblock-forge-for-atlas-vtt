import test from 'node:test';
import assert from 'node:assert/strict';
import { tableCellRollFormulas } from '../src/statblocks/tableCellRollsModel.ts';

test('Table cells expose explicit dice formulas and written advantage/disadvantage', () => {
  assert.deepEqual(tableCellRollFormulas('2d6+3', false), ['2d6+3']);
  assert.deepEqual(tableCellRollFormulas('1d20+5 adv', false), ['1d20+5 adv']);
  assert.deepEqual(tableCellRollFormulas('Stealth +5 dis', false), ['+5 dis']);
});

test('Table Roll as a bonus converts signed scalar values and leaves ordinary numbers alone', () => {
  assert.deepEqual(tableCellRollFormulas('+5', true), ['+5']);
  assert.deepEqual(tableCellRollFormulas('-3', true), ['-3']);
  assert.deepEqual(tableCellRollFormulas('5', false), []);
});

test('Table cell roll detection returns distinct links only once', () => {
  assert.deepEqual(tableCellRollFormulas('Attack +5, damage 2d6+3', false), ['+5', '2d6+3']);
});
