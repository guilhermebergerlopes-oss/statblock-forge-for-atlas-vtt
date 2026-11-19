import type { ForgeLayoutDocument, ForgeTemplate } from '../templates/forgeTemplate.ts';
import type { TemplateEditorDirtyBaseline } from '../templates/templateEditorDirtyState.ts';

/** In-memory handoff used when Obsidian closes an editor before its draft is saved. */
export interface ClosedTemplateEditorDraft {
  recoveryDraftId: string;
  filePath: string | null;
  displayName: string;
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  originalText: string | null;
  canOverwriteCurrentFile: boolean;
  dirtyBaseline: TemplateEditorDirtyBaseline;
  jsonDraftText: string | null;
  jsonAppliedText: string | null;
  jsonStatus: string;
  sidebarMode: 'fields' | 'field' | 'options' | 'json' | 'rests' | 'dice';
  sidebarTab: 'structure' | 'properties' | 'appearance' | 'compendium';
  compendiumFieldKey: string | null;
  compendiumFieldId: string | null;
  compendiumEditingItemId: string | null;
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  selectedTemplateFieldKey: string | null;
}

/** Stable enough for one editor session and independent of the source template ID. */
export function createTemplateEditorRecoveryDraftId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `forge-draft-${Date.now().toString(36)}-${random}`;
}
