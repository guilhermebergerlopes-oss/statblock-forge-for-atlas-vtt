/**
 * Theme and outer-frame controls shared by the template editor's Appearance tab.
 * All customization is exposed through form controls: users never need CSS snippets.
 */
import type { ForgeLayoutDocument } from '../templates/forgeTemplate.ts';
import { normalizeStatblockThemeId, STATBLOCK_THEMES, type StatblockThemePalette } from '../templates/statblockThemes.ts';
import {
  createForgeBorderPreset, makeForgeStyleId,
  type ForgeCustomBorder, type ForgeCustomTheme, type ForgeBorderStyle,
} from '../templates/styleLibrary.ts';
import { translateForgeText, type ForgeLanguage } from '../i18n/localization.ts';
import { button, checkboxInput, el, inputText, labeledControl, numberInput, selectInput } from './templateEditorDom.ts';

export interface TemplateThemeAppearanceContext {
  layout: ForgeLayoutDocument;
  language: ForgeLanguage;
  advancedOpen: boolean;
  setAdvancedOpen(open: boolean): void;
  render(): void;
  renderPreviewOnly(): void;
  confirmReset(itemName: string, onConfirm: () => void): void;
  customThemes?: readonly ForgeCustomTheme[];
  customBorders?: readonly ForgeCustomBorder[];
  saveCustomTheme?(theme: ForgeCustomTheme): void;
  deleteCustomTheme?(id: string): void;
  saveCustomBorder?(border: ForgeCustomBorder): void;
  deleteCustomBorder?(id: string): void;
  exportStylePackage?(name: string, themes: readonly ForgeCustomTheme[], borders: readonly ForgeCustomBorder[]): void;
  importStyleFile?(file: File): void;
  tokenBorderOpen?: boolean;
  setTokenBorderOpen?(open: boolean): void;
}

export interface TemplateColorControlOptions {
  name: string;
  current: string | undefined;
  language: ForgeLanguage;
  onChange(value: string | undefined): void;
  renderPreviewOnly(): void;
  description?: string;
}

export function renderForgeColorControl(options: TemplateColorControlOptions): HTMLElement {
  const { name, current, language, onChange, renderPreviewOnly } = options;
  const wrapper = el('div', 'statblock-forge__color-control');
  const label = el('label', 'statblock-forge__inline-toggle');
  const enabled = el('input');
  enabled.type = 'checkbox';
  enabled.checked = Boolean(current);
  label.append(enabled, document.createTextNode(`${translateForgeText('Customize', language)} ${translateForgeText(name, language).toLowerCase()}`));

  const color = el('input', 'statblock-forge__color');
  color.type = 'color';
  color.value = current ?? '#777777';
  color.disabled = !current;
  color.setAttribute('aria-label', translateForgeText(name, language));
  enabled.addEventListener('change', () => {
    color.disabled = !enabled.checked;
    onChange(enabled.checked ? color.value : undefined);
    renderPreviewOnly();
  });
  color.addEventListener('change', () => {
    onChange(color.value);
    renderPreviewOnly();
  });

  wrapper.append(label, color);
  return wrapper;
}

const PALETTE_FIELDS: Array<[keyof StatblockThemePalette, string]> = [
  ['background', 'Background'], ['surface', 'Surface'], ['raised', 'Raised surface'], ['border', 'Border'],
  ['accent', 'Accent'], ['accentStrong', 'Strong accent'], ['text', 'Text'], ['muted', 'Secondary text'],
];
const BORDER_OPTIONS: Array<{ value: string; label: string; style: ForgeBorderStyle }> = [
  { value: 'none', label: 'No outer border', style: 'none' },
  { value: 'solid', label: 'Solid frame', style: 'solid' },
  { value: 'double', label: 'Double frame', style: 'double' },
  { value: 'dashed', label: 'Dashed frame', style: 'dashed' },
  { value: 'dotted', label: 'Dotted frame', style: 'dotted' },
  { value: 'groove', label: 'Grooved frame', style: 'groove' },
  { value: 'ridge', label: 'Ridge frame', style: 'ridge' },
];

function copyTheme(theme: ForgeCustomTheme): ForgeCustomTheme {
  return { ...theme, palette: { ...theme.palette } };
}

function copyBorder(border: ForgeCustomBorder): ForgeCustomBorder {
  return { ...border };
}

function colorInput(value: string, label: string): HTMLInputElement {
  const input = el('input', 'statblock-forge__color');
  input.type = 'color';
  input.value = value;
  input.setAttribute('aria-label', label);
  return input;
}

export function renderTemplateThemeAppearance(context: TemplateThemeAppearanceContext): HTMLElement {
  const { layout, language, render, renderPreviewOnly } = context;
  const panel = el('div', 'statblock-forge__panel statblock-forge__theme-panel');
  const customThemes = context.customThemes ?? [];
  const customBorders = context.customBorders ?? [];
  const exchange = el('div', 'statblock-forge__style-exchange');
  const styleFileInput = el('input');
  styleFileInput.type = 'file';
  styleFileInput.accept = '.forgestyle,application/json';
  styleFileInput.hidden = true;
  styleFileInput.addEventListener('change', () => {
    const file = styleFileInput.files?.[0];
    if (file) context.importStyleFile?.(file);
    styleFileInput.value = '';
  });
  const importButton = button(translateForgeText('Import .forgestyle', language), () => styleFileInput.click());
  exchange.append(importButton, styleFileInput);
  if (customThemes.length > 0 || customBorders.length > 0) {
    exchange.append(button(translateForgeText('Export style library', language), () => {
      context.exportStylePackage?.('Forge style library', customThemes, customBorders);
    }));
  }
  panel.append(exchange);
  const themeId = normalizeStatblockThemeId(layout.themeId);
  const selectedPreset = STATBLOCK_THEMES.find((theme) => theme.id === themeId) ?? STATBLOCK_THEMES[0]!;
  const selectedCustomTheme = layout.customTheme;
  const themeOptions = [
    ...STATBLOCK_THEMES.map((theme) => ({ value: theme.id, label: translateForgeText(theme.name, language) })),
    ...customThemes.map((theme) => ({ value: `custom:${theme.id}`, label: `${translateForgeText('Custom', language)}: ${theme.name}` })),
  ];
  if (selectedCustomTheme && !customThemes.some((theme) => theme.id === selectedCustomTheme.id)) {
    themeOptions.push({ value: `custom:${selectedCustomTheme.id}`, label: `${selectedCustomTheme.name} (${translateForgeText('Template copy', language)})` });
  }
  const themeSelect = selectInput(
    selectedCustomTheme ? `custom:${selectedCustomTheme.id}` : themeId,
    themeOptions,
  );
  themeSelect.addEventListener('change', () => {
    if (themeSelect.value.startsWith('custom:')) {
      const custom = customThemes.find((theme) => theme.id === themeSelect.value.slice(7));
      if (custom) layout.customTheme = copyTheme(custom);
    } else {
      delete layout.customTheme;
      layout.themeId = normalizeStatblockThemeId(themeSelect.value);
    }
    render();
  });
  panel.append(labeledControl('Theme', themeSelect));

  const advanced = el('details', 'statblock-forge__appearance-advanced statblock-forge__theme-advanced');
  advanced.open = context.advancedOpen;
  advanced.addEventListener('toggle', () => context.setAdvancedOpen(advanced.open));
  advanced.append(el('summary', '', translateForgeText('Advanced customization', language)));
  advanced.append(el('h5', 'statblock-forge__appearance-group-heading', translateForgeText('Theme colors', language)));

  const palette: StatblockThemePalette = selectedCustomTheme
    ? { ...selectedCustomTheme.palette }
    : { ...selectedPreset.palette, ...(layout.themeOverrides?.[themeId] ?? {}) };
  const swatches = el('div', 'statblock-forge__theme-swatches');
  swatches.setAttribute('aria-label', `${selectedCustomTheme?.name ?? selectedPreset.name} palette`);
  (['background', 'surface', 'accent', 'accentStrong', 'text', 'muted'] as const).forEach((key) => {
    const chip = el('span', 'statblock-forge__theme-swatch');
    chip.setCssStyles({ backgroundColor: palette[key] });
    chip.setAttribute('aria-label', `${key}: ${palette[key]}`);
    swatches.append(chip);
  });
  advanced.append(swatches);

  const controls = el('div', 'statblock-forge__theme-color-grid');
  for (const [key, label] of PALETTE_FIELDS) {
    const control = el('label', 'statblock-forge__theme-color-control');
    control.append(el('span', 'statblock-forge__control-label', translateForgeText(label, language)));
    const color = colorInput(palette[key], translateForgeText(label, language));
    color.addEventListener('change', () => {
      if (layout.customTheme) {
        layout.customTheme = {
          ...layout.customTheme,
          palette: { ...layout.customTheme.palette, [key]: color.value.toLowerCase() },
        };
      } else {
        const current = layout.themeOverrides ?? {};
        const currentTheme = current[themeId] ?? {};
        layout.themeOverrides = {
          ...current,
          [themeId]: { ...currentTheme, [key]: color.value.toLowerCase() },
        };
      }
      renderPreviewOnly();
    });
    control.append(color);
    controls.append(control);
  }
  advanced.append(controls);

  const themeName = inputText(selectedCustomTheme?.name ?? '', translateForgeText('Name for custom theme', language));
  themeName.setAttribute('aria-label', translateForgeText('Name for custom theme', language));
  const themeActions = el('div', 'statblock-forge__style-library-actions');
  if (selectedCustomTheme) {
    themeActions.append(button(translateForgeText('Save changes to theme', language), () => {
      const updated = { ...layout.customTheme!, name: themeName.value.trim() || layout.customTheme!.name, palette: { ...layout.customTheme!.palette } };
      layout.customTheme = updated;
      context.saveCustomTheme?.(copyTheme(updated));
      render();
    }, true));
    const removeTheme = button(translateForgeText('Remove from theme library', language), () => {
      context.deleteCustomTheme?.(selectedCustomTheme.id);
      // TemplateEditorView refreshes after the confirmation callback succeeds.
    }, true);
    removeTheme.classList.add('statblock-forge__properties-utility-button', 'is-danger');
    themeActions.append(removeTheme);
  } else {
    themeActions.append(button(translateForgeText('Save as custom theme', language), () => {
      const name = themeName.value.trim();
      if (!name) {
        themeName.focus();
        return;
      }
      const theme: ForgeCustomTheme = { id: makeForgeStyleId(name), name, palette: { ...palette } };
      context.saveCustomTheme?.(copyTheme(theme));
      layout.customTheme = copyTheme(theme);
      render();
    }, true));
  }
  themeActions.append(button(translateForgeText('Export this theme', language), () => {
    const exportedTheme: ForgeCustomTheme = selectedCustomTheme
      ? copyTheme({ ...selectedCustomTheme, name: themeName.value.trim() || selectedCustomTheme.name })
      : { id: makeForgeStyleId(selectedPreset.name), name: themeName.value.trim() || selectedPreset.name, palette: { ...palette } };
    context.exportStylePackage?.(exportedTheme.name, [exportedTheme], []);
  }));
  advanced.append(labeledControl('Custom theme name', themeName), themeActions);

  const reset = button(translateForgeText('Reset', language), () => {
    context.confirmReset(translateForgeText('theme palette', language), () => {
      if (layout.customTheme) {
        const saved = customThemes.find((theme) => theme.id === layout.customTheme?.id);
        if (saved) layout.customTheme = copyTheme(saved);
        else layout.customTheme.palette = { ...selectedPreset.palette };
      } else {
        const current = { ...(layout.themeOverrides ?? {}) };
        delete current[themeId];
        layout.themeOverrides = current;
        if (Object.keys(current).length === 0) delete layout.themeOverrides;
      }
      render();
    });
  }, true);
  reset.disabled = selectedCustomTheme
    ? !customThemes.some((theme) => theme.id === selectedCustomTheme.id)
    : !layout.themeOverrides?.[themeId] || Object.keys(layout.themeOverrides[themeId] ?? {}).length === 0;
  advanced.append(reset);
  panel.append(advanced);

  // Reusable outer-frame editor. The template stores a snapshot; the plugin settings
  // store reusable copies, so deleting a library item never breaks existing templates.
  const borderSection = el('details', 'statblock-forge__appearance-advanced statblock-forge__border-library');
  borderSection.open = true;
  borderSection.append(el('summary', '', translateForgeText('Custom outer border', language)));

  const currentFrame = layout.frame;
  const frameOptions = [
    { value: 'theme', label: translateForgeText('Theme default', language) },
    ...BORDER_OPTIONS.map((option) => ({ value: option.value, label: translateForgeText(option.label, language) })),
    ...customBorders.map((border) => ({ value: `custom:${border.id}`, label: `${translateForgeText('Custom', language)}: ${border.name}` })),
  ];
  let selectedFrameValue = 'theme';
  if (currentFrame) {
    const savedBorder = customBorders.find((border) => border.id === currentFrame.id);
    selectedFrameValue = savedBorder ? `custom:${savedBorder.id}`
      : currentFrame.id.startsWith('builtin-') ? currentFrame.id.slice(8) : `snapshot:${currentFrame.id}`;
    if (selectedFrameValue.startsWith('snapshot:')) frameOptions.push({ value: selectedFrameValue, label: currentFrame.name });
  }
  const frameSelect = selectInput(selectedFrameValue, frameOptions);
  frameSelect.addEventListener('change', () => {
    if (frameSelect.value === 'theme') {
      delete layout.frame;
    } else if (frameSelect.value.startsWith('custom:')) {
      const saved = customBorders.find((border) => border.id === frameSelect.value.slice(7));
      if (saved) layout.frame = copyBorder(saved);
    } else if (frameSelect.value.startsWith('snapshot:')) {
      // The current snapshot is deliberately kept intact when its library record was removed.
    } else {
      const selected = BORDER_OPTIONS.find((option) => option.value === frameSelect.value);
      if (selected) {
        const borderColor = layout.customTheme?.palette.border
          ?? layout.themeOverrides?.[themeId]?.border
          ?? selectedPreset.palette.border;
        layout.frame = createForgeBorderPreset(`builtin-${selected.value}`, selected.label, selected.style, borderColor);
      }
    }
    render();
  });
  borderSection.append(labeledControl('Outer border preset', frameSelect));

  if (layout.frame) {
    const frame = layout.frame;
    const borderControls = el('div', 'statblock-forge__theme-color-grid');
    const borderColor = colorInput(frame.color, translateForgeText('Border color', language));
    borderColor.addEventListener('change', () => { frame.color = borderColor.value.toLowerCase(); renderPreviewOnly(); });
    borderControls.append(labeledControl('Border color', borderColor));
    const innerColor = colorInput(frame.innerColor, translateForgeText('Inner line color', language));
    innerColor.disabled = !frame.inner;
    innerColor.addEventListener('change', () => { frame.innerColor = innerColor.value.toLowerCase(); renderPreviewOnly(); });
    borderControls.append(labeledControl('Inner line color', innerColor));
    const width = numberInput(frame.width, 0, 16, 0.5);
    width.addEventListener('change', () => { frame.width = Math.max(0, Math.min(16, Number(width.value) || 0)); renderPreviewOnly(); });
    borderControls.append(labeledControl('Border thickness (px)', width));
    const radius = numberInput(frame.radius, 0, 48, 1);
    radius.addEventListener('change', () => { frame.radius = Math.max(0, Math.min(48, Number(radius.value) || 0)); renderPreviewOnly(); });
    borderControls.append(labeledControl('Corner radius (px)', radius));
    const inner = checkboxInput(frame.inner, (value) => {
      frame.inner = value;
      innerColor.disabled = !value;
      innerWidth.disabled = !value;
      innerGap.disabled = !value;
      renderPreviewOnly();
    });
    borderControls.append(labeledControl('Add inner border', inner));
    const innerWidth = numberInput(frame.innerWidth, 0, 8, 0.5);
    innerWidth.disabled = !frame.inner;
    innerWidth.addEventListener('change', () => { frame.innerWidth = Math.max(0, Math.min(8, Number(innerWidth.value) || 0)); renderPreviewOnly(); });
    borderControls.append(labeledControl('Inner border thickness (px)', innerWidth));
    const innerGap = numberInput(frame.innerGap, 0, 24, 1);
    innerGap.disabled = !frame.inner;
    innerGap.addEventListener('change', () => { frame.innerGap = Math.max(0, Math.min(24, Number(innerGap.value) || 0)); renderPreviewOnly(); });
    borderControls.append(labeledControl('Space between borders (px)', innerGap));
    borderSection.append(borderControls);

    const borderName = inputText(frame.name, translateForgeText('Name for custom border', language));
    borderName.setAttribute('aria-label', translateForgeText('Name for custom border', language));
    const borderActions = el('div', 'statblock-forge__style-library-actions');
    if (customBorders.some((border) => border.id === frame.id)) {
      borderActions.append(button(translateForgeText('Save changes to border', language), () => {
        const updated = { ...frame, name: borderName.value.trim() || frame.name };
        layout.frame = updated;
        context.saveCustomBorder?.(copyBorder(updated));
        render();
      }, true));
      const removeBorder = button(translateForgeText('Remove from border library', language), () => {
        context.deleteCustomBorder?.(frame.id);
        // TemplateEditorView refreshes after the confirmation callback succeeds.
      }, true);
      removeBorder.classList.add('statblock-forge__properties-utility-button', 'is-danger');
      borderActions.append(removeBorder);
    } else {
      borderActions.append(button(translateForgeText('Save as custom border', language), () => {
        const name = borderName.value.trim();
        if (!name) {
          borderName.focus();
          return;
        }
        const saved: ForgeCustomBorder = { ...frame, id: makeForgeStyleId(name), name };
        context.saveCustomBorder?.(copyBorder(saved));
        layout.frame = copyBorder(saved);
        render();
      }, true));
    }
    borderActions.append(button(translateForgeText('Export this border', language), () => {
      const exportedBorder = copyBorder({ ...frame, name: borderName.value.trim() || frame.name });
      context.exportStylePackage?.(exportedBorder.name, [], [exportedBorder]);
    }));
    borderSection.append(labeledControl('Custom border name', borderName), borderActions);
    const borderPreview = el('div', 'statblock-forge__frame-preview');
    borderPreview.setCssStyles({ border: `${frame.width}px ${frame.style} ${frame.color}` });
    borderPreview.setCssStyles({ borderRadius: `${frame.radius}px` });
    if (frame.inner) borderPreview.setCssStyles({ boxShadow: `inset 0 0 0 ${frame.innerWidth}px ${frame.innerColor}, inset 0 0 0 ${frame.innerWidth + frame.innerGap}px transparent` });
    borderPreview.setAttribute('aria-label', translateForgeText('Border preview', language));
    borderSection.append(borderPreview);
  }
  panel.append(borderSection);

  // The header Token art is not a regular Image block. Give it its own frame controls
  // so the decorative token rim can be styled without changing the token image itself.
  const tokenAppearance = layout.tokenAppearance ?? (layout.tokenAppearance = { enabled: false });
  const tokenGroup = el('details', 'statblock-forge__appearance-advanced statblock-forge__token-appearance');
  tokenGroup.open = context.tokenBorderOpen ?? false;
  tokenGroup.addEventListener('toggle', () => context.setTokenBorderOpen?.(tokenGroup.open));
  tokenGroup.append(el('summary', '', translateForgeText('Token border', language)));
  const enabledRow = el('label', 'statblock-forge__inline-toggle');
  const enabled = el('input');
  enabled.type = 'checkbox';
  enabled.checked = tokenAppearance.enabled === true;
  enabledRow.append(enabled, document.createTextNode(translateForgeText('Customize token border', language)));
  tokenGroup.append(enabledRow);

  const preset = selectInput(tokenAppearance.borderPreset ?? 'default', [
    { value: 'default', label: translateForgeText('Default', language) },
    { value: 'double', label: translateForgeText('Double', language) },
    { value: 'oval', label: translateForgeText('Oval', language) },
    { value: 'diamond', label: translateForgeText('Diamond', language) },
    { value: 'regular-hexagon', label: translateForgeText('Regular hexagon', language) },
    { value: 'triangle-up', label: translateForgeText('Triangle up', language) },
    { value: 'triangle-right', label: translateForgeText('Triangle right', language) },
    { value: 'triangle-down', label: translateForgeText('Triangle down', language) },
    { value: 'triangle-left', label: translateForgeText('Triangle left', language) },
    { value: 'pointed', label: translateForgeText('Pointed', language) },
    { value: 'angular', label: translateForgeText('Angular', language) },
    { value: 'hexagonal', label: translateForgeText('Hexagonal', language) },
    { value: 'shield', label: translateForgeText('Shield', language) },
  ]);
  preset.disabled = !enabled.checked;
  preset.addEventListener('change', () => {
    tokenAppearance.borderPreset = preset.value as NonNullable<typeof tokenAppearance.borderPreset>;
    if (tokenAppearance.borderWidth === undefined) tokenAppearance.borderWidth = preset.value === 'double' ? 3 : 2;
    width.value = String(tokenAppearance.borderWidth);
    renderPreviewOnly();
  });
  tokenGroup.append(labeledControl('Border shape', preset));

  const color = el('input', 'statblock-forge__color');
  color.type = 'color';
  color.value = tokenAppearance.borderColor ?? palette.accent;
  color.disabled = !enabled.checked;
  color.setAttribute('aria-label', translateForgeText('Token border color', language));
  color.addEventListener('change', () => { tokenAppearance.borderColor = color.value.toLowerCase(); renderPreviewOnly(); });
  tokenGroup.append(labeledControl('Border color', color));

  const width = numberInput(tokenAppearance.borderWidth ?? (tokenAppearance.borderPreset === 'double' ? 3 : 2), 1, 12, 0.5);
  width.disabled = !enabled.checked;
  width.addEventListener('change', () => {
    tokenAppearance.borderWidth = Math.max(1, Math.min(12, Number(width.value) || 1));
    renderPreviewOnly();
  });
  tokenGroup.append(labeledControl('Thickness (px)', width));
  enabled.addEventListener('change', () => {
    tokenAppearance.enabled = enabled.checked;
    preset.disabled = !enabled.checked;
    color.disabled = !enabled.checked;
    width.disabled = !enabled.checked;
    renderPreviewOnly();
  });
  panel.append(tokenGroup);
  return panel;
}
