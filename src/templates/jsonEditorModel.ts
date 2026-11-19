import {
  addMissingHeaderField,
  HEADER_PARTS,
  type HeaderPartId,
} from './fieldEditorModel.ts';
import {
  cloneJson,
  collectBlockIds,
  isRecord,
  parseTemplateForEditing,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import { ensureLayoutMetadataForTree } from './layoutEditorModel.ts';
import { normalizeFieldCompendium, normalizeFieldIds } from './fieldCompendiumModel.ts';

export interface TemplateJsonReading {
  template: ForgeTemplate | null;
  problems: string[];
  warnings: string[];
}

/**
 * Reads a JSON draft without mutating the live template. A draft must keep its
 * current template id; the fixed Atlas header fields are restored just as they
 * are by the native editor before the result can be applied.
 */
export function readTemplateJson(text: string, currentId: string): TemplateJsonReading {
  let parsed: ReturnType<typeof parseTemplateForEditing>;
  try {
    parsed = parseTemplateForEditing(text);
  } catch (error) {
    return {
      template: null,
      problems: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }

  if (parsed.template.id !== currentId) {
    return {
      template: null,
      problems: [`The template ID must remain "${currentId}" while editing JSON.`],
      warnings: parsed.warnings,
    };
  }

  const template = cloneJson(parsed.template);
  const restored: HeaderPartId[] = [];
  try {
    for (const part of HEADER_PARTS) {
      const before = template.fields.length;
      addMissingHeaderField(template, part.id);
      if (template.fields.length > before) restored.push(part.id);
    }
  } catch (error) {
    return {
      template: null,
      problems: [error instanceof Error ? error.message : String(error)],
      warnings: parsed.warnings,
    };
  }

  const warnings = [...parsed.warnings];
  if (restored.length > 0) {
    warnings.push(`Restored required header fields: ${restored.join(', ')}.`);
  }
  return { template, problems: [], warnings };
}

/**
 * Keeps Forge's private layout metadata aligned with a JSON-edited Atlas tree.
 * Metadata for surviving block ids is preserved; new blocks receive defaults;
 * removed blocks are discarded from the sidecar only.
 */
export function reconcileLayoutAfterJsonEdit(
  template: ForgeTemplate,
  previous: ForgeLayoutDocument,
): ForgeLayoutDocument {
  const next = cloneJson(previous);
  const liveIds = new Set(collectBlockIds(template.layout.blocks));
  for (const id of Object.keys(next.blocks)) {
    if (!liveIds.has(id)) delete next.blocks[id];
  }
  ensureLayoutMetadataForTree(template, next);

  const fieldKeys = new Set(template.fields.map((field) => field.key));
  // Preserve a Field's stable Compendium ID when a key is renamed in the raw
  // JSON editor. The normal visual editor moves this mapping immediately; the
  // `formerKeys` list provides the same migration path for direct JSON edits.
  const fieldIdSource = isRecord(next.fieldIds) ? { ...next.fieldIds } : {};
  for (const field of template.fields) {
    if (typeof fieldIdSource[field.key] === 'string') continue;
    const formerKeys = Array.isArray(field.formerKeys)
      ? field.formerKeys.filter((key): key is string => typeof key === 'string')
      : [];
    const formerKey = formerKeys.find((key) => !fieldKeys.has(key) && typeof fieldIdSource[key] === 'string');
    if (!formerKey) continue;
    fieldIdSource[field.key] = fieldIdSource[formerKey];
    delete fieldIdSource[formerKey];
  }
  next.fieldIds = normalizeFieldIds(fieldIdSource, template.fields);
  next.compendiumByFieldId = normalizeFieldCompendium(
    next.compendiumByFieldId,
    new Set(Object.values(next.fieldIds)),
  );
  if (isRecord(next.fieldKinds)) {
    for (const key of Object.keys(next.fieldKinds)) {
      if (!fieldKeys.has(key)) delete next.fieldKinds[key];
    }
  }
  if (isRecord(next.abilityParts)) {
    for (const key of Object.keys(next.abilityParts)) {
      if (!fieldKeys.has(key)) delete next.abilityParts[key];
    }
  }
  next.templateId = template.id;
  return next;
}
