import assert from 'node:assert/strict';
import test from 'node:test';
import { rollForgeOffMapDiceFormula } from '../src/statblocks/atlasOffMapDiceRoller.ts';

const D20 = {
  id: 'builtin:d20', name: 'd20', builtIn: true,
  dice: [{ count: 1, sides: 20 }], crit: 'natural',
  advantage: { kind: 'keep' }, disadvantage: { kind: 'keep' },
};
const source = { type: 'statblock', statblockPath: 'Characters/Ayla.md', tokenName: 'Ayla', abilityName: 'Attack' };
const queue = (...values) => {
  let index = 0;
  return () => values[index++] ?? 0;
};
const id = () => 'local-roll-1';

test('completes a bare modifier with the default dice and preserves source metadata', () => {
  const attempt = rollForgeOffMapDiceFormula('+4', D20, source, null, queue(0.95), 123, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.formula, '1d20+4');
  assert.equal(attempt.result.total, 24);
  assert.equal(attempt.result.crit, 'high');
  assert.equal(attempt.result.id, 'local-roll-1');
  assert.equal(attempt.result.timestamp, 123);
  assert.deepEqual(attempt.result.source, source);
  assert.equal(attempt.result.diceSet.name, 'd20');
});

test('an empty formula rolls the Dice Set default', () => {
  const attempt = rollForgeOffMapDiceFormula('', D20, source, null, queue(0.25), 1, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.formula, '1d20');
  assert.equal(attempt.result.total, 6);
});

test('written dice formulas remain written and do not inherit Dice Set appearance', () => {
  const set = { ...D20, dice: [{ count: 1, sides: 20, name: 'Fate', colour: '#123456' }] };
  const attempt = rollForgeOffMapDiceFormula('2d6+3', set, source, null, queue(0, 0.5), 2, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.formula, '2d6+3');
  assert.equal(attempt.result.rolls.every((die) => die.name === undefined && die.colour === undefined), true);
});

test('keep advantage rolls one extra default die and keeps the highest', () => {
  const attempt = rollForgeOffMapDiceFormula('d20+2', D20, source, 'advantage', queue(0.15, 0.85), 3, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.total, 20);
  assert.equal(attempt.result.advantage, 'advantage');
  assert.equal(attempt.result.rolls.length, 2);
  assert.equal(attempt.result.rolls.filter((die) => die.dropped).length, 1);
});

test('keep disadvantage rolls one extra default die and keeps the lowest', () => {
  const attempt = rollForgeOffMapDiceFormula('d20', D20, source, 'disadvantage', queue(0.85, 0.05), 4, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.total, 2);
  assert.equal(attempt.result.advantage, 'disadvantage');
  assert.equal(attempt.result.rolls.filter((die) => die.dropped).length, 1);
});

test('roll-under advantage keeps the lowest result', () => {
  const set = { ...D20, id: 'builtin:d20-roll-under', name: 'd20 roll-under', crit: 'roll-under' };
  const attempt = rollForgeOffMapDiceFormula('d20', set, source, 'advantage', queue(0.9, 0.05), 5, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.total, 2);
  assert.equal(attempt.result.rolls.filter((die) => die.dropped).length, 1);
});

test('Draw Steel number advantage and disadvantage add or subtract two', () => {
  const set = {
    id: 'builtin:power-roll', name: 'Power roll', builtIn: true,
    dice: [{ count: 2, sides: 10 }], crit: 'high-total',
    advantage: { kind: 'number', value: 2 }, disadvantage: { kind: 'number', value: 2 },
  };
  const advantage = rollForgeOffMapDiceFormula('2d10', set, source, 'advantage', queue(0.2, 0.2), 6, id);
  const disadvantage = rollForgeOffMapDiceFormula('2d10', set, source, 'disadvantage', queue(0.2, 0.2), 7, id);
  assert.equal(advantage.ok && advantage.result.total, 8);
  assert.equal(disadvantage.ok && disadvantage.result.total, 4);
});

test('die advantage adds an identified extra die to the total', () => {
  const set = {
    ...D20, advantage: { kind: 'die', sides: 6, name: 'Edge', colour: '#abcdef' },
  };
  const attempt = rollForgeOffMapDiceFormula('d20+1', set, source, 'advantage', queue(0.2, 0.5), 8, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.total, 10);
  const bonus = attempt.result.rolls.find((die) => die.advantage);
  assert.equal(bonus?.name, 'Edge');
  assert.equal(bonus?.colour, '#abcdef');
});

test('d100 tens-only advantage shares the units digit and keeps the lowest for roll-under', () => {
  const set = {
    id: 'builtin:d100-roll-under', name: 'd100 roll-under', builtIn: true,
    dice: [{ count: 1, sides: 100 }], crit: 'roll-under',
    advantage: { kind: 'keep', tensOnly: true }, disadvantage: { kind: 'keep', tensOnly: true },
  };
  const attempt = rollForgeOffMapDiceFormula('d100', set, source, 'advantage', queue(0.44, 0.09), 9, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.rolls.length, 2);
  assert.equal(attempt.result.rolls[1]?.sharedUnits, true);
  assert.equal(attempt.result.total, 5);
});

test('the set explosion rule applies to default dice and records exploded dice', () => {
  const set = {
    id: 'builtin:d10-exploding', name: 'd10 exploding', builtIn: true,
    dice: [{ count: 1, sides: 10 }], crit: 'natural',
    explode: { dice: 'default', repeats: false, highFaces: 1, lowFaces: 1 },
  };
  const attempt = rollForgeOffMapDiceFormula('d10', set, source, null, queue(0.99, 0.2), 10, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.total, 13);
  assert.equal(attempt.result.rolls.some((die) => die.exploded), true);
});

test('critical rules distinguish natural, doubles, high-total and disabled criticals', () => {
  const doubles = { ...D20, dice: [{ count: 2, sides: 6 }], crit: 'doubles' };
  const highTotal = { ...D20, dice: [{ count: 2, sides: 10 }], crit: 'high-total' };
  const none = { ...D20, crit: 'none' };
  assert.equal(rollForgeOffMapDiceFormula('2d6', doubles, source, null, queue(0.5, 0.5), 11, id).ok && rollForgeOffMapDiceFormula('2d6', doubles, source, null, queue(0.5, 0.5), 11, id).result.crit, 'high');
  const high = rollForgeOffMapDiceFormula('2d10', highTotal, source, null, queue(0.99, 0.99), 12, id);
  assert.equal(high.ok && high.result.crit, 'high');
  const noCrit = rollForgeOffMapDiceFormula('d20', none, source, null, queue(0.99), 13, id);
  assert.equal(noCrit.ok && noCrit.result.crit, null);
});

test('invalid formulas are refused before randomness is consumed', () => {
  let calls = 0;
  const attempt = rollForgeOffMapDiceFormula('d20++3', D20, source, null, () => { calls++; return 0.5; }, 14, id);
  assert.deepEqual(attempt, { ok: false, error: 'syntax' });
  assert.equal(calls, 0);
});

test('the off-map roller reports unavailable secure randomness instead of using an insecure fallback', () => {
  const attempt = rollForgeOffMapDiceFormula('d20', D20, source, null, () => { throw new Error('random-unavailable'); }, 15, () => { throw new Error('random-unavailable'); });
  assert.deepEqual(attempt, { ok: false, error: 'random-unavailable' });
});


test('written adv and dis use the configured Dice Set rules without click modifiers', () => {
  const advantage = rollForgeOffMapDiceFormula('d20+2 adv', D20, source, null, queue(0.15, 0.85), 16, id);
  const disadvantage = rollForgeOffMapDiceFormula('d20 dis', D20, source, null, queue(0.85, 0.05), 17, id);
  assert.equal(advantage.ok, true);
  assert.equal(advantage.result.total, 20);
  assert.equal(advantage.result.advantage, 'advantage');
  assert.equal(disadvantage.ok, true);
  assert.equal(disadvantage.result.total, 2);
  assert.equal(disadvantage.result.advantage, 'disadvantage');
});

test('a written side and an opposite click side cancel on off-map rolls', () => {
  const attempt = rollForgeOffMapDiceFormula('d20+2 adv', D20, source, 'disadvantage', queue(0.5), 18, id);
  assert.equal(attempt.ok, true);
  assert.equal(attempt.result.total, 13);
  assert.equal(attempt.result.advantage, undefined);
  assert.equal(attempt.result.rolls.length, 1);
});

test('a written side is rejected when the active Dice Set cannot apply it', () => {
  const set = { ...D20, advantage: undefined };
  const attempt = rollForgeOffMapDiceFormula('d20 adv', set, source, null, queue(0.5), 19, id);
  assert.deepEqual(attempt, { ok: false, error: 'advantage' });
});
