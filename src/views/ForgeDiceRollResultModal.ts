import { Modal, type App } from 'obsidian';
import type { ForgeOffMapDiceRollResult } from '../statblocks/atlasOffMapDiceRoller.ts';

function node<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/** Forge-owned result presentation for rolls made without an Atlas map open. */
export class ForgeDiceRollResultModal extends Modal {
  constructor(
    app: App,
    private readonly result: ForgeOffMapDiceRollResult,
    private readonly language: 'en' | 'pt-BR',
    private readonly footerMessage?: string,
  ) {
    super(app);
  }

  onOpen(): void {
    const pt = this.language === 'pt-BR';
    const label = (en: string, br: string): string => pt ? br : en;
    this.modalEl.classList.add('statblock-forge__dice-roll-modal');
    this.contentEl.replaceChildren();
    this.contentEl.classList.add('statblock-forge__dice-roll-content');
    this.setTitle(label('Dice roll', 'Rolagem de dados'));

    const source = this.result.source;
    const heading = node('div', 'statblock-forge__dice-roll-source');
    heading.append(node('strong', '', source.tokenName || source.statblockPath));
    if (source.abilityName) heading.append(node('span', '', source.abilityName));
    this.contentEl.append(heading);

    const setLine = node('p', 'statblock-forge__dice-roll-set', `${label('Dice Set', 'Conjunto de dados')}: ${this.result.diceSet.name}`);
    this.contentEl.append(setLine);
    const formula = node('code', 'statblock-forge__dice-roll-formula', this.result.formula);
    this.contentEl.append(formula);

    const dice = node('div', 'statblock-forge__dice-roll-dice');
    for (const die of this.result.rolls) {
      const classes = [
        'statblock-forge__dice-roll-die',
        ...(die.dropped ? ['is-dropped'] : []),
        ...(die.rerolled ? ['is-rerolled'] : []),
        ...(die.exploded ? ['is-exploded'] : []),
        ...(die.advantage ? ['is-bonus'] : []),
        ...(die.negative ? ['is-negative'] : []),
        ...(die.success ? ['is-success'] : []),
        ...(die.failure ? ['is-failure'] : []),
      ];
      const chip = node('div', classes.join(' '));
      if (die.colour) chip.style.setProperty('--forge-die-colour', die.colour);
      chip.append(node('span', 'statblock-forge__dice-roll-die-value', `${die.negative ? '−' : ''}${die.value}`));
      const detail = die.name || die.label || die.die;
      chip.append(node('small', 'statblock-forge__dice-roll-die-label', detail));
      if (die.dropped) chip.title = label('Not kept', 'Não mantido');
      else if (die.rerolled) chip.title = label('Rerolled', 'Re-rolado');
      else if (die.exploded) chip.title = label('Explosion', 'Explosão');
      dice.append(chip);
    }
    if (this.result.rolls.length) this.contentEl.append(dice);

    const total = node('div', `statblock-forge__dice-roll-total${this.result.crit ? ` is-${this.result.crit}-crit` : ''}`);
    total.append(node('span', 'statblock-forge__dice-roll-total-label', label('Total', 'Total')));
    total.append(node('strong', '', String(this.result.total)));
    this.contentEl.append(total);

    if (this.result.crit) {
      this.contentEl.append(node('div', `statblock-forge__dice-roll-crit is-${this.result.crit}`, this.result.crit === 'high'
        ? label('Critical success', 'Sucesso crítico')
        : label('Critical failure', 'Falha crítica')));
    }
    if (this.result.advantage) {
      this.contentEl.append(node('p', 'statblock-forge__dice-roll-advantage', this.result.advantage === 'advantage'
        ? label('Rolled with advantage', 'Rolagem com vantagem')
        : label('Rolled with disadvantage', 'Rolagem com desvantagem')));
    }
    if (this.result.modifiers !== 0 || this.result.namedModifiers?.length) {
      const modifier = node('div', 'statblock-forge__dice-roll-modifiers');
      modifier.append(node('span', '', label('Modifiers', 'Modificadores')));
      modifier.append(node('strong', '', `${this.result.modifiers > 0 ? '+' : ''}${this.result.modifiers}`));
      for (const item of this.result.namedModifiers ?? []) {
        modifier.append(node('small', '', `${item.value > 0 ? '+' : ''}${item.value} ${item.label}`));
      }
      this.contentEl.append(modifier);
    }

    const footer = node('div', 'statblock-forge__dice-roll-footer');
    footer.append(node('small', '', this.footerMessage ?? label(
      'Rolled locally by Statblock Forge · not added to Atlas map history',
      'Rolagem local do Statblock Forge · não adicionada ao histórico do mapa Atlas',
    )));
    const close = node('button', 'mod-cta', label('Close', 'Fechar'));
    close.type = 'button';
    close.addEventListener('click', () => this.close());
    footer.append(close);
    this.contentEl.append(footer);
  }

  onClose(): void {
    this.modalEl.classList.remove('statblock-forge__dice-roll-modal');
    this.contentEl.classList.remove('statblock-forge__dice-roll-content');
    this.contentEl.replaceChildren();
  }
}
