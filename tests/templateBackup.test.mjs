import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createTemplateBackupEnvelope,
  listTemplateBackups,
  restoreTemplateBackup,
  serializeTemplateBackup,
} from '../src/templates/templateBackup.ts';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import { serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';

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
    return { path, basename: path.split('/').pop().replace(/\.[^.]+$/, '') };
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
      } catch { /* invalid templates do not reserve a verifiable ID */ }
    }
    return rows;
  }
}

function fixture(name = 'Ash Drake') {
  const template = createBlankTemplate(name);
  const layout = createForgeLayout(template);
  return { template, layout, text: serializeForgeTemplateFile(template, layout) };
}

function envelopeBackup(path, originalText, createdAt = new Date('2026-11-20T12:00:00.000Z')) {
  return serializeTemplateBackup(createTemplateBackupEnvelope(path, originalText, createdAt));
}

test('lists a validated versioned backup with its exact original path and restore target', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  const path = 'Templates/Ash Drake.forgetemplate';
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(path, original.text);
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake-2026-11-20T12-00-00-000Z.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup(path, original.text));

  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.canRestore, true);
  assert.equal(backup.originalPath, path);
  assert.equal(backup.targetPath, path);
  assert.equal(backup.targetExists, true);
  assert.equal(backup.templateId, original.template.id);
  assert.equal(backup.backupText, await storage.read(backupPath));
});

test('rejects a backup envelope whose checksum or byte size no longer matches', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  const envelope = createTemplateBackupEnvelope('Templates/Ash Drake.forgetemplate', original.text);
  envelope.originalText += '\n';
  await storage.create('Templates/.statblock-forge/backups/damaged.forgetemplate.bak', serializeTemplateBackup(envelope));

  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.canRestore, false);
  assert.match(backup.message, /checksum|tamanho/i);
});

test('restores a missing original file from an exact validated backup without changing its ID', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup('Templates/Ash Drake.forgetemplate', original.text));
  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.targetExists, false);

  const result = await restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: null, allowOverwrite: false,
  });
  assert.equal(result.path, 'Templates/Ash Drake.forgetemplate');
  assert.equal(result.restoredExisting, false);
  assert.equal(await storage.read(result.path), original.text);
  assert.equal(JSON.parse(await storage.read(result.path)).id, original.template.id);
});

test('replacing the same Template ID creates a safety backup before compare-and-swap restoration', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  const currentTemplate = structuredClone(original.template);
  currentTemplate.name = 'Ash Drake Reworked';
  const currentText = serializeForgeTemplateFile(currentTemplate, original.layout);
  const targetPath = 'Templates/Ash Drake.forgetemplate';
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(targetPath, currentText);
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake-old.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup(targetPath, original.text));

  const [backup] = await listTemplateBackups(storage, 'Templates');
  const result = await restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: currentText, allowOverwrite: true,
    now: new Date('2026-11-20T13:00:00.000Z'),
  });
  assert.equal(result.restoredExisting, true);
  assert.equal(await storage.read(targetPath), original.text);
  assert.ok(result.safetyBackupPath);
  const safety = JSON.parse(await storage.read(result.safetyBackupPath));
  assert.equal(safety.originalPath, targetPath);
  assert.equal(safety.originalText, currentText);
});

test('requires explicit overwrite approval for an existing target', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  const targetPath = 'Templates/Ash Drake.forgetemplate';
  const currentText = original.text.replace('Ash Drake', 'Ash Drake Changed');
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(targetPath, currentText);
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup(targetPath, original.text));
  const [backup] = await listTemplateBackups(storage, 'Templates');
  await assert.rejects(() => restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: currentText, allowOverwrite: false,
  }), /confirmação explícita/i);
  assert.equal(await storage.read(targetPath), currentText);
});

test('preserves a concurrent target edit made after the restore confirmation snapshot', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  const targetPath = 'Templates/Ash Drake.forgetemplate';
  const current = JSON.parse(original.text);
  current.fields[0].label = 'Changed after listing';
  const currentText = JSON.stringify(current);
  const concurrent = JSON.parse(original.text);
  concurrent.fields[0].label = 'Concurrent edit';
  const concurrentText = JSON.stringify(concurrent);
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(targetPath, currentText);
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup(targetPath, original.text));
  const [backup] = await listTemplateBackups(storage, 'Templates');
  storage.files.set(targetPath, concurrentText);
  await assert.rejects(() => restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: currentText, allowOverwrite: true,
  }), /alterado depois da confirmação/i);
  assert.equal(await storage.read(targetPath), concurrentText);
});

test('preserves a backup changed after it was listed', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup('Templates/Ash Drake.forgetemplate', original.text));
  const [backup] = await listTemplateBackups(storage, 'Templates');
  storage.files.set(backupPath, `${backup.backupText} `);
  await assert.rejects(() => restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: null, allowOverwrite: false,
  }), /backup mudou/i);
});

test('blocks restoration when the original path now belongs to a different Template ID', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture('Ash Drake');
  const other = fixture('Other Template');
  const targetPath = 'Templates/Ash Drake.forgetemplate';
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(targetPath, other.text);
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake.forgetemplate.bak';
  await storage.create(backupPath, envelopeBackup(targetPath, original.text));
  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.canRestore, false);
  assert.match(backup.message, /outro Template/i);
});

test('legacy raw backups resolve by stable ID when the original file was moved', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  const movedPath = 'Templates/Recovered/Ash Drake.forgetemplate';
  await storage.ensureFolder('Templates/Recovered');
  await storage.create(movedPath, original.text);
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake-2026-11-20T12-00-00-000Z.forgetemplate.bak';
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  await storage.create(backupPath, original.text);
  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.isLegacy, true);
  assert.equal(backup.targetPath, movedPath);
  assert.equal(backup.canRestore, true);
});

test('legacy raw backups without a matching ID restore as a new file without overwriting', async () => {
  const storage = new MemoryTemplateStorage();
  const original = fixture();
  await storage.ensureFolder('Templates/.statblock-forge/backups');
  const backupPath = 'Templates/.statblock-forge/backups/Ash Drake-2026-11-20T12-00-00-000Z.forgetemplate.bak';
  await storage.create(backupPath, original.text);
  const [backup] = await listTemplateBackups(storage, 'Templates');
  assert.equal(backup.targetPath, 'Templates/Ash Drake.forgetemplate');
  const result = await restoreTemplateBackup({
    storage, templateFolder: 'Templates', backup,
    expectedBackupText: backup.backupText, expectedTargetText: null, allowOverwrite: false,
  });
  assert.equal(result.restoredExisting, false);
  assert.equal(await storage.read(result.path), original.text);
});


test('Command Palette exposes the backup recovery manager and its explicit restore workflow', async () => {
  const [mainSource, modalSource] = await Promise.all([
    readFile(new URL('../main.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/views/TemplateBackupManagerModal.ts', import.meta.url), 'utf8'),
  ]);
  assert.match(mainSource, /id:\s*'recover-forge-template-backup'/);
  assert.match(mainSource, /new TemplateBackupManagerModal\(/);
  assert.match(modalSource, /Review restore/);
  assert.match(modalSource, /Restore backup/);
  assert.match(modalSource, /restoreTemplateBackup\(/);
});
