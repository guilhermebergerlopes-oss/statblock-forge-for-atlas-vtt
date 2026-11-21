import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main = await readFile(new URL('../main.ts', import.meta.url), 'utf8');
const deletion = await readFile(new URL('../src/views/TemplateDeletionModal.ts', import.meta.url), 'utf8');

test('plugin wires link repair to startup, Forge template create/rename and late metadata availability', () => {
  assert.match(main, /new ForgeTemplateLinkMaintenance\(/);
  assert.match(main, /listTemplates: async \(\)/);
  assert.match(main, /listStatblockNotes: async \(\)/);
  assert.match(main, /updateNoteLink: async \(notePath, update\)/);
  assert.match(main, /this\.app\.vault\.on\('create', shouldRefresh\)/);
  assert.match(main, /this\.app\.vault\.on\('rename', shouldRefresh\)/);
  assert.match(main, /this\.app\.metadataCache\.on\('changed'/);
  assert.match(main, /templateLinkMaintenance\.start\(\)/);
  assert.match(main, /templateLinkMaintenance\.stop\(\)/);
});

test('template deletion confirmation displays exact linked-note counts without deleting the notes', () => {
  assert.match(deletion, /countForgeTemplateBacklinks\(/);
  assert.match(deletion, /getMarkdownFiles\(\)/);
  assert.match(deletion, /They will not be deleted/);
  assert.match(deletion, /não serão excluídas/);
  assert.match(deletion, /moveTemplateToTrash\(/);
});
