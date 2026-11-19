import { isRecord, type ForgeTemplate, type JsonRecord } from '../templates/forgeTemplate.ts';
import { FORGE_STATBLOCK_LINK_KEY } from '../statblocks/forgeTemplateLink.ts';
import { normalizeCheckboxFieldValue } from '../templates/checkboxFieldModel.ts';


export interface StatblockDataBinding {
  /** Only keys explicitly declared by the selected template are exposed. */
  data: JsonRecord;
  /** Declared fields not present in the source; they are intentionally left empty. */
  missingKeys: string[];
  /** Source-only keys that were not bound to a visible template field. */
  ignoredKeys: string[];
}

/**
 * Bind an imported JSON/frontmatter record to a template without copying note
 * metadata or leaking arbitrary source properties into the renderer.
 */
export function bindStatblockData(template: ForgeTemplate, source: unknown): StatblockDataBinding {
  if (!isRecord(source)) throw new Error('A fonte do statblock precisa conter um objeto de propriedades.');

  const declared = new Set(template.fields.map((field) => field.key));
  const data: JsonRecord = {};
  const missingKeys: string[] = [];
  for (const field of template.fields) {
    if (field.type === 'checkboxes') {
      data[field.key] = normalizeCheckboxFieldValue(field, source[field.key]);
      if (!Object.prototype.hasOwnProperty.call(source, field.key)) missingKeys.push(field.key);
    } else if (Object.prototype.hasOwnProperty.call(source, field.key)
      && source[field.key] !== undefined) {
      data[field.key] = source[field.key];
    } else {
      missingKeys.push(field.key);
    }
  }

  const ignoredKeys = Object.keys(source).filter((key) => !declared.has(key)
    && key !== FORGE_STATBLOCK_LINK_KEY
);
  return { data, missingKeys, ignoredKeys };
}

/** Optional envelope for JSON files exported by external tools or scripts. */
export function unwrapStatblockJson(value: unknown): JsonRecord {
  if (!isRecord(value)) throw new Error('O JSON precisa ter um objeto na raiz.');
  if (value.format === 'statblock-forge-data' && isRecord(value.data)) return value.data;
  return value;
}
