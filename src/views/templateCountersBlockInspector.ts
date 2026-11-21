import { DEFAULT_COUNTERS_PER_ROW, normalizeCountersPerRow, setCountersPerRow } from '../templates/counterLayoutModel.ts';
import { translateForgeText } from '../i18n/localization.ts';
import { labeledControl, numberInput } from './templateEditorDom.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

/** Visual layout controls for a Counters block; its counter definitions remain Field-owned. */
export function renderCountersBlockInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const { block, layout } = context;
  if (block.type !== 'counters') return;

  const current = normalizeCountersPerRow(layout.blocks[block.id]?.countersPerRow ?? DEFAULT_COUNTERS_PER_ROW);
  const perRow = numberInput(current, 1, undefined, 1);
  perRow.setAttribute('aria-label', translateForgeText('Counters per row', context.language));
  perRow.addEventListener('change', () => {
    const entered = perRow.valueAsNumber;
    if (!Number.isFinite(entered) || entered < 1) {
      perRow.value = String(current);
      return;
    }
    if (setCountersPerRow(layout, block.id, entered)) context.render();
    else perRow.value = String(normalizeCountersPerRow(layout.blocks[block.id]?.countersPerRow ?? current));
  });
  panel.append(labeledControl(
    translateForgeText('Counters per row', context.language),
    perRow,
    translateForgeText('Controls how many Counter tracks appear on each line.', context.language),
  ));
}
