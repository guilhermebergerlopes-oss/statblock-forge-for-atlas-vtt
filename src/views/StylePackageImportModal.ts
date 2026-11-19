import { Modal, Notice, type App } from 'obsidian';
import type { ForgeCustomBorder, ForgeCustomTheme } from '../templates/styleLibrary.ts';
import {
  applyForgeStyleImport,
  type ForgeStyleImportChoice,
  type ForgeStyleImportResult,
  type ForgeStylePackage,
} from '../templates/stylePackage.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';

interface ImportRow<T> {
  source: T;
  nameInput: HTMLInputElement;
  choiceSelect: HTMLSelectElement;
  hasConflict: boolean;
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function hasThemeConflict(theme: ForgeCustomTheme, existing: readonly ForgeCustomTheme[]): boolean {
  return existing.some((item) => item.id === theme.id || normalizedName(item.name) === normalizedName(theme.name));
}

function hasBorderConflict(border: ForgeCustomBorder, existing: readonly ForgeCustomBorder[]): boolean {
  return existing.some((item) => item.id === border.id || normalizedName(item.name) === normalizedName(border.name));
}

function createChoiceSelect(hasConflict: boolean, language: ForgeLanguage): HTMLSelectElement {
  const select = document.createElement('select');
  const options: Array<[ForgeStyleImportChoice, string]> = [
    ['copy', hasConflict ? 'Keep both (import as copy)' : 'Add to library'],
    ...(hasConflict ? [['replace', 'Replace matching style'] as [ForgeStyleImportChoice, string]] : []),
    ['skip', 'Skip this style'],
  ];
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = translateForgeText(label, language);
    select.append(option);
  }
  select.value = 'copy';
  return select;
}

function createImportRow<T extends { id: string; name: string }>(
  container: HTMLElement,
  typeLabel: string,
  source: T,
  conflict: boolean,
  language: ForgeLanguage,
): ImportRow<T> {
  const row = document.createElement('div');
  row.className = 'statblock-forge__style-import-row';
  const title = document.createElement('strong');
  title.textContent = `${translateForgeText(typeLabel, language)}: ${source.name}`;
  row.append(title);

  if ('palette' in source) {
    const palette = (source as unknown as ForgeCustomTheme).palette;
    const swatches = document.createElement('div');
    swatches.className = 'statblock-forge__style-import-swatches';
    for (const key of ['background', 'surface', 'raised', 'border', 'accent', 'accentStrong', 'text', 'muted'] as const) {
      const swatch = document.createElement('span');
      swatch.style.backgroundColor = palette[key];
      swatch.setAttribute('aria-label', `${key}: ${palette[key]}`);
      swatches.append(swatch);
    }
    row.append(swatches);
  } else {
    const border = source as unknown as ForgeCustomBorder;
    const preview = document.createElement('div');
    preview.className = 'statblock-forge__style-import-frame';
    preview.style.border = `${border.width}px ${border.style} ${border.color}`;
    preview.style.borderRadius = `${border.radius}px`;
    if (border.inner) {
      preview.style.boxShadow = `inset 0 0 0 ${border.innerWidth}px ${border.innerColor}, inset 0 0 0 ${border.innerWidth + border.innerGap}px transparent`;
    }
    row.append(preview);
  }

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.maxLength = 64;
  nameInput.value = conflict ? `${source.name} (Imported)` : source.name;
  nameInput.setAttribute('aria-label', translateForgeText('Imported style name', language));
  row.append(nameInput);

  const choiceSelect = createChoiceSelect(conflict, language);
  choiceSelect.setAttribute('aria-label', translateForgeText('Import action', language));
  choiceSelect.addEventListener('change', () => {
    nameInput.disabled = choiceSelect.value === 'skip';
    if (choiceSelect.value === 'replace') nameInput.value = source.name;
    else if (choiceSelect.value === 'copy' && conflict && normalizedName(nameInput.value) === normalizedName(source.name)) {
      nameInput.value = `${source.name} (Imported)`;
    }
  });
  row.append(choiceSelect);

  if (conflict) {
    const note = document.createElement('small');
    note.textContent = translateForgeText('An item with the same ID or name already exists. Choose whether to keep both or replace it.', language);
    row.append(note);
  }
  container.append(row);
  return { source, nameInput, choiceSelect, hasConflict: conflict };
}

export class StylePackageImportModal extends Modal {
  constructor(
    app: App,
    private readonly stylePackage: ForgeStylePackage,
    private readonly currentThemes: readonly ForgeCustomTheme[],
    private readonly currentBorders: readonly ForgeCustomBorder[],
    private readonly language: ForgeLanguage,
    private readonly onImport: (result: ForgeStyleImportResult) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.titleEl.setText(translateForgeText('Import style package', this.language));
    contentEl.addClass('statblock-forge__style-import-modal');

    const heading = contentEl.createEl('p', { text: this.stylePackage.name });
    heading.addClass('statblock-forge__style-import-package-name');

    const themeRows: ImportRow<ForgeCustomTheme>[] = [];
    const borderRows: ImportRow<ForgeCustomBorder>[] = [];
    if (this.stylePackage.themes.length > 0) {
      contentEl.createEl('h3', { text: translateForgeText('Themes', this.language) });
      for (const theme of this.stylePackage.themes) {
        themeRows.push(createImportRow(contentEl, 'Theme', theme, hasThemeConflict(theme, this.currentThemes), this.language));
      }
    }
    if (this.stylePackage.borders.length > 0) {
      contentEl.createEl('h3', { text: translateForgeText('Borders', this.language) });
      for (const border of this.stylePackage.borders) {
        borderRows.push(createImportRow(contentEl, 'Border', border, hasBorderConflict(border, this.currentBorders), this.language));
      }
    }

    const actions = contentEl.createDiv('statblock-forge__style-import-actions');
    const cancel = actions.createEl('button', { text: translateForgeText('Cancel', this.language) });
    cancel.addEventListener('click', () => this.close());
    const confirm = actions.createEl('button', { text: translateForgeText('Import selected styles', this.language), cls: 'mod-cta' });
    confirm.addEventListener('click', () => {
      try {
        const result = applyForgeStyleImport(this.stylePackage, this.currentThemes, this.currentBorders, {
          themeChoices: themeRows.map((row) => row.choiceSelect.value as ForgeStyleImportChoice),
          borderChoices: borderRows.map((row) => row.choiceSelect.value as ForgeStyleImportChoice),
          themeNames: themeRows.map((row) => row.nameInput.value),
          borderNames: borderRows.map((row) => row.nameInput.value),
        });
        const imported = result.addedThemes + result.replacedThemes + result.addedBorders + result.replacedBorders;
        if (imported === 0) {
          new Notice(translateForgeText('No styles were imported.', this.language));
          this.close();
          return;
        }
        this.onImport(result);
        this.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        new Notice(`${translateForgeText('Could not import selected styles:', this.language)} ${translateForgeText(message, this.language)}`);
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
