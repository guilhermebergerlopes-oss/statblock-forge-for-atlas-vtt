import { translateForgeText } from '../i18n/localization.ts';
import { numericFieldTracks, setNumericFieldMaximum, setNumericFieldTracking, trackBlockForNumericField } from '../templates/numericTrackingModel.ts';
import type { ForgeBlock, ForgeField, ForgeTemplate } from '../templates/forgeTemplate.ts';
import type { ForgeLanguage } from '../i18n/localization.ts';
import { el, labeledControl, selectInput } from './templateEditorDom.ts';

interface NumericTrackingContext {
  template: ForgeTemplate;
  language: ForgeLanguage;
  render(): void;
  renderPreviewOnly(): void;
}

export interface NumericTrackingOptions {
  /** Names each control after the field when a Metric contains several numbers. */
  named?: boolean;
  /** The Track tile currently displaying this number, if the selected block is a Track. */
  trackBlock?: ForgeBlock | null;
}

/** Renders the same per-Number tracking controls used by Atlas Value and Metric options. */
export function renderNumericTrackingControls(
  context: NumericTrackingContext,
  field: ForgeField,
  panel: HTMLElement,
  options: NumericTrackingOptions = {},
): void {
  if (field.type !== 'number') return;
  const currentTrack = options.trackBlock ?? null;
  const externalTrack = currentTrack ?? trackBlockForNumericField(context.template, field.key);
  const tracks = numericFieldTracks(field, externalTrack);
  const name = field.label.trim() || field.key;
  const translate = (value: string): string => translateForgeText(value, context.language);

  // A second Track tile already makes this Field a resource; Atlas displays a
  // note instead of a conflicting, duplicated tracking editor.
  if (!options.trackBlock && !isRecordTracks(field.tracks) && externalTrack) {
    return;
  }

  const modeOptions = [
    ...(!currentTrack ? [{ value: 'off', label: translate('Off') }] : []),
    { value: 'down', label: translate('Counts down') },
    { value: 'up', label: translate('Counts up') },
  ];
  const mode = selectInput(tracks?.counts ?? (currentTrack?.counts === 'up' ? 'up' : currentTrack ? 'down' : 'off'), modeOptions);
  const trackingLabel = options.named ? `${name}: ${translate('Tracking')}` : translate('Tracking');
  mode.addEventListener('change', () => {
    if (!setNumericFieldTracking(context.template, field.key, mode.value as 'off' | 'up' | 'down', currentTrack?.id)) return;
    context.render();
  });
  panel.append(labeledControl(trackingLabel, mode));

  if (tracks) {
    const maxOptions = [
      { value: '', label: translate('This value') },
      ...context.template.fields
        .filter((candidate) => candidate.type === 'number' && candidate.key !== field.key)
        .map((candidate) => ({ value: candidate.key, label: candidate.label.trim() || candidate.key })),
    ];
    const selectedMax = typeof tracks.max === 'string' ? tracks.max : '';
    if (selectedMax && !maxOptions.some((option) => option.value === selectedMax)) {
      maxOptions.push({ value: selectedMax, label: `${translate('Missing field')}: ${selectedMax}` });
    }
    const maximum = selectInput(selectedMax, maxOptions);
    const maximumLabel = options.named ? `${translate('Maximum for')} ${name}` : translate('Maximum');
    maximum.addEventListener('change', () => {
      if (setNumericFieldMaximum(context.template, field.key, maximum.value || null, currentTrack?.id)) context.renderPreviewOnly();
    });
    panel.append(labeledControl(maximumLabel, maximum));
    const hasSeparateMaximum = context.template.fields.some((candidate) =>
      candidate.type === 'number' && candidate.key !== field.key);
    const hint = context.language === 'pt-BR'
      ? hasSeparateMaximum
        ? 'A quantidade de boxes acompanha o valor do Field escolhido. “Este valor” usa o próprio Field; escolha outro Number para definir um máximo separado.'
        : 'Para definir a quantidade de boxes separadamente, adicione outro Field do tipo Number e escolha-o aqui em Maximum. O valor desse Field será a quantidade de boxes.'
      : hasSeparateMaximum
        ? 'The number of boxes follows the selected Field. “This value” uses this Field; choose another Number to set a separate maximum.'
        : 'To set the number of boxes separately, add another Number Field and choose it here under Maximum. Its value becomes the number of boxes.';
    panel.append(el('small', 'statblock-forge__hint', hint));
  }
}

function isRecordTracks(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
