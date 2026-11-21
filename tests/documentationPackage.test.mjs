import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DOCUMENTATION_FOLDER,
  FORGE_DOCUMENTATION_FILES,
  DEFAULT_PT_BR_DOCUMENTATION_FOLDER,
  documentationFolderForLanguage,
  normalizeDocumentationFolder,
  writeForgeDocumentation,
} from '../src/documentation/documentationPackage.ts';
import { FORGE_DOCUMENTATION_FILES_EN } from '../src/documentation/documentationPackage.en.ts';

function createVaultMock() {
  const folders = new Set();
  const files = new Map();
  const vault = {
    getAbstractFileByPath(path) {
      if (files.has(path)) return { path, extension: 'md' };
      if (folders.has(path)) return { path, children: [] };
      return null;
    },
    async createFolder(path) {
      if (files.has(path)) throw new Error(`Path is a file: ${path}`);
      folders.add(path);
      return { path, children: [] };
    },
    async create(path, content) {
      if (files.has(path) || folders.has(path)) throw new Error(`Path already exists: ${path}`);
      const file = { path, extension: 'md' };
      files.set(path, content);
      return file;
    },
  };
  return { vault, folders, files };
}

test('normalizes documentation folders and uses a safe default for invalid paths', () => {
  assert.equal(normalizeDocumentationFolder('  Bestiary\\Docs///Forge/  '), 'Bestiary/Docs/Forge');
  assert.equal(normalizeDocumentationFolder(' / '), DEFAULT_DOCUMENTATION_FOLDER);
  assert.equal(normalizeDocumentationFolder('../outside'), DEFAULT_DOCUMENTATION_FOLDER);
  assert.equal(normalizeDocumentationFolder(null), DEFAULT_DOCUMENTATION_FOLDER);
});

test('localizes built-in documentation folders but preserves custom folders', () => {
  assert.equal(documentationFolderForLanguage(DEFAULT_DOCUMENTATION_FOLDER, 'pt-BR'), DEFAULT_PT_BR_DOCUMENTATION_FOLDER);
  assert.equal(documentationFolderForLanguage(DEFAULT_PT_BR_DOCUMENTATION_FOLDER, 'en'), DEFAULT_DOCUMENTATION_FOLDER);
  assert.equal(documentationFolderForLanguage('Campaign/Reference', 'pt-BR'), 'Campaign/Reference');
});

test('writes the selected language documentation and creates nested folders', async () => {
  const { vault, folders, files } = createVaultMock();
  const result = await writeForgeDocumentation(vault, 'Campaign/Forge Docs', 'en');

  assert.equal(result.folder, 'Campaign/Forge Docs');
  assert.equal(result.created, 34);
  assert.equal(result.preserved, 0);
  assert.ok(folders.has('Campaign'));
  assert.ok(folders.has('Campaign/Forge Docs'));
  assert.ok(files.has('Campaign/Forge Docs/00 - Index.md'));
  assert.match(files.get('Campaign/Forge Docs/00 - Index.md'), /Statblock Forge documentation/);
});

test('preserves existing notes and fills only missing documentation files', async () => {
  const { vault, files } = createVaultMock();
  const path = `${DEFAULT_DOCUMENTATION_FOLDER}/00 - Índice.md`;
  files.set(path, '# My personal notes');

  const result = await writeForgeDocumentation(vault, DEFAULT_DOCUMENTATION_FOLDER, 'pt-BR');

  assert.equal(result.created, 33);
  assert.equal(result.preserved, 1);
  assert.equal(files.get(path), '# My personal notes');
});

test('does not overwrite a folder that conflicts with a documentation filename', async () => {
  const { vault, folders } = createVaultMock();
  const folder = DEFAULT_DOCUMENTATION_FOLDER;
  const conflictingPath = `${folder}/00 - Index.md`;
  folders.add(folder);
  folders.add(conflictingPath);

  await assert.rejects(
    writeForgeDocumentation(vault, folder, 'en'),
    /já existe como pasta/,
  );
});

test('downloadable Portuguese and English guides document Checkbox multiple choices and Selection boolean formulas', () => {
  const portuguese = FORGE_DOCUMENTATION_FILES.find((file) => file.name.includes('Checkboxes e referências'));
  const english = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name.includes('Checkboxes and Boolean'));
  assert.ok(portuguese);
  assert.ok(english);
  assert.match(portuguese.content, /Escolhas únicas e múltiplas/);
  assert.match(portuguese.content, /outros Fields Checkboxes nunca são afetados/i);
  assert.match(english.content, /Single and multiple choices/);
  assert.match(english.content, /Other Checkboxes Fields are never affected/);
  assert.match(portuguese.content, /Selection como Booleano/);
  assert.match(portuguese.content, /stance\.aggressive/);
  assert.match(portuguese.content, /@languages\.common\.number/);
  assert.match(portuguese.content, /número estiver vazio/);
  assert.match(english.content, /Selection as a boolean/);
  assert.match(english.content, /stance\.aggressive/);
  assert.match(english.content, /@languages\.common\.number/);
  assert.match(english.content, /number is blank/);
});
