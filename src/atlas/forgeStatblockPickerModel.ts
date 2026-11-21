/** Minimal Atlas Link Statblock dialog metadata for a Forge-native note. */
export interface ForgeStatblockPickerEntry {
  readonly path: string;
  readonly name: string;
  readonly detail: string;
}

function normalizePickerText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}

function detailFingerprint(value: string): string {
  const normalized = normalizePickerText(value);
  const parts = normalized.split('·').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return normalized;
  const ratingValue = parts[parts.length - 1]?.match(/(?:^|\s)([\p{L}\p{N}]+(?:[./-][\p{L}\p{N}]+)*)$/u)?.[1];
  if (!ratingValue) return normalized;
  return `${parts.slice(0, -1).join(' · ')} · ${ratingValue}`;
}

/**
 * The Atlas picker does not expose its note path on each React option. Match
 * the rendered name/detail pair to Forge note metadata without guessing when
 * two entries are visually indistinguishable.
 */
export function matchForgeStatblockPickerEntry(
  name: string,
  detail: string,
  entries: readonly ForgeStatblockPickerEntry[],
): ForgeStatblockPickerEntry | null {
  const normalizedName = normalizePickerText(name);
  if (!normalizedName) return null;
  const nameMatches = entries.filter((entry) => normalizePickerText(entry.name) === normalizedName);
  if (nameMatches.length === 0) return null;

  const normalizedDetail = normalizePickerText(detail);
  if (!normalizedDetail) return nameMatches.length === 1 ? nameMatches[0] ?? null : null;
  const exactMatches = nameMatches.filter((entry) => normalizePickerText(entry.detail) === normalizedDetail);
  if (exactMatches.length === 1) return exactMatches[0] ?? null;
  const fingerprint = detailFingerprint(detail);
  const compatibleMatches = nameMatches.filter((entry) => detailFingerprint(entry.detail) === fingerprint);
  return compatibleMatches.length === 1 ? compatibleMatches[0] ?? null : null;
}

/** Scalar values used by the Atlas picker are intentionally restricted to displayable primitives. */
export function forgePickerScalar(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Same compact detail convention used by Atlas: kind, rating, or the note folder. */
export function forgePickerDetail(input: {
  path: string;
  fields: Readonly<Record<string, unknown>>;
}): string {
  const { path, fields } = input;
  const kind = [forgePickerScalar(fields.size), forgePickerScalar(fields.type)].filter(Boolean).join(' ');
  const ratingKey = (['cr', 'tier', 'level'] as const).find((key) => forgePickerScalar(fields[key]) !== null);
  const ratingValue = ratingKey ? forgePickerScalar(fields[ratingKey]) : null;
  const rating = ratingKey && ratingValue
    ? `${ratingKey === 'cr' ? 'CR' : ratingKey === 'tier' ? 'Tier' : 'Level'} ${ratingValue}`
    : '';
  const detail = [kind, rating].filter(Boolean).join(' · ');
  if (detail) return detail;
  const slash = path.lastIndexOf('/');
  return slash > 0 ? path.slice(0, slash) : '/';
}

/**
 * Atlas' React list options are keyed by their statblock note path. The path is
 * not rendered as a DOM attribute, but React keeps the key on the host Fiber.
 * Read that key only when it matches a known Forge note; text matching remains
 * the fallback for Atlas builds whose React DOM no longer exposes Fiber keys.
 */
export function forgePickerEntryForAtlasOption(
  option: unknown,
  entries: readonly ForgeStatblockPickerEntry[],
  name = '',
  detail = '',
): ForgeStatblockPickerEntry | null {
  if (typeof option === 'object' && option !== null) {
    const candidate = option as Record<string, unknown>;
    const dataset = candidate.dataset;
    if (typeof dataset === 'object' && dataset !== null) {
      const data = dataset as Record<string, unknown>;
      for (const value of [data.forgeStatblockPath, data.statblockPath, data.path]) {
        if (typeof value === 'string') {
          const direct = entries.find((entry) => entry.path === value);
          if (direct) return direct;
        }
      }
    }

    // React's host Fiber key is the exact `entry.path` used by StatblockList.
    // React may encode a key while flattening nested child arrays, so check the
    // raw and standard escaped forms. Restrict traversal to this row's Fiber
    // ancestry; never infer a note from an arbitrary prop or visible row index.
    try {
      for (const property of Object.getOwnPropertyNames(option)) {
        if (!property.startsWith('__reactFiber$')) continue;
        let fiber: unknown = candidate[property];
        for (let depth = 0; depth < 12 && typeof fiber === 'object' && fiber !== null; depth += 1) {
          const current = fiber as Record<string, unknown>;
          if (typeof current.key === 'string') {
            const key = current.key;
            const candidates = [
              key,
              key.startsWith('$') ? key.slice(1) : key,
              key.startsWith('.$') ? key.slice(2) : key,
              key.replace(/^\$|^\.\$/, '').replace(/=0/g, '=').replace(/=2/g, ':'),
            ];
            for (const candidatePath of candidates) {
              const direct = entries.find((entry) => entry.path === candidatePath);
              if (direct) return direct;
            }
          }
          fiber = current.return;
        }
      }
    } catch {
      // A React implementation may make its internal fields inaccessible.
    }
  }

  return matchForgeStatblockPickerEntry(name, detail, entries);
}
