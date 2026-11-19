import assert from 'node:assert/strict';
import test from 'node:test';
import {
  recoveryButtonsOf,
  recoveryDiagnosticsOf,
  setRecoveryButtons,
} from '../src/templates/recoveryEditorModel.ts';

function templateWithLegacyConditions() {
  return {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'legacy-template',
    fields: [{ key: 'hp', label: 'HP', type: 'number' }],
    layout: {
      maxColumns: 2,
      blocks: [],
      forgeConditionDefinitions: [{ id: 'poisoned', name: 'Poisoned', color: '#8b5cf6', valued: true }],
    },
    recovery: [{
      id: 'long-rest',
      name: 'Long Rest',
      rules: [
        { target: { kind: 'condition', condition: 'poisoned' }, does: 'step', by: -1 },
        { target: { kind: 'resource', field: 'hp' }, does: 'full' },
      ],
    }],
  };
}

test('legacy Forge Conditions are not exposed as editable or executable rules', () => {
  const template = templateWithLegacyConditions();
  const buttons = recoveryButtonsOf(template);
  assert.equal(buttons.length, 1);
  assert.deepEqual(buttons[0].rules, [{ target: { kind: 'resource', field: 'hp' }, does: 'full' }]);
  assert.ok(recoveryDiagnosticsOf(template).some((message) => message.includes('Conditions nativas do Atlas')));
});

test('editing supported Rest rules preserves legacy Condition JSON and old template definitions', () => {
  const template = templateWithLegacyConditions();
  const original = structuredClone(template);
  const buttons = recoveryButtonsOf(template);
  setRecoveryButtons(template, buttons);
  assert.deepEqual(template.recovery[0].rules[0], original.recovery[0].rules[0]);
  assert.deepEqual(template.layout.forgeConditionDefinitions, original.layout.forgeConditionDefinitions);
});

test('new Forge Rest rules expose only Resource and Counters targets', () => {
  const source = templateWithLegacyConditions();
  const buttons = recoveryButtonsOf(source);
  assert.ok(buttons.every((button) => button.rules.every((rule) => ['resource', 'counters'].includes(rule.target.kind))));
});
