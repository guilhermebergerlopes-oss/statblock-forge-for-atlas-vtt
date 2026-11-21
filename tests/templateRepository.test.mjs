import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBlankTemplate,
  createForgeLayout,
} from '../src/templates/forgeTemplate.ts';
import {
  TemplateConflictError,
  TemplateNameConflictError,
  saveTemplateDocument,
} from '../src/templates/templateRepository.ts';
import { parseTemplateFileText, serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';
import { listTemplateBackups } from '../src/templates/templateBackup.ts';

class MemoryTemplateStorage {
  files = new Map();
  folders = new Set();
  beforeCompareAndSwap = null;

  exists(path) { return this.files.has(path) || this.folders.has(path); }
  async read(path) {
    if (!this.files.has(path)) throw new Error(`Missing file: ${path}`);
    return this.files.get(path);
  }
  async create(path, contents) {
    if (this.exists(path)) throw new Error(`Already exists: ${path}`);
    this.files.set(path, contents);
    const basename = path.split('/').pop().replace(/\.[^.]+$/, '');
    return { path, basename };
  }
  async modify(path, contents) {
    if (!this.files.has(path)) throw new Error(`Missing file: ${path}`);
    this.files.set(path, contents);
  }
  async compareAndSwap(path, expectedText, contents) {
    if (this.beforeCompareAndSwap) await this.beforeCompareAndSwap(path, expectedText, contents, this);
    const currentText = this.files.get(path) ?? '';
    if (currentText !== expectedText) return { written: false, currentText };
    this.files.set(path, contents);
    return { written: true, currentText };
  }
  async rename(path, newPath) {
    const contents = await this.read(path);
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
  async listBackupFiles(folder) {
    const prefix = `${folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/`;
    return [...this.files.keys()]
      .filter((path) => path.startsWith(prefix) && path.toLowerCase().endsWith('.forgetemplate.bak'))
      .map((path) => ({ path, basename: path.split('/').pop(), size: this.files.get(path).length, mtime: 0 }));
  }
  async listTemplateIds() {
    const rows = [];
    for (const [path, text] of this.files) {
      if (!/\.(?:forgetemplate|atlastemplate)$/i.test(path)) continue;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.format === 'atlas-statblock-template' && typeof parsed.id === 'string') rows.push({ path, id: parsed.id });
      } catch { /* malformed files do not reserve an unverifiable id */ }
    }
    return rows;
  }
}

function templateFixture(name = 'Ash Drake') {
  const template = createBlankTemplate(name);
  template.layout.blocks = [
    { id: 'main-section', type: 'section', label: 'Main', blocks: [
      { id: 'hp-stat', type: 'stat', field: 'hp' },
    ] },
  ];
  return template;
}

function atlasSourceFixture(name = 'Ash Drake') {
  const template = templateFixture(name);
  return JSON.stringify({
    format: 'atlas-statblock-template',
    version: 1,
    id: 'ash-drake-abc123',
    fields: [
      { key: 'summary', label: 'Summary', type: 'text' },
      { key: 'stance', label: 'Stance', type: 'choice', options: ['Aggressive', 'Defensive'] },
      { key: 'resources', label: 'Resources', type: 'counters' },
      { key: 'groups', label: 'Groups', type: 'spells' },
    ],
    layout: template.layout,
  }, null, 2) + '\n';
}

test('importing an Atlas template creates a Forge-owned copy and preserves the original source', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Imports');
  const sourcePath = 'Imports/Ash Drake.atlastemplate';
  const originalText = atlasSourceFixture();
  storage.files.set(sourcePath, originalText);
  const parsed = parseTemplateFileText(originalText, 'atlastemplate');
  assert.equal(parsed.fileFormat, 'atlas');
  assert.equal(parsed.canOverwrite, false, 'Atlas imports are read-only');

  const saved = await saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Ash Drake',
    template: parsed.template,
    layout: createForgeLayout(parsed.template),
    sourcePath,
    originalText,
  });

  assert.equal(saved.file.path, 'Templates/Ash Drake.forgetemplate');
  assert.equal(saved.createdCopy, true);
  assert.notEqual(saved.template.id, parsed.template.id);
  assert.deepEqual(saved.template.derivedFrom, { templateId: parsed.template.id });
  assert.equal(parseTemplateFileText(saved.serializedTemplate, 'forgetemplate').fileFormat, 'forge');
  assert.deepEqual(JSON.parse(saved.serializedTemplate).fields.map((field) => field.type), ['inline', 'selection', 'counter', 'groups']);
  assert.equal(await storage.read(sourcePath), originalText, 'the Atlas source is never modified');
  assert.equal([...storage.files.keys()].some((path) => path.endsWith('.atlastemplate') && path !== sourcePath), false);
});

test('Atlas source stays read-only even when caller requests an ordinary save rather than Save As Copy', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Imports');
  const sourcePath = 'Imports/Ash Drake.atlastemplate';
  const originalText = atlasSourceFixture();
  storage.files.set(sourcePath, originalText);
  const parsed = parseTemplateFileText(originalText, 'atlastemplate');
  parsed.template.fields[0].label = 'Changed in Forge';

  const saved = await saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Ash Drake',
    template: parsed.template,
    layout: createForgeLayout(parsed.template),
    sourcePath,
    originalText,
    saveAsCopy: false,
  });

  assert.equal(saved.file.path, 'Templates/Ash Drake.forgetemplate');
  assert.equal(JSON.parse(await storage.read(sourcePath)).fields[0].label, 'Summary');
  assert.equal(JSON.parse(await storage.read(saved.file.path)).fields[0].label, 'Changed in Forge');
});

test('Atlas import reports a conflict when the Forge destination already exists', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Imports');
  await storage.ensureFolder('Templates');
  const sourcePath = 'Imports/Ash Drake.atlastemplate';
  const originalText = atlasSourceFixture();
  storage.files.set(sourcePath, originalText);
  const existing = templateFixture('Ash Drake');
  storage.files.set('Templates/Ash Drake.forgetemplate', serializeForgeTemplateFile(existing, createForgeLayout(existing)));
  const parsed = parseTemplateFileText(originalText, 'atlastemplate');

  await assert.rejects(() => saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Ash Drake',
    template: parsed.template,
    layout: createForgeLayout(parsed.template),
    sourcePath,
    originalText,
    saveAsCopy: true,
  }), TemplateNameConflictError);
  assert.equal(await storage.read(sourcePath), originalText);
});

test('updating an existing Forge template uses compare-and-swap and preserves its stable ID', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Templates');
  const template = templateFixture();
  const path = 'Templates/Ash Drake.forgetemplate';
  const originalText = serializeForgeTemplateFile(template, createForgeLayout(template));
  storage.files.set(path, originalText);
  const edited = structuredClone(template);
  edited.fields[0].label = 'Creature Name';

  const saved = await saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Ash Drake',
    template: edited,
    layout: createForgeLayout(edited),
    sourcePath: path,
    originalText,
  });

  assert.equal(saved.file.path, path);
  assert.equal(saved.createdCopy, false);
  assert.equal(saved.template.id, template.id);
  assert.equal(JSON.parse(await storage.read(path)).fields[0].label, 'Creature Name');
});

test('updating a Forge template rejects a concurrent external edit', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Templates');
  const template = templateFixture();
  const path = 'Templates/Ash Drake.forgetemplate';
  const originalText = serializeForgeTemplateFile(template, createForgeLayout(template));
  storage.files.set(path, originalText);
  const concurrent = JSON.stringify({ ...JSON.parse(originalText), concurrentEdit: true });
  storage.beforeCompareAndSwap = async (target, _expected, _contents, store) => {
    if (target === path) {
      store.files.set(path, concurrent);
      store.beforeCompareAndSwap = null;
    }
  };

  await assert.rejects(() => saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Ash Drake',
    template,
    layout: createForgeLayout(template),
    sourcePath: path,
    originalText,
  }), TemplateConflictError);
  assert.equal(await storage.read(path), concurrent);
});

test('confirmed Forge replacement creates a versioned backup with exact original content', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Templates');
  const existing = templateFixture('Replacement');
  const targetPath = 'Templates/Replacement.forgetemplate';
  const currentText = serializeForgeTemplateFile(existing, createForgeLayout(existing));
  storage.files.set(targetPath, currentText);
  const replacement = templateFixture('Replacement');
  replacement.fields[0].label = 'New Replacement';

  const saved = await saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Replacement',
    template: replacement,
    layout: createForgeLayout(replacement),
    saveAsCopy: true,
    overwriteExistingPath: targetPath,
    expectedOverwriteText: currentText,
    now: new Date('2026-11-20T14:00:00.000Z'),
  });

  assert.equal(saved.overwrittenExisting, true);
  assert.ok(saved.backupPath);
  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.canRestore, true);
  assert.equal(backup.originalPath, targetPath);
  assert.equal(backup.templateId, existing.id);
  assert.equal(JSON.parse(backup.backupText).originalText, currentText);
  assert.equal(JSON.parse(await storage.read(targetPath)).id, existing.id);
});

test('confirmed Forge replacement keeps the backup when a concurrent edit wins', async () => {
  const storage = new MemoryTemplateStorage();
  await storage.ensureFolder('Templates');
  const existing = templateFixture('Replacement');
  const targetPath = 'Templates/Replacement.forgetemplate';
  const currentText = serializeForgeTemplateFile(existing, createForgeLayout(existing));
  storage.files.set(targetPath, currentText);
  const concurrent = JSON.stringify({ ...JSON.parse(currentText), concurrentEdit: true });
  storage.beforeCompareAndSwap = async (path, _expected, _contents, store) => {
    if (path === targetPath) {
      store.files.set(path, concurrent);
      store.beforeCompareAndSwap = null;
    }
  };

  await assert.rejects(() => saveTemplateDocument({
    storage,
    templateFolder: 'Templates',
    name: 'Replacement',
    template: templateFixture('Replacement'),
    layout: createForgeLayout(templateFixture('Replacement')),
    saveAsCopy: true,
    overwriteExistingPath: targetPath,
    expectedOverwriteText: currentText,
    now: new Date('2026-11-20T15:00:00.000Z'),
  }), /alterado durante a criação do backup/i);
  assert.equal(await storage.read(targetPath), concurrent);
  const backups = await listTemplateBackups(storage, 'Templates');
  assert.equal(backups.length, 1);
  assert.equal(backups[0].canRestore, true);
});
