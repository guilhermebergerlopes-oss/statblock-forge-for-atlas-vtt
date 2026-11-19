import type { App, TFile } from 'obsidian';

export type ImageReferenceTarget =
  | { kind: 'empty' }
  | { kind: 'remote'; src: string }
  | { kind: 'vault'; path: string };

function firstString(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = firstString(item);
      if (candidate) return candidate;
    }
  }
  return '';
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function unwrapMarkdownImage(value: string): string {
  const match = /^!?(?:\[([^\]]*)\])\((<[^>]+>|.+?)\)(?:\s+["'][^"']*["'])?$/.exec(value.trim());
  if (!match?.[2]) return value;
  const target = match[2].trim();
  return target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target;
}

/** Extracts a supported image reference from plain paths, Obsidian links and Markdown image links. */
export function parseImageReference(value: unknown): ImageReferenceTarget {
  let target = firstString(value);
  if (!target) return { kind: 'empty' };

  const encoded = /^<STATBLOCK-(WIKI|MARKDOWN)-LINK>([\s\S]+?)<STATBLOCK-\1-LINK>$/.exec(target);
  if (encoded?.[2]) target = encoded[2].trim();
  target = unwrapMarkdownImage(target);
  target = target.replace(/^<([^>]+)>$/, '$1').trim();

  // Keep external URLs byte-for-byte: decoding their percent escapes can change the URL.
  if (/^(?:https?:)?\/\//i.test(target) || /^(?:data:image\/|blob:|app:\/\/local\/)/i.test(target)) {
    return { kind: 'remote', src: target };
  }

  target = target.replace(/^!?(?:\[\[)/, '').replace(/\]\]$/, '');
  target = (target.split('|')[0] ?? '').trim();
  target = target.trim();
  target = target.replace(/\\/g, '/');
  if (!target) return { kind: 'empty' };
  return { kind: 'vault', path: target };
}

/** Returns the normalized first image reference for use by the shared renderer. */
export function imageReferenceText(value: unknown): string {
  const reference = parseImageReference(value);
  if (reference.kind === 'remote') return reference.src;
  if (reference.kind === 'vault') return reference.path;
  return '';
}

/**
 * Candidate Vault paths in precedence order. Keep the literal path first so a
 * real filename containing a percent sequence or `#` is not accidentally
 * rewritten; then try decoded, heading-free and root-relative variants.
 */
export function imageVaultPathCandidates(raw: string): string[] {
  const written = raw.trim().replace(/\\/g, '/');
  const decoded = safeDecode(written).replace(/\\/g, '/');
  const bases = [written, decoded];
  const candidates: string[] = [];
  for (const base of bases) {
    for (const value of [base, base.split('#')[0] ?? '']) {
      const normalized = value.trim();
      if (!normalized) continue;
      candidates.push(normalized, normalized.replace(/^\/+/, ''));
    }
  }
  return [...new Set(candidates)].filter(Boolean);
}

function isFileLike(value: unknown): value is TFile {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return typeof record.path === 'string' && typeof record.extension === 'string';
}

/** Resolves a Forge/Atlas image value through Obsidian's link cache and Vault. */
export function resolveVaultImageFile(app: App, raw: unknown, sourcePath?: string): TFile | null {
  const reference = parseImageReference(raw);
  if (reference.kind !== 'vault') return null;

  for (const path of imageVaultPathCandidates(reference.path)) {
    let linked: unknown = null;
    try {
      linked = app.metadataCache.getFirstLinkpathDest(path, sourcePath ?? '');
    } catch {
      // Some Obsidian builds may reject paths from non-Markdown FileViews.
    }
    if (isFileLike(linked)) return linked;

    let direct: unknown = null;
    try { direct = app.vault.getAbstractFileByPath(path); } catch { /* try the next candidate */ }
    if (isFileLike(direct)) return direct;

    // A `.forgetemplate` is not a Markdown note, so Obsidian may not have
    // indexed its wiki links. Preserve normal relative-link behavior anyway.
    if (sourcePath && !path.startsWith('/')) {
      const sourceFolder = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : '';
      const relativePath = sourceFolder ? `${sourceFolder}/${path}` : path;
      if (relativePath !== path) {
        let relative: unknown = null;
        try { relative = app.vault.getAbstractFileByPath(relativePath); } catch { /* try the next candidate */ }
        if (isFileLike(relative)) return relative;
      }
    }
  }
  return null;
}

/** Converts an image field value into an Obsidian-safe URL, or undefined when unavailable. */
export function resolveVaultImageResource(app: App, raw: unknown, sourcePath?: string): string | undefined {
  const reference = parseImageReference(raw);
  if (reference.kind === 'empty') return undefined;
  if (reference.kind === 'remote') return reference.src;
  const file = resolveVaultImageFile(app, reference.path, sourcePath);
  return file ? app.vault.getResourcePath(file) : undefined;
}
