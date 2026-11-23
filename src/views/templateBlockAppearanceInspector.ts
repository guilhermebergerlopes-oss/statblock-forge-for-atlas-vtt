/** Compact per-block appearance controls for the Forge template Inspector. */
import type { BlockAppearance, ForgeBlockLayout } from '../templates/forgeTemplate.ts';
import { translateForgeText } from '../i18n/localization.ts';
import { resolveBlockAppearanceForMode } from '../templates/blockAppearance.ts';
import { copyBlockAppearance, hasCopiedBlockAppearance, pasteBlockAppearance } from '../templates/blockAppearanceClipboard.ts';
import { checkboxInput, collapsibleAppearanceGroup, button, el, labeledControl, numberInput, selectInput, toggleControl } from './templateEditorDom.ts';
import { renderForgeColorControl } from './templateAppearanceEditor.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

export type BlockAppearanceSectionKey = 'surface' | 'text' | 'indicators';

type TypographyScope = 'text' | 'label' | 'value';
type TypographyProperty = 'fontSize' | 'fontWeight' | 'fontStyle' | 'textDecoration' | 'letterSpacing' | 'lineHeight';

function typographyKey(scope: TypographyScope, property: TypographyProperty): string {
  if (scope === 'text') return property;
  return `${scope}${property[0]!.toUpperCase()}${property.slice(1)}`;
}

/** Adds optional typography controls without seeding overrides on untouched fields. */
export function appendTypographyControls(
  parent: HTMLElement,
  title: string,
  scope: TypographyScope,
  appearance: BlockAppearance,
  context: Pick<TemplateBlockInspectorContext, 'language' | 'renderPreviewOnly'>,
  disclosureKey?: string,
): void {
  const record = appearance as unknown as Record<string, unknown>;
  const group = collapsibleAppearanceGroup(title, undefined, false);
  if (disclosureKey) group.dataset.forgeDisclosureKey = disclosureKey;
  const sizeKey = typographyKey(scope, 'fontSize');
  const currentSize = typeof record[sizeKey] === 'number' ? Number(record[sizeKey]) : undefined;
  const size = numberInput(currentSize ?? 14, 8, 48);
  size.disabled = currentSize === undefined;
  size.setAttribute('aria-label', `${title} font size`);
  const sizeEnabled = checkboxInput(currentSize !== undefined, (enabled) => {
    if (enabled) {
      record[sizeKey] = 14;
      size.value = '14';
    } else {
      delete record[sizeKey];
    }
    size.disabled = !enabled;
    context.renderPreviewOnly();
  });
  const sizeToggle = el('label', 'statblock-forge__inline-toggle');
  sizeToggle.append(sizeEnabled, document.createTextNode(translateForgeText('Customize font size', context.language)));
  size.addEventListener('change', () => {
    const parsed = Number(size.value);
    if (Number.isFinite(parsed)) record[sizeKey] = Math.max(8, Math.min(48, parsed));
    context.renderPreviewOnly();
  });
  group.append(labeledControl(translateForgeText('Font size (px)', context.language), size), sizeToggle);

  const weightKey = typographyKey(scope, 'fontWeight');
  const weight = selectInput(String(record[weightKey] ?? 'inherit'), [
    { value: 'inherit', label: translateForgeText('Theme default', context.language) },
    { value: '400', label: translateForgeText('Normal', context.language) },
    { value: '500', label: translateForgeText('Medium', context.language) },
    { value: '600', label: translateForgeText('Semi-bold', context.language) },
    { value: '700', label: translateForgeText('Bold', context.language) },
  ]);
  weight.addEventListener('change', () => {
    if (weight.value === 'inherit') delete record[weightKey];
    else record[weightKey] = weight.value;
    context.renderPreviewOnly();
  });
  group.append(labeledControl(translateForgeText('Font weight', context.language), weight));

  const styleKey = typographyKey(scope, 'fontStyle');
  const fontStyle = selectInput(String(record[styleKey] ?? 'inherit'), [
    { value: 'inherit', label: translateForgeText('Theme default', context.language) },
    { value: 'normal', label: translateForgeText('Normal', context.language) },
    { value: 'italic', label: translateForgeText('Italic', context.language) },
  ]);
  fontStyle.addEventListener('change', () => {
    if (fontStyle.value === 'inherit') delete record[styleKey];
    else record[styleKey] = fontStyle.value;
    context.renderPreviewOnly();
  });
  group.append(labeledControl(translateForgeText('Font style', context.language), fontStyle));

  const decorationKey = typographyKey(scope, 'textDecoration');
  const decoration = selectInput(String(record[decorationKey] ?? 'inherit'), [
    { value: 'inherit', label: translateForgeText('Theme default', context.language) },
    { value: 'none', label: translateForgeText('None', context.language) },
    { value: 'underline', label: translateForgeText('Underline', context.language) },
    { value: 'line-through', label: translateForgeText('Strikethrough', context.language) },
  ]);
  decoration.addEventListener('change', () => {
    if (decoration.value === 'inherit') delete record[decorationKey];
    else record[decorationKey] = decoration.value;
    context.renderPreviewOnly();
  });
  group.append(labeledControl(translateForgeText('Text decoration', context.language), decoration));

  const spacingKey = typographyKey(scope, 'letterSpacing');
  const currentSpacing = typeof record[spacingKey] === 'number' ? Number(record[spacingKey]) : undefined;
  const spacing = numberInput(currentSpacing ?? 0, -1, 8, 0.1);
  spacing.disabled = currentSpacing === undefined;
  spacing.setAttribute('aria-label', `${title} letter spacing`);
  const spacingEnabled = checkboxInput(currentSpacing !== undefined, (enabled) => {
    if (enabled) {
      record[spacingKey] = 0;
      spacing.value = '0';
    } else {
      delete record[spacingKey];
    }
    spacing.disabled = !enabled;
    context.renderPreviewOnly();
  });
  const spacingToggle = el('label', 'statblock-forge__inline-toggle');
  spacingToggle.append(spacingEnabled, document.createTextNode(translateForgeText('Customize letter spacing', context.language)));
  spacing.addEventListener('change', () => {
    const parsed = Number(spacing.value);
    if (Number.isFinite(parsed)) record[spacingKey] = Math.max(-1, Math.min(8, parsed));
    context.renderPreviewOnly();
  });
  group.append(labeledControl(translateForgeText('Letter spacing (px)', context.language), spacing), spacingToggle);

  // Unitless line-height controls the distance between baselines and scales
  // with the effective font size. An unset value inherits the selected theme.
  const lineHeightKey = typographyKey(scope, 'lineHeight');
  const currentLineHeight = typeof record[lineHeightKey] === 'number' ? Number(record[lineHeightKey]) : undefined;
  const lineHeight = numberInput(currentLineHeight ?? 1.4, 0.8, 3, 0.1);
  lineHeight.disabled = currentLineHeight === undefined;
  lineHeight.setAttribute('aria-label', `${title} line spacing`);
  const lineHeightEnabled = checkboxInput(currentLineHeight !== undefined, (enabled) => {
    if (enabled) {
      record[lineHeightKey] = 1.4;
      lineHeight.value = '1.4';
    } else {
      delete record[lineHeightKey];
    }
    lineHeight.disabled = !enabled;
    context.renderPreviewOnly();
  });
  const lineHeightToggle = el('label', 'statblock-forge__inline-toggle');
  lineHeightToggle.append(lineHeightEnabled, document.createTextNode(translateForgeText('Customize line spacing', context.language)));
  lineHeight.addEventListener('change', () => {
    const parsed = Number(lineHeight.value);
    if (Number.isFinite(parsed)) record[lineHeightKey] = Math.round(Math.max(0.8, Math.min(3, parsed)) * 10) / 10;
    context.renderPreviewOnly();
  });
  group.append(labeledControl(translateForgeText('Line spacing (×)', context.language), lineHeight), lineHeightToggle);
  parent.append(group);
}

export interface TemplateBlockAppearanceInspectorOptions {
  context: TemplateBlockInspectorContext;
  metadata: ForgeBlockLayout;
  advancedOpen: boolean;
  setAdvancedOpen(open: boolean): void;
  hasNumericTracking: boolean;
  sectionsOpen: Partial<Record<BlockAppearanceSectionKey, boolean>>;
  setSectionOpen(section: BlockAppearanceSectionKey, open: boolean): void;
}

export function renderBlockAppearanceInspector(options: TemplateBlockAppearanceInspectorOptions): HTMLElement {
  const { context, metadata, advancedOpen, setAdvancedOpen, hasNumericTracking, sectionsOpen, setSectionOpen } = options;
  const { block } = context;
  const appearance = metadata.appearanceMode === 'custom'
    ? (metadata.appearance = resolveBlockAppearanceForMode(metadata.appearance, 'custom'))
    : (metadata.appearance ?? (metadata.appearance = {}));
  const advanced = el('details', 'statblock-forge__appearance-advanced statblock-forge__block-appearance-advanced');
  advanced.open = advancedOpen;
  advanced.addEventListener('toggle', () => setAdvancedOpen(advanced.open));
  advanced.append(el('summary', '', translateForgeText('Block appearance', context.language)));

  const appearanceActions = el('div', 'statblock-forge__block-appearance-copy-actions');
  const pasteAppearance = button(translateForgeText('Paste appearance', context.language), () => {
    if (!pasteBlockAppearance(metadata)) return;
    context.showNotice(translateForgeText('Block appearance pasted. Content and layout were not changed.', context.language));
    context.render();
  }, true);
  pasteAppearance.classList.add('statblock-forge__properties-utility-button');
  pasteAppearance.disabled = !hasCopiedBlockAppearance();
  pasteAppearance.title = translateForgeText('Apply the copied visual settings to this block.', context.language);
  const copyAppearance = button(translateForgeText('Copy appearance', context.language), () => {
    copyBlockAppearance(metadata);
    pasteAppearance.disabled = false;
    context.showNotice(translateForgeText('Block appearance copied.', context.language));
  }, true);
  copyAppearance.classList.add('statblock-forge__properties-utility-button');
  copyAppearance.title = translateForgeText('Copy only this block’s visual settings.', context.language);
  appearanceActions.append(copyAppearance, pasteAppearance);
  advanced.append(appearanceActions);

  const customAppearance = toggleControl(translateForgeText('Custom appearance', context.language), metadata.appearanceMode === 'custom', (enabled) => {
    if (enabled && metadata.appearanceMode !== 'custom') {
      metadata.appearance = resolveBlockAppearanceForMode(metadata.appearance, 'custom');
    }
    metadata.appearanceMode = enabled ? 'custom' : 'theme';
    if (enabled) setAdvancedOpen(true);
    context.render();
  });
  customAppearance.className += ' statblock-forge__custom-appearance-toggle';
  advanced.append(customAppearance);

  if (metadata.appearanceMode === 'custom') {
    const renderColor = (
      name: string,
      current: string | undefined,
      onChange: (value: string | undefined) => void,
    ): HTMLElement => renderForgeColorControl({
      name,
      current,
      language: context.language,
      onChange,
      renderPreviewOnly: context.renderPreviewOnly,
    });

    const surfaceGroup = collapsibleAppearanceGroup('Surface', undefined, sectionsOpen.surface ?? false);
    surfaceGroup.addEventListener('toggle', () => setSectionOpen('surface', surfaceGroup.open));
    const shape = selectInput(appearance.shape ?? 'rounded', [
      { value: 'square', label: translateForgeText('Square', context.language) },
      { value: 'rounded', label: translateForgeText('Rounded', context.language) },
      { value: 'oval', label: translateForgeText('Oval', context.language) },
    ]);
    shape.addEventListener('change', () => { appearance.shape = shape.value as BlockAppearance['shape']; context.renderPreviewOnly(); });
    surfaceGroup.append(labeledControl('Corner shape', shape));
    surfaceGroup.append(renderColor('Background', appearance.background, (value) => { appearance.background = value; }));

    const backgroundOpacity = numberInput(appearance.backgroundOpacity ?? 100, 0, 100);
    backgroundOpacity.addEventListener('change', () => {
      appearance.backgroundOpacity = Math.max(0, Math.min(100, Number(backgroundOpacity.value) || 0));
      context.renderPreviewOnly();
    });
    surfaceGroup.append(labeledControl('Opacity (%)', backgroundOpacity));
    surfaceGroup.append(renderColor('Border', appearance.borderColor, (value) => { appearance.borderColor = value; }));

    const borderPreset = selectInput(appearance.borderPreset ?? 'default', [
      { value: 'default', label: translateForgeText('Default', context.language) },
      { value: 'double', label: translateForgeText('Double', context.language) },
      { value: 'oval', label: translateForgeText('Oval', context.language) },
      { value: 'diamond', label: translateForgeText('Diamond', context.language) },
      { value: 'regular-hexagon', label: translateForgeText('Regular hexagon', context.language) },
      { value: 'triangle-up', label: translateForgeText('Triangle up', context.language) },
      { value: 'triangle-right', label: translateForgeText('Triangle right', context.language) },
      { value: 'triangle-down', label: translateForgeText('Triangle down', context.language) },
      { value: 'triangle-left', label: translateForgeText('Triangle left', context.language) },
      { value: 'pointed', label: translateForgeText('Pointed', context.language) },
      { value: 'angular', label: translateForgeText('Angular', context.language) },
      { value: 'hexagonal', label: translateForgeText('Hexagonal', context.language) },
      { value: 'shield', label: translateForgeText('Shield', context.language) },
    ]);
    surfaceGroup.append(labeledControl('Border shape', borderPreset));

    const borderStyle = selectInput(appearance.borderStyle ?? 'solid', [
      { value: 'solid', label: 'Solid' }, { value: 'dashed', label: 'Dashed' },
      { value: 'dotted', label: 'Dotted' }, { value: 'double', label: 'Double' }, { value: 'none', label: 'None' },
    ]);
    borderStyle.disabled = appearance.borderPreset !== undefined && appearance.borderPreset !== 'default';
    borderStyle.addEventListener('change', () => { appearance.borderStyle = borderStyle.value as BlockAppearance['borderStyle']; context.renderPreviewOnly(); });
    const borderWidth = numberInput(appearance.borderWidth ?? (appearance.borderPreset === 'double' ? 3 : 1), 0, 16, 0.5);
    borderWidth.addEventListener('change', () => {
      appearance.borderWidth = Math.max(0, Math.min(16, Number(borderWidth.value) || 0));
      context.renderPreviewOnly();
    });
    surfaceGroup.append(labeledControl('Border style', borderStyle), labeledControl('Thickness (px)', borderWidth));

    const cornerRadius = numberInput(appearance.cornerRadius ?? (appearance.shape === 'square' ? 0 : 14), 0, 100);
    cornerRadius.addEventListener('change', () => {
      appearance.cornerRadius = Math.max(0, Math.min(100, Number(cornerRadius.value) || 0));
      context.renderPreviewOnly();
    });
    const updateBorderControlState = (): void => {
      const geometric = ['oval', 'diamond', 'regular-hexagon', 'triangle-up', 'triangle-right', 'triangle-down', 'triangle-left', 'pointed', 'angular', 'hexagonal', 'shield'].includes(appearance.borderPreset ?? 'default');
      shape.disabled = geometric;
      cornerRadius.disabled = geometric;
      borderStyle.disabled = appearance.borderPreset !== undefined && appearance.borderPreset !== 'default';
      borderStyle.value = appearance.borderPreset === 'double' ? 'double' : appearance.borderStyle ?? 'solid';
    };
    borderPreset.addEventListener('change', () => {
      appearance.borderPreset = borderPreset.value as BlockAppearance['borderPreset'];
      if (appearance.borderWidth === undefined) borderWidth.value = appearance.borderPreset === 'double' ? '3' : '1';
      updateBorderControlState();
      context.renderPreviewOnly();
    });
    updateBorderControlState();
    if (appearance.shape === 'rounded') surfaceGroup.append(labeledControl('Corner radius (px)', cornerRadius));
    surfaceGroup.append(renderColor('Shadow', appearance.shadowColor, (value) => { appearance.shadowColor = value; }));

    const shadowBlur = numberInput(appearance.shadowBlur ?? 0, 0, 64);
    shadowBlur.addEventListener('change', () => { appearance.shadowBlur = Math.max(0, Math.min(64, Number(shadowBlur.value) || 0)); context.renderPreviewOnly(); });
    const shadowOffsetX = numberInput(appearance.shadowOffsetX ?? 0, -32, 32);
    shadowOffsetX.addEventListener('change', () => { appearance.shadowOffsetX = Math.max(-32, Math.min(32, Number(shadowOffsetX.value) || 0)); context.renderPreviewOnly(); });
    const shadowOffsetY = numberInput(appearance.shadowOffsetY ?? 2, -32, 32);
    shadowOffsetY.addEventListener('change', () => { appearance.shadowOffsetY = Math.max(-32, Math.min(32, Number(shadowOffsetY.value) || 0)); context.renderPreviewOnly(); });
    const shadowSpread = numberInput(appearance.shadowSpread ?? 0, -16, 32);
    shadowSpread.addEventListener('change', () => { appearance.shadowSpread = Math.max(-16, Math.min(32, Number(shadowSpread.value) || 0)); context.renderPreviewOnly(); });
    const shadowOpacity = numberInput(appearance.shadowOpacity ?? 55, 0, 100);
    shadowOpacity.addEventListener('change', () => { appearance.shadowOpacity = Math.max(0, Math.min(100, Number(shadowOpacity.value) || 0)); context.renderPreviewOnly(); });
    surfaceGroup.append(
      labeledControl('Blur (px)', shadowBlur),
      labeledControl('Horizontal offset (px)', shadowOffsetX),
      labeledControl('Vertical offset (px)', shadowOffsetY),
      labeledControl('Spread (px)', shadowSpread),
      labeledControl('Opacity (%)', shadowOpacity),
    );
    advanced.append(surfaceGroup);

    const textGroup = collapsibleAppearanceGroup('Text', undefined, sectionsOpen.text ?? false);
    textGroup.addEventListener('toggle', () => setSectionOpen('text', textGroup.open));
    textGroup.append(
      renderColor('Text', appearance.textColor, (value) => { appearance.textColor = value; }),
      renderColor('Labels', appearance.labelColor, (value) => { appearance.labelColor = value; }),
      renderColor('Values', appearance.valueColor, (value) => { appearance.valueColor = value; }),
    );
    const align = selectInput(appearance.textAlign ?? 'start', [
      { value: 'start', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'Right' },
    ]);
    align.addEventListener('change', () => { appearance.textAlign = align.value as BlockAppearance['textAlign']; context.renderPreviewOnly(); });
    const verticalAlign = selectInput(appearance.verticalAlign ?? 'center', [
      { value: 'start', label: 'Top' }, { value: 'center', label: 'Middle' }, { value: 'end', label: 'Bottom' },
    ]);
    verticalAlign.addEventListener('change', () => { appearance.verticalAlign = verticalAlign.value as BlockAppearance['verticalAlign']; context.renderPreviewOnly(); });
    const padding = numberInput(appearance.padding ?? 0, 0, 96);
    padding.addEventListener('change', () => { appearance.padding = Math.max(0, Math.min(96, Number(padding.value) || 0)); context.renderPreviewOnly(); });
    textGroup.append(
      labeledControl('Horizontal alignment', align),
      labeledControl('Vertical alignment', verticalAlign),
      labeledControl('Padding (px)', padding),
    );
    appendTypographyControls(textGroup, translateForgeText('All text', context.language), 'text', appearance, context, `block-typography:${block.id}:text`);
    appendTypographyControls(textGroup, translateForgeText('Labels', context.language), 'label', appearance, context, `block-typography:${block.id}:label`);
    appendTypographyControls(textGroup, translateForgeText('Values', context.language), 'value', appearance, context, `block-typography:${block.id}:value`);
    advanced.append(textGroup);

    if (block.type === 'track' || block.type === 'counters' || hasNumericTracking) {
      const indicatorGroup = collapsibleAppearanceGroup('Indicators', undefined, sectionsOpen.indicators ?? false);
      indicatorGroup.addEventListener('toggle', () => setSectionOpen('indicators', indicatorGroup.open));
      indicatorGroup.append(
        renderColor('Filled marks', appearance.trackFillColor, (value) => { appearance.trackFillColor = value; }),
        renderColor('Empty marks', appearance.trackEmptyColor, (value) => { appearance.trackEmptyColor = value; }),
        renderColor('Outline', appearance.trackBorderColor, (value) => { appearance.trackBorderColor = value; }),
      );
      advanced.append(indicatorGroup);
    }

    const resetAppearance = button(translateForgeText('Reset', context.language), () => {
      context.confirmReset(translateForgeText('block appearance', context.language), () => {
        metadata.appearance = {};
        metadata.appearanceMode = 'theme';
        context.render();
      });
    }, true);
    resetAppearance.classList.add('statblock-forge__properties-utility-button');
    advanced.append(resetAppearance);
  }

  return advanced;
}
