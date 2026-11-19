import type { ForgeLayoutDocument, ForgeTemplate } from '../templates/forgeTemplate.ts';
import type { ForgeLanguage } from '../i18n/localization.ts';

export type AbilityPartIndicatorColor = 'trackFillColor' | 'trackEmptyColor' | 'trackBorderColor';

/** Narrow bridge from specialized field editors to the FileView coordinator. */
export interface TemplateSpecializedFieldEditorContext {
  template: ForgeTemplate;
  language: ForgeLanguage;
  getLayout(): ForgeLayoutDocument | null;
  ensureLayout(): ForgeLayoutDocument;
  render(): void;
  renderPreviewOnly(): void;
  showNotice(message: string): void;
  confirmDelete(itemName: string, onConfirm: () => void): void;
  getAbilityAppearanceAdvancedOpen(): boolean;
  setAbilityAppearanceAdvancedOpen(open: boolean): void;
  renderColorControl(
    name: string,
    current: string | undefined,
    onChange: (value: string | undefined) => void,
    description?: string,
  ): HTMLElement;
}

