import type { App } from 'obsidian';
import { normalizeTemplateFolder } from '../templates/templateFormat';

/** Status of the documented Atlas template directory, checked through the public Vault API. */
export type AtlasTemplateFolderStatus = 'found' | 'not-found';

export function getAtlasTemplateFolderStatus(app: App, folder: string): AtlasTemplateFolderStatus {
  const path = normalizeTemplateFolder(folder);
  return app.vault.getAbstractFileByPath(path) ? 'found' : 'not-found';
}
