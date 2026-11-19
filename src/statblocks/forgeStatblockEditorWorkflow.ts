import type { App, TFile } from 'obsidian';

export interface ForgeStatblockEditorOpener {
  openForgeEditor: () => Promise<void>;
}

/**
 * Opens the Markdown instance in one Obsidian tab, then asks the plugin to
 * attach its editable statblock panel to that same MarkdownView. The YAML
 * frontmatter remains the note's single source of values; no second statblock
 * tab or duplicated data file is created. This does not rely on Atlas loading
 * .forgetemplate files.
 */
export async function openForgeStatblockNoteForEditing(
  app: App,
  file: TFile,
  opener: ForgeStatblockEditorOpener,
): Promise<void> {
  const leaf = app.workspace.getLeaf('tab');
  if (!leaf) throw new Error('Não foi possível abrir uma nova aba para a nota do statblock.');
  await leaf.openFile(file, { active: true });
  app.workspace.setActiveLeaf(leaf, { focus: true });
  await app.workspace.revealLeaf(leaf);
  await opener.openForgeEditor();
}
