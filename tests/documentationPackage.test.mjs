import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DOCUMENTATION_FOLDER,
  FORGE_DOCUMENTATION_FILES,
  DEFAULT_PT_BR_DOCUMENTATION_FOLDER,
  documentationFolderForLanguage,
  normalizeDocumentationFolder,
  writeForgeDocumentation,
  validateForgeDocumentationBundle,
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
  assert.equal(result.created, 35);
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

  assert.equal(result.created, 34);
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

test('downloadable Portuguese and English guides document Table Row and Column Formulas', () => {
  const portuguese = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '34 - Fórmulas em Tables.md');
  const english = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '34 - Table Formulas.md');
  assert.ok(portuguese);
  assert.ok(english);
  assert.equal(FORGE_DOCUMENTATION_FILES.length, 35);
  assert.equal(FORGE_DOCUMENTATION_FILES_EN.length, 35);
  for (const guide of [portuguese.content, english.content]) {
    assert.match(guide, /Row Formula/);
    assert.match(guide, /Column Formula/);
    assert.match(guide, /\{fieldKey\.sum\}/);
    assert.match(guide, /\{fieldKey\.average\}/);
    assert.match(guide, /any Field|qualquer Field/i);
    assert.match(guide, /500 characters|500 caracteres/);
  }
  assert.match(portuguese.content, /Cada linha usa sua própria quantidade/);
  assert.match(english.content, /Each row uses its own quantity/);
});

test('both downloadable documentation bundles contain 35 unique, non-empty Markdown notes', () => {
  for (const files of [FORGE_DOCUMENTATION_FILES, FORGE_DOCUMENTATION_FILES_EN]) {
    assert.equal(files.length, 35);
    assert.doesNotThrow(() => validateForgeDocumentationBundle(files));
    assert.equal(new Set(files.map((file) => file.name)).size, files.length);
    for (const file of files) {
      assert.ok(file.content.trim().length > 0, `${file.name} must not be empty`);
      assert.match(file.content, /^---\n/, `${file.name} must start with Markdown frontmatter`);
    }
  }
});

test('documentation bundle validation rejects missing content and duplicate names', () => {
  assert.throws(
    () => validateForgeDocumentationBundle([
      { name: '01 - Valid.md', content: '# Valid note' },
      { name: '02 - Empty.md', content: '  ' },
      { name: '01 - Valid.md', content: '# Duplicate' },
    ]),
    /02 - Empty\.md: conteúdo vazio; 01 - Valid\.md: nome duplicado/,
  );
});

test('Portuguese and English guides document stable references to specific Table cells', () => {
  const portugueseNumeric = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '25 - Fórmulas em Number e Rating.md');
  const englishNumeric = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '25 - Formulas in Number and Rating.md');
  const portugueseTable = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '34 - Fórmulas em Tables.md');
  const englishTable = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '34 - Table Formulas.md');
  for (const guide of [portugueseNumeric?.content, englishNumeric?.content, portugueseTable?.content, englishTable?.content]) {
    assert.ok(guide);
    assert.match(guide, /\{table_1\.row2\.value\}/);
    assert.match(guide, /@table_1\.row2\.value/);
    assert.match(guide, /row1/);
    assert.match(guide, /row2/);
    assert.match(guide, /positional|posicional|posição|position/i);
  }
});

test('downloadable Table formula guides distinguish bare value from an explicit value Field reference', () => {
  const portuguese = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '34 - Fórmulas em Tables.md');
  const english = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '34 - Table Formulas.md');
  assert.ok(portuguese);
  assert.ok(english);
  for (const guide of [portuguese.content, english.content]) {
    assert.match(guide, /floor\(\(\{value\}-10\)\/2\)/);
    assert.match(guide, /@value/);
    assert.match(guide, /same row|mesma linha/i);
    assert.match(guide, /original stored value|valor armazenado originalmente/i);
  }
});

test('formula guides explain that references use displayed Number/Rating results', () => {
  const portuguese = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '25 - Fórmulas em Number e Rating.md');
  const english = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '25 - Formulas in Number and Rating.md');
  assert.ok(portuguese);
  assert.ok(english);
  assert.match(portuguese.content, /resultado que esse Field exibe/);
  assert.match(portuguese.content, /input bruto/);
  assert.match(english.content, /result that Field displays/);
  assert.match(english.content, /raw input/);
});

test('the index describes the special meaning of value in Table formulas', () => {
  const portuguese = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '00 - Índice.md');
  const english = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '00 - Index.md');
  assert.ok(portuguese);
  assert.ok(english);
  for (const guide of [portuguese.content, english.content]) {
    assert.match(guide, /Row Formula/);
    assert.match(guide, /Column Formula/);
    assert.match(guide, /\{value\}/);
    assert.match(guide, /@value/);
  }
});


test('downloadable Table guides explain hidden row-label heading and plain-number fallback', () => {
  const portugueseCore = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '03 - Conceitos fundamentais.md');
  const portugueseFields = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '05 - Fields.md');
  const portugueseContainers = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '10 - Containers: visão geral.md');
  const englishCore = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '03 - Core Concepts.md');
  const englishFields = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '05 - Fields.md');
  const englishContainers = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '10 - Containers Overview.md');

  for (const guide of [portugueseCore?.content, portugueseFields?.content, portugueseContainers?.content]) {
    assert.ok(guide);
    assert.match(guide, /Show Labels in rows/);
    assert.match(guide, /cabeçalho visível/);
    assert.match(guide, /`1`, `2`, `3`/);
    assert.match(guide, /Counter/);
  }
  for (const guide of [portugueseFields?.content, portugueseContainers?.content]) {
    assert.ok(guide);
    assert.match(guide, /rótulo personalizado/);
  }
  for (const guide of [englishCore?.content, englishFields?.content, englishContainers?.content]) {
    assert.ok(guide);
    assert.match(guide, /Show Labels in rows/);
    assert.match(guide, /no visible `Row` heading|no visible heading/);
    assert.match(guide, /`1`, `2`, `3`/);
    assert.match(guide, /custom label/);
    assert.match(guide, /Counter/);
    assert.doesNotMatch(guide, /Show Field labels in rows.*one Field per row/);
  }
});

test('downloadable Table guides distinguish always-available Template row controls from statblock permission', () => {
  const portuguese = FORGE_DOCUMENTATION_FILES.find((file) => file.name === '10 - Containers: visão geral.md');
  const english = FORGE_DOCUMENTATION_FILES_EN.find((file) => file.name === '10 - Containers Overview.md');
  assert.ok(portuguese);
  assert.ok(english);
  assert.match(portuguese.content, /modo de construção do Template.*adicionar e remover linhas ficam sempre visíveis/i);
  assert.match(portuguese.content, /Allow adding rows in statblocks.*somente.*statblocks/i);
  assert.match(english.content, /Template construction mode.*controls.*always visible/i);
  assert.match(english.content, /Allow adding rows in statblocks.*only in rendered statblocks/i);
});
