import test from 'node:test';
import assert from 'node:assert/strict';
import { renameTemplateFieldKey, validateTemplateFields } from '../src/templates/fieldEditorModel.ts';

function template(fields, sample = {}) {
  return {
    format: 'atlas-statblock-template',
    version: 1,
    id: 'former-key-contract',
    fields,
    layout: { maxColumns: 12, blocks: [] },
    sample: { ...sample },
  };
}

test('repeated Field renames retain every prior key in newest-first order', () => {
  const value = template([{ key: 'mana', label: 'Mana', type: 'number' }], { mana: 8 });

  renameTemplateFieldKey(value, 'mana', 'focus');
  renameTemplateFieldKey(value, 'focus', 'essence');

  assert.equal(value.fields[0].key, 'essence');
  assert.deepEqual(value.fields[0].formerKeys, ['focus', 'mana']);
  assert.deepEqual(value.sample, { essence: 8 });
  assert.deepEqual(validateTemplateFields(value), []);
});

test('renaming back to an own Former Key removes its alias case-insensitively', () => {
  const value = template([{
    key: 'essence', label: 'Essence', type: 'number', formerKeys: ['focus', 'mana'],
  }], { essence: 8 });

  renameTemplateFieldKey(value, 'essence', 'FOCUS');

  assert.equal(value.fields[0].key, 'FOCUS');
  assert.deepEqual(value.fields[0].formerKeys, ['essence', 'mana']);
  assert.deepEqual(validateTemplateFields(value), []);
});

test('renaming a Field to another Field Former Key is rejected without mutation', () => {
  const value = template([
    { key: 'hp', label: 'HP', type: 'number' },
    { key: 'vitality', label: 'Vitality', type: 'number', formerKeys: ['oldHp'] },
  ], { hp: 12, vitality: 8 });
  const before = structuredClone(value);

  assert.throws(() => renameTemplateFieldKey(value, 'hp', 'oldHp'), /já está sendo usada/);
  assert.deepEqual(value, before);
});

test('native validation rejects two Fields claiming the same Former Key', () => {
  const value = template([
    { key: 'health', label: 'Health', type: 'number', formerKeys: ['oldHp'] },
    { key: 'vitality', label: 'Vitality', type: 'number', formerKeys: ['oldHp'] },
  ]);

  assert.ok(validateTemplateFields(value).some((issue) => issue.code === 'duplicate-key'));
});
