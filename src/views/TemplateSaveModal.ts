import { Modal, type App } from 'obsidian';
import { normalizeForgeLanguage, translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import {
  templateSaveChoice,
  type TemplateSaveKind,
  type TemplateSaveSubject,
} from '../templates/templateSaveChoice.ts';

export interface TemplateSaveRequest {
  kind: TemplateSaveKind;
  name: string;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Atlas-style Save dialog: the entered name decides Update versus Save as New. */
export class TemplateSaveModal extends Modal {
  constructor(
    app: App,
    private readonly language: ForgeLanguage,
    private readonly subject: TemplateSaveSubject,
    private readonly nameTaken: (name: string) => boolean,
    private readonly onSave: (request: TemplateSaveRequest) => Promise<string | null>,
  ) {
    super(app);
  }

  onOpen(): void {
    const language = normalizeForgeLanguage(this.language);
    const label = (en: string, pt: string): string => language === 'en' ? en : pt;
    const { contentEl } = this;
    this.modalEl.classList.add('statblock-forge__save-modal');
    contentEl.replaceChildren();
    this.setTitle(this.subject.unsaved
      ? label('Save template', 'Salvar template')
      : label(`Save template: ${this.subject.name}`, `Salvar template: ${this.subject.name}`));

    const field = element('label', 'statblock-forge__save-field');
    field.append(element('span', 'statblock-forge__save-label', label('Template name', 'Nome do template')));
    const input = element('input', 'statblock-forge__input statblock-forge__save-name');
    input.type = 'text';
    input.value = this.subject.name;
    input.spellcheck = false;
    input.autocomplete = 'off';
    field.append(input);
    contentEl.append(field);

    const explanation = element('p', 'statblock-forge__save-hint');
    const problem = element('p', 'statblock-forge__save-problem');
    problem.hidden = true;
    contentEl.append(explanation, problem);

    const actions = element('div', 'modal-button-container');
    const cancelButton = element('button', '', label('Cancel', 'Cancelar'));
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => this.close());
    const saveButton = element('button', 'mod-cta', label('Save', 'Salvar'));
    saveButton.type = 'button';
    actions.append(cancelButton, saveButton);
    contentEl.append(actions);

    let busy = false;
    let failed: string | null = null;
    const refresh = (): void => {
      const choice = templateSaveChoice(this.subject, input.value, this.nameTaken, language);
      saveButton.textContent = busy
        ? label('Saving…', 'Salvando…')
        : choice.label;
      saveButton.disabled = busy || choice.problem !== null;
      cancelButton.disabled = busy;
      explanation.textContent = choice.problem ? '' : choice.hint ?? '';
      const message = failed ?? choice.problem;
      problem.hidden = !message;
      problem.textContent = message ?? '';
      input.setAttribute('aria-invalid', message ? 'true' : 'false');
    };

    const save = (): void => {
      if (busy) return;
      const choice = templateSaveChoice(this.subject, input.value, this.nameTaken, language);
      if (choice.problem) {
        refresh();
        input.focus();
        return;
      }
      busy = true;
      failed = null;
      refresh();
      void this.onSave({ kind: choice.kind, name: input.value.trim() }).then((error) => {
        if (error === null) {
          this.close();
          return;
        }
        busy = false;
        failed = translateForgeText(error, language);
        refresh();
        input.focus();
      }).catch((error: unknown) => {
        busy = false;
        failed = translateForgeText(error instanceof Error ? error.message : String(error), language);
        refresh();
        input.focus();
      });
    };

    input.addEventListener('input', () => { failed = null; refresh(); });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        save();
      }
    });
    saveButton.addEventListener('click', save);
    refresh();
    window.setTimeout(() => { input.focus(); input.select(); }, 0);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
