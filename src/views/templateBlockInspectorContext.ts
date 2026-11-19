import type { ForgeBlock, ForgeLayoutDocument, ForgeTemplate } from '../templates/forgeTemplate.ts';
import type { ForgeLanguage } from '../i18n/localization.ts';

/** Narrow view bridge used by block-specific Inspector modules. */
export interface TemplateBlockInspectorContext {
  template: ForgeTemplate;
  layout: ForgeLayoutDocument;
  block: ForgeBlock;
  language: ForgeLanguage;
  render(): void;
  renderPreviewOnly(): void;
  showNotice(message: string): void;
  confirmDelete(itemName: string, onConfirm: () => void): void;
  confirmReset(itemName: string, onConfirm: () => void): void;
  openImagePicker(fieldKey: string): void;
  resolveImage?(path: string): string | undefined;
  getImagePreviewGeometry?(blockId: string): { aspectRatio: number; clipPath?: string; borderRadius?: string } | undefined;
  getDisclosureOpen?(key: string): boolean;
  setDisclosureOpen?(key: string, open: boolean): void;
  setTemplate(template: ForgeTemplate): void;
}
