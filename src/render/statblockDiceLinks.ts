import { Menu, Notice, type App } from 'obsidian';
import type { ForgeTemplate } from '../templates/forgeTemplate.ts';
import { loadForgeRestDiceSet, type ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';
import { forgeStatblockDefaultRollFormula, forgeStatblockRollMenuSides, getForgeStatblockRollHistory, hasForgeStatblockRollHistory, repeatForgeStatblockRollFromHistory, rollForgeStatblockWithAtlasDiceTool } from '../statblocks/atlasRestDiceTool.ts';
import {
  formulaWithNextRollModifiers, isNextRollModifierQueued, pendingNextRollModifiers, restoreNextRollModifiers,
  takeNextRollModifiers, toggleNextRollModifier,
} from '../statblocks/nextRollModifiers.ts';
import { rollPieces } from '../statblocks/atlasDiceEngine/textRolls.ts';
import { FORGE_STATBLOCK_DICE_LINK_CLASS } from './statblockDiceLinkElement.ts';

const LINK_CLASS = FORGE_STATBLOCK_DICE_LINK_CLASS;
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'OPTION', 'A']);
const LABEL_SELECTOR = [
  '.statblock-forge__preview-stat-label',
  '.statblock-forge__preview-block-heading',
  '.statblock-forge__preview-field-label',
  '.statblock-forge__preview-line-label',
  '.statblock-forge__preview-entry-part-label',
  '.atlas-sb-label',
  '.atlas-sb-property-name',
].join(',');

function isAddToNextRollKey(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'n' || event.code === 'KeyN';
}

function isAddToNextRollShortcutKey(event: KeyboardEvent): boolean {
  return isAddToNextRollKey(event)
    && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;
}

function toggleRollInNextRollQueue(
  app: App,
  statblockKey: string,
  formula: string,
  label: string | undefined,
  language: 'en' | 'pt-BR',
): void {
  const added = toggleNextRollModifier(app, statblockKey, formula, label);
  const description = label ? ` (${label})` : '';
  new Notice(language === 'pt-BR'
    ? (added
      ? `${formula}${description} será adicionado à próxima rolagem.`
      : `${formula}${description} foi removido da próxima rolagem.`)
    : (added
      ? `${formula}${description} will be added to the next roll.`
      : `${formula}${description} was removed from the next roll.`));
}

export interface ForgeStatblockDiceLinkOptions {
  app: App;
  template: ForgeTemplate;
  statblockPath: string;
  statblockName: string;
  language: 'en' | 'pt-BR';
}

function isSkipped(text: Text): boolean {
  const parent = text.parentElement;
  if (!parent || parent.closest(`.${LINK_CLASS}`)) return true;
  if (parent.closest('[contenteditable="true"], .statblock-forge__dice-field-editor, .statblock-forge__inline-editor')) return true;
  return SKIPPED_TAGS.has(parent.tagName);
}

/** Rewrites only the renderer-owned static text, following Atlas' text-roll parsing rule. */
export function linkForgeStatblockDice(root: HTMLElement): void {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, doc.defaultView?.NodeFilter.SHOW_TEXT ?? NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => isSkipped(node as Text)
      ? (doc.defaultView?.NodeFilter.FILTER_REJECT ?? NodeFilter.FILTER_REJECT)
      : (doc.defaultView?.NodeFilter.FILTER_ACCEPT ?? NodeFilter.FILTER_ACCEPT),
  });
  const targets: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    targets.push(current as Text);
    current = walker.nextNode();
  }

  for (const textNode of targets) {
    const text = textNode.nodeValue ?? '';
    const pieces = rollPieces(text);
    if (!pieces.some((piece) => piece.formula !== null)) continue;
    const fragment = doc.createDocumentFragment();
    for (const piece of pieces) {
      if (piece.formula === null) {
        fragment.append(doc.createTextNode(piece.text));
        continue;
      }
      const link = doc.createElement('span');
      link.className = LINK_CLASS;
      link.textContent = piece.text;
      link.dataset.formula = piece.formula;
      link.setAttribute('role', 'button');
      link.setAttribute('tabindex', '0');
      link.setAttribute('aria-label', `Rolar ${piece.formula}`);
      fragment.append(link);
    }
    textNode.replaceWith(fragment);
  }
}

function abilityNameFor(link: HTMLElement): string | undefined {
  const explicit = link.closest<HTMLElement>('[data-roll-name]')?.dataset.rollName?.trim();
  if (explicit) return explicit.replace(/[:.]$/, '');
  const scope = link.closest<HTMLElement>(
    '.atlas-sb-labelled, .atlas-sb-property, .atlas-sb-trait, .statblock-forge__preview-stat, .statblock-forge__preview-block, .statblock-forge__preview-pairs, li, td, p',
  );
  const label = scope?.querySelector<HTMLElement>(LABEL_SELECTOR)?.textContent?.trim();
  return label ? label.replace(/[:.]$/, '') : undefined;
}

function advantageFrom(event: MouseEvent | KeyboardEvent): 'advantage' | 'disadvantage' | null {
  if (event.shiftKey === event.altKey) return null;
  return event.shiftKey ? 'advantage' : 'disadvantage';
}

function showStatblockRollHistory(
  app: App,
  statblockPath: string,
  at: { x: number; y: number },
  language: 'en' | 'pt-BR',
): void {
  const entries = getForgeStatblockRollHistory(app, statblockPath, 10);
  const historyMenu = new Menu();
  if (entries.length === 0) {
    historyMenu.addItem((item) => item
      .setTitle(language === 'pt-BR' ? 'Nenhuma rolagem recente' : 'No recent rolls')
      .setDisabled(true));
  } else {
    for (const entry of entries) {
      const label = entry.abilityName ? `${entry.abilityName}: ` : '';
      const time = new Date(entry.timestamp).toLocaleTimeString(language === 'pt-BR' ? 'pt-BR' : 'en', {
        hour: '2-digit', minute: '2-digit',
      });
      historyMenu.addItem((item) => item
        .setTitle(`${label}${entry.formula} = ${entry.total} · ${time}${entry.repeatable === false ? (language === 'pt-BR' ? ' · indisponível' : ' · unavailable') : ''}`)
        .setIcon('history')
        .setDisabled(entry.repeatable === false)
        .onClick(() => {
          const attempt = repeatForgeStatblockRollFromHistory(app, entry.id);
          if (!attempt.available || !attempt.roll) {
            new Notice(language === 'pt-BR'
              ? 'Não foi possível repetir esta rolagem. Verifique se o Atlas está ativo e atualizado.'
              : 'Could not repeat this roll. Make sure Atlas is enabled and up to date.');
          }
        }));
    }
  }
  historyMenu.showAtPosition(at);
}

function addStatblockRollHistoryItem(
  menu: Menu,
  app: App,
  statblockPath: string,
  at: { x: number; y: number },
  language: 'en' | 'pt-BR',
): void {
  if (!hasForgeStatblockRollHistory(app)) return;
  menu.addItem((item) => item
    .setTitle(language === 'pt-BR' ? 'Histórico de rolagens' : 'Roll history')
    .setIcon('history')
    .onClick(() => showStatblockRollHistory(app, statblockPath, at, language)));
}

/**
 * Wires the Forge statblock's roll links to the Dice Tool exposed by an open
 * Atlas map. Atlas owns the roll history and visual event; Forge only supplies
 * the formula and its statblock source metadata.
 */
export function attachForgeStatblockDiceRolling(
  root: HTMLElement,
  options: ForgeStatblockDiceLinkOptions,
): () => void {
  linkForgeStatblockDice(root);
  const rollLinkHint = options.language === 'pt-BR'
    ? 'Clique para rolar. Mantenha N pressionado e clique para adicionar ou remover esta fórmula da próxima rolagem.'
    : 'Click to roll. Hold N and click to add or remove this formula from the next roll.';
  root.querySelectorAll<HTMLElement>(`.${LINK_CLASS}`).forEach((link) => {
    link.title = rollLinkHint;
    const formula = link.dataset.formula ?? link.textContent ?? '';
    link.setAttribute('aria-label', options.language === 'pt-BR'
      ? `Rolar ${formula}. Mantenha N pressionado e clique para adicionar ou remover da próxima rolagem.`
      : `Roll ${formula}. Hold N and click to add or remove from the next roll.`);
  });
  const requestedSetId = typeof options.template.diceSetId === 'string' ? options.template.diceSetId : '';
  let explicitSetPromise: Promise<ForgeRestDiceSet | null> | null = null;
  const getExplicitSet = (): Promise<ForgeRestDiceSet | null> => {
    if (!requestedSetId) return Promise.resolve(null);
    explicitSetPromise ??= loadForgeRestDiceSet(options.app, options.template).then((set) =>
      set.id === requestedSetId ? set : null,
    ).catch(() => null);
    return explicitSetPromise;
  };

  const statblockKey = options.statblockPath || `name:${options.statblockName}`;
  let addToNextRollKeyDown = false;
  const document = root.ownerDocument;
  const ownerWindow = document.defaultView;
  const onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (isAddToNextRollShortcutKey(event)) addToNextRollKeyDown = true;
  };
  const onDocumentKeyUp = (event: KeyboardEvent): void => {
    if (isAddToNextRollKey(event)) addToNextRollKeyDown = false;
  };
  const onWindowBlur = (): void => { addToNextRollKeyDown = false; };
  const roll = async (link: HTMLElement, side: 'advantage' | 'disadvantage' | null): Promise<void> => {
    const formula = link.dataset.formula;
    if (!formula) return;
    const queued = takeNextRollModifiers(options.app, statblockKey);
    try {
      const set = await getExplicitSet();
      const defaultRoll = queued.length > 0 ? forgeStatblockDefaultRollFormula(options.app, set, options.statblockPath) : null;
      const formulaToRoll = formulaWithNextRollModifiers(formula, queued, defaultRoll);
      if (!formulaToRoll) {
        restoreNextRollModifiers(options.app, statblockKey, queued);
        new Notice(options.language === 'pt-BR'
          ? 'Não foi possível determinar os dados padrão para combinar as fórmulas. Os bônus continuam aguardando a próxima rolagem.'
          : 'Could not resolve the default dice needed to combine these formulas. The modifiers remain queued for the next roll.');
        return;
      }
      const attempt = rollForgeStatblockWithAtlasDiceTool(options.app, formulaToRoll, {
        statblockPath: options.statblockPath,
        tokenName: options.statblockName,
        abilityName: abilityNameFor(link),
      }, set, side);
      if (!attempt.available) {
        restoreNextRollModifiers(options.app, statblockKey, queued);
        new Notice(options.language === 'pt-BR'
          ? 'O serviço de rolagem do Atlas não está disponível. Verifique se o Atlas VTT está ativo e atualizado.'
          : 'Atlas dice rolling is unavailable. Make sure Atlas VTT is enabled and up to date.');
      } else if (!attempt.roll) {
        restoreNextRollModifiers(options.app, statblockKey, queued);
        new Notice(options.language === 'pt-BR'
          ? 'O Atlas não conseguiu executar esta fórmula de dados.'
          : 'Atlas could not roll this dice formula.');
      }
    } catch (error) {
      restoreNextRollModifiers(options.app, statblockKey, queued);
      new Notice(options.language === 'pt-BR'
        ? `Falha na rolagem: ${error instanceof Error ? error.message : String(error)}`
        : `Dice roll failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const linkOf = (event: Event): HTMLElement | null => {
    const target = event.target;
    if (!(target instanceof Element)) return null;
    return target.closest<HTMLElement>(`.${LINK_CLASS}`);
  };
  const onClick = (event: MouseEvent): void => {
    const link = linkOf(event);
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    if (addToNextRollKeyDown) {
      const formula = link.dataset.formula?.trim();
      if (formula) {
        toggleRollInNextRollQueue(options.app, statblockKey, formula, abilityNameFor(link), options.language);
      }
      return;
    }
    void roll(link, advantageFrom(event));
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const link = linkOf(event);
    if (!link) return;
    event.preventDefault();
    event.stopPropagation();
    void roll(link, advantageFrom(event));
  };

  const onContextMenu = (event: MouseEvent): void => {
    const link = linkOf(event);
    const formula = link?.dataset.formula;
    if (!link || !formula) return;
    event.preventDefault();
    event.stopPropagation();

    const box = link.getBoundingClientRect();
    const at = event.button === 2
      ? { x: event.clientX, y: event.clientY }
      : { x: box.left, y: box.bottom };
    const label = abilityNameFor(link);
    void getExplicitSet().then((set) => {
      if (!link.isConnected) return;
      const queued = isNextRollModifierQueued(options.app, statblockKey, formula, label);
      const pending = pendingNextRollModifiers(options.app, statblockKey);
      const menu = new Menu();
      addStatblockRollHistoryItem(menu, options.app, options.statblockPath, at, options.language);
      menu.addItem((item) => item
        .setTitle(options.language === 'pt-BR' ? 'Rolar' : 'Roll')
        .setIcon('dices')
        .onClick(() => { void roll(link, null); }));

      menu.addItem((item) => item
        .setTitle(options.language === 'pt-BR'
          ? (queued ? 'Remover da próxima rolagem' : 'Adicionar à próxima rolagem')
          : (queued ? 'Remove from next roll' : 'Add to next roll'))
        .setIcon(queued ? 'minus-circle' : 'plus-circle')
        .onClick(() => toggleRollInNextRollQueue(options.app, statblockKey, formula, label, options.language)));

      const defaultRoll = pending.length > 0 ? forgeStatblockDefaultRollFormula(options.app, set, options.statblockPath) : null;
      const formulaForMenu = formulaWithNextRollModifiers(formula, pending, defaultRoll) ?? formula;
      for (const side of forgeStatblockRollMenuSides(options.app, formulaForMenu, set, options.statblockPath)) {
        const advantage = side === 'advantage';
        menu.addItem((item) => item
          .setTitle(options.language === 'pt-BR'
            ? (advantage ? 'Rolar com vantagem' : 'Rolar com desvantagem')
            : (advantage ? 'Roll with advantage' : 'Roll with disadvantage'))
          .setIcon(advantage ? 'chevrons-up' : 'chevrons-down')
          .onClick(() => { void roll(link, side); }));
      }

      // Preserve the pointer location even though a custom Dice Set may need an async Vault read.
      menu.showAtPosition(at);
    }).catch(() => {
      if (!link.isConnected) return;
      const queued = isNextRollModifierQueued(options.app, statblockKey, formula, label);
      const menu = new Menu();
      addStatblockRollHistoryItem(menu, options.app, options.statblockPath, at, options.language);
      menu.addItem((item) => item
        .setTitle(options.language === 'pt-BR' ? 'Rolar' : 'Roll')
        .setIcon('dices')
        .onClick(() => { void roll(link, null); }));
      menu.addItem((item) => item
        .setTitle(options.language === 'pt-BR'
          ? (queued ? 'Remover da próxima rolagem' : 'Adicionar à próxima rolagem')
          : (queued ? 'Remove from next roll' : 'Add to next roll'))
        .setIcon(queued ? 'minus-circle' : 'plus-circle')
        .onClick(() => toggleRollInNextRollQueue(options.app, statblockKey, formula, label, options.language)));
      menu.showAtPosition(at);
    });
  };

  document.addEventListener('keydown', onDocumentKeyDown, true);
  document.addEventListener('keyup', onDocumentKeyUp, true);
  ownerWindow?.addEventListener('blur', onWindowBlur);
  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('contextmenu', onContextMenu);
  return () => {
    addToNextRollKeyDown = false;
    document.removeEventListener('keydown', onDocumentKeyDown, true);
    document.removeEventListener('keyup', onDocumentKeyUp, true);
    ownerWindow?.removeEventListener('blur', onWindowBlur);
    root.removeEventListener('click', onClick);
    root.removeEventListener('keydown', onKeyDown);
    root.removeEventListener('contextmenu', onContextMenu);
  };
}
