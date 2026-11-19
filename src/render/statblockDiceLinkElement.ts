import { rollPieces } from '../statblocks/atlasDiceEngine/textRolls.ts';
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
