import {
  clampInteger,
  collectBlockIds,
  createBlock,
  createForgeLayout,
  isRecord,
  type ForgeBlock,
  type ForgeLayoutDocument,
  type ForgeTemplate,
} from './forgeTemplate.ts';
import { MAX_BLOCK_ROWS } from './layoutLimits.ts';

export const LAYOUT_BLOCK_TYPES = [
  { value: 'section', label: 'Section container', requiresField: false },
  { value: 'row', label: 'Row container', requiresField: false },
  { value: 'tabs', label: 'Tabs container', requiresField: false },
  { value: 'heading', label: 'Heading', requiresField: false },
  { value: 'title', label: 'Title', requiresField: true },
  { value: 'divider', label: 'Divider', requiresField: false },
  { value: 'vertical-divider', label: 'Vertical divider', requiresField: false },
  { value: 'text', label: 'Text', requiresField: false },
  { value: 'line', label: 'Line', requiresField: false },
  { value: 'stat', label: 'Stat', requiresField: true },
  { value: 'metric', label: 'Metric', requiresField: true },
  { value: 'tags', label: 'Tags', requiresField: true },
  { value: 'scores', label: 'Table', requiresField: true },
  { value: 'entries', label: 'Entries / Abilities', requiresField: true },
  { value: 'pairs', label: 'Pairs', requiresField: true },
  { value: 'image', label: 'Image', requiresField: true },
  { value: 'spells', label: 'Spells', requiresField: true },
  { value: 'counters', label: 'Counters', requiresField: true },
  { value: 'checkboxes', label: 'Checkboxes', requiresField: true },
  { value: 'track', label: 'Track', requiresField: true },
] as const;

export type LayoutBlockType = (typeof LAYOUT_BLOCK_TYPES)[number]['value'];

export interface LayoutInsertionTarget {
  /** Container that receives the new block, or null for the root Grid. */
  targetContainerId: string | null;
  /** Insert immediately after this sibling instead of appending. */
  insertAfterBlockId: string | null;
}

export interface LayoutValidationIssue {
  code: 'duplicate-id' | 'invalid-id' | 'missing-metadata' | 'invalid-span' | 'invalid-rows' | 'unknown-field' | 'invalid-container-children';
  message: string;
  blockId?: string;
}

interface BlockLocation {
  siblings: ForgeBlock[];
  index: number;
  block: ForgeBlock;
}

function locateBlock(blocks: ForgeBlock[], id: string): BlockLocation | null {
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!block) continue;
    if (block.id === id) return { siblings: blocks, index, block };
    if (Array.isArray(block.blocks)) {
      // Keep the original child array reference so sibling moves/removals mutate
      // the actual template tree instead of a filtered copy.
      const nested = block.blocks as ForgeBlock[];
      const found = locateBlock(nested, id);
      if (found) return found;
    }
  }
  return null;
}

function descendantIds(block: ForgeBlock): string[] {
  const ids = [block.id];
  if (Array.isArray(block.blocks)) {
    for (const nested of block.blocks) {
      if (isRecord(nested) && typeof nested.id === 'string') {
        ids.push(...descendantIds(nested as ForgeBlock));
      }
    }
  }
  return ids;
}

function ensureBlockMetadata(layout: ForgeLayoutDocument, block: ForgeBlock, defaultSpan = 12): void {
  if (!layout.blocks[block.id]) {
    layout.blocks[block.id] = {
      span: clampInteger(defaultSpan, 1, 12, 12),
      rows: 1,
      appearance: {},
      appearanceMode: 'theme',
      ...(block.type === 'metric' ? { metricSlotsPerRow: 6 } : {}),
    };
  }
}

export function ensureLayoutMetadataForTree(template: ForgeTemplate, layout: ForgeLayoutDocument): void {
  const visit = (blocks: ForgeBlock[], parentType?: string): void => {
    for (const block of blocks) {
      const defaultSpan = block.type === 'vertical-divider' ? 1
        : parentType === 'row' ? 6
          : parentType === undefined && (block.type === 'stat' || block.type === 'tags') ? 6
            : 12;
      ensureBlockMetadata(layout, block, defaultSpan);
      if (Array.isArray(block.blocks)) {
        const children = block.blocks.filter(isRecord) as ForgeBlock[];
        visit(children, block.type);
      }
    }
  };
  visit(template.layout.blocks);
}

export function addLayoutBlock(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  type: LayoutBlockType,
  fieldKey?: string | null,
  targetContainerId?: string | null,
  insertAfterBlockId?: string | null,
): ForgeBlock {
  const definition = LAYOUT_BLOCK_TYPES.find((item) => item.value === type);
  if (!definition) throw new Error(`Tipo de bloco não suportado: ${String(type)}`);

  const normalizedKey = typeof fieldKey === 'string' ? fieldKey.trim() : '';
  if (definition.requiresField && !normalizedKey) {
    throw new Error('Selecione um Template Field para este tipo de bloco.');
  }
  if (normalizedKey && !template.fields.some((field) => field.key === normalizedKey)) {
    throw new Error('O campo selecionado não existe no template.');
  }
  if (type === 'line' && normalizedKey) {
    const field = template.fields.find((item) => item.key === normalizedKey);
    if (!field || !['text', 'number', 'rating', 'dice', 'choice'].includes(field.type)) {
      throw new Error('Line aceita apenas campos Text, Number, Rating, Dice e Choice.');
    }
  }
  if (type === 'title' && normalizedKey) {
    const field = template.fields.find((item) => item.key === normalizedKey);
    if (!field || field.type !== 'text') {
      throw new Error('Title aceita apenas campos do tipo Text.');
    }
  }

  let siblings = template.layout.blocks;
  let parentType: string | undefined;
  if (targetContainerId) {
    const parent = findLayoutBlock(template, targetContainerId);
    if (!parent || !['section', 'row', 'tabs'].includes(parent.type) || !Array.isArray(parent.blocks)) {
      throw new Error('O container de destino não existe ou não aceita blocos.');
    }
    if (!canContainerAcceptBlockType(parent.type, type)) {
      if (parent.type === 'tabs') throw new Error('Um container Tabs só pode receber containers Section.');
      if (parent.type === 'row') throw new Error('Um container Row não pode receber outra Row ou Tabs.');
      throw new Error('O container selecionado não aceita este tipo de bloco.');
    }
    siblings = parent.blocks as ForgeBlock[];
    parentType = parent.type;
  }

  const block = createBlock(type, template, normalizedKey || undefined);
  let insertionIndex = siblings.length;
  if (insertAfterBlockId) {
    const anchor = locateBlock(template.layout.blocks, insertAfterBlockId);
    if (!anchor || anchor.siblings !== siblings) {
      throw new Error('O bloco selecionado não pertence ao nível de inserção escolhido.');
    }
    insertionIndex = anchor.index + 1;
  }
  siblings.splice(insertionIndex, 0, block);
  const defaultSpan = type === 'vertical-divider' ? 1
    : parentType === 'row' ? 6
      : (!targetContainerId && (type === 'stat' || type === 'tags') ? 6 : 12);
  ensureBlockMetadata(layout, block, defaultSpan);
  return block;
}

export function findLayoutBlock(template: ForgeTemplate, blockId: string): ForgeBlock | null {
  return locateBlock(template.layout.blocks, blockId)?.block ?? null;
}

export function removeLayoutBlock(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockId: string,
): ForgeBlock | null {
  const location = locateBlock(template.layout.blocks, blockId);
  if (!location) return null;
  const [removed] = location.siblings.splice(location.index, 1);
  if (!removed) return null;
  for (const id of descendantIds(removed)) delete layout.blocks[id];
  return removed;
}

/** Returns whether a block can move one position within its current sibling list. */
export function canMoveLayoutBlock(template: ForgeTemplate, blockId: string, direction: -1 | 1): boolean {
  const location = locateBlock(template.layout.blocks, blockId);
  if (!location) return false;
  const target = location.index + direction;
  return target >= 0 && target < location.siblings.length;
}

/** Swaps a block with its adjacent sibling; it never crosses a container boundary. */
export function moveLayoutBlock(template: ForgeTemplate, blockId: string, direction: -1 | 1): boolean {
  const location = locateBlock(template.layout.blocks, blockId);
  if (!location || !canMoveLayoutBlock(template, blockId, direction)) return false;
  const target = location.index + direction;
  const current = location.siblings[location.index];
  const adjacent = location.siblings[target];
  if (!current || !adjacent) return false;
  location.siblings[location.index] = adjacent;
  location.siblings[target] = current;
  return true;
}

export function bindLayoutBlock(template: ForgeTemplate, blockId: string, fieldKey: string | null): void {
  const block = findLayoutBlock(template, blockId);
  if (!block) throw new Error('Bloco não encontrado.');
  if (['heading', 'divider', 'vertical-divider', 'section', 'row', 'tabs'].includes(block.type)) {
    throw new Error('Este bloco estrutural não pode ser vinculado a um campo.');
  }
  if (fieldKey === null || fieldKey.trim() === '') {
    if (block.type === 'title') throw new Error('Title precisa estar vinculado a um campo Text.');
    delete block.field;
    return;
  }
  const field = template.fields.find((item) => item.key === fieldKey);
  if (!field) {
    throw new Error('O campo selecionado não existe no template.');
  }
  if (block.type === 'title' && field.type !== 'text') {
    throw new Error('Title aceita apenas campos do tipo Text.');
  }
  block.field = fieldKey;
}

export function resizeLayoutBlock(
  layout: ForgeLayoutDocument,
  block: ForgeBlock,
  span: number,
  rows: number,
): void {
  ensureBlockMetadata(layout, block, 12);
  const metadata = layout.blocks[block.id];
  if (!metadata) throw new Error('Não foi possível inicializar os metadados do bloco.');
  metadata.span = clampInteger(span, 1, 12, 12);
  metadata.rows = clampInteger(rows, 1, MAX_BLOCK_ROWS, 1);
}


/** Returns the direct parent container of a block, or null for the root grid. */
export function findLayoutParentId(template: ForgeTemplate, blockId: string): string | null {
  const visit = (blocks: ForgeBlock[], parentId: string | null): string | null | undefined => {
    for (const block of blocks) {
      if (block.id === blockId) return parentId;
      if (Array.isArray(block.blocks)) {
        const found = visit(block.blocks.filter(isRecord) as ForgeBlock[], block.id);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  };
  return visit(template.layout.blocks, null) ?? null;
}

/** Whether a container accepts a direct child of the requested type. */
export function canContainerAcceptBlockType(containerType: string | null | undefined, childType: LayoutBlockType): boolean {
  if (!containerType) return true;
  if (containerType === 'section') return true;
  if (containerType === 'row') return childType !== 'row' && childType !== 'tabs';
  if (containerType === 'tabs') return childType === 'section';
  return false;
}

/**
 * Resolve where a newly created block belongs relative to the last selected
 * block. Compatible containers receive the new block as a child. Otherwise,
 * the new block is inserted immediately after the selected block at the
 * nearest ancestor level that accepts its type.
 */
export function resolveLayoutInsertionTarget(
  template: ForgeTemplate,
  selectedBlockId: string | null | undefined,
  childType: LayoutBlockType,
): LayoutInsertionTarget {
  if (!selectedBlockId) return { targetContainerId: null, insertAfterBlockId: null };

  const selected = findLayoutBlock(template, selectedBlockId);
  if (!selected) return { targetContainerId: null, insertAfterBlockId: null };

  const isContainer = ['section', 'row', 'tabs'].includes(selected.type) && Array.isArray(selected.blocks);
  if (isContainer && canContainerAcceptBlockType(selected.type, childType)) {
    return { targetContainerId: selected.id, insertAfterBlockId: null };
  }

  // The selected block cannot receive this child. Place it beside the selected
  // node; if its current parent also rejects the type (for example, a Row
  // cannot contain another Row), climb until a compatible sibling level exists.
  let anchor = selected;
  let parentId = findLayoutParentId(template, selected.id);
  while (parentId) {
    const parent = findLayoutBlock(template, parentId);
    if (!parent) break;
    if (canContainerAcceptBlockType(parent.type, childType)) {
      return { targetContainerId: parent.id, insertAfterBlockId: anchor.id };
    }
    anchor = parent;
    parentId = findLayoutParentId(template, parent.id);
  }

  return { targetContainerId: null, insertAfterBlockId: anchor.id };
}

/** Moves a block to a sibling index or into a container without flattening the tree. */
export function moveLayoutBlockTo(
  template: ForgeTemplate,
  blockId: string,
  targetParentId: string | null,
  targetIndex: number,
): boolean {
  const source = locateBlock(template.layout.blocks, blockId);
  if (!source) return false;

  let targetSiblings = template.layout.blocks;
  if (targetParentId) {
    const targetParent = findLayoutBlock(template, targetParentId);
    if (!targetParent || !['section', 'row', 'tabs'].includes(targetParent.type) || !Array.isArray(targetParent.blocks)) {
      throw new Error('O destino não aceita blocos.');
    }
    if (targetParentId === blockId || descendantIds(source.block).includes(targetParentId)) {
      throw new Error('Um bloco não pode ser movido para dentro de si mesmo.');
    }
    if (targetParent.type === 'tabs' && source.block.type !== 'section') {
      throw new Error('Tabs só aceita Sections.');
    }
    if (targetParent.type === 'row' && (source.block.type === 'row' || source.block.type === 'tabs')) {
      throw new Error('Row não aceita outra Row ou Tabs.');
    }
    targetSiblings = targetParent.blocks as ForgeBlock[];
  }

  const sameList = source.siblings === targetSiblings;
  let insertion = clampInteger(targetIndex, 0, targetSiblings.length, targetSiblings.length);
  if (sameList && source.index < insertion) insertion -= 1;
  if (sameList && insertion === source.index) return false;

  source.siblings.splice(source.index, 1);
  insertion = clampInteger(insertion, 0, targetSiblings.length, targetSiblings.length);
  targetSiblings.splice(insertion, 0, source.block);
  return true;
}

/** Groups contiguous sibling blocks into a new Row, preserving their order and metadata. */
export function groupLayoutBlocks(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  blockIds: readonly string[],
): ForgeBlock {
  const uniqueIds = [...new Set(blockIds)];
  if (uniqueIds.length < 2) throw new Error('Selecione pelo menos dois blocos.');
  const locations = uniqueIds.map((id) => locateBlock(template.layout.blocks, id));
  if (locations.some((location) => !location)) throw new Error('Um ou mais blocos não foram encontrados.');
  const first = locations[0]!;
  if (locations.some((location) => location!.siblings !== first.siblings)) {
    throw new Error('Agrupe apenas blocos do mesmo container.');
  }
  const ordered = locations.map((location) => location!).sort((a, b) => a.index - b.index);
  for (let index = 1; index < ordered.length; index += 1) {
    if (ordered[index]!.index !== ordered[index - 1]!.index + 1) {
      throw new Error('Os blocos precisam ser adjacentes para formar uma Row.');
    }
  }

  const parentId = findLayoutParentId(template, first.block.id);
  const parent = parentId ? findLayoutBlock(template, parentId) : null;
  if (parent?.type === 'row' || parent?.type === 'tabs') {
    throw new Error('Este container não permite criar uma Row neste nível.');
  }
  if (ordered.some((location) => location.block.type === 'row' || location.block.type === 'tabs')) {
    throw new Error('Rows e Tabs não podem ser agrupados dentro de outra Row.');
  }
  const row = createBlock('row', template);
  row.blocks = ordered.map((location) => location.block);
  const firstIndex = ordered[0]!.index;
  const lastIndex = ordered[ordered.length - 1]!.index;
  first.siblings.splice(firstIndex, lastIndex - firstIndex + 1, row);
  layout.blocks[row.id] = { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' };
  return row;
}

/** Removes a Row wrapper while retaining its children and their layout metadata. */
export function ungroupLayoutRow(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
  rowId: string,
): ForgeBlock[] {
  const location = locateBlock(template.layout.blocks, rowId);
  if (!location || location.block.type !== 'row' || !Array.isArray(location.block.blocks)) {
    throw new Error('Selecione uma Row para desagrupar.');
  }
  const children = location.block.blocks.filter(isRecord) as ForgeBlock[];
  location.siblings.splice(location.index, 1, ...children);
  delete layout.blocks[rowId];
  return children;
}

export function validateLayoutDocument(
  template: ForgeTemplate,
  layout: ForgeLayoutDocument,
): LayoutValidationIssue[] {
  const issues: LayoutValidationIssue[] = [];
  const seen = new Set<string>();
  const validFieldKeys = new Set(template.fields.map((field) => field.key));

  const visit = (blocks: ForgeBlock[]): void => {
    for (const block of blocks) {
      if (typeof block.id !== 'string' || !block.id.trim()) {
        issues.push({ code: 'invalid-id', message: 'Há um bloco sem ID válido.' });
      } else if (seen.has(block.id)) {
        issues.push({ code: 'duplicate-id', blockId: block.id, message: `O ID de bloco ${block.id} está duplicado.` });
      } else {
        seen.add(block.id);
      }

      if (typeof block.field === 'string' && block.field && !validFieldKeys.has(block.field)) {
        issues.push({ code: 'unknown-field', blockId: block.id, message: `O bloco ${block.id} aponta para o campo inexistente ${block.field}.` });
      }

      const metadata = layout.blocks[block.id];
      if (!metadata) {
        issues.push({ code: 'missing-metadata', blockId: block.id, message: `O bloco ${block.id} não possui configuração de Grid.` });
      } else {
        if (!Number.isInteger(metadata.span) || metadata.span < 1 || metadata.span > 12) {
          issues.push({ code: 'invalid-span', blockId: block.id, message: `A largura do bloco ${block.id} precisa ser de 1 a 12 colunas.` });
        }
        if (!Number.isInteger(metadata.rows) || metadata.rows < 1 || metadata.rows > MAX_BLOCK_ROWS) {
          issues.push({ code: 'invalid-rows', blockId: block.id, message: `A altura do bloco ${block.id} precisa ser de 1 a ${MAX_BLOCK_ROWS.toLocaleString('pt-BR')} linhas.` });
        }
      }

      if (['section', 'row', 'tabs'].includes(block.type) && !Array.isArray(block.blocks)) {
        issues.push({ code: 'invalid-container-children', blockId: block.id, message: `O container ${block.id} precisa possuir uma lista de blocos filhos.` });
      }
      if (Array.isArray(block.blocks)) {
        const children = block.blocks.filter(isRecord) as ForgeBlock[];
        if (block.type === 'tabs' && children.some((child) => child.type !== 'section')) {
          issues.push({ code: 'invalid-container-children', blockId: block.id, message: `O container Tabs ${block.id} só pode conter Sections.` });
        }
        visit(children);
      }
    }
  };

  visit(template.layout.blocks);
  return issues;
}

export function createLayoutForTemplate(template: ForgeTemplate): ForgeLayoutDocument {
  const layout = createForgeLayout(template);
  ensureLayoutMetadataForTree(template, layout);
  return layout;
}

export function layoutBlockIds(block: ForgeBlock): string[] {
  return collectBlockIds([block]);
}
