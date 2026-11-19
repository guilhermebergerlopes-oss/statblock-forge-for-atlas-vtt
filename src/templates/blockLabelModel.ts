/** Resolves a visible block label while keeping an explicit empty string meaningful. */
export interface ForgeBlockLabelField {
  label?: unknown;
}

/**
 * Atlas treats `label: ""` as an explicit request to hide a Value label.
 * A Field with an empty label also suppresses stale block-label copies from
 * older templates, while an absent block label falls back to the Field label.
 */
export function resolveForgeBlockLabel(
  explicitLabel: unknown,
  field: ForgeBlockLabelField | undefined,
  key: unknown,
  fallbackToFieldLabel = true,
  fallbackToKeyWhenFieldIsMissing = true,
): string {
  if (typeof explicitLabel === 'string') {
    const explicit = explicitLabel.trim();
    if (!explicit) return '';
    if (field && (typeof field.label !== 'string' || !field.label.trim())) return '';
    return explicit;
  }
  if (field) {
    const label = typeof field.label === 'string' ? field.label.trim() : '';
    return fallbackToFieldLabel ? label : '';
  }
  return fallbackToKeyWhenFieldIsMissing && typeof key === 'string' ? key : '';
}
