import { normalizeBlockAppearance } from './blockAppearance.ts';
import type { BlockAppearance, ForgeBlockLayout } from './forgeTemplate.ts';

export interface CopiedBlockAppearance {
  appearanceMode: 'theme' | 'custom';
  appearance: BlockAppearance;
}

let copiedAppearance: CopiedBlockAppearance | null = null;

function cloneAppearance(value: unknown): BlockAppearance {
  const normalized = normalizeBlockAppearance(value);
  // Appearance is persisted as JSON sidecar metadata. Clone it so later edits
  // to the source block cannot mutate the clipboard snapshot by reference.
  return JSON.parse(JSON.stringify(normalized)) as BlockAppearance;
}

/** Stores only visual settings; block content, structure and Field links are excluded. */
export function copyBlockAppearance(source: Pick<ForgeBlockLayout, 'appearance' | 'appearanceMode'>): void {
  copiedAppearance = {
    appearanceMode: source.appearanceMode === 'custom' ? 'custom' : 'theme',
    appearance: cloneAppearance(source.appearance),
  };
}

export function hasCopiedBlockAppearance(): boolean {
  return copiedAppearance !== null;
}

/** Applies the copied appearance without changing the target block's layout or content. */
export function pasteBlockAppearance(target: ForgeBlockLayout): boolean {
  if (!copiedAppearance) return false;
  target.appearance = cloneAppearance(copiedAppearance.appearance);
  target.appearanceMode = copiedAppearance.appearanceMode;
  return true;
}

/** Test helper; the editor itself keeps the clipboard for the plugin session. */
export function clearCopiedBlockAppearance(): void {
  copiedAppearance = null;
}
