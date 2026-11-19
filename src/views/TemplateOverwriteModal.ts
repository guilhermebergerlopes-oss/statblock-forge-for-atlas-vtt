import { Modal, type App } from 'obsidian';
import {
  normalizeForgeLanguage,
  translateForgeText,
  type ForgeLanguage,
} from '../i18n/localization.ts';
import type {
  TemplateNameConflictError,
  TemplateOverwriteConfirmation,
} from '../templates/templateRepository.ts';

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Explicit confirmation before a same-name Forge template is replaced. */
export class TemplateOverwriteModal extends Modal {
  constructor(
    app: App,
    private readonly conflict: TemplateNameConflictError,
    private readonly language: ForgeLanguage,
    private readonly onConfirm: (confirmation: TemplateOverwriteConfirmation | null) => void,
  ) {
    super(app);
  }

  private decided = false;

  private decide(confirmation: TemplateOverwriteConfirmation | null): void {
    if (this.decided) return;
    this.decided = true;
    this.close();
    this.onConfirm(confirmation);
  }

  onOpen(): void {
    const language = normalizeForgeLanguage(this.language);
    this.setTitle(translateForgeText('Replace template?', language));
    this.contentEl.replaceChildren();
    this.contentEl.append(element(
      'p',
      '',
      translateForgeText('A template with this name already exists. Do you want to replace it?', language),
    ));
    this.contentEl.append(element(
      'p',
      'statblock-forge__hint',
      translateForgeText('A backup will be created, and the existing template will keep its ID and statblock links.', language),
    ));
    this.contentEl.append(element('code', 'statblock-forge__path', this.conflict.path));

    const actions = element('div', 'modal-button-container');
    const cancelButton = element('button', '', translateForgeText('Cancel', language));
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => this.decide(null));

    const confirmButton = element('button', 'mod-warning', translateForgeText('Replace template', language));
    confirmButton.type = 'button';
    confirmButton.addEventListener('click', () => {
      confirmButton.disabled = true;
      cancelButton.disabled = true;
      const confirmation: TemplateOverwriteConfirmation = {
        overwriteExistingPath: this.conflict.path,
        expectedOverwriteText: this.conflict.existingText,
      };
      this.decide(confirmation);
    });

    actions.append(cancelButton, confirmButton);
    this.contentEl.append(actions);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
    if (!this.decided) {
      this.decided = true;
      this.onConfirm(null);
    }
  }
}
