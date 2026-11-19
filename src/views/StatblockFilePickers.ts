import { FuzzySuggestModal, TFile, type App } from 'obsidian';
import { FORGE_TEMPLATE_EXTENSION, isSupportedTemplatePath } from '../templates/templateFormat.ts';
import { isSupportedVaultImagePath } from '../templates/imageFieldModel.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';

export class ForgeTemplatePickerModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private readonly onChoose: (file: TFile) => void,
    language: ForgeLanguage = 'en',
    private readonly forgeOnly = false,
  ) {
    super(app);
    this.setPlaceholder(translateForgeText(
      forgeOnly ? 'Selecione um template .forgetemplate…' : 'Selecione um template Forge ou Atlas…',
      language,
    ));
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((file) => {
      if (!isSupportedTemplatePath(file.path)) return false;
      return !this.forgeOnly || file.extension.toLowerCase() === FORGE_TEMPLATE_EXTENSION;
    });
  }

  getItemText(file: TFile): string {
    return `${file.basename} — ${file.path}`;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}


/** Fuzzy Vault picker for regular Image fields; it never creates or links Atlas tokens. */
export class VaultImagePickerModal extends FuzzySuggestModal<TFile> {
  constructor(app: App, private readonly onChoose: (file: TFile) => void, language: ForgeLanguage = 'en') {
    super(app);
    this.setPlaceholder(translateForgeText('Choose an image from the Vault…', language));
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((file) => isSupportedVaultImagePath(file.path));
  }

  getItemText(file: TFile): string {
    return `${file.basename} — ${file.path}`;
  }

  onChooseItem(file: TFile): void {
    this.onChoose(file);
  }
}
