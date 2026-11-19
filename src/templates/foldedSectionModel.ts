/** UI state for collapsible Sections moved into the statblock footer. */
export interface FoldedSectionExpansionState {
  /** Sections explicitly expanded even though they are configured to start closed. */
  expanded: Set<string>;
  /** Sections explicitly collapsed even though they are configured to start open. */
  collapsed: Set<string>;
}

/** Resolve the user's choice first, then fall back to the Section's configured initial state. */
export function isFoldedSectionExpanded(
  blockId: string,
  initiallyExpanded: boolean,
  state: FoldedSectionExpansionState,
): boolean {
  if (state.collapsed.has(blockId)) return false;
  return initiallyExpanded || state.expanded.has(blockId);
}

/** Store an explicit open/closed choice so it survives a complete preview rerender. */
export function setFoldedSectionExpanded(
  blockId: string,
  expanded: boolean,
  initiallyExpanded: boolean,
  state: FoldedSectionExpansionState,
): void {
  if (expanded) {
    state.collapsed.delete(blockId);
    if (initiallyExpanded) state.expanded.delete(blockId);
    else state.expanded.add(blockId);
    return;
  }
  state.expanded.delete(blockId);
  state.collapsed.add(blockId);
}

/** Footer actions keep their own label even when No Label hides the block heading. */
export function foldedSectionFooterLabel(
  heading: string,
  language: 'en' | 'pt-BR',
  unnamedOrdinal: number,
): string {
  const configuredHeading = heading.trim();
  if (configuredHeading) return configuredHeading;
  const ordinal = Math.max(1, Math.trunc(unnamedOrdinal) || 1);
  return language === 'pt-BR' ? `Seção (${ordinal})` : `Section (${ordinal})`;
}
