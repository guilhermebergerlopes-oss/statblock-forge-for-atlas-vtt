import assert from 'node:assert/strict';
import test from 'node:test';
import {
  combineWrittenAdvantage,
  withWrittenAdvantage,
  writtenAdvantage,
} from '../src/statblocks/atlasDiceEngine/writtenAdvantage.ts';

test('written advantage is recognized only as a final space-separated word', () => {
  assert.deepEqual(writtenAdvantage('1d20+5 adv'), {
    formula: '1d20+5', side: 'advantage', word: 'adv',
  });
  assert.deepEqual(writtenAdvantage('+4 DIS'), {
    formula: '+4', side: 'disadvantage', word: 'DIS',
  });
  assert.deepEqual(writtenAdvantage('1d20 advantage'), {
    formula: '1d20 advantage', side: null, word: '',
  });
  assert.deepEqual(writtenAdvantage('1d20adv'), {
    formula: '1d20adv', side: null, word: '',
  });
});

test('written and requested opposite sides cancel, while matching sides remain', () => {
  assert.equal(combineWrittenAdvantage('advantage', null), 'advantage');
  assert.equal(combineWrittenAdvantage('advantage', 'advantage'), 'advantage');
  assert.equal(combineWrittenAdvantage('advantage', 'disadvantage'), null);
  assert.equal(combineWrittenAdvantage(null, 'disadvantage'), 'disadvantage');
});

test('written side can be normalized when a formula is recomposed', () => {
  assert.equal(withWrittenAdvantage('1d20+5 adv', 'disadvantage'), '1d20+5 dis');
  assert.equal(withWrittenAdvantage('1d20+5 adv', null), '1d20+5');
});
