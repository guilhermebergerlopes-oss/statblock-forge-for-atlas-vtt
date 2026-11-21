import { Modal, Notice, TFile, type App } from 'obsidian';
import { moveTemplateToTrash } from '../templates/templateDeletion.ts';
import { normalizeForgeLanguage, translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import { FORGE_TEMPLATE_EXTENSION } from '../templates/templateFormat.ts';
import { countForgeTemplateBacklinks } from '../statblocks/forgeTemplateLinkMaintenance.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Confirmation UI for deleting a template, available independently of the former library view. */
export class TemplateDeletionModal extends Modal {
  constructor(
    private readonly vaultApp: App,
    private readonly file: TFile,
    private readonly language: ForgeLanguage,
    private readonly onDeleted?: (path: string) => void,
    private readonly onError?: (message: string) => void,
  ) {
    super(vaultApp);
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
      ? 'The .forgetemplate will be moved to the trash. Existing statblock notes and previously created Atlas template files will remain. Their link to this source will be unavailable unless the source is restored or one unambiguous copy with the same ID remains.'
      : 'The .atlastemplate will be moved to the trash. Existing statblock notes that reference its ID may no longer find their Atlas template. No notes will be deleted.';
    this.contentEl.append(element('p', 'statblock-forge__hint', translateForgeText(warning, language)));
    const linkedNotes = element('p', 'statblock-forge__hint', label(
      'Checking linked statblock notes…',
      'Verificando notas de statblock vinculadas…',
    ));
    this.contentEl.append(linkedNotes);
    this.contentEl.append(element('code', 'statblock-forge__path', this.file.path));
    void this.updateLinkedNoteCount(linkedNotes, forgeTemplate, label);

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
        exists: (path) => this.vaultApp.vault.getAbstractFileByPath(path) === this.file,
        trash: async (path) => {
          const current = this.vaultApp.vault.getAbstractFileByPath(path);
          if (!(current instanceof TFile)) throw new Error('O template não existe mais no Vault.');
          await this.vaultApp.fileManager.trashFile(current);
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

  private async updateLinkedNoteCount(
    target: HTMLElement,
    forgeTemplate: boolean,
    label: (en: string, pt: string) => string,
  ): Promise<void> {
    try {
      const raw = JSON.parse(await this.vaultApp.vault.cachedRead(this.file)) as unknown;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)
        || typeof (raw as Record<string, unknown>).id !== 'string') {
        target.textContent = label(
          'Linked-note count is unavailable because this template has no valid ID.',
          'A quantidade de notas vinculadas não está disponível porque o template não possui um ID válido.',
        );
        return;
      }
      const templateId = (raw as Record<string, unknown>).id as string;
      const notes = this.vaultApp.vault.getMarkdownFiles().map((note) => ({
        path: note.path,
        frontmatter: this.vaultApp.metadataCache.getFileCache(note)?.frontmatter,
      }));
      const count = countForgeTemplateBacklinks(notes, {
        kind: forgeTemplate ? 'forge' : 'atlas',
        path: this.file.path,
        templateId,
      });
      target.textContent = forgeTemplate
        ? (count > 0
          ? label(
            `${count} statblock note(s) currently link to this Forge template. They will not be deleted, but their template link will remain unavailable until the source is restored or relinked.`,
            `${count} nota(s) de statblock estão vinculadas a este template Forge. Elas não serão excluídas, mas o vínculo ficará indisponível até que a origem seja restaurada ou o vínculo seja corrigido.`,
          )
          : label('No statblock notes currently reference this exact Forge template path and ID.', 'Nenhuma nota de statblock referencia atualmente este caminho e ID exatos do template Forge.'))
        : (count > 0
          ? label(
            `${count} published statblock note(s) reference this Atlas template ID. Their native Atlas link may stop resolving; the notes will not be deleted.`,
            `${count} nota(s) de statblock publicada(s) referencia(m) este ID de template Atlas. O vínculo nativo pode deixar de funcionar; as notas não serão excluídas.`,
          )
          : label('No published statblock notes currently reference this Atlas template ID.', 'Nenhuma nota de statblock publicada referencia atualmente este ID de template Atlas.'));
    } catch {
      target.textContent = label(
        'Linked-note count could not be verified. Existing notes will still be preserved.',
        'Não foi possível verificar a quantidade de notas vinculadas. As notas existentes ainda serão preservadas.',
      );
    }
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
