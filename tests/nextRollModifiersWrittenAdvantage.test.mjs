import assert from 'node:assert/strict';
import test from 'node:test';
import { formulaWithNextRollModifiers } from '../src/statblocks/nextRollModifiers.ts';

const add = [{ key: 'bonus', formula: '+2', label: 'Might' }];

test('next-roll formula composition keeps a written side at the end', () => {
  assert.equal(formulaWithNextRollModifiers('1d20+3 adv', add), '1d20+3+2[Might] adv');
  assert.equal(formulaWithNextRollModifiers('+3 dis', add, '1d20'), '+3+2[Might] dis');
});

test('opposite sides from the base formula and queued modifiers cancel', () => {
  const queued = [{ key: 'roll', formula: '1d4 dis', label: 'Bane' }];
  assert.equal(formulaWithNextRollModifiers('1d20+3 adv', queued), '1d20+3+(1d4)');
});
