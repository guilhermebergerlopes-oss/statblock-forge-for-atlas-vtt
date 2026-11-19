/** Stable lifecycle decisions for derived Atlas template exports. */

export interface ExistingAtlasTemplateExport {
  id: string;
  matchesCurrentContent: boolean;
}

export interface AtlasTemplateExportPlan {
  atlasTemplateId: string;
  action: 'reuse' | 'create' | 'create-replacement';
  warning?: string;
}

/**
 * Select the Atlas template ID for a publish operation.
 *
 * A valid backlink takes precedence over the Forge ID. If its exported file was
 * deleted, the same Atlas ID is recreated. If the file still exists but was
 * changed independently, Forge creates a new ID instead of overwriting it.
 */
export function planAtlasTemplateExport(input: {
  forgeTemplateId: string;
  linkedAtlasTemplateId?: string | null;
  existingExports: ExistingAtlasTemplateExport[];
  replacementId: string;
}): AtlasTemplateExportPlan {
  const preferredId = input.linkedAtlasTemplateId?.trim() || input.forgeTemplateId.trim();
  if (!preferredId || !input.forgeTemplateId.trim()) {
    throw new Error('O ciclo de publicação precisa dos IDs dos templates Forge e Atlas.');
  }
  const matchingId = input.existingExports.filter((item) => item.id === preferredId);
  if (matchingId.length === 0) return { atlasTemplateId: preferredId, action: 'create' };
  if (matchingId.length === 1 && matchingId[0]!.matchesCurrentContent) {
    return { atlasTemplateId: preferredId, action: 'reuse' };
  }

  const replacementId = input.replacementId.trim();
  if (!replacementId || replacementId === preferredId) {
    throw new Error('A substituição de um template Atlas conflitante exige um novo ID.');
  }
  return {
    atlasTemplateId: replacementId,
    action: 'create-replacement',
    warning: matchingId.length > 1
      ? 'Foram encontrados vários templates Atlas com o mesmo ID vinculado. Uma nova cópia foi criada para evitar uma associação ambígua.'
      : 'A exportação Atlas vinculada foi modificada e não será sobrescrita. Uma nova cópia foi criada e o vínculo da nota será atualizado.',
  };
}
