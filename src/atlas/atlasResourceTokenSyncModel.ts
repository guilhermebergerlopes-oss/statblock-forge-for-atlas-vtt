import type { ForgeField, JsonRecord } from '../templates/forgeTemplate.ts';
import type { AtlasCollectionResourceDefinition } from './atlasResourceCatalog.ts';

export interface AtlasResourceValue {
  current: number;
  max: number;
}

export interface AtlasResourceSourceSpec {
  readonly resource: AtlasCollectionResourceDefinition;
  readonly field: ForgeField;
}

export type AtlasResourceSourceValue =
  | { readonly status: 'missing' | 'invalid'; readonly spec: AtlasResourceSourceSpec }
  | { readonly status: 'empty'; readonly spec: AtlasResourceSourceSpec }
  | { readonly status: 'value'; readonly value: AtlasResourceValue; readonly spec: AtlasResourceSourceSpec };

export interface AtlasResourceHolder {
  readonly resources?: Readonly<Record<string, AtlasResourceValue>>;
  readonly overriddenMax?: readonly string[];
}

export interface AtlasResourceTokenSyncResult {
  readonly changed: boolean;
  readonly resources: Record<string, AtlasResourceValue>;
}

export interface AtlasResourceTokenSyncOptions {
  /** Resource IDs whose Atlas field path changed since this map last followed its rules. */
  readonly refieldedKeys?: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

function isHitPointKey(value: string): boolean {
  return ['hp', 'health', 'hitpoints'].includes(normalizedKey(value.replace(/:\s*$/, '')));
}

/**
 * Rebase an Atlas dotted path on the current Forge Field key. This retains nested
 * selectors (`stats.0`, `resources.mana`) while supporting formerKeys and a
 * custom Field that carries the `hit-points` meaning.
 */
export function atlasResourceSourcePath(spec: AtlasResourceSourceSpec): string | null {
  const parts = spec.resource.field.split('.').map((part) => part.trim()).filter(Boolean);
  const head = parts[0] ?? '';
  if (!head) return null;
  const aliases = [spec.field.key, ...(Array.isArray(spec.field.formerKeys)
    ? spec.field.formerKeys.filter((value): value is string => typeof value === 'string')
    : [])];
  const matches = aliases.some((alias) => normalizedKey(alias) === normalizedKey(head))
    || (isHitPointKey(head) && (spec.field.meaning === 'hit-points' || aliases.some(isHitPointKey)));
  if (!matches) return null;
  return [spec.field.key, ...parts.slice(1)].join('.');
}

interface PathRead {
  exists: boolean;
  value: unknown;
}

function readPath(root: JsonRecord, path: string): PathRead {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return { exists: false, value: undefined };
  let current: unknown = root;
  for (const part of parts) {
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(part) || Number(part) >= current.length) return { exists: false, value: undefined };
      current = current[Number(part)];
      continue;
    }
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { exists: false, value: undefined };
    }
    current = current[part];
  }
  return { exists: true, value: current };
}

function numeric(value: unknown): number | null {
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value.trim())) value = Number(value);
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Mirrors Atlas 0.17.0 `parseResourceValue()` without importing Atlas source into the Forge bundle. */
export function parseAtlasResourceValue(value: unknown, direction: AtlasCollectionResourceDefinition['direction']): AtlasResourceValue | null {
  const spent = direction === 'fills';
  if (isRecord(value)) {
    const max = numeric(value.max);
    const current = numeric(value.current ?? value.value ?? (spent ? 0 : max));
    if (max === null || current === null) return null;
    return { current: Math.max(0, Math.min(max, current)), max };
  }
  if (typeof value === 'string') {
    const fraction = value.trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (fraction) {
      const current = Number(fraction[1]);
      const max = Number(fraction[2]);
      return { current: Math.max(0, Math.min(max, current)), max };
    }
    const noted = value.trim().match(/^(\d+(?:\.\d+)?)\s*\([^()]*\)$/);
    if (noted) value = noted[1];
  }
  const max = numeric(value);
  if (max === null) return null;
  return { current: spent ? 0 : max, max };
}

function holdsValue(resource: AtlasCollectionResourceDefinition, value: AtlasResourceValue): boolean {
  return resource.direction === 'static' ? value.max >= 0 : value.max > 0;
}

/**
 * Resolves one Forge Field value using Atlas' parsing and direction conventions.
 * Missing values are ignored, explicitly empty values remove a token-held Resource,
 * and prose/invalid quantities do not destroy a value that Atlas cannot interpret.
 */
export function readAtlasResourceSourceValue(
  data: JsonRecord,
  spec: AtlasResourceSourceSpec,
): AtlasResourceSourceValue {
  const path = atlasResourceSourcePath(spec);
  if (!path) return { status: 'invalid', spec };
  const read = readPath(data, path);
  if (!read.exists || read.value === undefined) return { status: 'missing', spec };
  if (read.value === null || (typeof read.value === 'string' && read.value.trim() === '')) return { status: 'empty', spec };
  const parsed = parseAtlasResourceValue(read.value, spec.resource.direction);
  if (!parsed) return { status: 'invalid', spec };
  if (!holdsValue(spec.resource, parsed)) return { status: 'empty', spec };
  return { status: 'value', value: parsed, spec };
}

/**
 * Mirrors Atlas' `syncedResources()` for the Resource definitions that read a
 * Forge v2 note. Existing current values are kept and clamped to the new maximum;
 * missing values start in the direction's initial state. Maxima set by hand are
 * never overwritten. A Field explicitly emptied removes the corresponding value.
 */
export function syncAtlasResourcesForToken(
  token: AtlasResourceHolder,
  sources: ReadonlyMap<string, AtlasResourceSourceValue>,
  options: AtlasResourceTokenSyncOptions = {},
): AtlasResourceTokenSyncResult {
  const next: Record<string, AtlasResourceValue> = { ...(token.resources ?? {}) };
  const overridden = new Set(token.overriddenMax ?? []);

  for (const [key, source] of sources) {
    if (overridden.has(key)) continue;
    if (source.status === 'missing' || source.status === 'invalid') continue;
    if (source.status === 'empty') {
      delete next[key];
      continue;
    }
    const held = next[key];
    if (held) {
      const wasAtStart = source.spec.resource.direction === 'fills'
        ? held.current === 0
        : held.current === held.max;
      if (options.refieldedKeys?.has(key) && wasAtStart) {
        // Atlas restartAtStart(): a refielded Resource restarts only when the
        // token was still at its previous direction-specific starting value.
        next[key] = { ...source.value };
      } else {
        next[key] = {
          current: Math.max(0, Math.min(source.value.max, held.current)),
          max: source.value.max,
        };
      }
    } else {
      next[key] = { ...source.value };
    }
  }

  const before = token.resources ?? {};
  const beforeKeys = Object.keys(before).sort();
  const nextKeys = Object.keys(next).sort();
  const changed = beforeKeys.length !== nextKeys.length || beforeKeys.some((key, index) => {
    if (key !== nextKeys[index]) return true;
    const left = before[key];
    const right = next[key];
    return left.current !== right.current || left.max !== right.max;
  });
  return { changed, resources: next };
}

/** Build the source values for each Resource definition, keyed by Atlas' stable Resource ID. */
export function atlasResourceSourceValues(
  data: JsonRecord,
  specs: readonly AtlasResourceSourceSpec[],
): Map<string, AtlasResourceSourceValue> {
  const result = new Map<string, AtlasResourceSourceValue>();
  for (const spec of specs) result.set(spec.resource.key, readAtlasResourceSourceValue(data, spec));
  return result;
}
