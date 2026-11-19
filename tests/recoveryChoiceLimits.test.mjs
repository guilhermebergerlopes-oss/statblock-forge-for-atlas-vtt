import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRecoveryChoicePickLimits,
  recoveryChoicePickCapacity,
  withRecoveryChoicePickLimit,
  recoveryButtonsOf,
  recoveryButtonsForEditing,
  setRecoveryButtons,
  validateRecoveryButtons,
} from '../src/templates/recoveryEditorModel.ts';
import { createBlankTemplate } from '../src/templates/forgeTemplate.ts';

const action = (id) => ({ id, name: `Action ${id}`, rules: [] });
const choice = (overrides = {}) => ({
  id: 'step-a', prompt: 'Choose', min: 1, max: 1,
  actions: [action('a'), action('b'), action('c')],
  ...overrides,
});
const restButton = (step) => ({ id: 'rest-a', name: 'Rest', rules: [], choices: [step] });

 test('pick capacity is limited by distinct actions unless repetition is enabled', () => {
  assert.equal(recoveryChoicePickCapacity(choice()), 3);
  assert.equal(recoveryChoicePickCapacity(choice({ actions: [action('a')] })), 1);
  assert.equal(recoveryChoicePickCapacity(choice({ repeat: true, actions: [action('a')] })), 6);
  assert.equal(recoveryChoicePickCapacity(choice({ repeat: true, actions: Array.from({ length: 8 }, (_, i) => action(String(i))) })), 6);
});

test('raising minimum raises maximum instead of invalidating the whole Rest step', () => {
  const next = withRecoveryChoicePickLimit(choice({ min: 1, max: 1 }), 'min', 3);
  assert.equal(next.min, 3);
  assert.equal(next.max, 3);
  assert.deepEqual(validateRecoveryButtons([restButton(next)]), []);
});

test('lowering maximum lowers minimum so the step remains valid', () => {
  const next = withRecoveryChoicePickLimit(choice({ min: 3, max: 3 }), 'max', 2);
  assert.equal(next.min, 2);
  assert.equal(next.max, 2);
  assert.deepEqual(validateRecoveryButtons([restButton(next)]), []);
});

test('minimum and maximum remain within the number of distinct actions when repeats are off', () => {
  const next = withRecoveryChoicePickLimit(choice({ min: 1, max: 1 }), 'min', 6);
  assert.equal(next.min, 3);
  assert.equal(next.max, 3);
  const reduced = normalizeRecoveryChoicePickLimits({ ...next, actions: [action('a'), action('b')] });
  assert.equal(reduced.min, 2);
  assert.equal(reduced.max, 2);
});

test('enabling and disabling repeats adjusts both limits to the supported capacity', () => {
  const repeated = withRecoveryChoicePickLimit(choice({ min: 1, max: 1, repeat: true }), 'min', 5);
  assert.equal(repeated.min, 5);
  assert.equal(repeated.max, 5);
  const distinctOnly = normalizeRecoveryChoicePickLimits({ ...repeated, repeat: undefined, actions: [action('a'), action('b')] });
  assert.equal(distinctOnly.min, 2);
  assert.equal(distinctOnly.max, 2);
});

test('empty and non-finite numeric edits do not poison an existing limit', () => {
  const current = choice({ min: 1, max: 2 });
  const sameMin = withRecoveryChoicePickLimit(current, 'min', Number.NaN);
  const sameMax = withRecoveryChoicePickLimit(current, 'max', Number.NaN);
  assert.equal(sameMin.min, 1);
  assert.equal(sameMin.max, 2);
  assert.equal(sameMax.min, 1);
  assert.equal(sameMax.max, 2);
});

test('a saved choice with adjusted limits survives editor and runtime parsing', () => {
  const template = createBlankTemplate('Rest limits');
  template.recovery = [restButton(choice({ min: 1, max: 1 }))];
  const editedButton = recoveryButtonsForEditing(template)[0];
  assert.ok(editedButton);
  const adjusted = withRecoveryChoicePickLimit(editedButton.choices[0], 'min', 2);
  setRecoveryButtons(template, [{ ...editedButton, choices: [adjusted] }]);

  const editorChoice = recoveryButtonsForEditing(template)[0]?.choices?.[0];
  const runtimeChoice = recoveryButtonsOf(template)[0]?.choices?.[0];
  assert.equal(editorChoice?.min, 2);
  assert.equal(editorChoice?.max, 2);
  assert.equal(runtimeChoice?.min, 2);
  assert.equal(runtimeChoice?.max, 2);
  assert.deepEqual(validateRecoveryButtons(recoveryButtonsForEditing(template)), []);
});
