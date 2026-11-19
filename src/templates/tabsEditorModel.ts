import {
  addLayoutBlock,
  findLayoutBlock,
  findLayoutParentId,
  moveLayoutBlockTo,
  removeLayoutBlock,
} from './layoutEditorModel.ts';
import { collectBlockIds, newBlockId, type ForgeBlock, type ForgeLayoutDocument, type ForgeTemplate } from './forgeTemplate.ts';

function tabContext(template: ForgeTemplate, tabId: string): { tabs: ForgeBlock; siblings: ForgeBlock[]; index: number } | null {
  const tab = findLayoutBlock(template, tabId);
  if (!tab || tab.type !== 'section') return null;
  const parentId = findLayoutParentId(template, tabId);
  const tabs = parentId ? findLayoutBlock(template, parentId) : null;
  if (!tabs || tabs.type !== 'tabs' || !Array.isArray(tabs.blocks)) return null;
  const siblings = tabs.blocks.filter((item): item is ForgeBlock => typeof item === 'object' && item !== null && 'id' in item && 'type' in item);
  return { tabs, siblings, index: siblings.findIndex((item) => item.id === tabId) };
}

/** Create a Section as a tab in a Tabs container. */
export function addTabToContainer(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  tabsId: string,
  requestedLabel?: string,
): ForgeBlock {
  const tabs = findLayoutBlock(template, tabsId);
  if (!tabs || tabs.type !== 'tabs') throw new Error('Select a Tabs container first.');
  const count = Array.isArray(tabs.blocks) ? tabs.blocks.filter((block) => block.type === 'section').length : 0;
  const section = addLayoutBlock(template, layout, 'section', null, tabsId);
  section.heading = requestedLabel?.trim() || `Tab ${count + 1}`;
  return section;
}

/** Rename only a Section that is a direct child of Tabs. */
export function renameTab(template: ForgeTemplate, tabId: string, label: string): boolean {
  const context = tabContext(template, tabId);
  if (!context) return false;
  const tab = context.siblings.find((item) => item.id === tabId);
  if (!tab) return false;
  const next = label.trim();
  if ((typeof tab.heading === 'string' ? tab.heading : '') === next) return false;
  if (next) tab.heading = next;
  else delete tab.heading;
  return true;
}

/** Reorder a tab within its own Tabs container without flattening children. */
export function moveTab(template: ForgeTemplate, tabId: string, direction: -1 | 1): boolean {
  const context = tabContext(template, tabId);
  if (!context || context.index < 0) return false;
  const targetIndex = direction < 0 ? context.index - 1 : context.index + 2;
  if (targetIndex < 0 || targetIndex > context.siblings.length) return false;
  const parentId = context.tabs.id;
  return moveLayoutBlockTo(template, tabId, parentId, targetIndex);
}

/** Remove one tab and all its nested blocks/metadata. */
export function removeTab(template: ForgeTemplate, layout: ForgeLayoutDocument, tabId: string): ForgeBlock | null {
  if (!tabContext(template, tabId)) return null;
  return removeLayoutBlock(template, layout, tabId);
}


/** Whether an Entries / Abilities block can become a Tabs container at its current tree level. */
export function canWrapEntriesBlockInTabs(template: ForgeTemplate, blockId: string): boolean {
  const block = findLayoutBlock(template, blockId);
  if (!block || block.type !== 'entries') return false;
  const parentId = findLayoutParentId(template, blockId);
  if (parentId === null) return true;
  const parent = findLayoutBlock(template, parentId);
  // Atlas Sections and the root can hold Tabs. Rows cannot, and Tabs only hold Sections.
  // Do not offer the same wrapping action on the Entries block already inside its generated tab.
  return parent?.type === 'section' && !isTabSection(template, parentId);
}

/**
 * Wraps an existing Entries block in Tabs -> Section without creating a new
 * Field or a second list. The original Entries object and ID remain intact.
 * The former canvas placement moves to Tabs; the Entries block becomes full
 * width inside its new Section. Refuses unsupported parent containers.
 */
export function wrapEntriesBlockInTabs(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
): ForgeBlock | null {
  if (!canWrapEntriesBlockInTabs(template, blockId)) return null;
  const entries = findLayoutBlock(template, blockId);
  if (!entries || entries.type !== 'entries') return null;

  const parentId = findLayoutParentId(template, blockId);
  const parent = parentId ? findLayoutBlock(template, parentId) : null;
  const siblings = parent
    ? (Array.isArray(parent.blocks) ? parent.blocks as ForgeBlock[] : null)
    : template.layout.blocks;
  if (!siblings) return null;
  const index = siblings.findIndex((item) => item.id === blockId);
  if (index < 0) return null;

  const existingIds = new Set(collectBlockIds(template.layout.blocks));
  const tabsId = newBlockId(existingIds);
  existingIds.add(tabsId);
  const sectionId = newBlockId(existingIds);
  const field = template.fields.find((item) => item.key === entries.field);
  // The tab label uses the Field label. Any explicit Entries heading stays
  // on the original block and remains visible inside that tab.
  const tabHeading = field?.label?.trim()
    || (typeof entries.heading === 'string' && entries.heading.trim() ? entries.heading.trim() : 'Abilities');

  const tabs: ForgeBlock = {
    id: tabsId,
    type: 'tabs',
    blocks: [{ id: sectionId, type: 'section', heading: tabHeading, blocks: [entries] }],
  };
  const originalMeta = layout.blocks[blockId] ?? {
    span: 12,
    rows: 1,
    appearance: {},
    appearanceMode: 'theme' as const,
  };

  // The Tabs tile inherits the old grid placement. Keep the original visual
  // treatment on the Entries block, which now occupies the full tab panel.
  layout.blocks[tabsId] = {
    span: originalMeta.span,
    rows: originalMeta.rows,
    appearance: {},
    appearanceMode: 'theme',
  };
  layout.blocks[sectionId] = {
    span: 12,
    rows: 1,
    appearance: {},
    appearanceMode: 'theme',
  };
  layout.blocks[blockId] = { ...originalMeta, span: 12 };
  siblings.splice(index, 1, tabs);
  return tabs;
}

export function isTabSection(template: ForgeTemplate, blockId: string): boolean {
  return tabContext(template, blockId) !== null;
}
