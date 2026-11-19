import type { ForgeLanguage } from '../i18n/localization.ts';
import { translateForgeText } from '../i18n/localization.ts';
import type { InlineScoresTableEdit } from './inlineScoresTableModel.ts';

export type InlineScoresTableMenuAction =
  | { kind: 'item'; id: string; label: string; icon: string; command: InlineScoresTableEdit; disabled?: boolean; destructive?: boolean }
  | { kind: 'submenu'; id: string; label: string; icon: string; children: InlineScoresTableMenuAction[] }
  | { kind: 'separator' };

export interface InlineScoresTableMenuState {
  rowCount: number;
  columnCount: number;
  rowsAllowed: boolean;
  columnsAllowed: boolean;
  language: ForgeLanguage;
}

export interface InlineScoresTableMenuCell {
  row: number;
  column: number;
}

const SEPARATOR: InlineScoresTableMenuAction = { kind: 'separator' };

function label(source: string, language: ForgeLanguage): string {
  return translateForgeText(source, language);
}

function item(
  state: InlineScoresTableMenuState,
  id: string,
  text: string,
  icon: string,
  command: InlineScoresTableEdit,
  options: { disabled?: boolean; destructive?: boolean } = {},
): InlineScoresTableMenuAction {
  return { kind: 'item', id, label: label(text, state.language), icon, command, ...options };
}

/** The row handle menu, in the same order as Atlas' statblock-pane table menu. */
export function inlineScoresRowMenu(state: InlineScoresTableMenuState, row: number): InlineScoresTableMenuAction[] {
  if (!state.rowsAllowed || row < 0 || row >= state.rowCount) return [];
  const full = state.rowCount >= 100;
  const last = state.rowCount - 1;
  return [
    item(state, 'row-before', 'Add row above', 'panel-top-close', { type: 'add-row', index: row }, { disabled: full }),
    item(state, 'row-after', 'Add row below', 'panel-bottom-close', { type: 'add-row', index: row + 1 }, { disabled: full }),
    SEPARATOR,
    item(state, 'row-up', 'Move row up', 'arrow-up', { type: 'move-row', from: row, to: row - 1 }, { disabled: row === 0 }),
    item(state, 'row-down', 'Move row down', 'arrow-down', { type: 'move-row', from: row, to: row + 1 }, { disabled: row === last }),
    SEPARATOR,
    item(state, 'row-copy', 'Duplicate row', 'copy', { type: 'duplicate-row', index: row }, { disabled: full }),
    item(state, 'row-delete', 'Delete row', 'trash-2', { type: 'remove-row', index: row }, { disabled: last === 0, destructive: true }),
  ];
}

/** The column handle menu. Statblock sheets do not permit changing column alignment. */
export function inlineScoresColumnMenu(state: InlineScoresTableMenuState, column: number): InlineScoresTableMenuAction[] {
  if (!state.columnsAllowed || column < 0 || column >= state.columnCount) return [];
  const full = state.columnCount >= 12;
  const last = state.columnCount - 1;
  return [
    item(state, 'column-before', 'Add column left', 'panel-left-close', { type: 'add-column', index: column }, { disabled: full }),
    item(state, 'column-after', 'Add column right', 'panel-right-close', { type: 'add-column', index: column + 1 }, { disabled: full }),
    SEPARATOR,
    item(state, 'column-left', 'Move column left', 'arrow-left', { type: 'move-column', from: column, to: column - 1 }, { disabled: column === 0 }),
    item(state, 'column-right', 'Move column right', 'arrow-right', { type: 'move-column', from: column, to: column + 1 }, { disabled: column === last }),
    SEPARATOR,
    item(state, 'column-copy', 'Duplicate column', 'copy', { type: 'duplicate-column', index: column }, { disabled: full }),
    item(state, 'column-delete', 'Delete column', 'trash-2', { type: 'remove-column', index: column }, { disabled: last === 0, destructive: true }),
  ];
}

function sortMenu(state: InlineScoresTableMenuState, column: number): InlineScoresTableMenuAction[] {
  if (!state.rowsAllowed) return [];
  const disabled = state.rowCount < 2;
  return [
    item(state, 'sort-a-z', 'Sort A to Z', 'arrow-down-a-z', { type: 'sort-rows', column, direction: 1 }, { disabled }),
    item(state, 'sort-z-a', 'Sort Z to A', 'arrow-up-z-a', { type: 'sort-rows', column, direction: -1 }, { disabled }),
  ];
}

function tidy(actions: InlineScoresTableMenuAction[]): InlineScoresTableMenuAction[] {
  const result: InlineScoresTableMenuAction[] = [];
  for (const action of actions) {
    if (action.kind === 'submenu' && action.children.length === 0) continue;
    if (action.kind === 'separator' && (result.length === 0 || result.at(-1)?.kind === 'separator')) continue;
    result.push(action);
  }
  if (result.at(-1)?.kind === 'separator') result.pop();
  return result;
}

/** Cell menu: Row ›, Column ›, then sorting commands, matching Atlas. */
export function inlineScoresCellMenu(state: InlineScoresTableMenuState, at: InlineScoresTableMenuCell): InlineScoresTableMenuAction[] {
  const rows = at.row >= 0 ? inlineScoresRowMenu(state, at.row) : [];
  const columns = inlineScoresColumnMenu(state, at.column);
  const sorting = sortMenu(state, at.column);
  return tidy([
    ...(rows.length ? [{ kind: 'submenu' as const, id: 'row', label: label('Row', state.language), icon: 'table', children: rows }] : []),
    ...(columns.length ? [{ kind: 'submenu' as const, id: 'column', label: label('Column', state.language), icon: 'table', children: columns }] : []),
    ...(rows.length || columns.length ? [SEPARATOR] : []),
    ...sorting,
  ]);
}

/** Column handle menu: sorting first, followed by the column's own actions. */
export function inlineScoresColumnHandleMenu(state: InlineScoresTableMenuState, column: number): InlineScoresTableMenuAction[] {
  return tidy([...sortMenu(state, column), SEPARATOR, ...inlineScoresColumnMenu(state, column)]);
}
