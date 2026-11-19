/**
 * Atlas-compatible Abilities tabs for Statblock Forge.
 *
 * An Abilities tile is an Entries block or a Tabs block whose Sections each
 * contain exactly one Entries block. Every tab owns a separate Entries field,
 * while all tabs share the same Entry Parts schema.
 */
import {
  cloneJson,
  newBlockId,
  registerTemplateField,
  isRecord,
  type ForgeBlock,
  type ForgeField,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import {
  addLayoutBlock,
  findLayoutBlock,
  findLayoutParentId,
  removeLayoutBlock,
} from './layoutEditorModel.ts';

function blocksOf(block: ForgeBlock): ForgeBlock[] {
  return Array.isArray(block.blocks) ? block.blocks.filter(isRecord) as ForgeBlock[] : [];
}

function entriesOf(section: ForgeBlock): ForgeBlock | null {
  const children = blocksOf(section);
  return section.type === 'section' && children.length === 1 && children[0]?.type === 'entries'
    ? children[0]
    : null;
}

function fieldOf(template: ForgeTemplate, block: ForgeBlock | null): ForgeField | undefined {
  if (!block || typeof block.field !== 'string') return undefined;
  return template.fields.find((field) => field.key === block.field);
}

/** The Atlas Abilities shape: every tab Section contains one Entries block. */
export function isAbilitiesTabs(template: ForgeTemplate, blockOrId: ForgeBlock | string): boolean {
  const block = typeof blockOrId === 'string' ? findLayoutBlock(template, blockOrId) : blockOrId;
  if (!block || block.type !== 'tabs') return false;
  const tabs = blocksOf(block);
  return tabs.length > 0 && tabs.every((tab) => entriesOf(tab) !== null);
}

/** Ordered, unique Entries fields belonging to an Abilities tile. */
export function abilityFieldsForTabs(template: ForgeTemplate, tabsId: string): ForgeField[] {
  const tabs = findLayoutBlock(template, tabsId);
  if (!tabs || !isAbilitiesTabs(template, tabs)) return [];
  const result: ForgeField[] = [];
  const seen = new Set<string>();
  for (const section of blocksOf(tabs)) {
    const field = fieldOf(template, entriesOf(section));
    if (field && field.type === 'entries' && !seen.has(field.key)) {
      seen.add(field.key);
      result.push(field);
    }
  }
  return result;
}

/** If an Entries field belongs to an Abilities tile, return all of that tile's fields. */
export function abilityFieldsForField(template: ForgeTemplate, fieldKey: string): ForgeField[] {
  const visit = (blocks: ForgeBlock[]): ForgeField[] | null => {
    for (const block of blocks) {
      if (block.type === 'tabs' && isAbilitiesTabs(template, block)) {
        const fields = abilityFieldsForTabs(template, block.id);
        if (fields.some((field) => field.key === fieldKey)) return fields;
      }
      if (Array.isArray(block.blocks)) {
        const found = visit(blocksOf(block));
        if (found) return found;
      }
    }
    return null;
  };
  return visit(template.layout.blocks) ?? template.fields.filter((field) => field.key === fieldKey && field.type === 'entries');
}

function cloneEntryShape(source: ForgeField | undefined, target: ForgeField): void {
  if (!source || !isRecord(source.entry)) return;
  target.entry = cloneJson(source.entry);
}

function registerAbilityTabField(template: ForgeTemplate, layout: ForgeLayoutDocument, heading: string, source?: ForgeField): ForgeField {
  const cleanHeading = heading.trim() || 'Abilities';
  const field = registerTemplateField(template, cleanHeading, 'entries');
  cloneEntryShape(source, field);
  layout.fieldKinds ??= {};
  layout.fieldKinds[field.key] = 'collections';
  return field;
}

function setBlockMeta(layout: ForgeLayoutDocument, block: ForgeBlock, span = 12): void {
  layout.blocks[block.id] = {
    span,
    rows: 1,
    appearance: {},
    appearanceMode: 'theme',
  };
}

/**
 * Splits a standalone Entries block into the Atlas Abilities Tabs shape:
 * Tabs heading inherits the old block heading; the existing list becomes
 * Tab 1 and a new independent Entries field is created for Tab 2.
 */
export function splitEntriesIntoAbilityTabs(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  entriesId: string,
): ForgeBlock | null {
  const entries = findLayoutBlock(template, entriesId);
  if (!entries || entries.type !== 'entries' || typeof entries.field !== 'string') return null;
  const parentId = findLayoutParentId(template, entriesId);
  const parent = parentId ? findLayoutBlock(template, parentId) : null;
  if (parentId && (!parent || parent.type !== 'section')) return null;
  if (parent && findLayoutParentId(template, parent.id) !== null) {
    const grandparentId = findLayoutParentId(template, parent.id);
    if (grandparentId && findLayoutBlock(template, grandparentId)?.type === 'tabs') return null;
  }
  const siblings = parent ? blocksOf(parent) : template.layout.blocks;
  const index = siblings.findIndex((item) => item.id === entriesId);
  if (index < 0) return null;
  // blocksOf() returns a filtered copy; use the actual child array for mutation.
  const actualSiblings = parent ? parent.blocks as ForgeBlock[] : template.layout.blocks;
  const actualIndex = actualSiblings.findIndex((item) => item.id === entriesId);
  if (actualIndex < 0) return null;

  const sourceField = template.fields.find((field) => field.key === entries.field && field.type === 'entries');
  if (!sourceField) return null;
  const inheritedHeading = typeof entries.heading === 'string' ? entries.heading.trim() : '';
  const originalMeta = layout.blocks[entries.id] ?? { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' as const };
  const tabs: ForgeBlock = {
    id: newBlockId(new Set([...collectAllIds(template.layout.blocks)])),
    type: 'tabs',
    ...(inheritedHeading ? { heading: inheritedHeading } : {}),
    blocks: [],
  };
  const firstSection: ForgeBlock = { id: newBlockId(new Set([...collectAllIds(template.layout.blocks), tabs.id])), type: 'section', heading: 'Tab 1', blocks: [] };
  const secondSection: ForgeBlock = { id: newBlockId(new Set([...collectAllIds(template.layout.blocks), tabs.id, firstSection.id])), type: 'section', heading: 'Tab 2', blocks: [] };
  const newField = registerAbilityTabField(template, layout, 'Tab 2', sourceField);
  const secondEntries: ForgeBlock = { id: newBlockId(new Set([...collectAllIds(template.layout.blocks), tabs.id, firstSection.id, secondSection.id])), type: 'entries', field: newField.key, nameStyle: 'run-in' };
  delete entries.heading;
  firstSection.blocks = [entries];
  secondSection.blocks = [secondEntries];
  tabs.blocks = [firstSection, secondSection];
  actualSiblings.splice(actualIndex, 1, tabs);
  layout.blocks[tabs.id] = { ...originalMeta, appearance: {}, appearanceMode: 'theme' };
  layout.blocks[firstSection.id] = { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' };
  layout.blocks[secondSection.id] = { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' };
  layout.blocks[entries.id] = { ...originalMeta, span: 12 };
  setBlockMeta(layout, secondEntries);
  layout.fieldKinds ??= {};
  layout.fieldKinds[sourceField.key] = 'collections';
  return tabs;
}

function collectAllIds(blocks: readonly ForgeBlock[]): string[] {
  const result: string[] = [];
  for (const block of blocks) {
    result.push(block.id);
    result.push(...collectAllIds(blocksOf(block)));
  }
  return result;
}

/** Adds a fully populated ability tab, cloning the first tab's Entry shape/Parts. */
export function addAbilityTab(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  tabsId: string,
  requestedHeading?: string,
): ForgeBlock | null {
  const tabs = findLayoutBlock(template, tabsId);
  if (!tabs || !isAbilitiesTabs(template, tabs)) return null;
  const sections = blocksOf(tabs);
  const takenHeadings = new Set(sections.map((section) => String(section.heading ?? '').trim().toLowerCase()));
  let nextNumber = sections.length + 1;
  while (takenHeadings.has(`tab ${nextNumber}`)) nextNumber += 1;
  const heading = requestedHeading?.trim() || `Tab ${nextNumber}`;
  const sourceField = fieldOf(template, entriesOf(sections[0] as ForgeBlock));
  const field = registerAbilityTabField(template, layout, heading, sourceField);
  const section = addLayoutBlock(template, layout, 'section', null, tabsId);
  section.heading = heading;
  addLayoutBlock(template, layout, 'entries', field.key, section.id);
  return section;
}

/**
 * Removes an Abilities tab. If one tab remains, the Tabs wrapper disappears
 * and the remaining Entries block takes the wrapper heading, as in Atlas.
 * The removed field remains registered so note data is not discarded.
 */
export function removeAbilityTab(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  tabsId: string,
  sectionId: string,
): ForgeBlock | null {
  const tabs = findLayoutBlock(template, tabsId);
  if (!tabs || !isAbilitiesTabs(template, tabs)) return null;
  const sections = blocksOf(tabs);
  const removedIndex = sections.findIndex((section) => section.id === sectionId);
  if (removedIndex < 0) return null;
  const remaining = sections.filter((section) => section.id !== sectionId);
  if (remaining.length !== 1) return removeLayoutBlock(template, layout, sectionId);

  const remainingSection = remaining[0];
  if (!remainingSection) return null;
  const remainingEntries = entriesOf(remainingSection);
  if (!remainingEntries) return null;
  const parentId = findLayoutParentId(template, tabsId);
  const parent = parentId ? findLayoutBlock(template, parentId) : null;
  if (parentId && (!parent || !Array.isArray(parent.blocks))) return null;
  const siblings = parent ? parent.blocks as ForgeBlock[] : template.layout.blocks;
  const tabsIndex = siblings.findIndex((block) => block.id === tabsId);
  if (tabsIndex < 0) return null;
  const heading = typeof tabs.heading === 'string' && tabs.heading.trim()
    ? tabs.heading.trim()
    : (typeof remainingSection.heading === 'string' ? remainingSection.heading.trim() : '');
  if (heading) remainingEntries.heading = heading;
  else delete remainingEntries.heading;
  siblings.splice(tabsIndex, 1, remainingEntries);
  delete layout.blocks[tabsId];
  delete layout.blocks[sectionId];
  delete layout.blocks[remainingSection.id];
  return remainingEntries;
}

/** Reorders a tab left or right without changing the field values it owns. */
export function moveAbilityTab(
  template: ForgeTemplate,
  tabsId: string,
  sectionId: string,
  direction: -1 | 1,
): boolean {
  const tabs = findLayoutBlock(template, tabsId);
  if (!tabs || !isAbilitiesTabs(template, tabs)) return false;
  const sections = blocksOf(tabs);
  const index = sections.findIndex((section) => section.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sections.length || !Array.isArray(tabs.blocks)) return false;
  const actual = tabs.blocks as ForgeBlock[];
  const [moved] = actual.splice(index, 1);
  if (!moved) return false;
  actual.splice(target, 0, moved);
  return true;
}
