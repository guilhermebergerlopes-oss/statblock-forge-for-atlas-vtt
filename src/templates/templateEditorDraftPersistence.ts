/**
 * Content snapshot used to decide whether an editor interaction requires a
 * recovery-draft write. Selection, scroll position, sidebar state and other
 * presentation-only details are intentionally excluded.
 */
export function templateEditorDraftContentSnapshot(
  template: unknown | null,
  layout: unknown | null,
  jsonDraftText: string | null,
  jsonAppliedText: string | null,
): string | null {
  if (template === null || layout === null) return null;
  return JSON.stringify({ template, layout, jsonDraftText, jsonAppliedText }) ?? null;
}

/**
 * A draft needs to be written only when its current content differs from both
 * the last persisted snapshot and the snapshot already waiting on the debounce.
 */
export function shouldPersistTemplateEditorDraftContent(
  currentSnapshot: string | null,
  lastPersistedSnapshot: string | null,
  pendingSnapshot: string | null,
): boolean {
  return currentSnapshot !== null
    && currentSnapshot !== lastPersistedSnapshot
    && currentSnapshot !== pendingSnapshot;
}
