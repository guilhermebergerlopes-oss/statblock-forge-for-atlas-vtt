import { Menu, Notice, type App } from 'obsidian';
import type { ForgeTemplate } from '../templates/forgeTemplate.ts';
import { loadForgeRestDiceSet, type ForgeRestDiceSet } from '../statblocks/restDiceRoller.ts';
import { loadForgeAtlasCollectionDiceSet } from '../atlas/atlasCollectionDiceSet.ts';
import { getAtlasDicePresetPinStates, resolveAtlasSavedRollCollection, supportsAtlasDicePresets, toggleAtlasDicePresetPin } from '../atlas/atlasSavedRolls.ts';
import { ForgeDiceRollResultModal } from '../views/ForgeDiceRollResultModal.ts';
import { SaveAtlasDicePresetModal } from '../views/SaveAtlasDicePresetModal.ts';
import { forgeStatblockDefaultRollFormula, forgeStatblockRollMenuSides, getForgeStatblockRollHistory, hasForgeStatblockRollHistory, repeatForgeStatblockRollFromHistory, rollForgeStatblockWithAtlasDiceTool, type ForgeAtlasRollContext } from '../statblocks/atlasRestDiceTool.ts';
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
  /** Exact originating map/token when the statblock is rendered by Atlas. */
  atlasRollContext?: ForgeAtlasRollContext;
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

async function openSaveAtlasRoll(
  app: App,
  statblockPath: string,
  statblockName: string,
  link: HTMLElement,
  language: 'en' | 'pt-BR',
  activeDiceSet?: ForgeRestDiceSet | null,
): Promise<void> {
  const formula = link.dataset.formula?.trim() ?? '';
  if (!formula) return;
  try {
    const collection = await resolveAtlasSavedRollCollection(app, statblockPath);
    if (!collection) {
      new Notice(language === 'pt-BR'
        ? 'Abra um mapa do Atlas 0.18.0 ou superior para salvar rolagens em uma coleção.'
        : 'Open an Atlas 0.18.0 or newer map to save rolls to a collection.');
      return;
    }
    const suggestedName = (abilityNameFor(link) || statblockName || formula).trim().slice(0, 40);
    new SaveAtlasDicePresetModal(app, language, collection, formula, suggestedName, activeDiceSet).open();
  } catch (error) {
    new Notice(language === 'pt-BR'
      ? `Não foi possível acessar as coleções do Atlas: ${error instanceof Error ? error.message : String(error)}`
      : `Could not access Atlas collections: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function addSaveAtlasRollMenuItem(
  menu: Menu,
  app: App,
  statblockPath: string,
  statblockName: string,
  link: HTMLElement,
  language: 'en' | 'pt-BR',
  activeDiceSet?: ForgeRestDiceSet | null,
): void {
  if (!supportsAtlasDicePresets(app)) return;
  menu.addItem((item) => item
    .setTitle(language === 'pt-BR' ? 'Salvar rolagem na coleção Atlas' : 'Save roll to Atlas collection')
    .setIcon('bookmark-plus')
    .onClick(() => { void openSaveAtlasRoll(app, statblockPath, statblockName, link, language, activeDiceSet); }));
}

function showMenuWithAtlasDiceRowItems(
  menu: Menu,
  app: App,
  statblockPath: string,
  formula: string,
  link: HTMLElement,
  at: { x: number; y: number },
  language: 'en' | 'pt-BR',
  activeDiceSet?: ForgeRestDiceSet | null,
): void {
  void (async () => {
    try {
      const collection = await resolveAtlasSavedRollCollection(app, statblockPath);
      if (collection) {
        const states = getAtlasDicePresetPinStates(collection, formula, activeDiceSet);
        for (const state of states) {
          menu.addItem((item) => item
            .setTitle(language === 'pt-BR'
              ? `${state.pinned ? 'Desafixar' : 'Fixar'} “${state.name}” ${state.pinned ? 'da' : 'na'} fileira de dados Atlas`
              : `${state.pinned ? 'Unpin' : 'Pin'} “${state.name}” ${state.pinned ? 'from' : 'to'} Atlas dice row`)
            .setIcon(state.pinned ? 'pin-off' : 'pin')
            .onClick(() => {
              void toggleAtlasDicePresetPin(collection, state.id).then((result) => {
                if (result.ok) {
                  new Notice(language === 'pt-BR'
                    ? (result.pinned
                      ? `“${result.presetName}” foi fixada na fileira de dados Atlas.`
                      : `“${result.presetName}” foi removida da fileira de dados Atlas.`)
                    : (result.pinned
                      ? `“${result.presetName}” was pinned to the Atlas dice row.`
                      : `“${result.presetName}” was unpinned from the Atlas dice row.`));
                  return;
                }
                const message = result.reason === 'row-full'
                  ? (language === 'pt-BR'
                    ? 'A fileira de dados Atlas já está cheia. Remova uma posição no editor do Atlas antes de fixar outra rolagem.'
                    : 'The Atlas dice row is full. Remove a slot in the Atlas editor before pinning another roll.')
                  : (language === 'pt-BR'
                    ? 'O Atlas não conseguiu atualizar a fileira de dados. Verifique se a coleção ainda está disponível.'
                    : 'Atlas could not update the dice row. Check that the collection is still available.');
                new Notice(message);
              }).catch((error) => {
                new Notice(language === 'pt-BR'
                  ? `Não foi possível atualizar a fileira do Atlas: ${error instanceof Error ? error.message : String(error)}`
                  : `Could not update the Atlas dice row: ${error instanceof Error ? error.message : String(error)}`);
              });
            }));
        }
      }
    } catch { /* Keep the ordinary roll menu available when collection settings cannot be read. */ }
    if (link.isConnected) menu.showAtPosition(at);
  })();
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
      const engineLabel = entry.engine === 'forge' ? (language === 'pt-BR' ? 'Forge' : 'Forge') : 'Atlas';
      historyMenu.addItem((item) => item
        .setTitle(`${label}${entry.formula} = ${entry.total} · ${time} · ${engineLabel}${entry.repeatable === false ? (language === 'pt-BR' ? ' · indisponível' : ' · unavailable') : ''}`)
        .setIcon('history')
        .setDisabled(entry.repeatable === false)
        .onClick(() => {
          const attempt = repeatForgeStatblockRollFromHistory(app, entry.id);
          if (attempt.engine === 'forge' && attempt.details) {
            new ForgeDiceRollResultModal(app, attempt.details, language).open();
          }
          if (!attempt.available || !attempt.roll) {
            new Notice(language === 'pt-BR'
              ? 'Não foi possível repetir esta rolagem. Verifique se o conjunto de dados original ainda está disponível.'
              : 'Could not repeat this roll. Check whether its original Dice Set is still available.');
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
  let collectionSetPromise: Promise<ForgeRestDiceSet> | null = null;
  const getCollectionSet = (): Promise<ForgeRestDiceSet> => {
    collectionSetPromise ??= loadForgeAtlasCollectionDiceSet(options.app, options.statblockPath);
    return collectionSetPromise;
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
      const [set, collectionSet] = await Promise.all([getExplicitSet(), getCollectionSet()]);
      const defaultRoll = queued.length > 0
        ? forgeStatblockDefaultRollFormula(options.app, set, options.statblockPath, options.atlasRollContext, collectionSet)
        : null;
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
        ...(options.atlasRollContext?.viewId ? { viewId: options.atlasRollContext.viewId } : {}),
        ...(options.atlasRollContext?.tokenId ? { tokenId: options.atlasRollContext.tokenId } : {}),
        ...(options.atlasRollContext?.tokenImagePath ? { tokenImagePath: options.atlasRollContext.tokenImagePath } : {}),
        ...(options.atlasRollContext?.originContext ? { originContext: options.atlasRollContext.originContext } : {}),
        tokenName: options.statblockName,
        abilityName: abilityNameFor(link),
      }, set, side, collectionSet);
      if (attempt.engine === 'forge' && attempt.details) {
        new ForgeDiceRollResultModal(options.app, attempt.details, options.language).open();
      }
      if (!attempt.available) {
        restoreNextRollModifiers(options.app, statblockKey, queued);
        new Notice(options.language === 'pt-BR'
          ? 'Não foi possível iniciar o sistema de rolagem. Verifique a configuração do conjunto de dados.'
          : 'Could not start the dice roller. Check the active Dice Set configuration.');
      } else if (!attempt.roll) {
        restoreNextRollModifiers(options.app, statblockKey, queued);
        const errorCode = attempt.error?.trim();
        const detail = errorCode === 'advantage'
          ? (options.language === 'pt-BR'
            ? 'o Dice Set ativo não define uma regra aplicável para essa vantagem/desvantagem.'
            : 'the active Dice Set does not define a rule for this advantage/disadvantage request.')
          : errorCode;
        const localRoll = attempt.engine === 'forge';
        new Notice(options.language === 'pt-BR'
          ? (detail ? `A rolagem não foi executada: ${detail}` : (localRoll ? 'O Forge não conseguiu executar esta fórmula de dados.' : 'O Atlas não conseguiu executar esta fórmula de dados.'))
          : (detail || (localRoll ? 'Forge could not roll this dice formula.' : 'Atlas could not roll this dice formula.')));
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
    void Promise.all([getExplicitSet(), getCollectionSet()]).then(([set, collectionSet]) => {
      if (!link.isConnected) return;
      const queued = isNextRollModifierQueued(options.app, statblockKey, formula, label);
      const pending = pendingNextRollModifiers(options.app, statblockKey);
      const menu = new Menu();
      const activeDiceSet = set ?? collectionSet;
      addStatblockRollHistoryItem(menu, options.app, options.statblockPath, at, options.language);
      addSaveAtlasRollMenuItem(menu, options.app, options.statblockPath, options.statblockName, link, options.language, activeDiceSet);
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

      const defaultRoll = pending.length > 0 ? forgeStatblockDefaultRollFormula(options.app, set, options.statblockPath, options.atlasRollContext, collectionSet) : null;
      const formulaForMenu = formulaWithNextRollModifiers(formula, pending, defaultRoll) ?? formula;
      for (const side of forgeStatblockRollMenuSides(options.app, formulaForMenu, set, options.statblockPath, options.atlasRollContext, collectionSet)) {
        const advantage = side === 'advantage';
        menu.addItem((item) => item
          .setTitle(options.language === 'pt-BR'
            ? (advantage ? 'Rolar com vantagem' : 'Rolar com desvantagem')
            : (advantage ? 'Roll with advantage' : 'Roll with disadvantage'))
          .setIcon(advantage ? 'chevrons-up' : 'chevrons-down')
          .onClick(() => { void roll(link, side); }));
      }

      // Wait for the matching collection presets so the menu can expose pin/unpin actions.
      showMenuWithAtlasDiceRowItems(menu, options.app, options.statblockPath, formula, link, at, options.language, activeDiceSet);
    }).catch(() => {
      if (!link.isConnected) return;
      const queued = isNextRollModifierQueued(options.app, statblockKey, formula, label);
      const menu = new Menu();
      addStatblockRollHistoryItem(menu, options.app, options.statblockPath, at, options.language);
      addSaveAtlasRollMenuItem(menu, options.app, options.statblockPath, options.statblockName, link, options.language, null);
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
      showMenuWithAtlasDiceRowItems(menu, options.app, options.statblockPath, formula, link, at, options.language, null);
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
