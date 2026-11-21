import { isRecord, type ForgeBlock, type ForgeField, type ForgeTemplate, type JsonRecord } from './forgeTemplate.ts';

type LegacyGrid = {
  id: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldIds: string[];
  settings: Record<string, JsonRecord>;
  raw: JsonRecord;
};

const FIELD_TYPES = new Set([
  'text', 'markdown', 'number', 'rating', 'dice', 'choice', 'list', 'scores',
  'entries', 'pairs', 'image', 'spells', 'counters', 'checkboxes',
]);
const NATIVE_BLOCK_TYPES = new Set([
  'section', 'row', 'tabs', 'title', 'line', 'stat', 'metric', 'scores', 'tags',
  'text', 'entries', 'pairs', 'track', 'counters', 'checkboxes', 'image', 'spells', 'heading',
  'divider', 'vertical-divider', 'script', 'opaque',
]);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/;

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function stableSuffix(seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(-6);
}

function uniqueId(seed: string, used: Set<string>): string {
  const base = stableSuffix(seed);
  let candidate = base;
  let index = 2;
  while (used.has(candidate)) candidate = `${base.slice(0, 6 - String(index).length)}${index++}`;
  used.add(candidate);
  return candidate;
}

function normalizeFieldType(value: unknown): string {
  if (typeof value !== 'string') return 'text';
  const type = value.trim().toLowerCase();
  if (FIELD_TYPES.has(type)) return type;
  const aliases: Record<string, string> = {
    string: 'text', inline: 'text', integer: 'number', float: 'number', longtext: 'markdown', textarea: 'markdown',
    select: 'choice', selection: 'choice', multiselect: 'choice', array: 'list', table: 'scores', object: 'pairs',
    counter: 'counters', groups: 'spells',
  };
  return aliases[type] ?? 'text';
}

function normalizeOneField(keyHint: string, value: unknown, index: number): ForgeField {
  const raw = typeof value === 'string' ? { type: value } : isRecord(value) ? value : {};
  const key = typeof raw.key === 'string' && raw.key.trim() ? raw.key.trim()
    : typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim()
      : keyHint.trim() || `field_${index + 1}`;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim()
    : typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim()
      : typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : key;
  const field: JsonRecord = {
    ...raw,
    key,
    label,
    type: normalizeFieldType(raw.type ?? (typeof value === 'string' ? value : undefined)),
  };
  // Older table fields named the slot list `columns`.
  if (!Array.isArray(field.slots) && Array.isArray(field.columns)) {
    field.slots = field.columns.filter((item): item is string => typeof item === 'string');
  }
  if (Array.isArray(field.options)) field.options = field.type === 'checkboxes'
    ? field.options.filter((item) => isRecord(item) && typeof item.key === 'string' && typeof item.label === 'string')
    : field.options.filter((item): item is string => typeof item === 'string');
  return field as ForgeField;
}

function normalizeFields(value: unknown): { fields: ForgeField[]; defaults: JsonRecord; changed: boolean } {
  const array = Array.isArray(value);
  const entries: Array<[string, unknown]> = array
    ? value.map((item, index) => [isRecord(item) && typeof item.key === 'string' ? item.key : `field_${index + 1}`, item])
    : isRecord(value) ? Object.entries(value) : [];
  const fields: ForgeField[] = [];
  const defaults: JsonRecord = {};
  const used = new Set<string>();
  let changed = !array;
  entries.forEach(([hint, raw], index) => {
    let field = normalizeOneField(hint, raw, index);
    if (used.has(field.key)) {
      let suffix = 2;
      const original = field.key;
      while (used.has(`${original}_${suffix}`)) suffix += 1;
      field = { ...field, key: `${original}_${suffix}` };
      changed = true;
    }
    used.add(field.key);
    if (isRecord(raw) && raw.default !== undefined) defaults[field.key] = raw.default;
    const alreadyNormalized = array && isRecord(raw)
      && raw.key === field.key && raw.label === field.label && raw.type === field.type
      && (!Array.isArray(raw.columns) || Array.isArray(raw.slots));
    if (!alreadyNormalized) changed = true;
    fields.push(alreadyNormalized && !changed ? raw as ForgeField : field);
  });
  return { fields: array && !changed ? value as ForgeField[] : fields, defaults, changed };
}

function normalizeLegacyGrid(value: unknown, index: number): LegacyGrid | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id.trim()
    || typeof value.type === 'string' || !isRecord(value.layout) || !Array.isArray(value.fieldIds)) return null;
  const settings: Record<string, JsonRecord> = {};
  if (isRecord(value.fieldSettings)) {
    for (const [key, setting] of Object.entries(value.fieldSettings)) if (isRecord(setting)) settings[key] = setting;
  }
  return {
    id: value.id.trim(),
    title: typeof value.title === 'string' && value.title.trim() ? value.title.trim() : `Block ${index + 1}`,
    x: finite(value.layout.x, 0),
    y: finite(value.layout.y, index),
    width: Math.max(1, Math.min(12, finite(value.layout.w, 4))),
    height: Math.max(1, finite(value.layout.h, 2)),
    fieldIds: value.fieldIds.filter((key): key is string => typeof key === 'string' && key.length > 0),
    settings,
    raw: value,
  };
}

function collectReferences(blocks: ForgeBlock[]): Set<string> {
  const result = new Set<string>();
  const visit = (items: ForgeBlock[]): void => {
    for (const block of items) {
      if (typeof block.field === 'string' && block.field) result.add(block.field);
      if (Array.isArray(block.fields)) for (const key of block.fields) if (typeof key === 'string') result.add(key);
      if (Array.isArray(block.blocks)) visit(block.blocks.filter(isRecord) as ForgeBlock[]);
    }
  };
  visit(blocks);
  return result;
}

function labelForBlock(block: ForgeBlock, fields: Map<string, ForgeField>, index: number): string {
  if (block.type === 'section' && typeof block.heading === 'string' && block.heading.trim()) return block.heading.trim();
  if (block.type === 'heading' && typeof block.text === 'string' && block.text.trim()) return block.text.trim();
  const keys = typeof block.field === 'string' ? [block.field]
    : Array.isArray(block.fields) ? block.fields.filter((key): key is string => typeof key === 'string') : [];
  return keys.map((key) => fields.get(key)?.label).find((value) => Boolean(value)) ?? `Tab ${index + 1}`;
}

function applyLegacySettings(block: ForgeBlock, settings?: JsonRecord): ForgeBlock {
  if (!settings) return block;
  const next: JsonRecord = { ...block };
  if (typeof settings.label === 'string' && ['stat', 'tags', 'pairs', 'track', 'counters'].includes(block.type)) next.label = settings.label;
  if (typeof settings.heading === 'string' && ['text', 'entries', 'spells'].includes(block.type)) next.heading = settings.heading;
  if (typeof settings.className === 'string') next.className = settings.className;
  if (settings.rollable === true && ['stat', 'pairs', 'scores'].includes(block.type)) next.rollable = true;
  if (settings.display === 'plain' || settings.display === 'signed') {
    if (['stat', 'pairs', 'scores'].includes(block.type)) next.display = settings.display;
  }
  if (typeof settings.look === 'string') {
    if (block.type === 'stat' && ['run-in', 'stacked'].includes(settings.look)) next.look = settings.look;
    if (block.type === 'tags' && ['comma', 'chips', 'bullets', 'numbered'].includes(settings.look)) next.look = settings.look;
    if (block.type === 'spells' && ['lines', 'tabs'].includes(settings.look)) next.look = settings.look;
  }
  if (block.type === 'image' && ['token', 'portrait'].includes(String(settings.shape))) next.shape = settings.shape;
  const extras = isRecord(block.fsExtras) ? { ...block.fsExtras } : {};
  const legacySettings = { ...settings };
  if (block.type === 'scores') delete legacySettings.orientation;
  extras.atlasLegacyFieldSettings = legacySettings;
  next.fsExtras = extras;
  return next as ForgeBlock;
}

function createFieldBlock(field: ForgeField, id: string, settings?: JsonRecord): ForgeBlock | null {
  let block: ForgeBlock;
  switch (field.type) {
    case 'number': case 'rating': case 'dice':
      block = { id, type: 'stat', field: field.key, label: field.label, look: 'stacked' }; break;
    case 'choice': case 'list':
      block = { id, type: 'tags', field: field.key, label: field.label, look: 'comma' }; break;
    case 'scores':
      block = { id, type: 'scores', field: field.key }; break;
    case 'entries': block = { id, type: 'entries', field: field.key }; break;
    case 'pairs': block = { id, type: 'pairs', field: field.key, label: field.label }; break;
    case 'counters': block = { id, type: 'counters', field: field.key, label: field.label }; break;
    case 'markdown': case 'text': block = { id, type: 'text', field: field.key, heading: field.label }; break;
    case 'image': block = { id, type: 'image', field: field.key, shape: 'portrait' }; break;
    case 'spells': block = { id, type: 'spells', field: field.key }; break;
    default: return null;
  }
  return applyLegacySettings(block, settings);
}

function blockWidthClass(width: number): string | undefined {
  if (width >= 10) return undefined;
  if (width >= 7) return 'atlas-layout-width-two-thirds';
  if (width >= 5) return 'atlas-layout-width-half';
  return 'atlas-layout-width-one-third';
}

function migrateLegacyGridBlock(
  legacy: LegacyGrid,
  fields: Map<string, ForgeField>,
  usedIds: Set<string>,
  referenced: Set<string>,
): { section: ForgeBlock; widthClass?: string } | null {
  if (usedIds.has(legacy.id)) return null;
  const children: ForgeBlock[] = [];
  const keptSettings: Record<string, JsonRecord> = {};
  for (const key of legacy.fieldIds) {
    const field = fields.get(key);
    if (!field || referenced.has(key)) continue;
    const childId = uniqueId(`${legacy.id}:${key}`, usedIds);
    const setting = legacy.settings[key];
    if (setting) keptSettings[key] = { ...setting };
    const child = createFieldBlock(field, childId, setting);
    if (child) children.push(child);
  }
  usedIds.add(legacy.id);
  return {
    section: {
      id: legacy.id,
      type: 'section',
      heading: legacy.title,
      blocks: children,
      fsExtras: {
        atlasLegacyGrid: {
          sourceId: legacy.id,
          originalTitle: legacy.title,
          originalLayout: { x: legacy.x, y: legacy.y, w: legacy.width, h: legacy.height },
          originalFieldIds: [...legacy.fieldIds],
          fieldSettings: legacy.raw.fieldSettings ?? keptSettings,
          // Preserve the complete legacy block payload, including fields that
          // this migration does not understand yet. The opaque copy is data
          // only: no legacy callbacks or executable values are evaluated.
          originalPayload: { ...legacy.raw },
        },
      },
    },
    widthClass: blockWidthClass(legacy.width),
  };
}

/**
 * Older Atlas layouts allowed a calculated modifier column directly on a
 * Table block. That block-level Columns feature is retired: keep the original
 * callback data as inert migration metadata and ask users to model the value
 * with a Number/Rating Field instead.
 */
function promoteLegacyTableBlock(
  value: JsonRecord,
  id: string,
  fields: Map<string, ForgeField>,
  unsupportedModifiers: Set<string>,
): ForgeBlock | null {
  if (value.type !== 'table') return null;
  const fieldKey = typeof value.field === 'string' && value.field.trim()
    ? value.field.trim()
    : Array.isArray(value.properties) && typeof value.properties[0] === 'string'
      ? value.properties[0].trim() : '';
  const field = fields.get(fieldKey);
  if (!fieldKey || !field || field.type !== 'scores') return null;

  const headers = Array.isArray(value.headers)
    ? value.headers.filter((header): header is string => typeof header === 'string')
    : [];
  if (headers.length > 0 && (!Array.isArray(field.slots) || field.slots.length === 0)) {
    field.slots = [...headers];
  }

  const calculate = value.calculate === true;
  const hasCustomModifier = typeof value.modifier === 'string' && value.modifier.trim().length > 0;
  if (calculate) unsupportedModifiers.add(id);

  const extras = isRecord(value.fsExtras) ? { ...value.fsExtras } : {};
  extras.atlasLegacyTable = {
    ...(Array.isArray(value.properties) ? { properties: [...value.properties] } : {}),
    ...(headers.length ? { headers: [...headers] } : {}),
    ...(calculate ? { calculate: true } : {}),
    ...(hasCustomModifier ? { modifier: value.modifier } : {}),
  };

  const next: JsonRecord = {
    ...value,
    id,
    type: 'scores',
    field: fieldKey,
    fsExtras: extras,
  };
  delete next.properties;
  delete next.headers;
  delete next.calculate;
  delete next.modifier;
  delete next.orientation;
  delete next.perLine;
  delete next.columns;

  if (value.rollable === true) next.rollable = true;
  return next as ForgeBlock;
}

function promoteRootBlock(
  value: unknown,
  index: number,
  used: Set<string>,
  fields: Map<string, ForgeField>,
  unsupportedModifiers: Set<string>,
): ForgeBlock | null {
  if (!isRecord(value)) return null;
  const rawId = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : null;
  const id = rawId && !used.has(rawId) ? rawId : uniqueId(`legacy-root:${index}:${JSON.stringify(value)}`, used);
  used.add(id);
  const tableBlock = promoteLegacyTableBlock(value, id, fields, unsupportedModifiers);
  if (tableBlock) return tableBlock;
  if (typeof value.type === 'string' && NATIVE_BLOCK_TYPES.has(value.type)) return { ...value, id } as ForgeBlock;
  return { id, type: 'opaque', raw: { ...value } };
}

/** Atlas requires globally unique IDs throughout the nested block tree. Older
 * grid templates could repeat a child ID in another Section, so repair only
 * collisions while keeping the first occurrence and all block payloads. */
function normalizeNativeBlockIds(
  blocks: ForgeBlock[],
  used: Set<string>,
  fields: Map<string, ForgeField>,
  unsupportedModifiers: Set<string>,
): { blocks: ForgeBlock[]; changed: boolean } {
  let changed = false;
  const next = blocks.map((block, index) => {
    const rawId = typeof block.id === 'string' && block.id.trim() ? block.id.trim() : '';
    const id = rawId && !used.has(rawId)
      ? rawId
      : uniqueId(`legacy-nested:${index}:${rawId}:${JSON.stringify(block)}`, used);
    used.add(id);
    let normalized: ForgeBlock = id === block.id ? block : { ...block, id };
    const tableBlock = promoteLegacyTableBlock(normalized as JsonRecord, id, fields, unsupportedModifiers);
    if (tableBlock) normalized = tableBlock;
    else if (normalized.type === 'table') normalized = { id, type: 'opaque', raw: { ...(normalized as JsonRecord) } };
    if (Array.isArray(normalized.blocks)) {
      const childRecords = normalized.blocks.filter(isRecord) as ForgeBlock[];
      if (childRecords.length === normalized.blocks.length) {
        const children = normalizeNativeBlockIds(childRecords, used, fields, unsupportedModifiers);
        if (children.changed) normalized = { ...normalized, blocks: children.blocks };
      }
    }
    if (normalized !== block) changed = true;
    return normalized;
  });
  return { blocks: changed ? next : blocks, changed };
}

function normalizeTabs(blocks: ForgeBlock[], fields: Map<string, ForgeField>, used: Set<string>): { blocks: ForgeBlock[]; changed: boolean } {
  let changed = false;
  const next = blocks.map((block) => {
    if (!['row', 'section', 'tabs'].includes(block.type) || !Array.isArray(block.blocks)) return block;
    const rawChildren = block.blocks as ForgeBlock[];
    const validChildren = rawChildren.filter(isRecord) as ForgeBlock[];
    const nested = normalizeTabs(validChildren, fields, used);
    let children = nested.blocks;
    let wrapped = false;
    if (block.type === 'tabs') {
      children = children.map((child, index) => {
        if (child.type === 'section') return child;
        wrapped = true;
        return {
          id: uniqueId(`${block.id}:tab:${child.id}:${index}`, used),
          type: 'section', heading: labelForBlock(child, fields, index), blocks: [child],
        };
      });
    }
    const childrenChanged = rawChildren.length !== validChildren.length
      || nested.changed
      || children.some((child, index) => child !== rawChildren[index]);
    if (childrenChanged || wrapped) {
      changed = true;
      return { ...block, blocks: children };
    }
    return block;
  });
  return { blocks: changed ? next : blocks, changed };
}

function mergeLegacyGrids(sources: unknown[][]): LegacyGrid[] {
  const byId = new Map<string, LegacyGrid>();
  sources.forEach((source) => source.forEach((raw, index) => {
    const current = normalizeLegacyGrid(raw, index);
    if (!current) return;
    const previous = byId.get(current.id);
    if (!previous) { byId.set(current.id, current); return; }
    byId.set(current.id, {
      ...previous, ...current,
      fieldIds: [...new Set([...previous.fieldIds, ...current.fieldIds])],
      settings: { ...previous.settings, ...current.settings },
    });
  }));
  return [...byId.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id));
}


export function isLegacyTemplateCandidate(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const hasGridArray = Array.isArray(value.gridBlocks)
    || (isRecord(value.layout) && Array.isArray(value.layout.blocks)
      && value.layout.blocks.some((block) => normalizeLegacyGrid(block, 0) !== null));
  const snapshot = isRecord(value.snapshot) ? value.snapshot : {};
  const hasRootBlocks = Array.isArray(value.blocks) || Array.isArray(value.sections)
    || Array.isArray(snapshot.blocks);
  const hasLegacyFieldDefinitions = isRecord(value.fields)
    || isRecord(snapshot.fields) || Array.isArray(snapshot.fields);
  return hasGridArray || hasLegacyFieldDefinitions || hasRootBlocks
    || (Array.isArray(value.fields) && hasRootBlocks);
}

export interface LegacyTemplateMigrationResult {
  template: JsonRecord;
  changed: boolean;
  migratedGridBlocks: number;
  warnings: string[];
}

/**
 * Converts the previous grid editor's fields map and gridBlocks into the
 * current Atlas fields[] + layout.blocks model. Unknown values and original
 * geometry/settings are retained in fsExtras so the migration is reversible
 * at the data level even when the newer layout model cannot express every gap.
 */
export function migrateLegacyTemplate(input: unknown): LegacyTemplateMigrationResult {
  if (!isRecord(input)) throw new Error('Template root must be a JSON object.');
  const snapshot = isRecord(input.snapshot) ? input.snapshot : {};
  const rawFields = input.fields ?? snapshot.fields;
  const fieldResult = normalizeFields(rawFields);
  let fields = fieldResult.fields;
  const sample: JsonRecord = isRecord(input.sample) ? { ...input.sample } : {};
  let sampleChanged = false;
  for (const [key, value] of Object.entries(fieldResult.defaults)) {
    if (sample[key] === undefined) { sample[key] = value; sampleChanged = true; }
  }

  const layout = isRecord(input.layout) ? input.layout : {};
  const layoutBlocks = Array.isArray(layout.blocks) ? layout.blocks : [];
  const rootBlocks = Array.isArray(input.blocks) ? input.blocks : [];
  const rootSections = Array.isArray(input.sections) ? input.sections : [];
  const snapshotBlocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
  const gridBlocks = Array.isArray(input.gridBlocks) ? input.gridBlocks : [];
  const legacy = mergeLegacyGrids([gridBlocks, layoutBlocks, rootBlocks, rootSections, snapshotBlocks]);

  const sources = [...layoutBlocks, ...rootBlocks, ...rootSections, ...snapshotBlocks, ...gridBlocks];
  const containsLegacyTable: (value: unknown) => boolean = (value) => isRecord(value)
    && (value.type === 'table' || (Array.isArray(value.blocks) && value.blocks.some(containsLegacyTable)));
  if (sources.some(containsLegacyTable)) fields = fields.map((field) => ({ ...field }));

  const byKey = new Map(fields.map((field) => [field.key, field]));
  let addedFallbacks = false;
  for (const oldBlock of legacy) {
    for (const key of oldBlock.fieldIds) {
      if (byKey.has(key)) continue;
      const settings = oldBlock.settings[key];
      const fallback = normalizeOneField(key, {
        key,
        label: typeof settings?.label === 'string' && settings.label.trim() ? settings.label : key,
        type: settings?.type ?? settings?.fieldType ?? 'text',
      }, fields.length);
      fields = [...fields, fallback];
      byKey.set(key, fallback);
      addedFallbacks = true;
    }
  }

  const unsupportedLegacyTableModifiers = new Set<string>();
  const existing: ForgeBlock[] = [];
  const nativeIds = new Set<string>();
  const seenSourceIds = new Set<string>();
  const usedNativeIds = new Set<string>();
  for (const value of sources) {
    if (normalizeLegacyGrid(value, 0)) continue;
    if (isRecord(value) && typeof value.id === 'string' && value.id.trim()) {
      if (seenSourceIds.has(value.id)) continue;
      seenSourceIds.add(value.id);
    }
    const promoted = promoteRootBlock(value, existing.length, usedNativeIds, byKey, unsupportedLegacyTableModifiers);
    if (promoted) { existing.push(promoted); nativeIds.add(promoted.id); }
  }

  const usedIds = new Set<string>();
  const idsNormalized = normalizeNativeBlockIds(existing, usedIds, byKey, unsupportedLegacyTableModifiers);
  const normalizedNative = normalizeTabs(idsNormalized.blocks, byKey, usedIds).blocks;
  const referenced = collectReferences(normalizedNative);
  const byY = new Map<number, Array<{ section: ForgeBlock; widthClass?: string; x: number; width: number }>>();
  let migratedGridBlocks = 0;
  for (const oldBlock of legacy) {
    if (nativeIds.has(oldBlock.id)) continue;
    const converted = migrateLegacyGridBlock(oldBlock, byKey, usedIds, referenced);
    if (!converted) continue;
    const row = byY.get(oldBlock.y) ?? [];
    row.push({ ...converted, x: oldBlock.x, width: oldBlock.width });
    byY.set(oldBlock.y, row);
    migratedGridBlocks += 1;
    for (const key of oldBlock.fieldIds) if (byKey.has(key)) referenced.add(key);
  }

  const convertedLayout: ForgeBlock[] = [];
  for (const [y, items] of [...byY.entries()].sort((a, b) => a[0] - b[0])) {
    items.sort((a, b) => a.x - b.x);
    if (items.length === 1) {
      const item = items[0];
      if (!item) continue;
      const rowId = uniqueId(`legacy-row:${y}:${item.section.id}`, usedIds);
      convertedLayout.push({ id: rowId, type: 'row', ...(item.widthClass ? { className: item.widthClass } : {}), blocks: [item.section] });
    } else {
      const children = items.map((item) => item.widthClass ? { ...item.section, className: item.widthClass } : item.section);
      const hasGaps = items.some((item, index) => {
        const next = items[index + 1];
        return next !== undefined && next.x > item.x + item.width;
      });
      convertedLayout.push({
        id: uniqueId(`legacy-row:${y}:${items.map((item) => item.section.id).join('|')}`, usedIds),
        type: 'row', align: hasGaps ? 'spread' : 'start', blocks: children,
      });
    }
  }

  const nextBlocks = [...normalizedNative, ...convertedLayout];
  const wasLegacy = Array.isArray(input.gridBlocks) || input.blocks !== undefined || input.sections !== undefined
    || !Array.isArray(input.fields) || !isRecord(input.layout) || !Array.isArray(layout.blocks);
  const fieldsChanged = fieldResult.changed || addedFallbacks || input.fields !== fields;
  const blocksChanged = wasLegacy || migratedGridBlocks > 0 || normalizedNative !== existing;
  const layoutChanged = !isRecord(input.layout) || !Array.isArray(layout.blocks)
    || ![1, 2, 3].includes(Number(layout.maxColumns)) || blocksChanged;
  const changed = fieldsChanged || layoutChanged || sampleChanged || wasLegacy;
  if (!changed) return { template: input, changed: false, migratedGridBlocks: 0, warnings: [] };

  const name = typeof input.name === 'string' ? input.name : typeof input.title === 'string' ? input.title : 'Legacy Template';
  const rawId = typeof input.id === 'string' ? input.id : '';
  const templateId = ID_PATTERN.test(rawId) ? rawId : `${name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'legacy-template'}-${stableSuffix(JSON.stringify(input))}`;
  const updated: JsonRecord = {
    ...input,
    format: 'atlas-statblock-template',
    version: Number.isInteger(input.version) && Number(input.version) > 0 ? input.version : 1,
    id: templateId,
    fields,
    ...(Object.keys(sample).length || input.sample !== undefined ? { sample } : {}),
    layout: {
      ...layout,
      maxColumns: [1, 2, 3].includes(Number(layout.maxColumns)) ? Number(layout.maxColumns) : 2,
      blocks: nextBlocks,
    },
  };
  delete updated.gridBlocks;
  delete updated.blocks;
  delete updated.sections;
  if (isRecord(updated.snapshot)) {
    const nextSnapshot = { ...updated.snapshot };
    delete nextSnapshot.fields;
    delete nextSnapshot.blocks;
    updated.snapshot = nextSnapshot;
  }
  const warnings: string[] = [];
  if (migratedGridBlocks > 0) warnings.push(`${migratedGridBlocks} legacy grid block(s) were converted to native Section/Row blocks. Review the canvas and save the template to keep the migration.`);
  if (addedFallbacks) warnings.push('Some referenced fields were missing. In-line Fields were created so their values and references remain accessible.');
  if (rawId && rawId !== templateId) warnings.push('The legacy template ID did not match Atlas requirements and was replaced with a stable compatible ID.');
  if (unsupportedLegacyTableModifiers.size > 0) {
    warnings.push(`${unsupportedLegacyTableModifiers.size} legacy calculated Table column(s) were preserved as metadata but are no longer displayed. Recreate each calculated value as a Number/Rating Field with a formula, then add that Field to the Table.`);
  }
  return { template: updated, changed: true, migratedGridBlocks, warnings };
}
