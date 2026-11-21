import { Modal, Notice, type App } from 'obsidian';
import { createTemplateVaultStorage } from '../templates/templateVaultStorage.ts';
import { listTemplateBackups, restoreTemplateBackup, type TemplateBackupListItem } from '../templates/templateBackup.ts';
import { normalizeForgeLanguage, type ForgeLanguage } from '../i18n/localization.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Lists verified Forge backups and requires explicit confirmation before restoring one. */
export class TemplateBackupManagerModal extends Modal {
  private busy = false;
  private backups: TemplateBackupListItem[] = [];
  private failure: string | null = null;
  private confirming: TemplateBackupListItem | null = null;
  private readonly language: ForgeLanguage;

  constructor(
    app: App,
    private readonly templateFolder: string,
    language: ForgeLanguage,
    private readonly onRestored?: (path: string, safetyBackupPath?: string) => void,
  ) {
    super(app);
    this.language = normalizeForgeLanguage(language);
  }

  private label(en: string, pt: string): string {
    return this.language === 'pt-BR' ? pt : en;
  }

  onOpen(): void {
    this.modalEl.classList.add('statblock-forge__backup-modal');
    this.setTitle(this.label('Recover template backup', 'Recuperar backup de template'));
    void this.load();
  }

  private async load(): Promise<void> {
    this.busy = true;
    this.failure = null;
    this.render();
    try {
      this.backups = await listTemplateBackups(createTemplateVaultStorage(this.app), this.templateFolder);
    } catch (error) {
      this.failure = error instanceof Error ? error.message : String(error);
    } finally {
      this.busy = false;
      this.confirming = null;
      this.render();
    }
  }

  private render(): void {
    this.contentEl.replaceChildren();
    this.contentEl.append(element('p', 'statblock-forge__hint', this.label(
      'Backups are stored under .statblock-forge/backups. Forge validates the backup before offering restoration.',
      'Os backups ficam em .statblock-forge/backups. O Forge valida o arquivo antes de permitir a restauração.',
    )));
    if (this.failure) this.contentEl.append(element('p', 'statblock-forge__backup-error', this.failure));
    if (this.busy) {
      this.contentEl.append(element('p', 'statblock-forge__hint', this.label('Loading backups…', 'Carregando backups…')));
      return;
    }
    if (this.backups.length === 0) {
      this.contentEl.append(element('p', 'statblock-forge__hint', this.label('No Forge template backups were found.', 'Nenhum backup de template Forge foi encontrado.')));
      return;
    }
    if (this.confirming) {
      this.renderConfirmation(this.confirming);
      return;
    }
    const list = element('div', 'statblock-forge__backup-list');
    for (const backup of this.backups) {
      const row = element('section', 'statblock-forge__backup-row');
      row.append(element('strong', 'statblock-forge__backup-name', backup.templateName ?? backup.basename));
      const dateValue = backup.createdAt ? Date.parse(backup.createdAt) : backup.mtime;
      const dateLabel = Number.isFinite(dateValue) && dateValue > 0 ? new Date(dateValue).toLocaleString() : this.label('Date unavailable', 'Data indisponível');
      row.append(element('div', 'statblock-forge__backup-destination', `${dateLabel} · ${backup.size.toLocaleString()} bytes${backup.isLegacy ? ` · ${this.label('legacy backup', 'backup legado')}` : ''}`));
      row.append(element('code', 'statblock-forge__backup-path', backup.path));
      row.append(element('div', 'statblock-forge__backup-destination', backup.targetPath
        ? `${this.label('Restore to:', 'Restaurar em:')} ${backup.targetPath}`
        : this.label('No safe destination could be identified.', 'Não foi possível identificar um destino seguro.')));
      row.append(element('p', backup.canRestore ? 'statblock-forge__hint' : 'statblock-forge__backup-error', backup.message));
      const button = element('button', backup.canRestore ? 'mod-cta' : '', backup.canRestore
        ? this.label('Review restore…', 'Revisar restauração…')
        : this.label('Unavailable', 'Indisponível'));
      button.type = 'button';
      button.disabled = !backup.canRestore;
      button.addEventListener('click', () => { this.confirming = backup; this.render(); });
      row.append(button);
      list.append(row);
    }
    this.contentEl.append(list);
  }

  private renderConfirmation(backup: TemplateBackupListItem): void {
    const section = element('section', 'statblock-forge__backup-confirmation');
    section.append(element('h3', '', this.label('Confirm template restoration', 'Confirmar restauração do template')));
    section.append(element('p', '', `${this.label('Backup:', 'Backup:')} ${backup.basename}`));
    section.append(element('p', '', `${this.label('Destination:', 'Destino:')} ${backup.targetPath ?? ''}`));
    section.append(element('p', 'statblock-forge__hint', backup.targetExists
      ? this.label(
        'A file already exists at this destination. Forge will create a safety backup before replacing it. Changes made after this confirmation will be preserved.',
        'Já existe um arquivo neste destino. O Forge criará um backup de segurança antes de substituí-lo. Alterações feitas depois desta confirmação serão preservadas.',
      )
      : this.label(
        'The original file is missing. Forge will recreate it from the validated backup without changing existing files.',
        'O arquivo original não existe. O Forge irá recriá-lo a partir do backup validado sem alterar arquivos existentes.',
      )));
    const actions = element('div', 'modal-button-container');
    const cancel = element('button', '', this.label('Back', 'Voltar'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => { this.confirming = null; this.render(); });
    const restore = element('button', 'mod-warning', this.label('Restore backup', 'Restaurar backup'));
    restore.type = 'button';
    restore.disabled = this.busy;
    restore.addEventListener('click', () => { void this.restore(backup, restore, cancel); });
    actions.append(cancel, restore);
    section.append(actions);
    this.contentEl.append(section);
  }

  private async restore(backup: TemplateBackupListItem, restoreButton: HTMLButtonElement, cancelButton: HTMLButtonElement): Promise<void> {
    if (!backup.targetPath) return;
    this.busy = true;
    restoreButton.disabled = true;
    cancelButton.disabled = true;
    restoreButton.textContent = this.label('Restoring…', 'Restaurando…');
    const storage = createTemplateVaultStorage(this.app);
    try {
      const result = await restoreTemplateBackup({
        storage,
        templateFolder: this.templateFolder,
        backup,
        expectedBackupText: backup.backupText,
        expectedTargetText: backup.targetText,
        allowOverwrite: backup.targetExists,
      });
      if (this.onRestored) this.onRestored(result.path, result.safetyBackupPath);
      else new Notice(`${this.label('Template restored:', 'Template restaurado:')} ${result.path}${result.safetyBackupPath ? ` · ${this.label('Safety backup:', 'Backup de segurança:')} ${result.safetyBackupPath}` : ''}`);
      this.confirming = null;
      await this.load();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`${this.label('Could not restore template backup:', 'Não foi possível restaurar o backup:')} ${message}`, 10000);
      this.busy = false;
      restoreButton.disabled = false;
      cancelButton.disabled = false;
      restoreButton.textContent = this.label('Restore backup', 'Restaurar backup');
    }
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
