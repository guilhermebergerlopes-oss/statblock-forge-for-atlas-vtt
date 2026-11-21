import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createForgeStatblockTemplateLink,
  ensureForgeStatblockIsDiscoverableByAtlas,
  FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY,
  FORGE_STATBLOCK_LINK_KEY,
} from '../src/statblocks/forgeTemplateLink.ts';
import { createBlankTemplate } from '../src/templates/forgeTemplate.ts';
import { fieldKeyProblem, validateTemplateFields } from '../src/templates/fieldEditorModel.ts';
import {
  registerExistingForgeStatblocksInAtlasPicker,
  registerForgeStatblockNoteInAtlasPicker,
} from '../src/atlas/forgeAtlasStatblockRegistration.ts';

const v2 = createForgeStatblockTemplateLink({ templatePath: 'Templates/Wolf.forgetemplate', templateId: 'wolf-abc123' });
const v1 = createForgeStatblockTemplateLink({ templatePath: 'Templates/Wolf.forgetemplate', templateId: 'wolf-abc123', atlasTemplateId: 'atlas-wolf-123' });

test('Forge v2 notes receive Atlas discovery marker without claiming an Atlas template', () => {
  const frontmatter = { name: 'Wolf', [FORGE_STATBLOCK_LINK_KEY]: v2 };
  assert.equal(ensureForgeStatblockIsDiscoverableByAtlas(frontmatter), 'registered');
  assert.equal(frontmatter[FORGE_ATLAS_STATBLOCK_DISCOVERY_KEY], true);
  assert.equal(frontmatter['atlas-template'], undefined);
  assert.equal(frontmatter[FORGE_STATBLOCK_LINK_KEY].version, 2);
});

test('Atlas discovery registration is idempotent and preserves an existing statblock value', () => {
  const registered = { statblock: true, [FORGE_STATBLOCK_LINK_KEY]: v2 };
  assert.equal(ensureForgeStatblockIsDiscoverableByAtlas(registered), 'already-registered');
  const conflict = { statblock: 'custom-layout', [FORGE_STATBLOCK_LINK_KEY]: v2 };
  assert.equal(ensureForgeStatblockIsDiscoverableByAtlas(conflict), 'conflict');
  assert.equal(conflict.statblock, 'custom-layout');
});

test('Atlas-published v1 statblocks are not rewritten by the Forge v2 discovery migration', () => {
  const frontmatter = { [FORGE_STATBLOCK_LINK_KEY]: v1, 'atlas-template': 'atlas-wolf-123' };
  assert.equal(ensureForgeStatblockIsDiscoverableByAtlas(frontmatter), 'not-forge-v2');
  assert.equal(frontmatter.statblock, undefined);
});

function makeApp(frontmatterByPath) {
  const files = new Map(Object.entries(frontmatterByPath).map(([path, frontmatter]) => [path, { path, extension: 'md', frontmatter: structuredClone(frontmatter) }]));
  const writes = [];
  const app = {
    vault: { getMarkdownFiles: () => [...files.values()] },
    metadataCache: { getFileCache: (file) => ({ frontmatter: file.frontmatter }) },
    fileManager: {
      async processFrontMatter(file, update) {
        update(file.frontmatter);
        writes.push(file.path);
      },
    },
  };
  return { app, files, writes };
}

test('existing Forge v2 notes are registered for Atlas link discovery, while conflicts and v1 notes are untouched', async () => {
  const { app, files, writes } = makeApp({
    'Bestiary/Wolf.md': { name: 'Wolf', [FORGE_STATBLOCK_LINK_KEY]: v2 },
    'Bestiary/Bear.md': { name: 'Bear', statblock: 'bear-custom', [FORGE_STATBLOCK_LINK_KEY]: v2 },
    'Bestiary/Atlas Wolf.md': { name: 'Atlas Wolf', [FORGE_STATBLOCK_LINK_KEY]: v1, 'atlas-template': 'atlas-wolf-123' },
    'Notes/Ordinary.md': { name: 'Ordinary' },
  });

  const summary = await registerExistingForgeStatblocksInAtlasPicker(app);
  assert.deepEqual(summary, {
    scanned: 2,
    registered: 1,
    alreadyRegistered: 0,
    conflicts: ['Bestiary/Bear.md'],
    failed: [],
  });
  assert.equal(files.get('Bestiary/Wolf.md').frontmatter.statblock, true);
  assert.equal(files.get('Bestiary/Bear.md').frontmatter.statblock, 'bear-custom');
  assert.equal(files.get('Bestiary/Atlas Wolf.md').frontmatter.statblock, undefined);
  assert.deepEqual(writes, ['Bestiary/Wolf.md']);
});

test('single-note registration ignores ordinary notes and does not overwrite existing statblock metadata', async () => {
  const { app, files, writes } = makeApp({
    'Bestiary/Wolf.md': { name: 'Wolf', [FORGE_STATBLOCK_LINK_KEY]: v2 },
    'Notes/Normal.md': { name: 'Normal' },
  });
  assert.equal(await registerForgeStatblockNoteInAtlasPicker(app, files.get('Notes/Normal.md')), 'not-forge-v2');
  assert.equal(await registerForgeStatblockNoteInAtlasPicker(app, files.get('Bestiary/Wolf.md')), 'registered');
  assert.equal(await registerForgeStatblockNoteInAtlasPicker(app, files.get('Bestiary/Wolf.md')), 'already-registered');
  assert.deepEqual(writes, ['Bestiary/Wolf.md']);
});

test('Atlas picker registration has one owner and is not duplicated by the optional preview bridge', async () => {
  const { readFile } = await import('node:fs/promises');
  const bridge = await readFile(new URL('../src/atlas/forgeAtlasPreviewBridge.ts', import.meta.url), 'utf8');
  const panels = await readFile(new URL('../src/views/StatblockNotePanels.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(bridge, /registerForgeStatblockNoteInAtlasPicker|registerExistingForgeStatblocksInAtlasPicker/);
  assert.match(bridge, /Atlas link-dialog discovery is owned by StatblockNotePanels/);
  assert.match(panels, /registerExistingForgeStatblocksInAtlasPicker\(this\.app\)/);
  assert.match(panels, /this\.app\.workspace\.onLayoutReady\(registerExisting\)/);
  assert.match(panels, /this\.registerStatblockForAtlasPicker\(file\)/);
});


test('statblock is reserved as a Field key because Atlas requires it for Link Statblock discovery', () => {
  const template = createBlankTemplate('Wolf');
  assert.match(fieldKeyProblem(template, 'statblock') ?? '', /reservada/i);
  template.fields.push({ key: 'statblock', label: 'Custom Statblock', type: 'text' });
  assert.ok(validateTemplateFields(template).some((issue) => issue.code === 'reserved-key' && issue.fieldKey === 'statblock'));
});

test('the core note-panel lifecycle migrates existing Forge notes and watches changed notes', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/views/StatblockNotePanels.ts', import.meta.url), 'utf8');
  assert.match(source, /registerExistingForgeStatblocksInAtlasPicker\(this\.app\)/);
  assert.match(source, /this\.app\.workspace\.onLayoutReady\(registerExisting\)/);
  assert.match(source, /this\.registerStatblockForAtlasPicker\(file\)/);
  assert.match(source, /this\.app\.metadataCache\.on\('changed'/);
  assert.match(source, /this\.app\.metadataCache\.on\('resolved', registerExisting\)/);
});

test('concurrent Atlas registration requests coalesce into one frontmatter write', async () => {
  const { app, files, writes } = makeApp({
    'Bestiary/Wolf.md': { name: 'Wolf', [FORGE_STATBLOCK_LINK_KEY]: v2 },
  });
  const file = files.get('Bestiary/Wolf.md');
  const results = await Promise.all([
    registerForgeStatblockNoteInAtlasPicker(app, file),
    registerForgeStatblockNoteInAtlasPicker(app, file),
  ]);
  assert.deepEqual(results, ['registered', 'already-registered']);
  assert.deepEqual(writes, ['Bestiary/Wolf.md']);
});
