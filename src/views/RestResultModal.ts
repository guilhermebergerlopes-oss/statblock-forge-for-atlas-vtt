import { Modal, type App } from 'obsidian';
import type { RestCalculationResult } from '../statblocks/restRecoveryModel.ts';

export interface ForgeRestResultRoll {
  label: string;
  formula: string;
  total: number;
  engine: 'atlas' | 'forge';
}

export interface ForgeRestResultAction {
  choice: string;
  action: string;
  count: number;
  forOther: boolean;
}

export interface ForgeRestResultSpend {
  label: string;
  count: number;
}

export interface ForgeRestResultModalData {
  title: string;
  diceSetName: string;
  diceSetNote: string | null;
  saved: boolean;
  status: string;
  noChangeNote: string | null;
  rolls: readonly ForgeRestResultRoll[];
  actions: readonly ForgeRestResultAction[];
  spends: readonly ForgeRestResultSpend[];
  result: RestCalculationResult;
  warningLabels: readonly string[];
  otherCharacterLabels: readonly string[];
  language: 'en' | 'pt-BR';
}

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

/** Detailed, Forge-owned report shown after a Rest calculation and persistence attempt. */
export class RestResultModal extends Modal {
  constructor(app: App, private readonly data: ForgeRestResultModalData) {
    super(app);
  }

  onOpen(): void {
    const portuguese = this.data.language === 'pt-BR';
    const label = (en: string, pt: string): string => portuguese ? pt : en;
    this.setTitle(this.data.title);
    this.modalEl.classList.add('statblock-forge__rest-result-modal');
    this.contentEl.replaceChildren();
    this.contentEl.classList.add('statblock-forge__rest-result-content');

    const status = element(
      'div',
      `statblock-forge__rest-result-status ${this.data.saved ? 'is-saved' : this.data.otherCharacterLabels.length || this.data.warningLabels.length ? 'is-warning' : 'is-neutral'}`,
      this.data.status,
    );
    status.setAttribute('role', 'status');
    this.contentEl.append(status);

    const meta = element('p', 'statblock-forge__rest-result-meta', label(
      `Dice set: ${this.data.diceSetName}`,
      `Conjunto de dados: ${this.data.diceSetName}`,
    ));
    this.contentEl.append(meta);
    if (this.data.diceSetNote) {
      this.contentEl.append(element('p', 'statblock-forge__rest-result-note', this.data.diceSetNote));
    }

    if (this.data.actions.length > 0) {
      const rows = this.data.actions.map((action) => {
        const row = element('div', 'statblock-forge__rest-result-row');
        const name = element('div', 'statblock-forge__rest-result-row-main');
        name.append(element('strong', '', action.action));
        name.append(element('small', '', action.choice));
        const detail = element('div', 'statblock-forge__rest-result-row-detail');
        if (action.count > 1) detail.append(element('span', 'statblock-forge__rest-result-count', `× ${action.count}`));
        if (action.forOther) detail.append(element('span', 'statblock-forge__rest-result-tag is-other', label('Another character', 'Outro personagem')));
        row.append(name, detail);
        return row;
      });
      this.appendSection(label('Selected actions', 'Ações escolhidas'), rows);
    }

    if (this.data.spends.length > 0) {
      const rows = this.data.spends.map((spend) => {
        const row = element('div', 'statblock-forge__rest-result-row');
        row.append(
          element('span', 'statblock-forge__rest-result-row-main', spend.label),
          element('strong', 'statblock-forge__rest-result-count', `−${spend.count}`),
        );
        return row;
      });
      this.appendSection(label('Resources spent', 'Gastos realizados'), rows);
    }

    if (this.data.rolls.length > 0) {
      const rows = this.data.rolls.map((roll) => {
        const row = element('div', 'statblock-forge__rest-result-row');
        const main = element('div', 'statblock-forge__rest-result-row-main', roll.label);
        main.append(element('small', 'statblock-forge__rest-result-roll-source', roll.engine === 'atlas'
          ? label('Atlas Dice Tool · history recorded', 'Dice Tool Atlas · registrado no histórico')
          : label('Forge local roller · not in Atlas history', 'Motor local do Forge · fora do histórico Atlas')));
        row.append(
          main,
          element('code', 'statblock-forge__rest-result-roll', `${roll.formula} = ${roll.total}`),
        );
        return row;
      });
      this.appendSection(label('Rolls', 'Rolagens'), rows);
    }

    const counterRows = this.data.result.changes.map((change) => this.changeRow(change.label, change.from, change.to));
    if (counterRows.length > 0) this.appendSection(label('Counters', 'Counters'), counterRows);

    const resourceRows = this.data.result.resourceChanges.map((change) => {
      const row = this.changeRow(change.label, change.from, change.to);
      row.append(element('span', 'statblock-forge__rest-result-max', `/ ${change.max}`));
      return row;
    });
    if (resourceRows.length > 0) this.appendSection(label('Resources', 'Recursos'), resourceRows);

    if (this.data.otherCharacterLabels.length > 0) {
      const rows = this.data.otherCharacterLabels.map((message) => element(
        'div', 'statblock-forge__rest-result-warning is-other', message,
      ));
      this.appendSection(label('For another character', 'Para outro personagem'), rows);
    }

    if (this.data.warningLabels.length > 0) {
      const rows = this.data.warningLabels.map((message) => element(
        'div', 'statblock-forge__rest-result-warning', message,
      ));
      this.appendSection(label('Not applied', 'Não aplicado'), rows);
    }

    if (this.data.noChangeNote) {
      this.contentEl.append(element('p', 'statblock-forge__rest-result-note', this.data.noChangeNote));
    }

    const actions = element('div', 'modal-button-container statblock-forge__rest-result-actions');
    const close = element('button', 'mod-cta', label('Close', 'Fechar'));
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    actions.append(close);
    this.contentEl.append(actions);
  }

  onClose(): void {
    this.modalEl.classList.remove('statblock-forge__rest-result-modal');
    this.contentEl.classList.remove('statblock-forge__rest-result-content');
    this.contentEl.replaceChildren();
  }

  private appendSection(title: string, rows: HTMLElement[]): void {
    const section = element('section', 'statblock-forge__rest-result-section');
    section.append(element('h4', 'statblock-forge__rest-result-heading', title));
    const list = element('div', 'statblock-forge__rest-result-list');
    list.append(...rows);
    section.append(list);
    this.contentEl.append(section);
  }

  private changeRow(name: string, from: number, to: number): HTMLElement {
    const row = element('div', 'statblock-forge__rest-result-row');
    row.append(
      element('span', 'statblock-forge__rest-result-row-main', name),
      element('span', 'statblock-forge__rest-result-transition', `${from} → ${to}`),
    );
    return row;
  }
}
