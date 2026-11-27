import { TFile, type App, type MarkdownView } from 'obsidian';
import { loadStatblockSource } from '../statblocks/statblockDataSources.ts';
import { parseTemplateFileText } from '../templates/forgeFileFormat.ts';
import type { ForgeField } from '../templates/forgeTemplate.ts';
import { normalizeForgeLanguage, translateForgeText } from '../i18n/localization.ts';

interface MarkdownFieldControl {
  field: ForgeField;
  wrapper: HTMLDivElement;
  textarea: HTMLTextAreaElement;
  error: HTMLDivElement;
  status: HTMLSpanElement;
  savedValue: string;
  saving: boolean;
}

/**
 * Atlas-published v1 notes are rendered by Atlas itself. Atlas has no public
 * API for injecting a custom editor into its card, so Forge exposes only the
 * Markdown fields in a small companion editor beneath the native card.
 * Changes are written to the note's existing YAML frontmatter.
 */
export class StatblockMarkdownFieldsPanel {
  private readonly host: HTMLElement;
  private readonly controls = new Map<string, MarkdownFieldControl>();
  private generation = 0;
  private writeQueue: Promise<void> = Promise.resolve();
  private disposed = false;
  private language: 'en' | 'pt-BR';

  constructor(
    private readonly view: MarkdownView,
    private readonly app: App,
    private readonly source: TFile,
    private readonly templateFile: TFile,
    language: string,
  ) {
    this.language = normalizeForgeLanguage(language);
    this.host = document.createElement('section');
    this.host.className = 'statblock-forge__atlas-markdown-fields-panel';
    this.host.setAttribute('aria-label', this.t('Markdown field editor'));
    this.view.contentEl.appendChild(this.host);
    void this.refresh();
  }

  matches(sourcePath: string, templatePath: string): boolean {
    return this.source.path === sourcePath && this.templateFile.path === templatePath;
  }

  belongsTo(sourcePath: string): boolean {
    return this.source.path === sourcePath;
  }

  usesTemplate(templatePath: string): boolean {
    return this.templateFile.path === templatePath;
  }

  async refresh(): Promise<void> {
    if (this.disposed || this.hasDraftOrFocus()) return;
    if (!this.host.isConnected) this.view.contentEl.appendChild(this.host);
    const generation = ++this.generation;
    const source = this.app.vault.getAbstractFileByPath(this.source.path);
    const template = this.app.vault.getAbstractFileByPath(this.templateFile.path);
    if (!(source instanceof TFile) || !(template instanceof TFile)) {
      this.detach();
      return;
    }
    try {
      const parsed = parseTemplateFileText(await this.app.vault.cachedRead(template), template.extension);
      const fields = parsed.template.fields.filter((field) => field.type === 'markdown');
      if (fields.length === 0) {
        this.host.hidden = true;
        this.host.replaceChildren();
        this.controls.clear();
        return;
      }
      const loaded = await loadStatblockSource(this.app, source, parsed.template);
      if (this.disposed || generation !== this.generation) return;
      if (this.hasDraftOrFocus()) return;
      this.renderFields(fields, loaded.binding.data);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      this.renderLoadError(error instanceof Error ? error.message : String(error));
    }
  }

  detach(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.host.remove();
  }

  private t(value: string): string {
    return translateForgeText(value, this.language);
  }

  private hasDraftOrFocus(): boolean {
    if (this.host.contains(this.host.ownerDocument.activeElement)) return true;
    for (const control of this.controls.values()) {
      if (control.saving || control.textarea.value !== control.savedValue) return true;
    }
    return false;
  }

  private renderFields(fields: ForgeField[], data: Record<string, unknown>): void {
    this.host.hidden = false;
    this.host.replaceChildren();
    this.controls.clear();

    const heading = document.createElement('h3');
    heading.className = 'statblock-forge__atlas-markdown-fields-heading';
    heading.textContent = this.t('Markdown fields');
    const description = document.createElement('p');
    description.className = 'statblock-forge__atlas-markdown-fields-description';
    description.textContent = this.t('Edit paragraph fields here. Changes are saved to this statblock note and reflected in the Atlas card.');
    const list = document.createElement('div');
    list.className = 'statblock-forge__atlas-markdown-fields-list';

    for (const field of fields) {
      const wrapper = document.createElement('div');
      wrapper.className = 'statblock-forge__atlas-markdown-field';
      const label = document.createElement('label');
      label.className = 'statblock-forge__atlas-markdown-field-label';
      label.textContent = field.label?.trim() || field.key;
      const textarea = document.createElement('textarea');
      textarea.className = 'statblock-forge__atlas-markdown-field-input';
      textarea.rows = 2;
      textarea.wrap = 'soft';
      textarea.spellcheck = true;
      textarea.value = typeof data[field.key] === 'string' ? data[field.key] as string : '';
      textarea.placeholder = this.t('Write Markdown text…');
      textarea.setAttribute('aria-label', field.label?.trim() || field.key);
      label.htmlFor = `forge-markdown-${field.key}`;
      textarea.id = `forge-markdown-${field.key}`;
      const status = document.createElement('span');
      status.className = 'statblock-forge__atlas-markdown-field-status';
      const error = document.createElement('div');
      error.className = 'statblock-forge__atlas-markdown-field-error';
      error.hidden = true;
      error.setAttribute('role', 'alert');
      const control: MarkdownFieldControl = {
        field, wrapper, textarea, error, status,
        savedValue: textarea.value,
        saving: false,
      };
      this.controls.set(field.key, control);
      textarea.addEventListener('blur', () => { void this.save(control); });
      textarea.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return;
        event.preventDefault();
        void this.save(control).then(() => textarea.blur());
      });
      wrapper.append(label, textarea, error, status);
      list.append(wrapper);
    }

    this.host.append(heading, description, list);
  }

  private async save(control: MarkdownFieldControl): Promise<void> {
    const nextValue = control.textarea.value;
    if (nextValue === control.savedValue) return;
    control.error.hidden = true;
    control.status.textContent = this.t('Saving…');
    control.saving = true;
    const source = this.app.vault.getAbstractFileByPath(this.source.path);
    if (!(source instanceof TFile)) {
      control.error.textContent = this.t('The statblock note is no longer available.');
      control.error.hidden = false;
      control.status.textContent = '';
      control.saving = false;
      return;
    }
    const save = this.writeQueue.then(async () => {
      await this.app.fileManager.processFrontMatter(source, (frontmatter) => {
        if (nextValue === '') delete frontmatter[control.field.key];
        else frontmatter[control.field.key] = nextValue;
      });
    });
    this.writeQueue = save.catch(() => undefined);
    try {
      await save;
      control.savedValue = nextValue;
      control.status.textContent = this.t('Saved');
    } catch (error) {
      control.error.textContent = error instanceof Error ? error.message : String(error);
      control.error.hidden = false;
      control.status.textContent = this.t('Not saved');
    } finally {
      control.saving = false;
    }
  }

  private renderLoadError(message: string): void {
    this.host.hidden = false;
    this.host.replaceChildren();
    const heading = document.createElement('h3');
    heading.className = 'statblock-forge__atlas-markdown-fields-heading';
    heading.textContent = this.t('Markdown fields');
    const error = document.createElement('div');
    error.className = 'statblock-forge__atlas-markdown-field-error';
    error.textContent = message;
    this.host.append(heading, error);
  }
}
