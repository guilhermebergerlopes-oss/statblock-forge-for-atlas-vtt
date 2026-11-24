import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldKeyProblem, renameTemplateFieldKey, validateTemplateFields } from '../src/templates/fieldEditorModel.ts';
import { registerTemplateField } from '../src/templates/forgeTemplate.ts';

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

test('a Field can reclaim another Field Former Key and releases the old alias', () => {
  const value = template([
    { key: 'stamina', label: 'Stamina', type: 'number' },
    { key: 'vitality', label: 'Vitality', type: 'number', formerKeys: ['oldStamina'] },
  ], { stamina: 12, vitality: 8 });

  renameTemplateFieldKey(value, 'stamina', 'oldStamina');

  assert.equal(value.fields[0].key, 'oldStamina');
  assert.deepEqual(value.fields[0].formerKeys, ['stamina']);
  assert.deepEqual(value.fields[1].formerKeys, []);
  assert.deepEqual(validateTemplateFields(value), []);
});

test('a key that is currently owned by another Field remains unavailable', () => {
  const value = template([
    { key: 'stamina', label: 'Stamina', type: 'number' },
    { key: 'vitality', label: 'Vitality', type: 'number', formerKeys: ['oldVitality'] },
  ]);

  assert.equal(
    fieldKeyProblem(value, 'vitality', 'stamina'),
    'A chave "vitality" já está sendo usada por outro campo.',
  );
  assert.throws(() => renameTemplateFieldKey(value, 'stamina', 'vitality'), /já está sendo usada/);
});

test('new Fields can reuse former keys, while current keys still generate a suffix', () => {
  const value = template([
    { key: 'essence', label: 'Essence', type: 'number', formerKeys: ['mana'] },
    { key: 'focus', label: 'Focus', type: 'number' },
  ]);

  const reclaimed = registerTemplateField(value, 'Mana', 'number');
  const unique = registerTemplateField(value, 'Focus', 'number');

  assert.equal(reclaimed.key, 'mana');
  assert.deepEqual(value.fields[0].formerKeys, []);
  assert.equal(unique.key, 'focus_2');
  assert.deepEqual(validateTemplateFields(value), []);
});

test('native validation rejects two Fields claiming the same Former Key', () => {
  const value = template([
    { key: 'health', label: 'Health', type: 'number', formerKeys: ['oldHp'] },
    { key: 'vitality', label: 'Vitality', type: 'number', formerKeys: ['oldHp'] },
  ]);

  assert.ok(validateTemplateFields(value).some((issue) => issue.code === 'duplicate-key'));
});

test('an active Field key takes precedence over another Field legacy alias', () => {
  const value = template([
    { key: 'strength', label: 'Strength', type: 'number', formerKeys: ['might'] },
    { key: 'might', label: 'Might', type: 'number' },
  ]);

  assert.deepEqual(validateTemplateFields(value), []);
});
