import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankTemplate,
  createForgeLayout,
  serializeForgeLayout,
} from '../src/templates/forgeTemplate.ts';
import {
  parseTemplateFileText,
  serializeForgeTemplateFile,
} from '../src/templates/forgeFileFormat.ts';
import {
  resolveAtlasTemplateLayoutForForgeCopy,
} from '../src/templates/forgeLayoutSidecar.ts';
import { saveTemplateDocument } from '../src/templates/templateRepository.ts';
import {
  createTemplateBackupEnvelope,
  listTemplateBackups,
  restoreTemplateBackup,
  serializeTemplateBackup,
} from '../src/templates/templateBackup.ts';
import {
  createForgeStatblockTemplateLink,
  FORGE_STATBLOCK_LINK_KEY,
} from '../src/statblocks/forgeTemplateLink.ts';
import { repairForgeTemplateLinks } from '../src/statblocks/forgeTemplateLinkMaintenance.ts';

class MemoryTemplateStorage {
  files = new Map();
  folders = new Set();

  exists(path) { return this.files.has(path); }
  async read(path) {
    if (!this.files.has(path)) throw new Error(`Missing file: ${path}`);
    return this.files.get(path);
  }
  async create(path, contents) {
    if (this.files.has(path)) throw new Error(`Already exists: ${path}`);
    this.files.set(path, contents);
    return { path, basename: path.split('/').pop().replace(/\.[^.]+$/, '') };
  }
  async modify(path, contents) {
    if (!this.files.has(path)) throw new Error(`Missing file: ${path}`);
    this.files.set(path, contents);
  }
  async compareAndSwap(path, expectedText, contents) {
    const currentText = this.files.get(path);
    if (currentText !== expectedText) return { written: false, currentText: currentText ?? '' };
    this.files.set(path, contents);
    return { written: true, currentText };
  }
  async rename(path, newPath) {
    const contents = await this.read(path);
    if (this.files.has(newPath)) throw new Error(`Already exists: ${newPath}`);
    this.files.delete(path);
    return this.create(newPath, contents);
  }
  async ensureFolder(path) {
    let current = '';
    for (const part of path.split('/').filter(Boolean)) {
      current = current ? `${current}/${part}` : part;
      this.folders.add(current);
    }
  }
  async listTemplateIds() {
    const result = [];
    for (const [path, text] of this.files) {
      if (!/\.(?:forgetemplate|atlastemplate)$/i.test(path)) continue;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.format === 'atlas-statblock-template' && typeof parsed.id === 'string') {
          result.push({ path, id: parsed.id });
        }
      } catch { /* malformed files do not reserve an identity */ }
    }
    return result;
  }
  async listBackupFiles(folder) {
    const prefix = `${folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/`;
    return [...this.files.keys()]
      .filter((path) => path.startsWith(prefix) && path.toLowerCase().endsWith('.forgetemplate.bak'))
      .map((path) => ({ path, basename: path.split('/').pop(), size: this.files.get(path).length, mtime: 0 }));
  }
}

function forgeFixture(name = 'Ash Drake', id = 'ash-drake-abc123') {
  const template = createBlankTemplate(name);
  template.id = id;
  template.version = 1;
  template.fields.find((field) => field.key === 'name').futureFieldProperty = { preserved: true };
  template.layout.blocks = [
    { id: 'main-section', type: 'section', heading: 'Main', blocks: [
      { id: 'hp-stat', type: 'stat', field: 'hp', labelPlacement: 'above' },
    ] },
  ];
  const layout = createForgeLayout(template);
  layout.columns = 18;
  layout.dense = false;
  layout.sheetWidth = 840;
  layout.blocks['main-section'].span = 12;
  layout.blocks['hp-stat'].span = 9;
  layout.blocks['hp-stat'].appearance = { borderColor: '#123456', borderWidth: 2 };
  return { template, layout, text: serializeForgeTemplateFile(template, layout) };
}

function legacyGridFixture() {
  return {
    title: 'Legacy Beast',
    id: 'legacy-beast-abc123',
    fields: {
      name: { type: 'string', label: 'Name', default: 'Legacy Beast' },
      hp: { type: 'integer', label: 'HP', default: 12 },
    },
    gridBlocks: [
      {
        id: 'profile', title: 'Profile',
        layout: { x: 0, y: 0, w: 12, h: 2 },
        fieldIds: ['name', 'hp'],
        fieldSettings: { hp: { label: 'Vitality', rollable: true } },
        futureGridSetting: { keep: true },
      },
    ],
    futureLegacyRoot: { preserve: 'source' },
  };
}

test('legacy grid Templates migrate deterministically and repeated imports never mutate the source', async () => {
  const storage = new MemoryTemplateStorage();
  const legacyPath = 'Templates/Legacy Beast.atlastemplate';
  const legacyText = JSON.stringify(legacyGridFixture(), null, 2);
  await storage.ensureFolder('Templates');
  await storage.create(legacyPath, legacyText);

  const first = parseTemplateFileText(await storage.read(legacyPath), 'atlastemplate');
  const second = parseTemplateFileText(await storage.read(legacyPath), 'atlastemplate');
  assert.equal(first.fileFormat, 'atlas');
  assert.equal(first.canOverwrite, false, 'Atlas sources are import-only');
  assert.equal(first.template.id, 'legacy-beast-abc123');
  assert.equal(second.template.id, first.template.id);
  assert.deepEqual(second.template, first.template, 'repeated import of the same legacy bytes must produce the same migrated model');
  assert.equal(first.template.fields.find((field) => field.key === 'hp').type, 'number');
  assert.ok(first.template.layout.blocks.length > 0);
  assert.deepEqual(first.template.futureLegacyRoot, { preserve: 'source' });
  const migratedGrid = first.template.layout.blocks[0].blocks[0];
  assert.deepEqual(migratedGrid.fsExtras.atlasLegacyGrid.originalPayload.futureGridSetting, { keep: true }, 'unknown legacy grid payload must remain available in opaque metadata');
  assert.equal(migratedGrid.fsExtras.atlasLegacyGrid.originalPayload.id, 'profile');
  assert.equal(await storage.read(legacyPath), legacyText, 'inspection/import must not rewrite the legacy source');

  const normalizedAgain = parseTemplateFileText(JSON.stringify(first.template), 'atlastemplate');
  assert.deepEqual(normalizedAgain.template, first.template, 'a migrated Atlas model must be idempotent when reopened');
  const oldForgeExtension = parseTemplateFileText(legacyText, 'forgetemplate');
  assert.equal(oldForgeExtension.fileFormat, 'forge');
  assert.equal(oldForgeExtension.canOverwrite, false, 'legacy Forge-extension files without namespaced metadata must be protected');
  assert.equal(oldForgeExtension.layout, null);

  const firstCopy = await saveTemplateDocument({
    storage, templateFolder: 'Templates', name: 'Legacy Beast',
    template: first.template, layout: createForgeLayout(first.template),
    sourcePath: legacyPath, originalText: legacyText, saveAsCopy: true, allowUniqueNameOnConflict: true,
  });
  const secondCopy = await saveTemplateDocument({
    storage, templateFolder: 'Templates', name: 'Legacy Beast',
    template: second.template, layout: createForgeLayout(second.template),
    sourcePath: legacyPath, originalText: legacyText, saveAsCopy: true, allowUniqueNameOnConflict: true,
  });
  assert.notEqual(firstCopy.template.id, secondCopy.template.id);
  assert.equal(firstCopy.template.derivedFrom.templateId, first.template.id);
  assert.equal(secondCopy.template.derivedFrom.templateId, first.template.id);
  assert.notEqual(firstCopy.file.path, secondCopy.file.path);
  assert.equal(parseTemplateFileText(await storage.read(firstCopy.file.path), 'forgetemplate').canOverwrite, true);
  assert.equal(parseTemplateFileText(await storage.read(secondCopy.file.path), 'forgetemplate').canOverwrite, true);
  assert.equal(await storage.read(legacyPath), legacyText, 'creating Forge copies must leave the legacy source untouched');
});

test('repeated Atlas imports use an existing matching sidecar and create independent Forge copies without writing either source', async () => {
  const storage = new MemoryTemplateStorage();
  const source = forgeFixture('Wolf', 'wolf-abc123');
  // This is an Atlas-native source: it deliberately contains no Forge metadata.
  const atlasText = JSON.stringify(source.template, null, 2);
  const atlasPath = 'Imports/Wolf.atlastemplate';
  await storage.ensureFolder('Imports');
  await storage.create(atlasPath, atlasText);
  const sidecarPath = `Imports/.statblock-forge/layouts/${source.template.id}.json`;
  await storage.ensureFolder('Imports/.statblock-forge/layouts');
  const sidecarText = serializeForgeLayout(source.layout);
  await storage.create(sidecarPath, sidecarText);

  const importCopy = async () => {
    const parsed = parseTemplateFileText(await storage.read(atlasPath), 'atlastemplate');
    assert.equal(parsed.canOverwrite, false);
    const resolved = resolveAtlasTemplateLayoutForForgeCopy(parsed.template, parsed.layout, await storage.read(sidecarPath));
    assert.equal(resolved.source, 'sidecar');
    return saveTemplateDocument({
      storage, templateFolder: 'Templates', name: 'Wolf', template: parsed.template,
      layout: resolved.layout, sourcePath: atlasPath, originalText: atlasText,
      saveAsCopy: true, allowUniqueNameOnConflict: true,
    });
  };

  const first = await importCopy();
  const second = await importCopy();
  assert.notEqual(first.template.id, second.template.id);
  assert.equal(first.template.derivedFrom.templateId, source.template.id);
  assert.equal(second.template.derivedFrom.templateId, source.template.id);
  assert.notEqual(first.file.path, second.file.path);
  for (const copy of [first, second]) {
    const parsedCopy = parseTemplateFileText(await storage.read(copy.file.path), 'forgetemplate');
    assert.equal(parsedCopy.canOverwrite, true);
    assert.equal(parsedCopy.layout.columns, 18);
    assert.equal(parsedCopy.layout.dense, false);
    assert.equal(parsedCopy.layout.sheetWidth, 840);
    assert.equal(parsedCopy.layout.blocks['main-section'].span, 12);
    assert.equal(parsedCopy.layout.blocks['hp-stat'].span, 9);
    assert.equal(parsedCopy.layout.blocks['hp-stat'].appearance.borderColor, '#123456');
    assert.equal(parsedCopy.layout.templateId, copy.template.id);
  }
  assert.equal(await storage.read(atlasPath), atlasText, 'repeated imports must not rewrite the native Atlas source');
  assert.equal(await storage.read(sidecarPath), sidecarText, 'import may read but never rewrite the Atlas sidecar');
  assert.equal([...storage.files.keys()].some((path) => path.endsWith('.atlastemplate') && path !== atlasPath), false);
});

test('restoring a moved Forge Template backup preserves identity and repairs v1/v2 backlinks', async () => {
  const storage = new MemoryTemplateStorage();
  const original = forgeFixture('Ash Drake', 'ash-drake-abc123');
  const movedTemplate = structuredClone(original.template);
  movedTemplate.name = 'Ash Drake - edited';
  const movedLayout = structuredClone(original.layout);
  movedLayout.templateId = movedTemplate.id;
  const movedText = serializeForgeTemplateFile(movedTemplate, movedLayout);
  const movedPath = 'Archive/Bestiary/Ash Drake.forgetemplate';
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake-2026-11-20T12-00-00-000Z.forgetemplate.bak';
  await storage.ensureFolder('Archive/Bestiary');
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(movedPath, movedText);
  const envelope = createTemplateBackupEnvelope('Templates/Ash Drake.forgetemplate', original.text, new Date('2026-11-20T12:00:00.000Z'));
  await storage.create(backupPath, serializeTemplateBackup(envelope));

  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.canRestore, true);
  assert.equal(backup.targetPath, movedPath, 'missing original path must be resolved by the unique stable Template ID');
  const restored = await restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: movedText, allowOverwrite: true,
    now: new Date('2026-11-20T13:00:00.000Z'),
  });
  assert.equal(restored.path, movedPath);
  assert.equal(restored.restoredExisting, true);
  assert.ok(restored.safetyBackupPath);
  assert.equal(await storage.read(movedPath), original.text);
  assert.equal(JSON.parse(await storage.read(restored.safetyBackupPath)).originalText, movedText);

  const v2Path = 'Bestiary/Ash Drake.md';
  const v1Path = 'Bestiary/Ash Drake Published.md';
  const notes = new Map([
    [v2Path, {
      name: 'Ash Drake', hp: 12,
      [FORGE_STATBLOCK_LINK_KEY]: createForgeStatblockTemplateLink({ templatePath: 'Templates/Ash Drake.forgetemplate', templateId: original.template.id }),
    }],
    [v1Path, {
      name: 'Ash Drake Published', 'atlas-template': 'atlas-ash-drake-xyz789',
      [FORGE_STATBLOCK_LINK_KEY]: createForgeStatblockTemplateLink({
        templatePath: 'Templates/Ash Drake.forgetemplate', templateId: original.template.id,
        atlasTemplateId: 'atlas-ash-drake-xyz789',
      }),
    }],
  ]);
  const result = await repairForgeTemplateLinks({
    async listTemplates() {
      return [...storage.files].filter(([path]) => path.endsWith('.forgetemplate')).map(([path, text]) => ({ path, templateId: JSON.parse(text).id }));
    },
    async listStatblockNotes() {
      return [...notes].map(([path, frontmatter]) => ({ path, frontmatter: structuredClone(frontmatter) }));
    },
    async updateNoteLink(path, update) {
      const current = notes.get(path);
      if (!current) return false;
      const next = structuredClone(current);
      if (!update(next)) return false;
      notes.set(path, next);
      return true;
    },
  });
  assert.equal(result.notesUpdated, 2);
  const v2 = notes.get(v2Path);
  const v1 = notes.get(v1Path);
  assert.equal(v2[FORGE_STATBLOCK_LINK_KEY].templatePath, movedPath);
  assert.equal(v1[FORGE_STATBLOCK_LINK_KEY].templatePath, movedPath);
  assert.equal(v1[FORGE_STATBLOCK_LINK_KEY].atlasTemplateId, 'atlas-ash-drake-xyz789');
  assert.equal(v1['atlas-template'], 'atlas-ash-drake-xyz789');
  assert.equal(v2.hp, 12);
  assert.equal(v1.name, 'Ash Drake Published');
});
