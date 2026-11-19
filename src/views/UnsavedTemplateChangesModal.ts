import { Modal, Notice, type App } from 'obsidian';
import { normalizeForgeLanguage, translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Atlas-style question shown after Obsidian closes a modified template editor. */
export class UnsavedTemplateChangesModal extends Modal {
  private completed = false;
  private busy = false;
  private actionButtons: HTMLButtonElement[] = [];

  constructor(
    app: App,
    private readonly language: ForgeLanguage,
    private readonly templateName: string,
    private readonly onSave: () => Promise<void>,
    private readonly onKeepEditing: () => Promise<void>,
    private readonly onDiscard: () => Promise<void> = async () => undefined,
    private readonly isRecoveryPrompt = false,
  ) {
    super(app);
  }

  onOpen(): void {
    const portuguese = normalizeForgeLanguage(this.language) === 'pt-BR';
    const label = (en: string, pt: string): string => portuguese ? pt : en;
    this.modalEl.classList.add('statblock-forge__unsaved-modal');
    this.setTitle(label(`Save changes to ${this.templateName}?`, `Salvar alterações em ${this.templateName}?`));
    this.contentEl.replaceChildren();
    this.contentEl.append(element('p', 'statblock-forge__hint', this.isRecoveryPrompt
      ? label('An unsaved template draft from a previous session was found.', 'Foi encontrado um rascunho de template não salvo de uma sessão anterior.')
      : label('Editing this template ended before these changes were saved.', 'A edição deste template foi encerrada antes que estas alterações fossem salvas.')));

    const actions = element('div', 'modal-button-container');
    const discardButton = element('button', '', label("Don't Save", 'Não salvar'));
    discardButton.type = 'button';
    discardButton.addEventListener('click', () => this.finish());

    const keepButton = element('button', '', label('Keep Editing', 'Continuar editando'));
    keepButton.type = 'button';
    keepButton.addEventListener('click', () => this.finish(this.onKeepEditing));

    const saveButton = element('button', 'mod-cta', label('Save', 'Salvar'));
    saveButton.type = 'button';
    saveButton.addEventListener('click', () => this.finish(this.onSave));

    actions.append(discardButton, keepButton, saveButton);
    this.actionButtons = [discardButton, keepButton, saveButton];
    this.contentEl.append(actions);
    window.setTimeout(() => keepButton.focus(), 0);
  }

  private finish(action?: () => Promise<void>): void {
    if (this.completed || this.busy) return;
    const operation = action ?? this.onDiscard;
    this.busy = true;
    this.actionButtons.forEach((button) => { button.disabled = true; });
    void operation().then(() => {
      this.completed = true;
      this.close();
    }).catch((error: unknown) => {
      this.busy = false;
      this.actionButtons.forEach((button) => { button.disabled = false; });
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${translateForgeText('Could not reopen the template draft:', normalizeForgeLanguage(this.language))} ${translateForgeText(message, normalizeForgeLanguage(this.language))}`, 10000);
    });
  }

  onClose(): void {
    this.contentEl.replaceChildren();
    // Atlas treats dismissing the question (Escape or its close button) as Keep Editing.
    if (!this.completed && !this.busy) {
      this.completed = true;
      void this.onKeepEditing().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`${translateForgeText('Could not reopen the template draft:', normalizeForgeLanguage(this.language))} ${translateForgeText(message, normalizeForgeLanguage(this.language))}`, 10000);
      });
    }
  }
}
