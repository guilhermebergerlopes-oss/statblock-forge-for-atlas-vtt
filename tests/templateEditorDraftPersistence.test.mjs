import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldPersistTemplateEditorDraftContent,
  templateEditorDraftContentSnapshot,
} from '../src/templates/templateEditorDraftPersistence.ts';

const template = { id: 'test-template', fields: [{ key: 'hp', type: 'number' }] };
const layout = { templateId: 'test-template', blocks: { hp: { x: 0, y: 0 } } };

function snapshot(nextTemplate = template, nextLayout = layout, jsonDraftText = null, jsonAppliedText = null) {
  return templateEditorDraftContentSnapshot(nextTemplate, nextLayout, jsonDraftText, jsonAppliedText);
}

test('selection and sidebar-only interactions do not affect the recovery content snapshot', () => {
  const before = snapshot();
  const after = snapshot();

  // UI-only state such as selectedBlockId, selectedBlockIds, sidebarMode,
  // sidebarTab and scroll position is deliberately not part of the snapshot.
  assert.equal(after, before);
  assert.equal(shouldPersistTemplateEditorDraftContent(after, before, null), false);
});

test('template, layout and pending JSON edits change the recovery content snapshot', () => {
  const baseline = snapshot();

  assert.notEqual(snapshot({ ...template, name: 'Changed' }), baseline);
  assert.notEqual(snapshot(template, { ...layout, blocks: { hp: { x: 1, y: 0 } } }), baseline);
  assert.notEqual(snapshot(template, layout, '{"name":"draft"}', null), baseline);
  assert.notEqual(snapshot(template, layout, '{"name":"draft"}', '{"name":"applied"}'), baseline);
});

test('a real content change schedules one write and rerenders do not reschedule it', () => {
  const persisted = snapshot();
  const changed = snapshot({ ...template, name: 'Changed' });

  assert.equal(shouldPersistTemplateEditorDraftContent(changed, persisted, null), true);
  assert.equal(shouldPersistTemplateEditorDraftContent(changed, persisted, changed), false);
});

test('reverting to the persisted content does not write a duplicate JSON snapshot', () => {
  const persisted = snapshot();
  const changed = snapshot({ ...template, name: 'Changed' });

  assert.equal(shouldPersistTemplateEditorDraftContent(persisted, persisted, changed), false);
});

test('missing editor content cannot schedule a recovery-draft write', () => {
  assert.equal(templateEditorDraftContentSnapshot(null, layout, null, null), null);
  assert.equal(shouldPersistTemplateEditorDraftContent(null, null, null), false);
});
