import { rollPieces } from '../statblocks/atlasDiceEngine/textRolls.ts';
import { isDiceFieldValue } from '../statblocks/diceFieldEditorModel.ts';
import { getDiceFieldDisplaySettings } from '../statblocks/diceFieldDisplayModel.ts';
import type { ForgeField } from '../templates/forgeTemplate.ts';
import { ATLAS_DICE_ICON_DATA_URLS } from './atlasDiceIconAssets.ts';
import { rollableBonusFormula } from '../statblocks/statblockValueRolls.ts';

export const FORGE_STATBLOCK_DICE_LINK_CLASS = 'statblock-forge__dice-link';

/** Applies or removes the accessible link semantics for a renderer-owned bonus value. */
export function setForgeStatblockDiceLink(element: HTMLElement, formula: string | null): void {
  if (!formula) {
    if (element.dataset.forgeBonusDiceLink !== 'true') return;
    element.classList.remove(FORGE_STATBLOCK_DICE_LINK_CLASS);
    delete element.dataset.formula;
    delete element.dataset.forgeBonusDiceLink;
    element.removeAttribute('role');
    element.removeAttribute('tabindex');
    element.removeAttribute('aria-label');
    return;
  }
  element.classList.add(FORGE_STATBLOCK_DICE_LINK_CLASS);
  element.dataset.formula = formula;
  element.dataset.forgeBonusDiceLink = 'true';
  element.setAttribute('role', 'button');
  element.setAttribute('tabindex', '0');
  element.setAttribute('aria-label', `Rolar ${formula}`);
}


/**
 * Appends Atlas-compatible dice links to a Scores cell. Explicit dice notation
 * remains clickable in every Scores block; whole-number bonuses only become
 * links when the block opted into `Roll as a bonus`.
 */
/**
 * Renders a Dice Field using its configured visual label while keeping the
 * resolved formula as the actual clickable roll payload. Formula display is
 * the backwards-compatible default for existing Templates.
 */
export function appendForgeStatblockDiceFieldDisplay(
  container: HTMLElement,
  field: ForgeField,
  formula: string,
): void {
  const settings = getDiceFieldDisplaySettings(field);
  if (settings.mode !== 'formula' && formula && isDiceFieldValue(formula)) {
    if (settings.mode === 'text' && !settings.text.trim()) {
      appendForgeStatblockDiceText(container, formula);
      return;
    }
    const doc = container.ownerDocument;
    const link = doc.createElement('span');
    link.className = `${FORGE_STATBLOCK_DICE_LINK_CLASS} statblock-forge__dice-display-link`;
    setForgeStatblockDiceLink(link, formula);
    if (settings.mode === 'icon') {
      const image = doc.createElement('img');
      image.className = 'statblock-forge__dice-display-icon';
      image.src = ATLAS_DICE_ICON_DATA_URLS[settings.iconSides] ?? ATLAS_DICE_ICON_DATA_URLS[6];
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      image.draggable = false;
      link.append(image);
    } else {
      const label = doc.createElement('span');
      label.className = 'statblock-forge__dice-display-label';
      label.textContent = settings.text.trim();
      link.append(label);
    }
    container.append(link);
    return;
  }
  appendForgeStatblockDiceText(container, formula);
}

export function appendForgeStatblockDiceText(container: HTMLElement, text: string, rollable = false): void {
  const doc = container.ownerDocument;
  const bonus = rollableBonusFormula(text, rollable);
  if (bonus) {
    const link = doc.createElement('span');
    link.textContent = text;
    setForgeStatblockDiceLink(link, bonus);
    container.append(link);
    return;
  }

  const pieces = rollPieces(text);
  if (!pieces.some((piece) => piece.formula !== null)) {
    container.textContent = text || '\u200b';
    return;
  }

  for (const piece of pieces) {
    if (piece.formula === null) {
      if (piece.text) container.append(doc.createTextNode(piece.text));
      continue;
    }
    const link = doc.createElement('span');
    link.textContent = piece.text;
    setForgeStatblockDiceLink(link, piece.formula);
    container.append(link);
  }
}


/** Marks every clickable link rendered from a known Forge Field, including ordinary Set Dice bonuses. */
export function tagForgeStatblockDiceFieldLinks(container: HTMLElement, fieldKey: string): void {
  const links: HTMLElement[] = [];
  if (container.classList.contains(FORGE_STATBLOCK_DICE_LINK_CLASS)) links.push(container);
  links.push(...Array.from(container.querySelectorAll<HTMLElement>(`.${FORGE_STATBLOCK_DICE_LINK_CLASS}`)));
  for (const link of links) {
    link.dataset.forgeDiceFieldKey = fieldKey;
    link.dataset.forgeRollFieldKey = fieldKey;
  }
}
