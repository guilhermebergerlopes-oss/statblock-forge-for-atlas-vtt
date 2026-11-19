/**
 * Canonical, validated input model for every Forge statblock rendering surface.
 * This layer deliberately contains no DOM or Obsidian dependency so the same
 * data contract is exercised by the editor preview and final statblock view.
 */
import {
  cloneJson,
  isRecord,
  type ForgeLayoutDocument,
  type ForgeTemplate,
  type JsonRecord,
} from '../templates/forgeTemplate.ts';
import { normalizeCheckboxFieldValue } from '../templates/checkboxFieldModel.ts';

export interface StatblockRenderModel {
  /** Visual schema and block tree. Never mutated by the renderer. */
  template: ForgeTemplate;
  /** Forge-owned Grid and appearance metadata. */
  layout: ForgeLayoutDocument;
  /** The actual statblock values. This is not merged with template.sample. */
  data: JsonRecord;
}

/**
 * Creates the single input contract used by preview and final rendering.
 * Explicit data always wins as a complete record; sample values are used only
 * when the caller deliberately supplies template.sample (the editor preview).
 */
export function createStatblockRenderModel(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  data: unknown,
): StatblockRenderModel {
  if (!isRecord(data)) {
    throw new Error('Os dados do statblock precisam ser um objeto JSON.');
  }
  if (layout.format !== 'statblock-forge-layout' || layout.templateId !== template.id) {
    throw new Error('O layout não corresponde ao template informado.');
  }
  return { template, layout, data };
}

/** Resolve the preview data without ever leaking sample values into real data. */
export function templatePreviewData(template: ForgeTemplate): JsonRecord {
  // The Canvas is interactive, but its checkbox state is only a preview. Never
  // let renderer interactions mutate template.sample or serialize per-creature
  // selections into the reusable .forgetemplate.
  // The renderer has interactive sample-only controls (notably Ability Part
  // Counters) that update nested entry records. A shallow copy would let those
  // interactions mutate the reusable .forgetemplate through shared references.
  // Templates are JSON documents, so clone the complete sample before rendering.
  const preview = isRecord(template.sample) ? cloneJson(template.sample) : {};
  for (const field of template.fields) {
    if (field.type === 'checkboxes') preview[field.key] = normalizeCheckboxFieldValue(field, preview[field.key]);
  }
  return preview;
}

/**
 * Adds template sample images only as a display fallback for statblocks whose
 * own data has no value for that Image Field. The returned record is a shallow
 * copy and is never serialized back to the statblock note. An explicit empty
 * value in the statblock remains authoritative and keeps the image blank.
 */
export function withTemplateImagePreviewFallback(template: ForgeTemplate, data: JsonRecord): JsonRecord {
  const result: JsonRecord = { ...data };
  const sample = isRecord(template.sample) ? template.sample : {};
  for (const field of template.fields) {
    if (field.type !== 'image') continue;
    if (Object.prototype.hasOwnProperty.call(result, field.key)) continue;
    if (!Object.prototype.hasOwnProperty.call(sample, field.key) || sample[field.key] === undefined) continue;
    result[field.key] = cloneJson(sample[field.key]);
  }
  return result;
}
