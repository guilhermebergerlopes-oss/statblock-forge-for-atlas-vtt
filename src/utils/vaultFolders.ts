/** Minimal Vault surface required to create nested folders safely. */
export interface VaultFolderAccess {
  getAbstractFileByPath(path: string): unknown;
  createFolder(path: string): Promise<unknown>;
  adapter?: {
    exists(path: string): Promise<boolean>;
    list(path: string): Promise<{ files: string[]; folders: string[] }>;
    mkdir?(path: string): Promise<void>;
  };
}

export class VaultFolderPathConflictError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`The path "${path}" already exists and is not a folder.`);
    this.name = 'VaultFolderPathConflictError';
    this.path = path;
  }
}

type PathState = 'missing' | 'folder' | 'other';

function samePath(left: string, right: string): boolean {
  return normalizedPath(left).toLocaleLowerCase() === normalizedPath(right).toLocaleLowerCase();
}

function listedPath(parent: string, entry: string): string {
  const listed = normalizedPath(entry);
  return listed.includes('/') ? listed : (parent ? `${parent}/${listed}` : listed);
}

async function findCaseInsensitivePathState(vault: VaultFolderAccess, path: string): Promise<PathState> {
  const adapter = vault.adapter;
  if (!adapter || typeof adapter.list !== 'function') return 'missing';
  const slash = path.lastIndexOf('/');
  const parent = slash >= 0 ? path.slice(0, slash) : '';
  try {
    const listing = await adapter.list(parent);
    if (listing.folders.some((entry) => samePath(listedPath(parent, entry), path))) return 'folder';
    if (listing.files.some((entry) => samePath(listedPath(parent, entry), path))) return 'other';
  } catch {
    // If the parent cannot be listed, fall back to exact-path checks.
  }
  return 'missing';
}

const ensureOperations = new WeakMap<object, Map<string, Promise<void>>>();

function normalizedPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
}

function abstractPathState(value: unknown): PathState {
  if (typeof value !== 'object' || value === null) return 'missing';
  return Array.isArray((value as { children?: unknown }).children) ? 'folder' : 'other';
}

/**
 * Check both Obsidian's indexed tree and the adapter. The adapter check matters
 * for hidden folders (such as .statblock-forge), which may exist on disk while
 * not being returned by getAbstractFileByPath().
 */
async function pathState(vault: VaultFolderAccess, path: string): Promise<PathState> {
  const indexed = abstractPathState(vault.getAbstractFileByPath(path));
  if (indexed !== 'missing') return indexed;

  const adapter = vault.adapter;
  if (adapter && typeof adapter.exists === 'function' && await adapter.exists(path)) {
    if (typeof adapter.list === 'function') {
      try {
        await adapter.list(path);
        return 'folder';
      } catch {
        // Some adapters cannot list a directory when queried with a differently
        // cased path. Check its parent before classifying it as a file conflict.
      }
    }
    const listed = await findCaseInsensitivePathState(vault, path);
    return listed === 'missing' ? 'other' : listed;
  }

  // Windows/macOS adapters can reject a create even when exists(path) with
  // the requested casing returns false. Inspect the parent's directory list.
  return findCaseInsensitivePathState(vault, path);
}

async function ensureOneFolder(vault: VaultFolderAccess, path: string): Promise<void> {
  let byPath = ensureOperations.get(vault as object);
  if (!byPath) {
    byPath = new Map();
    ensureOperations.set(vault as object, byPath);
  }
  const operationKey = normalizedPath(path).toLocaleLowerCase();
  const pending = byPath.get(operationKey);
  if (pending) return pending;

  const operation = (async () => {
    const before = await pathState(vault, path);
    if (before === 'folder') return;
    if (before === 'other') throw new VaultFolderPathConflictError(path);

    try {
      // Obsidian does not index hidden folders in its abstract-file tree. Atlas
      // itself uses the adapter mkdir path for such directories, so use the
      // same mechanism for the Forge mirror and its nested hidden folders.
      const isHiddenPath = path.split('/').some((segment) => segment.startsWith('.'));
      const adapterMkdir = isHiddenPath ? vault.adapter?.mkdir : undefined;
      if (typeof adapterMkdir === 'function' && vault.adapter) {
        await adapterMkdir.call(vault.adapter, path);
      } else {
        await vault.createFolder(path);
      }
    } catch (error) {
      // Another save/mirror operation may have created the same folder after
      // our first check. Ignore only that specific race; preserve all other
      // creation errors.
      const after = await pathState(vault, path);
      if (after === 'folder') return;
      if (after === 'other') throw new VaultFolderPathConflictError(path);
      throw error;
    }
  })();

  byPath.set(operationKey, operation);
  try {
    await operation;
  } finally {
    if (byPath.get(operationKey) === operation) byPath.delete(operationKey);
    if (byPath.size === 0) ensureOperations.delete(vault as object);
  }
}

/**
 * Ensure a nested Vault folder exists. Safe for hidden directories and for
 * concurrent callers that attempt to create the same parent at the same time.
 */
export async function ensureVaultFolder(vault: VaultFolderAccess, path: string): Promise<void> {
  const normalized = normalizedPath(path);
  if (!normalized) return;

  let current = '';
  for (const segment of normalized.split('/')) {
    current = current ? `${current}/${segment}` : segment;
    await ensureOneFolder(vault, current);
  }
}
