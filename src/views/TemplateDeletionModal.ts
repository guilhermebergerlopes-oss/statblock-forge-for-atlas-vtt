import { Modal, Notice, TFile, type App } from 'obsidian';
import { moveTemplateToTrash } from '../templates/templateDeletion.ts';
import { normalizeForgeLanguage, translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import { FORGE_TEMPLATE_EXTENSION } from '../templates/templateFormat.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Confirmation UI for deleting a template, available independently of the former library view. */
export class TemplateDeletionModal extends Modal {
  constructor(
    app: App,
    private readonly file: TFile,
    private readonly language: ForgeLanguage,
    private readonly onDeleted?: (path: string) => void,
    private readonly onError?: (message: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const language = normalizeForgeLanguage(this.language);
    const portuguese = language === 'pt-BR';
    const label = (en: string, pt: string): string => portuguese ? pt : en;
    const forgeTemplate = this.file.extension.toLowerCase() === FORGE_TEMPLATE_EXTENSION;

    this.setTitle(translateForgeText('Delete template?', language));
    this.contentEl.replaceChildren();
    this.contentEl.append(element('p', '', label(
      'Move this template to the Obsidian trash?',
      'Mover este template para a lixeira do Obsidian?',
    )));

    const warning = forgeTemplate
      ? 'The .forgetemplate will be moved to the trash. Existing statblock notes and any published .atlastemplate copy will remain. Their quick link to this Forge source will no longer work.'
      : 'The .atlastemplate will be moved to the trash. Existing statblock notes that reference its ID may no longer find their Atlas template. No notes will be deleted.';
    this.contentEl.append(element('p', 'statblock-forge__hint', translateForgeText(warning, language)));
    this.contentEl.append(element('code', 'statblock-forge__path', this.file.path));

    const actions = element('div', 'modal-button-container');
    const cancelButton = element('button', '', label('Cancel', 'Cancelar'));
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => this.close());

    const confirmButton = element('button', 'mod-warning', label('Delete template', 'Excluir template'));
    confirmButton.type = 'button';
    confirmButton.addEventListener('click', () => {
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      void moveTemplateToTrash(this.file.path, {
        exists: (path) => this.app.vault.getAbstractFileByPath(path) === this.file,
        trash: async (path) => {
          const current = this.app.vault.getAbstractFileByPath(path);
          if (!(current instanceof TFile)) throw new Error('O template não existe mais no Vault.');
          await this.app.fileManager.trashFile(current);
        },
      }).then(() => {
        this.close();
        this.onDeleted?.(this.file.path);
      }).catch((error: unknown) => {
        confirmButton.disabled = false;
        cancelButton.disabled = false;
        const message = error instanceof Error ? error.message : String(error);
        if (this.onError) this.onError(message);
        else new Notice(`${translateForgeText('Could not delete template:', language)} ${translateForgeText(message, language)}`);
      });
    });

    actions.append(cancelButton, confirmButton);
    this.contentEl.append(actions);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
