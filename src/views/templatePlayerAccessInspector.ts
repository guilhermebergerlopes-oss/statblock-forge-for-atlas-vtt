import { playerAccessSetting, withPlayerAccess, type PlayerAccess } from '../templates/playerSettingsModel.ts';
import { translateForgeText } from '../i18n/localization.ts';
import type { ForgeBlockLayout } from '../templates/forgeTemplate.ts';
import { labeledControl, selectInput } from './templateEditorDom.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

type PlayerAccessChoice = PlayerAccess | 'total-hidden';

export function renderPlayerAccessInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const setting = playerAccessSetting(context.template, context.block);
  if (!setting) return;

  const totalHidden = context.layout.blocks[context.block.id]?.visibility === 'total-hidden';
  const accessLabels: Record<PlayerAccessChoice, string> = {
    edit: 'Players can edit',
    read: 'Players can only read',
    hidden: 'Hidden from players',
    'total-hidden': 'Total Hidden',
  };
  const access = selectInput(
    totalHidden ? 'total-hidden' : setting.value,
    [
      ...setting.choices.map((value) => ({ value, label: translateForgeText(accessLabels[value], context.language) })),
      { value: 'total-hidden', label: translateForgeText('Total Hidden', context.language) },
    ],
  );
  access.addEventListener('change', () => {
    const selected = access.value as PlayerAccessChoice;
    const metadata: ForgeBlockLayout = context.layout.blocks[context.block.id] ?? {
      span: 12,
      rows: 1,
      appearance: {},
      appearanceMode: 'theme' as const,
    };

    if (selected === 'total-hidden') {
      // Atlas must also consider the represented Fields unavailable to players.
      context.setTemplate(withPlayerAccess(context.template, setting.keys, 'hidden'));
      metadata.visibility = 'total-hidden';
    } else {
      context.setTemplate(withPlayerAccess(context.template, setting.keys, selected));
      delete metadata.visibility;
    }
    context.layout.blocks[context.block.id] = metadata;
    context.renderPreviewOnly();
  });

  panel.append(labeledControl(
    translateForgeText('Players', context.language),
    access,
    translateForgeText(
      'Hidden from players keeps the block in the final statblock. Total Hidden also removes it from the final statblock.',
      context.language,
    ),
  ));
}
