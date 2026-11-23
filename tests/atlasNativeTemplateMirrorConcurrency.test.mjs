import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureAtlasNativeTemplateMirror } from '../src/atlas/atlasNativeTemplateBridge.ts';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import { serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';

function createApp() {
  const template = createBlankTemplate('Wolf');
  template.id = 'wolf-abc123';
  const sourceText = serializeForgeTemplateFile(template, createForgeLayout(template));
  const sourceFile = { path: 'Templates/Wolf.forgetemplate', extension: 'forgetemplate', basename: 'Wolf' };
  const directories = new Set(['atlas-vtt', 'atlas-vtt/statblock-templates']);
  const files = new Map([[sourceFile.path, { file: sourceFile, text: sourceText }]]);
  // Files can briefly exist on disk while remaining absent from Obsidian's
  // indexed AbstractFile tree and getFiles() results.
  const unindexedFiles = new Map();
  const folderCreations = [];
  const fileCreations = [];
  const adapterWrites = [];
  const hiddenLookupPaths = new Set();
  const vault = {
    getAbstractFileByPath(path) {
      if (hiddenLookupPaths.has(path)) return null;
      if (files.has(path)) return files.get(path).file;
      if (directories.has(path)) return { path, children: [] };
      return null;
    },
    getFiles() { return [...files.values()].map((entry) => entry.file); },
    async cachedRead(file) { return files.get(file.path)?.text ?? ''; },
    async createFolder(path) {
      await new Promise((resolve) => setTimeout(resolve, 2));
      if (directories.has(path)) throw new Error('Folder already exists.');
      directories.add(path);
      folderCreations.push(path);
      return { path, children: [] };
    },
    async create(path, text) {
      if (files.has(path) || unindexedFiles.has(path)) throw new Error('File already exists.');
      const file = { path, extension: path.split('.').pop(), basename: path.split('/').pop().replace(/\.[^.]+$/, '') };
      files.set(path, { file, text });
      fileCreations.push(path);
      return file;
    },
    async modify(file, text) { files.set(file.path, { file, text }); },
    adapter: {
      async exists(path) {
        const wanted = path.toLocaleLowerCase();
        return [...directories].some((entry) => entry.toLocaleLowerCase() === wanted)
          || [...files.keys(), ...unindexedFiles.keys()].some((entry) => entry.toLocaleLowerCase() === wanted);
      },
      async read(path) {
        const unindexed = [...unindexedFiles.entries()].find(([entry]) => entry.toLocaleLowerCase() === path.toLocaleLowerCase());
        if (unindexed) return unindexed[1];
        const indexed = [...files.entries()].find(([entry]) => entry.toLocaleLowerCase() === path.toLocaleLowerCase());
        if (indexed) return indexed[1].text;
        throw new Error(`Not found: ${path}`);
      },
      async write(path, text) {
        const unindexed = [...unindexedFiles.keys()].find((entry) => entry.toLocaleLowerCase() === path.toLocaleLowerCase());
        const indexed = [...files.keys()].find((entry) => entry.toLocaleLowerCase() === path.toLocaleLowerCase());
        if (unindexed) unindexedFiles.set(unindexed, text);
        else if (indexed) files.get(indexed).text = text;
        else throw new Error(`Not found: ${path}`);
        adapterWrites.push(unindexed ?? indexed ?? path);
      },
      async list(path) {
        if (![...directories].some((entry) => entry.toLocaleLowerCase() === path.toLocaleLowerCase())) throw new Error(`Not a directory: ${path}`);
        return {
          files: [...files.keys(), ...unindexedFiles.keys()].filter((entry) => entry.slice(0, entry.lastIndexOf('/')).toLocaleLowerCase() === path.toLocaleLowerCase()),
          folders: [...directories].filter((entry) => entry.startsWith(`${path}/`)),
        };
      },
      async mkdir(path) {
        await new Promise((resolve) => setTimeout(resolve, 2));
        if (directories.has(path)) throw new Error('Folder already exists.');
        directories.add(path);
        folderCreations.push(path);
      },
    },
  };
  const app = { vault };
  return { app, sourceFile, directories, files, unindexedFiles, folderCreations, fileCreations, adapterWrites, hiddenLookupPaths };
}

test('simultaneous template save and statblock creation share one Atlas mirror operation', async () => {
  const { app, sourceFile, directories, files, folderCreations, fileCreations } = createApp();
  const [first, second] = await Promise.all([
    ensureAtlasNativeTemplateMirror(app, sourceFile),
    ensureAtlasNativeTemplateMirror(app, sourceFile),
  ]);

  assert.deepEqual(first, second);
  assert.equal(first.created, true);
  assert.ok(directories.has('atlas-vtt/statblock-templates/Forge Mirrors'));
  assert.deepEqual(folderCreations, ['atlas-vtt/statblock-templates/Forge Mirrors']);
  assert.deepEqual(fileCreations, ['atlas-vtt/statblock-templates/Forge Mirrors/Wolf (abc123).atlastemplate']);
  assert.ok(files.has(first.path));
  assert.ok(first.path.startsWith('atlas-vtt/statblock-templates/'), 'the mirror is placed in Atlas’ visible native template library');
  assert.ok(app.vault.getFiles().some((file) => file.path === first.path), 'Atlas TemplateLibrary can discover the mirror through Vault.getFiles()');
});


test('reuses an existing mirror through the adapter if the file is temporarily absent from the Obsidian index', async () => {
  const { app, sourceFile, files, unindexedFiles } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const mirrorText = files.get(first.path).text;

  // Simulate Obsidian's hidden-folder index omission while the adapter still
  // sees the existing on-disk file.
  files.delete(first.path);
  unindexedFiles.set(first.path, mirrorText);

  const second = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  assert.deepEqual(second, { templateId: first.templateId, path: first.path, created: false });
  assert.equal(unindexedFiles.get(first.path), mirrorText);
});

test('refreshes an existing unindexed mirror through the adapter when its Template id matches', async () => {
  const { app, sourceFile, files, unindexedFiles, adapterWrites } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const mirrorText = files.get(first.path).text;
  const staleText = mirrorText.replace('"label": "Name"', '"label": "Old Name"');
  files.delete(first.path);
  unindexedFiles.set(first.path, staleText);

  const second = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  assert.equal(second.created, false);
  assert.equal(unindexedFiles.get(first.path), mirrorText);
  assert.deepEqual(adapterWrites, [first.path]);
});

test('does not overwrite an unrelated file occupying the mirror path', async () => {
  const { app, sourceFile, files, unindexedFiles } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  files.delete(first.path);
  const unrelated = JSON.stringify({ id: 'some-other-template', name: 'Keep me' });
  unindexedFiles.set(first.path, unrelated);

  await assert.rejects(
    ensureAtlasNativeTemplateMirror(app, sourceFile),
    /já contém outro arquivo ou Template/i,
  );
  assert.equal(unindexedFiles.get(first.path), unrelated);
});

test('recovers when Vault.create reports File already exists after another process creates the mirror', async () => {
  const { app, sourceFile, files, unindexedFiles } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const mirrorText = files.get(first.path).text;
  files.delete(first.path);
  unindexedFiles.delete(first.path);

  // Force the create race after the initial adapter.exists() check.
  const originalCreate = app.vault.create.bind(app.vault);
  let injectedRace = false;
  app.vault.create = async (path, text) => {
    if (!injectedRace && path === first.path) {
      injectedRace = true;
      unindexedFiles.set(path, text);
      throw new Error('File already exists.');
    }
    return originalCreate(path, text);
  };

  const recovered = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  assert.equal(injectedRace, true);
  assert.deepEqual(recovered, { templateId: first.templateId, path: first.path, created: false });
  assert.equal(unindexedFiles.get(first.path), mirrorText);
});


test('reuses mirror TFiles from getFiles when path lookup temporarily omits them', async () => {
  const { app, sourceFile, files, fileCreations, hiddenLookupPaths } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const original = files.get(first.path).text;
  hiddenLookupPaths.add(first.path);
  const second = await ensureAtlasNativeTemplateMirror(app, sourceFile);

  assert.deepEqual(second, { templateId: first.templateId, path: first.path, created: false });
  assert.equal(files.get(first.path).text, original);
  assert.equal(fileCreations.filter((path) => path === first.path).length, 1);
});


test('migrates a legacy hidden mirror into Atlas visible template library folder', async () => {
  const { app, sourceFile, unindexedFiles, files } = createApp();
  const legacyPath = '.statblock-forge/atlas-native-templates/wolf-abc123.atlastemplate';
  const template = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const text = files.get(template.path).text;
  files.delete(template.path);
  unindexedFiles.set(legacyPath, text);

  const migrated = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  assert.equal(migrated.path, 'atlas-vtt/statblock-templates/Forge Mirrors/Wolf (abc123).atlastemplate');
  assert.equal(migrated.created, true);
  assert.ok(files.has(migrated.path));
  assert.equal(unindexedFiles.has(legacyPath), true, 'legacy files are left untouched');
});

test('recovers a case-insensitive existing-path collision by listing the Atlas template folder', async () => {
  const { app, sourceFile, files, unindexedFiles } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const mirrorText = files.get(first.path).text;
  files.delete(first.path);
  const differentlyCasedPath = first.path.replace('Wolf', 'WOLF').replace('(abc123)', '(ABC123)');
  unindexedFiles.set(differentlyCasedPath, mirrorText);

  const recovered = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  assert.equal(recovered.created, false);
  assert.equal(recovered.path, differentlyCasedPath);
  assert.equal(unindexedFiles.get(differentlyCasedPath), mirrorText);
});
