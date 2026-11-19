/** Immutable JSON snapshot of the template editor's persisted baseline. */
export interface TemplateEditorDirtyBaseline {
  templateJson: string;
  layoutJson: string;
}

/** Current editor state relevant to detecting unsaved template changes. */
export interface TemplateEditorDirtyState {
  template: unknown;
  layout: unknown;
  jsonDraftText: string | null;
  jsonAppliedText: string | null;
}

/** Capture the initial template and layout without retaining mutable references. */
export function captureTemplateEditorDirtyBaseline(
  template: unknown,
  layout: unknown,
): TemplateEditorDirtyBaseline {
  return {
    templateJson: JSON.stringify(template) ?? 'undefined',
    layoutJson: JSON.stringify(layout) ?? 'undefined',
  };
}

/**
 * Detect edits against the last loaded/saved baseline.
 * Pending JSON text counts as dirty even when it is invalid or has not yet been applied.
 */
export function hasUnsavedTemplateEditorChanges(
  baseline: TemplateEditorDirtyBaseline | null,
  state: TemplateEditorDirtyState,
): boolean {
  if (!baseline || state.template === null || state.layout === null) return false;
  if (state.jsonDraftText !== null && state.jsonDraftText !== state.jsonAppliedText) return true;
  return JSON.stringify(state.template) !== baseline.templateJson
    || JSON.stringify(state.layout) !== baseline.layoutJson;
}
