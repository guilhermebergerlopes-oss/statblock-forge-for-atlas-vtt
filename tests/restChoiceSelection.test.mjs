import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRestChoiceDraftValid,
  isRestChoicePicksValid,
  restChoicePicks,
  setRestChoiceActionCount,
} from '../src/statblocks/restChoiceSelectionModel.ts';

const action = (id) => ({ id, name: id, rules: [] });
const step = (overrides = {}) => ({
  id: 'step', prompt: 'Choose', min: 1, max: 2,
  actions: [action('a'), action('b'), action('c')],
  ...overrides,
});

test('runtime blocks confirmation until minimum picks are satisfied', () => {
  const choice = step({ min: 2, max: 3 });
  assert.equal(isRestChoiceDraftValid([choice], {}), false);
  let draft = setRestChoiceActionCount({}, choice, 'a', 1);
  assert.equal(isRestChoiceDraftValid([choice], draft), false);
  draft = setRestChoiceActionCount(draft, choice, 'b', 1);
  assert.equal(isRestChoiceDraftValid([choice], draft), true);
});

test('runtime never allows picks beyond maximum', () => {
  const choice = step({ min: 0, max: 2 });
  let draft = setRestChoiceActionCount({}, choice, 'a', 1);
  draft = setRestChoiceActionCount(draft, choice, 'b', 1);
  draft = setRestChoiceActionCount(draft, choice, 'c', 1);
  assert.equal(draft.step?.c, undefined);
  assert.equal(Object.values(draft.step ?? {}).reduce((sum, count) => sum + count, 0), 2);
  assert.equal(isRestChoiceDraftValid([choice], draft), true);
});

test('non-repeating actions are unique and can only be selected once', () => {
  const choice = step({ min: 0, max: 3 });
  const draft = setRestChoiceActionCount({}, choice, 'a', 3);
  assert.equal(draft.step.a, 1);
  assert.equal(isRestChoicePicksValid([choice], [
    { choice: 'step', action: 'a' },
    { choice: 'step', action: 'a' },
  ]), false);
});

test('repeating actions may be picked multiple times up to the step maximum', () => {
  const choice = step({ min: 2, max: 3, repeat: true });
  let draft = setRestChoiceActionCount({}, choice, 'a', 2);
  draft = setRestChoiceActionCount(draft, choice, 'b', 1);
  draft = setRestChoiceActionCount(draft, choice, 'c', 1);
  assert.deepEqual(draft.step, { a: 2, b: 1 });
  assert.equal(isRestChoiceDraftValid([choice], draft), true);
  assert.equal(isRestChoicePicksValid([choice], [
    { choice: 'step', action: 'a' },
    { choice: 'step', action: 'a' },
    { choice: 'step', action: 'b' },
  ]), true);
});

test('selection order preserves repeated picks when producing the request', () => {
  const choice = step({ min: 2, max: 3, repeat: true });
  const draft = setRestChoiceActionCount({}, choice, 'a', 2);
  const picks = restChoicePicks([choice], draft, [
    { choice: 'step', action: 'a' },
    { choice: 'step', action: 'a' },
  ]);
  assert.deepEqual(picks, [
    { choice: 'step', action: 'a' },
    { choice: 'step', action: 'a' },
  ]);
});
