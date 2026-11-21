import assert from 'node:assert/strict';
import test from 'node:test';
import { createForgeStatblockNoteFromTemplate } from '../src/statblocks/forgeStatblockNoteCreator.ts';
import { getAtlasPublicCapabilityReport } from '../src/atlas/atlasCapabilities.ts';

const TEMPLATE_PATH = 'Bestiary/Templates/ash-drake.forgetemplate';
const TEMPLATE_ID = 'creature-abc123';

function createNoteApp() {
  const sourceFile = { path: TEMPLATE_PATH, extension: 'forgetemplate' };
  const files = new Map([[TEMPLATE_PATH, '{"format":"atlas-statblock-template"}']]);
  const folders = new Set();
  const app = {
    vault: {
      getAbstractFileByPath(path) {
        if (files.has(path)) return path === TEMPLATE_PATH ? sourceFile : { path, extension: 'md' };
        if (folders.has(path)) return { path, children: [] };
        return null;
      },
      async createFolder(path) { folders.add(path); },
      async create(path, content) {
        files.set(path, content);
        return { path, extension: 'md' };
      },
    },
  };
  return { app, files };
}

test('Forge emits a v2 note link that Atlas can resolve without assigning Resources to Forge', async () => {
  const { app, files } = createNoteApp();
  const template = {
    format: 'atlas-statblock-template',
    version: 1,
    id: TEMPLATE_ID,
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'currentHp', label: 'Current HP', type: 'number', meaning: 'hit-points', tracks: { counts: 'down', max: 'maximumHp' } },
      { key: 'maximumHp', label: 'Maximum HP', type: 'number' },
      { key: 'mana', label: 'Mana', type: 'number' },
    ],
    layout: { maxColumns: 2, blocks: [] },
  };

  const result = await createForgeStatblockNoteFromTemplate({
    app,
    template,
    data: {
      name: 'Ash Drake', currentHp: 8, maximumHp: 24, mana: 12,
      undeclaredResource: 99,
    },
    statblockFolder: 'Bestiary/Creatures',
    fallbackName: 'Creature',
    templateSourcePath: TEMPLATE_PATH,
  });

  assert.equal(result.statblockFile.path, 'Bestiary/Creatures/ash-drake.md');
  assert.deepEqual(result.forgeLink, {
    format: 'statblock-forge-template-link',
    version: 2,
    templatePath: TEMPLATE_PATH,
    templateId: TEMPLATE_ID,
  });

  const note = files.get(result.statblockFile.path);
  assert.ok(note);
  assert.match(note, /^---\n/);
  const linkLine = note.match(/^statblock-forge: (.+)$/m);
  assert.ok(linkLine);
  assert.equal(linkLine[1], '{format: "statblock-forge-template-link", version: 2, templatePath: "Bestiary/Templates/ash-drake.forgetemplate", templateId: "creature-abc123"}');
  assert.match(note, /^currentHp: 8$/m);
  assert.match(note, /^maximumHp: 24$/m);
  assert.match(note, /^mana: 12$/m);
  assert.doesNotMatch(note, /undeclaredResource/);
  assert.doesNotMatch(note, /^atlas-template:/m);
  assert.match(note, /^statblock: true$/m);
});

test('Forge does not claim a public Atlas API for live token or Resource state', () => {
  const capability = getAtlasPublicCapabilityReport().find((item) => item.id === 'online-character-sync');
  assert.ok(capability);
  assert.equal(capability.status, 'not-documented');
  assert.match(capability.explanation, /Não foi encontrada uma API pública/);
  assert.match(capability.integration, /interface pública documentada/);
});
