import { Modal, type App } from 'obsidian';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export class StatblockCreationModal extends Modal {
  constructor(
    app: App,
    private readonly templateName: string,
    private readonly language: ForgeLanguage,
    private readonly onCreate: (name: string, useSampleValues: boolean) => Promise<void>,
    private readonly destinationFolder?: string,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.replaceChildren();
    contentEl.classList.add('statblock-forge__statblock-create-modal');
    this.setTitle(translateForgeText('Create statblock from template', this.language));
    if (this.destinationFolder !== undefined) {
      const destination = this.destinationFolder || translateForgeText('Vault root', this.language);
      const destinationRow = element('div');
      destinationRow.className = 'statblock-forge__statblock-create-destination';
      destinationRow.append(
        element('span', `${translateForgeText('Destination folder', this.language)}:`),
        element('span', destination),
      );
      contentEl.append(destinationRow);
    }

    const nameLabel = element('label', translateForgeText('Statblock name', this.language));
    nameLabel.className = 'statblock-forge__control';
    const nameInput = element('input');
    nameInput.type = 'text';
    nameInput.required = true;
    nameInput.value = this.templateName;
    nameInput.className = 'statblock-forge__input';
    nameLabel.append(nameInput);
    contentEl.append(nameLabel);

    const sampleLabel = element('label');
    sampleLabel.className = 'statblock-forge__inline-toggle';
    const sampleInput = element('input');
    sampleInput.type = 'checkbox';
    sampleInput.checked = false;
    const sampleText = element('span', translateForgeText('Copy example values', this.language));
    sampleLabel.append(sampleInput, sampleText);
    contentEl.append(sampleLabel);

    const actions = element('div');
    actions.className = 'modal-button-container';
    const cancelButton = element('button', translateForgeText('Cancel', this.language));
    cancelButton.type = 'button';
    cancelButton.addEventListener('click', () => this.close());
    const createButton = element('button', translateForgeText('Create statblock', this.language));
    createButton.type = 'button';
    createButton.className = 'mod-cta';
    createButton.addEventListener('click', () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        nameInput.setCustomValidity(translateForgeText('Enter a name for the statblock.', this.language));
        nameInput.reportValidity();
        return;
      }
      createButton.disabled = true;
      cancelButton.disabled = true;
      void this.onCreate(name, sampleInput.checked).then(() => this.close()).catch(() => {
        createButton.disabled = false;
        cancelButton.disabled = false;
      });
    });
    actions.append(cancelButton, createButton);
    contentEl.append(actions);
    nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        createButton.click();
      }
    });
    window.setTimeout(() => nameInput.focus(), 0);
  }

  onClose(): void {
    this.contentEl.replaceChildren();
  }
}
