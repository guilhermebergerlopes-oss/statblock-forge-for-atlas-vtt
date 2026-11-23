import assert from 'node:assert/strict';
import test from 'node:test';
import { AtlasNativeRoleTemplateSync, ensureAtlasNativeTemplateMirror } from '../src/atlas/atlasNativeTemplateBridge.ts';
import { FORGE_ATLAS_ROLE_MIRROR_KEY, isForgeAtlasRoleMirror } from '../src/templates/atlasRoleMirrorMetadata.ts';
import { createBlankTemplate, createForgeLayout } from '../src/templates/forgeTemplate.ts';
import { serializeForgeTemplateFile } from '../src/templates/forgeFileFormat.ts';
import { readForgeTemplateLink, resolveForgeTemplateForNote } from '../src/atlas/forgeTemplateLinkResolver.ts';

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
  const listeners = new Map();
  const readyCallbacks = [];
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
    on(event, callback) {
      const rows = listeners.get(event) ?? new Set();
      rows.add(callback);
      listeners.set(event, rows);
      return { event, callback };
    },
    offref(ref) { listeners.get(ref.event)?.delete(ref.callback); },
    async emit(event, ...args) {
      return Promise.all([...(listeners.get(event) ?? [])].map((callback) => Promise.resolve(callback(...args))));
    },
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
  const metadataCache = { getFileCache(file) { return { frontmatter: file.frontmatter ?? null }; } };
  const app = { vault, metadataCache, workspace: { onLayoutReady(callback) { readyCallbacks.push(callback); } } };
  return { app, sourceFile, directories, files, unindexedFiles, folderCreations, fileCreations, adapterWrites, hiddenLookupPaths, listeners, readyCallbacks };
}

test('simultaneous template save and statblock creation share one Atlas mirror operation', async () => {
  const { app, sourceFile, directories, files, folderCreations, fileCreations } = createApp();
  const [first, second] = await Promise.all([
    ensureAtlasNativeTemplateMirror(app, sourceFile),
    ensureAtlasNativeTemplateMirror(app, sourceFile),
  ]);

  assert.deepEqual(first, second);
  assert.equal(first.created, true);
  assert.equal(first.sourceTemplateId, 'wolf-abc123');
  assert.notEqual(first.atlasTemplateId, first.sourceTemplateId, 'Atlas mirror IDs are independent from Forge source IDs');
  assert.ok(directories.has('atlas-vtt/statblock-templates/Forge Mirrors'));
  assert.deepEqual(folderCreations, ['atlas-vtt/statblock-templates/Forge Mirrors']);
  assert.deepEqual(fileCreations, ['atlas-vtt/statblock-templates/Forge Mirrors/Wolf (abc123).atlastemplate']);
  assert.ok(files.has(first.path));
  assert.equal(JSON.parse(files.get(first.path).text).id, first.atlasTemplateId, 'the different Atlas ID is persisted in the native template JSON');
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
  assert.deepEqual(second, { atlasTemplateId: first.atlasTemplateId, sourceTemplateId: first.sourceTemplateId, path: first.path, created: false });
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
  assert.equal(recovered.created, false);
  assert.equal(recovered.sourceTemplateId, first.sourceTemplateId);
  assert.notEqual(recovered.atlasTemplateId, recovered.sourceTemplateId);
  assert.equal(JSON.parse(unindexedFiles.get(first.path)).id, recovered.atlasTemplateId);
  assert.notEqual(unindexedFiles.get(first.path), mirrorText, 'a newly recreated mirror receives its own fresh Atlas ID');
});


test('reuses mirror TFiles from getFiles when path lookup temporarily omits them', async () => {
  const { app, sourceFile, files, fileCreations, hiddenLookupPaths } = createApp();
  const first = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const original = files.get(first.path).text;
  hiddenLookupPaths.add(first.path);
  const second = await ensureAtlasNativeTemplateMirror(app, sourceFile);

  assert.deepEqual(second, { atlasTemplateId: first.atlasTemplateId, sourceTemplateId: first.sourceTemplateId, path: first.path, created: false });
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


test('Atlas Role mirror uses native Atlas field IDs and carries a Forge ownership marker', async () => {
  const { app, sourceFile, files } = createApp();
  const result = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const mirror = JSON.parse(files.get(result.path).text);
  assert.equal(mirror.fields.find((field) => field.key === 'name').type, 'text');
  assert.equal(mirror.fields.find((field) => field.key === 'hp').type, 'number');
  assert.equal(isForgeAtlasRoleMirror(mirror), true);
  assert.deepEqual(mirror[FORGE_ATLAS_ROLE_MIRROR_KEY], {
    format: 'statblock-forge-atlas-role-mirror',
    version: 1,
    sourceTemplateId: 'wolf-abc123',
    sourceTemplatePath: 'Templates/Wolf.forgetemplate',
  });
  assert.equal(Object.hasOwn(mirror, 'statblockForge'), false, 'Forge-only layout metadata is not exposed to Atlas');
  assert.notEqual(mirror.id, 'wolf-abc123', 'the Atlas native template has its own ID');
});

test('migrates an older Forge mirror that reused the Forge source ID', async () => {
  const { app, sourceFile, files } = createApp();
  const source = JSON.parse(files.get(sourceFile.path).text);
  delete source.statblockForge;
  source.statblockForgeRoleMirror = {
    format: 'statblock-forge-atlas-role-mirror',
    version: 1,
    sourceTemplateId: 'wolf-abc123',
    sourceTemplatePath: sourceFile.path,
  };
  const legacyPath = 'atlas-vtt/statblock-templates/Forge Mirrors/Wolf (abc123).atlastemplate';
  const legacyFile = { path: legacyPath, extension: 'atlastemplate', basename: 'Wolf (abc123)' };
  files.set(legacyPath, { file: legacyFile, text: JSON.stringify(source, null, 2) });

  const migrated = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const mirror = JSON.parse(files.get(legacyPath).text);
  assert.equal(migrated.path, legacyPath, 'the existing mirror file is updated in place');
  assert.notEqual(migrated.atlasTemplateId, 'wolf-abc123');
  assert.equal(mirror.id, migrated.atlasTemplateId);
  assert.equal(mirror.statblockForgeRoleMirror.sourceTemplateId, 'wolf-abc123');
});

test('generates an Atlas mirror ID that does not collide with another native Atlas template', async () => {
  const { app, sourceFile, files } = createApp();
  const occupiedPath = 'atlas-vtt/statblock-templates/Existing.atlastemplate';
  const occupiedFile = { path: occupiedPath, extension: 'atlastemplate', basename: 'Existing' };
  files.set(occupiedPath, {
    file: occupiedFile,
    text: JSON.stringify({ id: 'wolf-atlas-role-aaaaaa', name: 'Existing Atlas Template' }),
  });

  const originalRandom = Math.random;
  Math.random = () => 10 / 36; // Forces the first candidate suffix to `aaaaaa`.
  try {
    const result = await ensureAtlasNativeTemplateMirror(app, sourceFile);
    assert.notEqual(result.atlasTemplateId, 'wolf-abc123');
    assert.notEqual(result.atlasTemplateId, 'wolf-atlas-role-aaaaaa');
    assert.equal(JSON.parse(files.get(result.path).text).id, result.atlasTemplateId);
  } finally {
    Math.random = originalRandom;
  }
});


test('Atlas-created Role notes resolve to the Forge source from atlas-template without rewriting YAML', async () => {
  const { app, sourceFile } = createApp();
  const mirror = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const note = {
    path: 'Statblocks/Wolf.md',
    basename: 'Wolf',
    extension: 'md',
    frontmatter: { statblock: true, 'atlas-template': mirror.atlasTemplateId, name: 'Wolf' },
  };

  const link = readForgeTemplateLink(app, note);
  assert.deepEqual(link, {
    format: 'statblock-forge-template-link',
    version: 1,
    templatePath: 'Templates/Wolf.forgetemplate',
    templateId: 'wolf-abc123',
    atlasTemplateId: mirror.atlasTemplateId,
  });

  const resolution = await resolveForgeTemplateForNote(app, note);
  assert.equal(resolution.status, 'linked');
  assert.equal(resolution.file.path, sourceFile.path);
  assert.equal(note.frontmatter['statblock-forge'], undefined, 'the note YAML remains owned by Atlas');
});

test('a malformed explicit Forge link is not replaced by inferred Atlas Role metadata', async () => {
  const { app, sourceFile } = createApp();
  const mirror = await ensureAtlasNativeTemplateMirror(app, sourceFile);
  const note = {
    path: 'Statblocks/Wolf.md', basename: 'Wolf', extension: 'md',
    frontmatter: { statblock: true, 'atlas-template': mirror.atlasTemplateId, 'statblock-forge': 'user-data' },
  };
  assert.equal(readForgeTemplateLink(app, note), null);
});

test('Forge Role template sync mirrors saved templates at startup and follows later saves', async () => {
  const { app, sourceFile, files, readyCallbacks, listeners } = createApp();
  const sync = new AtlasNativeRoleTemplateSync(app);
  sync.start();
  assert.ok(listeners.has('create'));
  assert.ok(listeners.has('modify'));
  assert.ok(listeners.has('rename'));

  const startup = await readyCallbacks[0]();
  assert.deepEqual(startup, { scanned: 1, synced: 1, failed: [] });
  const firstMirror = [...files.keys()].find((path) => path.endsWith('.atlastemplate'));
  assert.ok(firstMirror, 'existing Forge template is published for the Atlas Role selector');

  const secondTemplate = createBlankTemplate('Bear');
  secondTemplate.id = 'bear-abc123';
  const secondFile = { path: 'Templates/Bear.forgetemplate', extension: 'forgetemplate', basename: 'Bear' };
  files.set(secondFile.path, { file: secondFile, text: serializeForgeTemplateFile(secondTemplate, createForgeLayout(secondTemplate)) });
  await app.vault.emit('create', secondFile);
  assert.ok([...files.keys()].some((path) => path.endsWith('Bear (abc123).atlastemplate')));

  const updatedTemplate = createBlankTemplate('Wolf');
  updatedTemplate.id = 'wolf-abc123';
  updatedTemplate.fields.find((field) => field.key === 'hp').label = 'Health';
  const currentSource = files.get(sourceFile.path);
  currentSource.text = serializeForgeTemplateFile(updatedTemplate, createForgeLayout(updatedTemplate));
  await app.vault.emit('modify', sourceFile);
  const wolfMirrorPath = [...files.keys()].find((path) => path.endsWith('Wolf (abc123).atlastemplate'));
  assert.match(files.get(wolfMirrorPath).text, /"label": "Health"/);

  sync.stop();
  assert.equal([...listeners.values()].reduce((count, rows) => count + rows.size, 0), 0);
});
