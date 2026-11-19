import { isRecord, type ForgeLayoutDocument, type ForgeTemplate, type JsonRecord } from './forgeTemplate.ts';

/** Common image formats that Obsidian can resolve from Vault files. */
export const VAULT_IMAGE_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'jfif', 'gif', 'webp', 'avif', 'apng', 'bmp', 'svg', 'ico', 'tif', 'tiff',
]);

export function isSupportedVaultImagePath(path: string): boolean {
  const normalized = path.trim().split(/[?#]/, 1)[0] ?? '';
  const filename = normalized.slice(normalized.lastIndexOf('/') + 1);
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || dot === filename.length - 1) return false;
  return VAULT_IMAGE_EXTENSIONS.has(filename.slice(dot + 1).toLowerCase());
}

/** Updates only the editor sample; actual statblock image values remain on their Markdown/JSON source. */
export function setTemplateSampleImage(
  template: ForgeTemplate,
  fieldKey: string,
  imagePath: string | null,
  layout?: ForgeLayoutDocument | null,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'image');
  if (!field) return false;

  const sample = isRecord(template.sample) ? { ...template.sample } : {};
  const current = typeof sample[fieldKey] === 'string' ? sample[fieldKey] as string : '';
  const nextPath = typeof imagePath === 'string' ? imagePath.trim() : '';
  if (!nextPath && isPinnedTemplateImage(layout, fieldKey)) return false;
  if (current === nextPath) return false;

  if (nextPath) sample[fieldKey] = nextPath;
  else delete sample[fieldKey];
  template.sample = sample;
  return true;
}


/** True when an ordinary Image Field is fixed by its Forge template. */
export function isPinnedTemplateImage(layout: ForgeLayoutDocument | null | undefined, fieldKey: string): boolean {
  return Array.isArray(layout?.pinnedImageFields) && layout.pinnedImageFields.includes(fieldKey);
}

/**
 * Pins the current template sample image to every statblock created from this
 * Forge template. Pinning requires an actual sample image and excludes the
 * reserved Atlas Token art Field.
 */
export function setPinnedTemplateImage(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  fieldKey: string,
  pinned: boolean,
): boolean {
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'image');
  if (!field || fieldKey === 'image') return false;
  const current = Array.isArray(layout.pinnedImageFields) ? layout.pinnedImageFields : [];
  const next = new Set(current.filter((key): key is string => typeof key === 'string'));
  if (pinned) {
    const sample = isRecord(template.sample) ? template.sample : {};
    const imagePath = sample[fieldKey];
    if (typeof imagePath !== 'string' || !imagePath.trim()) return false;
    next.add(fieldKey);
  } else {
    next.delete(fieldKey);
  }
  const normalized = [...next];
  if (current.length === normalized.length && current.every((key, index) => key === normalized[index])) return false;
  layout.pinnedImageFields = normalized;
  return true;
}

/** Keep pin metadata attached when an Image Field key is renamed. */
export function renamePinnedTemplateImageField(
  layout: ForgeLayoutDocument | null | undefined,
  from: string,
  to: string,
): void {
  if (!Array.isArray(layout?.pinnedImageFields) || from === to) return;
  layout.pinnedImageFields = [...new Set(layout.pinnedImageFields.map((key) => key === from ? to : key))];
}

/** Remove stale pin metadata when a Field is deleted or ceases to be an Image. */
export function removePinnedTemplateImageField(layout: ForgeLayoutDocument | null | undefined, fieldKey: string): void {
  if (!Array.isArray(layout?.pinnedImageFields)) return;
  layout.pinnedImageFields = layout.pinnedImageFields.filter((key) => key !== fieldKey);
}

/** Copies locked image values into the live data model, repairing older linked statblocks on load. */
export function applyPinnedTemplateImages(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument | null | undefined,
  data: JsonRecord,
): boolean {
  const sample = isRecord(template.sample) ? template.sample : {};
  let changed = false;
  for (const key of layout?.pinnedImageFields ?? []) {
    const field = template.fields.find((candidate) => candidate.key === key && candidate.type === 'image');
    const value = sample[key];
    if (!field || key === 'image' || typeof value !== 'string' || !value.trim()) continue;
    if (data[key] !== value) {
      data[key] = value;
      changed = true;
    }
  }
  return changed;
}

/** The immutable template-owned value for a pinned Image Field, if present. */
export function pinnedTemplateImageValue(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument | null | undefined,
  fieldKey: string,
): string | null {
  if (!isPinnedTemplateImage(layout, fieldKey)) return null;
  const field = template.fields.find((item) => item.key === fieldKey && item.type === 'image');
  const sample = isRecord(template.sample) ? template.sample : {};
  const value = field && fieldKey !== 'image' ? sample[fieldKey] : undefined;
  return typeof value === 'string' && value.trim() ? value : null;
}
