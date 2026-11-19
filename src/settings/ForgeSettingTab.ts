import { Platform, PluginSettingTab, Setting, type App } from 'obsidian';
import type StatblockForgePlugin from '../../main';
import { normalizeTemplateFolder } from '../templates/templateFormat';
import { localizeForgeElement, normalizeForgeLanguage } from '../i18n/localization';
import { DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT, forgeShortcutFromKeydown } from './forgeShortcut.ts';

export class ForgeSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly forgePlugin: StatblockForgePlugin) {
    super(app, forgePlugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.replaceChildren();
    const heading = document.createElement('h2');
    heading.textContent = 'Statblock Forge for Atlas VTT';
    containerEl.append(heading);

    new Setting(containerEl)
      .setName('Language')
      .addDropdown((dropdown) => dropdown
        .addOption('en', 'English')
        .addOption('pt-BR', 'Português (Brasil)')
        .setValue(normalizeForgeLanguage(this.forgePlugin.settings.language))
        .onChange(async (value: string) => {
          this.forgePlugin.settings.language = normalizeForgeLanguage(value);
          await this.forgePlugin.saveSettings();
          this.forgePlugin.refreshOpenViews();
          this.display();
        }));

    let shortcutInput: HTMLInputElement | null = null;
    const shortcutSetting = new Setting(containerEl)
      .setName('Statblock Mode shortcut')
      .setDesc('Click the field and press a key combination. Use at least one modifier: Mod (Ctrl on Windows/Linux or Cmd on macOS), Ctrl, Alt, or Shift. The shortcut works while the Forge editor is active and focus is outside text inputs.');
    shortcutSetting.addText((text) => {
      text
        .setPlaceholder(DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT)
        .setValue(this.forgePlugin.settings.toggleStatblockModeShortcut);
      shortcutInput = text.inputEl;
      text.inputEl.readOnly = true;
      text.inputEl.setAttribute('aria-label', 'Statblock Mode shortcut');
      text.inputEl.addEventListener('keydown', (event: KeyboardEvent) => {
        const shortcut = forgeShortcutFromKeydown(event, Platform.isMacOS);
        if (!shortcut) {
          if (!['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) event.preventDefault();
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        this.forgePlugin.settings.toggleStatblockModeShortcut = shortcut;
        text.setValue(shortcut);
        void this.forgePlugin.saveSettings();
      });
    });
    shortcutSetting.addButton((button) => button
      .setButtonText('Reset to default')
      .onClick(() => {
        this.forgePlugin.settings.toggleStatblockModeShortcut = DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT;
        void this.forgePlugin.saveSettings();
        if (shortcutInput) shortcutInput.value = DEFAULT_TOGGLE_STATBLOCK_MODE_SHORTCUT;
      }));

    new Setting(containerEl)
      .setName('Template folder')
      .addText((text) => text
        .setPlaceholder('atlas-vtt/statblock-templates')
        .setValue(this.forgePlugin.settings.templateFolder)
        .onChange(async (value: string) => {
          this.forgePlugin.settings.templateFolder = normalizeTemplateFolder(value);
          await this.forgePlugin.saveSettings();
          this.forgePlugin.refreshOpenViews();
        }));


    new Setting(containerEl)
      .setName('Statblock notes folder')
      .addText((text) => text
        .setPlaceholder('atlas-vtt/statblocks')
        .setValue(this.forgePlugin.settings.statblockFolder)
        .onChange(async (value: string) => {
          this.forgePlugin.settings.statblockFolder = normalizeTemplateFolder(value);
          await this.forgePlugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Documentation folder')
      .addText((text) => text
        .setPlaceholder(this.forgePlugin.settings.language === 'pt-BR' ? 'Statblock Forge/Documentação' : 'Statblock Forge/Documentation')
        .setValue(this.forgePlugin.settings.documentationFolder)
        .onChange(async (value: string) => {
          this.forgePlugin.settings.documentationFolder = value;
          await this.forgePlugin.saveSettings();
        }))
      .addButton((button) => button
        .setButtonText('Download documentation')
        .onClick(() => { void this.forgePlugin.downloadDocumentation(); }));

    const styleSetting = new Setting(containerEl).setName('Style library');
    const styleFileInput = document.createElement('input');
    styleFileInput.type = 'file';
    styleFileInput.accept = '.forgestyle,application/json';
    styleFileInput.hidden = true;
    styleFileInput.setAttribute('aria-label', 'Import .forgestyle');
    styleFileInput.addEventListener('change', () => {
      const file = styleFileInput.files?.[0];
      if (file) this.forgePlugin.importStyleFile(file);
      styleFileInput.value = '';
    });
    styleSetting.controlEl.append(styleFileInput);
    styleSetting.addButton((button) => button
      .setButtonText('Import .forgestyle')
      .onClick(() => styleFileInput.click()));
    styleSetting.addButton((button) => button
      .setButtonText('Export style library')
      .setDisabled(this.forgePlugin.settings.customThemes.length + this.forgePlugin.settings.customBorders.length === 0)
      .onClick(() => this.forgePlugin.exportStylePackage(
        'Forge style library',
        this.forgePlugin.settings.customThemes,
        this.forgePlugin.settings.customBorders,
      )));

    localizeForgeElement(containerEl, normalizeForgeLanguage(this.forgePlugin.settings.language));
  }
}
