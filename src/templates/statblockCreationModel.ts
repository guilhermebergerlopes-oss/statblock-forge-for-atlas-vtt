import { cloneJson, headerFieldForPart, isRecord, type ForgeLayoutDocument, type ForgeTemplate, type JsonRecord } from './forgeTemplate.ts';
import { pinnedTemplateImageValue } from './imageFieldModel.ts';
import { forgeTableStructureFromSample } from '../statblocks/tableRowsModel.ts';

/**
 * Build the initial field data for a new statblock note.
 * Example values are copied only when explicitly requested; otherwise only
 * the statblock name is initialized and all other template fields stay absent.
 */
export function createInitialStatblockData(
  template: ForgeTemplate,
  statblockName: string,
  useSampleValues = false,
  layout?: ForgeLayoutDocument | null,
): JsonRecord {
  const name = statblockName.trim();
  if (!name) throw new Error('Informe um nome para o statblock.');

  const data: JsonRecord = {};
  const sample = isRecord(template.sample) ? template.sample : {};
  if (useSampleValues) {
    for (const field of template.fields) {
      if (Object.prototype.hasOwnProperty.call(sample, field.key) && sample[field.key] !== undefined) {
        data[field.key] = cloneJson(sample[field.key]);
      }
    }
  } else {
    // A Table's row count and row labels are part of its configured structure,
    // not optional example Values. Keep that structure in every new statblock
    // while leaving its example cell contents blank unless the user opted in.
    for (const field of template.fields) {
      if (field.type !== 'scores' || field.forgeInternal !== 'table-storage') continue;
      if (!Object.prototype.hasOwnProperty.call(sample, field.key)) continue;
      const structure = forgeTableStructureFromSample(sample[field.key]);
      if (structure) data[field.key] = structure;
    }
  }

  // Template-pinned images are structural defaults rather than optional sample
  // data, so they are included even when the user skips other sample values.
  for (const field of template.fields) {
    const pinnedImage = pinnedTemplateImageValue(template, layout, field.key);
    if (pinnedImage !== null) data[field.key] = pinnedImage;
  }

  const nameField = headerFieldForPart(template.fields, 'name');
  if (nameField) data[nameField.key] = name;
  return data;
}
