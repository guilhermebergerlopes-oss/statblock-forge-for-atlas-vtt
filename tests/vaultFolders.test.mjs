import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureVaultFolder, VaultFolderPathConflictError } from '../src/utils/vaultFolders.ts';

function createVault({ folders = [], files = [], hideIndexedFolders = false, delayCreate = false } = {}) {
  const directorySet = new Set(folders);
  const fileSet = new Set(files);
  const created = [];
  const getAbstractFileByPath = (path) => {
    if (fileSet.has(path)) return { path, extension: path.split('.').pop() };
    if (directorySet.has(path) && !hideIndexedFolders) return { path, children: [] };
    return null;
  };
  const vault = {
    getAbstractFileByPath,
    adapter: {
      async exists(path) { return directorySet.has(path) || fileSet.has(path); },
      async list(path) {
        if (!directorySet.has(path)) throw new Error(`Not a folder: ${path}`);
        return { files: [], folders: [...directorySet].filter((entry) => entry.startsWith(`${path}/`)) };
      },
      async mkdir(path) {
        if (directorySet.has(path) || fileSet.has(path)) throw new Error('Folder already exists.');
        const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        if (parent && !directorySet.has(parent)) throw new Error(`Missing parent folder: ${parent}`);
        directorySet.add(path);
        created.push(path);
      },
    },
    async createFolder(path) {
      if (delayCreate) await new Promise((resolve) => setTimeout(resolve, 2));
      if (directorySet.has(path) || fileSet.has(path)) throw new Error('Folder already exists.');
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      if (parent && !directorySet.has(parent)) throw new Error(`Missing parent folder: ${parent}`);
      directorySet.add(path);
      created.push(path);
      return { path, children: [] };
    },
  };
  return { vault, directorySet, fileSet, created };
}

test('reuses hidden folders that exist in the adapter but are absent from the Vault index', async () => {
  const { vault, created } = createVault({
    folders: ['.statblock-forge', '.statblock-forge/atlas-native-templates'],
    hideIndexedFolders: true,
  });

  await ensureVaultFolder(vault, '.statblock-forge/atlas-native-templates');
  assert.deepEqual(created, []);
});

test('coalesces concurrent folder creation instead of surfacing Folder already exists', async () => {
  const { vault, directorySet, created } = createVault({ delayCreate: true });

  await Promise.all([
    ensureVaultFolder(vault, '.statblock-forge/atlas-native-templates'),
    ensureVaultFolder(vault, '.statblock-forge/atlas-native-templates'),
    ensureVaultFolder(vault, '.statblock-forge/atlas-native-templates'),
  ]);

  assert.ok(directorySet.has('.statblock-forge'));
  assert.ok(directorySet.has('.statblock-forge/atlas-native-templates'));
  assert.deepEqual(created, ['.statblock-forge', '.statblock-forge/atlas-native-templates']);
});

test('accepts another writer winning the createFolder race', async () => {
  const { vault, directorySet } = createVault();
  const originalCreate = vault.createFolder;
  let first = true;
  vault.createFolder = async (path) => {
    if (first) {
      first = false;
      directorySet.add(path);
      throw new Error('Folder already exists.');
    }
    return originalCreate(path);
  };

  await ensureVaultFolder(vault, 'Templates/New');
  assert.ok(directorySet.has('Templates'));
  assert.ok(directorySet.has('Templates/New'));
});

test('does not treat a file as an existing folder', async () => {
  const { vault } = createVault({ files: ['Templates'] });
  await assert.rejects(
    ensureVaultFolder(vault, 'Templates/New'),
    (error) => error instanceof VaultFolderPathConflictError && error.path === 'Templates',
  );
});


test('reuses an existing folder whose path differs only by letter case', async () => {
  const directorySet = new Set(['bestiary']);
  const created = [];
  const vault = {
    getAbstractFileByPath(path) {
      return directorySet.has(path) ? { path, children: [] } : null;
    },
    async createFolder(path) {
      if ([...directorySet].some((entry) => entry.toLocaleLowerCase() === path.toLocaleLowerCase())) {
        throw new Error('Folder already exists.');
      }
      directorySet.add(path);
      created.push(path);
      return { path, children: [] };
    },
    adapter: {
      async exists(path) { return directorySet.has(path); },
      async list(path) {
        const parent = path ? [...directorySet].find((entry) => entry.toLocaleLowerCase() === path.toLocaleLowerCase()) : '';
        if (path && !parent) throw new Error(`Not a folder: ${path}`);
        return {
          files: [],
          folders: [...directorySet].filter((entry) => (entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/')) : '') === parent),
        };
      },
    },
  };

  await ensureVaultFolder(vault, 'Bestiary');
  assert.deepEqual(created, []);
  assert.ok(directorySet.has('bestiary'));
});

test('coalesces folder creation requests whose paths differ only by letter case', async () => {
  const { vault, directorySet, created } = createVault({ delayCreate: true });
  const caseInsensitiveVault = {
    ...vault,
    getAbstractFileByPath(path) {
      const match = [...directorySet].find((entry) => entry.toLocaleLowerCase() === path.toLocaleLowerCase());
      return match ? { path: match, children: [] } : null;
    },
    createFolder: vault.createFolder.bind(vault),
  };

  await Promise.all([
    ensureVaultFolder(caseInsensitiveVault, 'Bestiary/Creatures'),
    ensureVaultFolder(caseInsensitiveVault, 'bestiary/creatures'),
  ]);
  assert.equal([...directorySet].filter((entry) => entry.toLocaleLowerCase() === 'bestiary/creatures').length, 1);
  assert.equal(created.filter((entry) => entry.toLocaleLowerCase() === 'bestiary/creatures').length, 1);
});
