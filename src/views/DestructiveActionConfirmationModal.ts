import { Modal, type App } from 'obsidian';
import { normalizeForgeLanguage, type ForgeLanguage } from '../i18n/localization.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Explicit confirmation for destructive actions in Properties and Rest editors. */
export interface ConfirmationModalCopy {
  title?: string;
  question?: string;
  confirmLabel?: string;
  detail?: string;
}

export class DestructiveActionConfirmationModal extends Modal {
  private decided = false;

  constructor(
    app: App,
    private readonly language: ForgeLanguage,
    private readonly itemName: string,
    private readonly onConfirm: () => void,
    private readonly detail?: string,
    private readonly copy?: ConfirmationModalCopy,
  ) {
    super(app);
  }

  onOpen(): void {
    const portuguese = normalizeForgeLanguage(this.language) === 'pt-BR';
    const title = this.copy?.title ?? (portuguese ? 'Confirmar exclusão' : 'Confirm deletion');
    const cancelLabel = portuguese ? 'Cancelar' : 'Cancel';
    const confirmLabel = this.copy?.confirmLabel ?? (portuguese ? 'Excluir' : 'Delete');
    this.modalEl.addClass('statblock-forge__destructive-confirm-modal');
    this.setTitle(title);
    this.contentEl.replaceChildren();
    this.contentEl.append(element('p', 'statblock-forge__destructive-confirm-question', this.copy?.question ?? (portuguese
      ? `Deseja realmente excluir ${this.itemName}?`
      : `Are you sure you want to delete ${this.itemName}?`)));
    this.contentEl.append(element('p', 'statblock-forge__hint', this.copy?.detail ?? this.detail ?? (portuguese
      ? 'Essa ação não pode ser desfeita.'
      : 'This action cannot be undone.')));

    const actions = element('div', 'modal-button-container statblock-forge__destructive-confirm-actions');
    const cancel = element('button', '', cancelLabel);
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.decide(false));
    const confirm = element('button', 'mod-warning', confirmLabel);
    confirm.type = 'button';
    confirm.addEventListener('click', () => this.decide(true));
    actions.append(cancel, confirm);
    this.contentEl.append(actions);
    window.setTimeout(() => cancel.focus(), 0);
  }

  private decide(confirmed: boolean): void {
    if (this.decided) return;
    this.decided = true;
    this.close();
    if (confirmed) this.onConfirm();
  }

  onClose(): void {
    this.contentEl.replaceChildren();
    // Dismissal (Escape or clicking the modal backdrop) is always cancellation.
    this.decided = true;
  }
}
