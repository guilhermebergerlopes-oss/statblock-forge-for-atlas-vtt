import { DEFAULT_COUNTERS_PER_ROW, MAX_COUNTERS_PER_ROW, normalizeCountersPerRow, setCountersPerRow } from '../templates/counterLayoutModel.ts';
import { translateForgeText } from '../i18n/localization.ts';
import { labeledControl, selectInput } from './templateEditorDom.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

/** Visual layout controls for a Counters block; its counter definitions remain Field-owned. */
export function renderCountersBlockInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const { block, layout } = context;
  if (block.type !== 'counters') return;

  const current = normalizeCountersPerRow(layout.blocks[block.id]?.countersPerRow ?? DEFAULT_COUNTERS_PER_ROW);
  const perRow = selectInput(String(current), Array.from(
    { length: MAX_COUNTERS_PER_ROW },
    (_value, index) => ({ value: String(index + 1), label: String(index + 1) }),
  ));
  perRow.addEventListener('change', () => {
    if (setCountersPerRow(layout, block.id, Number(perRow.value))) context.render();
  });
  panel.append(labeledControl(
    translateForgeText('Counters per row', context.language),
    perRow,
    translateForgeText('Controls how many Counter tracks appear on each line.', context.language),
  ));
}
