import test from 'node:test';
import assert from 'node:assert/strict';
import { ForgeDiceRollTogetherApi } from '../src/integration/diceRollTogetherApi.ts';

const templateId = 'daggerheart-character-sheet-uk7yht';
const diceSetId = '5c3bb776-15d2-469a-8ba0-75e4b1b03439';

function templateText() {
  return JSON.stringify({
    format: 'atlas-statblock-template',
    version: 1,
    id: templateId,
    diceSetId,
    fields: [
      { key: 'level', label: 'Level', type: 'number' },
      { key: 'attack', label: 'Attack', type: 'dice', diceFormula: '2d6+{level}' },
    ],
    layout: { maxColumns: 2, blocks: [] },
    recovery: [],
  });
}

const gmDiceSet = {
  id: diceSetId,
  name: 'Daggerheart GM Set',
  dice: [{ count: 1, sides: 6, name: 'Daggerheart d6', colour: '#123456' }],
  crit: 'high-total',
};

function makeApi(localDiceSet = null) {
  const templateFile = {
    extension: 'forgetemplate',
    basename: 'Daggerheart-Character-Sheet',
    path: 'atlas-vtt/statblock-templates/Daggerheart-Character-Sheet.forgetemplate',
    stat: { mtime: 1, size: templateText().length },
  };
  const setPath = 'atlas-vtt/dice-sets/Daggerheart.json';
  const app = {
    vault: {
      getFiles: () => [templateFile],
      cachedRead: async (file) => {
        assert.equal(file.path, templateFile.path);
        return templateText();
      },
      adapter: {
        list: async (folder) => folder === 'atlas-vtt/dice-sets'
          ? { files: localDiceSet ? [setPath] : [], folders: [] }
          : { files: [], folders: [] },
        exists: async (path) => Boolean(localDiceSet && path === setPath),
        read: async (path) => {
          if (!localDiceSet || path !== setPath) throw new Error('File not found');
          return JSON.stringify(localDiceSet);
        },
      },
    },
  };
  return new ForgeDiceRollTogetherApi({ app, initialStore: null, persistStore: async () => {} });
}

test('player can resolve the copied .forgetemplate without installing the GM custom Dice Set JSON', async () => {
  const api = makeApi();
  assert.equal(api.apiVersion, 3, 'the GM-authoritative Dice Set contract is exposed through integration API v3');
  const contract = await api.getTemplateRollContract(templateId, { requireDiceSet: false });
  assert.ok(contract);
  assert.equal(contract.version, 3);
  assert.equal(contract.templateId, templateId);
  assert.equal(contract.diceSetId, diceSetId);
  assert.equal(contract.diceSetAvailable, false);
  assert.equal(contract.diceFields[0]?.formula, '2d6+{level}');

  await assert.rejects(
    () => api.getTemplateRollContract(templateId),
    /no valid matching JSON was found|does not contain a valid matching set/i,
    'the default/GM path must remain strict when the custom Set Dice JSON is missing',
  );
});

test('player-local Set Dice JSON differences do not change the Template fingerprint', async () => {
  const absent = await makeApi().getTemplateRollContract(templateId, { requireDiceSet: false });
  const differentLocalSet = {
    ...gmDiceSet,
    name: 'Player local Daggerheart Set',
    dice: [{ count: 2, sides: 10, name: 'Local d10', colour: '#abcdef' }],
    crit: 'natural',
  };
  const present = await makeApi(differentLocalSet).getTemplateRollContract(templateId, { requireDiceSet: false });
  assert.ok(absent && present);
  assert.equal(absent.fingerprint, present.fingerprint,
    'the same .forgetemplate and same selected Dice Set ID produce the same Template fingerprint');
  assert.notEqual(absent.diceSetFingerprint, present.diceSetFingerprint,
    'the separate payload digest still detects local Set Dice differences');
});

test('the GM strict contract contains its resolved Dice Set and marks it authoritative', async () => {
  const api = makeApi(gmDiceSet);
  const contract = await api.getTemplateRollContract(templateId);
  assert.ok(contract);
  assert.equal(api.apiVersion, 3);
  assert.equal(contract.version, 3);
  assert.equal(contract.diceSetAvailable, true);
  assert.equal(contract.diceSet.id, diceSetId);
  assert.equal(contract.diceSet.dice[0]?.sides, 6);
  assert.equal(contract.diceSet.crit, 'high-total');
});
