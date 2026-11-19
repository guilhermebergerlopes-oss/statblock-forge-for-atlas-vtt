import type { ClosedTemplateEditorDraft } from '../views/closedTemplateEditorDraft.ts';

export interface PersistedTemplateEditorDraft {
  schemaVersion: 1;
  savedAt: number;
  draft: ClosedTemplateEditorDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isDraft(value: unknown): value is ClosedTemplateEditorDraft {
  if (!isRecord(value) || !isRecord(value.template) || !isRecord(value.layout)) return false;
  if (value.template.format !== 'atlas-statblock-template' || typeof value.template.id !== 'string'
    || !Array.isArray(value.template.fields) || !isRecord(value.template.layout)
    || !Array.isArray(value.template.layout.blocks)) return false;
  if (value.layout.format !== 'statblock-forge-layout' || value.layout.version !== 1
    || value.layout.templateId !== value.template.id || !isRecord(value.layout.blocks)) return false;
  if (typeof value.recoveryDraftId !== 'string' || !value.recoveryDraftId) return false;
  if (typeof value.displayName !== 'string' || !value.displayName) return false;
  if (!isStringOrNull(value.filePath) || !isStringOrNull(value.originalText)) return false;
  if (typeof value.canOverwriteCurrentFile !== 'boolean') return false;
  if (!isRecord(value.dirtyBaseline)
    || typeof value.dirtyBaseline.templateJson !== 'string'
    || typeof value.dirtyBaseline.layoutJson !== 'string') return false;
  if (!isStringOrNull(value.jsonDraftText) || !isStringOrNull(value.jsonAppliedText)) return false;
  if (typeof value.jsonStatus !== 'string') return false;
  if (!['fields', 'field', 'options', 'json', 'rests', 'dice'].includes(String(value.sidebarMode))) return false;
  if (!['structure', 'properties', 'appearance'].includes(String(value.sidebarTab))) return false;
  if (!(value.selectedBlockId === null || typeof value.selectedBlockId === 'string')) return false;
  if (!Array.isArray(value.selectedBlockIds) || !value.selectedBlockIds.every((id) => typeof id === 'string')) return false;
  if (!(value.selectedTemplateFieldKey === null || typeof value.selectedTemplateFieldKey === 'string')) return false;
  return true;
}

/** Read only valid Forge editor recovery records from plugin data. */
export function readPersistedTemplateEditorDrafts(value: unknown): PersistedTemplateEditorDraft[] {
  if (!Array.isArray(value)) return [];
  const drafts: PersistedTemplateEditorDraft[] = [];
  for (const item of value) {
    if (!isRecord(item) || item.schemaVersion !== 1 || typeof item.savedAt !== 'number' || !Number.isFinite(item.savedAt)) continue;
    if (!isDraft(item.draft)) continue;
    drafts.push({
      schemaVersion: 1,
      savedAt: item.savedAt,
      draft: JSON.parse(JSON.stringify(item.draft)) as ClosedTemplateEditorDraft,
    });
  }
  return drafts.sort((left, right) => left.savedAt - right.savedAt);
}

export function upsertPersistedTemplateEditorDrafts(
  current: PersistedTemplateEditorDraft[],
  draft: ClosedTemplateEditorDraft,
  savedAt = Date.now(),
): PersistedTemplateEditorDraft[] {
  const next = current.filter((entry) => entry.draft.recoveryDraftId !== draft.recoveryDraftId);
  next.push({ schemaVersion: 1, savedAt, draft: JSON.parse(JSON.stringify(draft)) as ClosedTemplateEditorDraft });
  return next.sort((left, right) => left.savedAt - right.savedAt);
}

export function removePersistedTemplateEditorDraft(
  current: PersistedTemplateEditorDraft[],
  recoveryDraftId: string,
): PersistedTemplateEditorDraft[] {
  return current.filter((entry) => entry.draft.recoveryDraftId !== recoveryDraftId);
}
