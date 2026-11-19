/** Safe boundary for moving a library template to the Obsidian trash. */

export interface TemplateTrashStorage {
  exists(path: string): boolean;
  trash(path: string): Promise<void>;
}

export function isDeletableTemplatePath(path: string): boolean {
  const normalized = path.trim().replace(/\\/g, '/').toLowerCase();
  return normalized.endsWith('.forgetemplate') || normalized.endsWith('.atlastemplate');
}

/** Moves only the selected template file; linked notes and exported companions are untouched. */
export async function moveTemplateToTrash(path: string, storage: TemplateTrashStorage): Promise<void> {
  const cleanPath = path.trim().replace(/\\/g, '/');
  if (!isDeletableTemplatePath(cleanPath)) throw new Error('Somente arquivos .forgetemplate e .atlastemplate podem ser excluídos por este comando.');
  if (!storage.exists(cleanPath)) throw new Error('O template não existe mais no Vault. Selecione o arquivo novamente e tente outra vez.');
  await storage.trash(cleanPath);
}
