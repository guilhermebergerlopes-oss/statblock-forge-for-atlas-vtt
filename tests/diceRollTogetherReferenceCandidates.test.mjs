import test from 'node:test';
import assert from 'node:assert/strict';
import { ForgeDiceRollTogetherApi } from '../src/integration/diceRollTogetherApi.ts';

function makeApi() {
  const app = { vault: { getFiles: () => [] } };
  return new ForgeDiceRollTogetherApi({ app, initialStore: null, persistStore: async () => {} });
}

test('Forge collects resolvable number references without failing on blank optional references', async () => {
  const api = makeApi();
  const template = {
    id: 'generic-rpg-sheet',
    diceSetId: null,
    fields: [
      { key: 'strength', label: 'Strength', type: 'number' },
      { key: 'proficiency', label: 'Proficiency', type: 'number' },
      { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '1d20 + {strength} + {proficiency}' },
    ],
    recovery: [],
    layout: { blocks: [] },
  };
  api.loadContext = async () => ({
    template,
    data: { strength: 3 },
    templateFile: { basename: 'Generic RPG Sheet' },
  });
  const result = await api.collectDiceFieldReferenceCandidates('characters/hero.md', 'attack');
  assert.ok(result);
  assert.deepEqual(result.references, ['strength', 'proficiency']);
  assert.deepEqual(result.referenceValues, { strength: 3 });
  assert.equal(result.templateId, template.id);
  assert.equal(result.originalFormula, '1d20 + {strength} + {proficiency}');
});

test('Forge candidate collection resolves checkbox references to numeric 1/0 values', async () => {
  const api = makeApi();
  const template = {
    id: 'checkbox-rpg-sheet',
    diceSetId: null,
    fields: [
      { key: 'training', label: 'Training', type: 'checkboxes', options: [{ key: 'proficient', label: 'Proficient' }] },
      { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '1d20 + {training.proficient}' },
    ],
    recovery: [],
    layout: { blocks: [] },
  };
  api.loadContext = async () => ({
    template,
    data: { training: { proficient: true } },
    templateFile: { basename: 'Checkbox RPG Sheet' },
  });
  const result = await api.collectDiceFieldReferenceCandidates('characters/hero.md', 'attack');
  assert.ok(result);
  assert.deepEqual(result.referenceValues, { 'training.proficient': 1 });
});
