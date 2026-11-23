import { TFile, type App } from 'obsidian';
import type { TemplateStorage } from './templateRepository.ts';
import { reservesForgeTemplateId } from './atlasRoleMirrorMetadata.ts';

/** A small Obsidian Vault adapter shared by template creation and editing. */
export function createTemplateVaultStorage(app: App): TemplateStorage {
  const { vault } = app;
  const getFile = (path: string): TFile => {
    const abstract = vault.getAbstractFileByPath(path);
    if (!(abstract instanceof TFile)) throw new Error(`Arquivo não encontrado: ${path}`);
    return abstract;
  };

  const ensureFolder = async (path: string): Promise<void> => {
    const normalized = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    if (!normalized) return;
    const parts = normalized.split('/');
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = vault.getAbstractFileByPath(current);
      if (!existing) await vault.createFolder(current);
      else if (existing instanceof TFile) throw new Error(`O caminho ${current} é um arquivo, não uma pasta.`);
    }
  };

  return {
    exists: (path) => vault.getAbstractFileByPath(path) !== null,
    read: async (path) => vault.read(getFile(path)),
    create: async (path, contents) => {
      const created = await vault.create(path, contents);
      return { path: created.path, basename: created.basename };
    },
    modify: async (path, contents) => vault.modify(getFile(path), contents),
    compareAndSwap: async (path, expectedText, contents) => {
      const file = getFile(path);
      let currentText = '';
      await vault.process(file, (current) => {
        currentText = current;
        return current === expectedText ? contents : current;
      });
      return { written: currentText === expectedText, currentText };
    },
    rename: async (path, newPath) => {
      await vault.rename(getFile(path), newPath);
      const renamed = getFile(newPath);
      return { path: renamed.path, basename: renamed.basename };
    },
    ensureFolder,
    listBackupFiles: async (folder) => {
      const prefix = `${folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')}/`;
      return vault.getFiles()
        .filter((file) => file.path.startsWith(prefix) && file.path.toLowerCase().endsWith('.forgetemplate.bak'))
        .map((file) => ({
          path: file.path,
          basename: file.name,
          size: file.stat.size,
          mtime: file.stat.mtime,
        }));
    },
    listTemplateIds: async () => {
      const files = vault.getFiles().filter((file) => ['forgetemplate', 'atlastemplate'].includes(file.extension.toLowerCase()));
      const entries = await Promise.all(files.map(async (file) => {
        try {
          const parsed: unknown = JSON.parse(await vault.cachedRead(file));
          if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            const document = parsed as Record<string, unknown>;
            // A generated Atlas mirror intentionally shares its Forge source ID.
            // It is an adapter file, not a second user-owned template identity.
            if (!reservesForgeTemplateId(file.path, document)) return null;
            if (document.format === 'atlas-statblock-template' && typeof document.id === 'string' && document.id.trim()) {
              return { path: file.path, id: document.id.trim() };
            }
          }
        } catch {
          // A malformed template has no trustworthy ID to compare.
        }
        return null;
      }));
      return entries.filter((entry): entry is { path: string; id: string } => entry !== null);
    },
  };
}
