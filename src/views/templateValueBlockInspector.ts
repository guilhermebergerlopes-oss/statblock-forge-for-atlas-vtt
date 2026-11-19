import { isRecord, type ForgeBlock, type ForgeTemplate } from '../templates/forgeTemplate.ts';
import { setTemplateSampleImage } from '../templates/imageFieldModel.ts';
import { setPairsDisplay, setStatDisplay, setStatFlag, setValueDisplayMode, setValueBlockFlag, valueDisplayMode } from '../templates/valueEditorModel.ts';
import { button, el, labeledControl, numberInput, selectInput, textareaInput, toggleControl } from './templateEditorDom.ts';
import { renderNumericTrackingControls } from './templateNumericTrackingControls.ts';
import { renderChoiceFieldSettings } from './templateChoiceFieldSettings.ts';
import { imageReferenceText } from '../render/vaultImageResolver.ts';
import { bindImageFocalLayout } from '../templates/imageFramingFocus.ts';
import { whenEmptyFallbackSourceFieldKeys } from '../templates/whenEmptyFallbackModel.ts';
import { normalizeForgeLanguage, translateForgeText } from '../i18n/localization.ts';
import type { TemplateBlockInspectorContext } from './templateBlockInspectorContext.ts';

export function renderValueBlockInspector(context: TemplateBlockInspectorContext, panel: HTMLElement): void {
  const { template, block } = context;
  const valueFieldForMode = template.fields.find((item) => item.key === block.field);
  const isNumberValueField = valueFieldForMode?.type === 'number';
  const language = normalizeForgeLanguage(context.language);

  // When Empty is deliberately limited to Fallback. Forge's own Total Hidden
  // and collapsible Section controls remain independent and are not options here.
  if (whenEmptyFallbackSourceFieldKeys(block, template.fields).length > 0) {
    const whenEmpty = selectInput(block.whenEmpty === 'fallback' ? 'fallback' : 'default', [
      { value: 'default', label: translateForgeText('Use Forge default', language) },
      { value: 'fallback', label: translateForgeText('Fallback', language) },
    ]);
    const fallback = textareaInput(
      typeof block.fallback === 'string' ? block.fallback : '',
      translateForgeText('Fallback text to show when empty', language),
      2,
    );
    const fallbackControl = labeledControl(
      translateForgeText('Fallback text', language),
      fallback,
      translateForgeText('Shown only while every Field used by this block is empty.', language),
    );
    fallbackControl.hidden = whenEmpty.value !== 'fallback';
    whenEmpty.addEventListener('change', () => {
      if (whenEmpty.value === 'fallback') block.whenEmpty = 'fallback';
      else delete block.whenEmpty;
      fallbackControl.hidden = whenEmpty.value !== 'fallback';
      context.renderPreviewOnly();
    });
    fallback.addEventListener('change', () => {
      block.fallback = fallback.value;
      context.renderPreviewOnly();
    });
    panel.append(
      labeledControl(
        translateForgeText('When Empty', language),
        whenEmpty,
        translateForgeText('Fallback is the only When Empty mode here. Forge Hide and Fold controls remain separate.', language),
      ),
      fallbackControl,
    );
  }
  if (block.type === 'stat' && valueFieldForMode) {
    const currentLabelPlacement = block.labelPlacement === 'above' ? 'above'
      : block.labelPlacement === 'none' || block.label === '' ? 'none'
        : block.look === 'stacked' ? 'stacked' : 'run-in';
    const look = selectInput(currentLabelPlacement, [
      { value: 'run-in', label: translateForgeText('Beside label', language) },
      { value: 'stacked', label: translateForgeText('Below label', language) },
      { value: 'above', label: translateForgeText('Above label', language) },
      { value: 'none', label: translateForgeText('No Label', language) },
    ]);
    look.addEventListener('change', () => {
      if (look.value === 'none') {
        // Keep the prior vertical/horizontal layout so the label can be
        // restored without changing the original presentation.
        block.labelPlacement = 'none';
      } else if (look.value === 'above') {
        // Above is Forge-specific: the value is rendered before its label.
        // Keep `look` untouched; the labelPlacement override owns this mode.
        block.labelPlacement = 'above';
        if (block.label === '') delete block.label;
      } else {
        delete block.labelPlacement;
        // Empty block labels are the native Atlas representation of No Label.
        // Remove that override when the user explicitly restores a placement,
        // so the Field label becomes visible again.
        if (block.label === '') delete block.label;
        block.look = look.value;
      }
      context.renderPreviewOnly();
    });
    panel.append(labeledControl(translateForgeText('Label placement', language), look));

    if (valueFieldForMode.type === 'choice') {
      panel.append(renderChoiceFieldSettings(valueFieldForMode, language, context.render));
    }

    if (isNumberValueField) {
      const valueMode = valueDisplayMode(block);
      const mode = selectInput(valueMode ?? 'number', [
        { value: 'number', label: 'Number' }, { value: 'boxes', label: 'Boxes' }, { value: 'gauge', label: 'Gauge' },
      ]);
      mode.addEventListener('change', () => {
        if (setValueDisplayMode(template, block.id, mode.value as 'number' | 'boxes' | 'gauge')) context.render();
      });
      const display = selectInput(block.display === 'signed' ? 'signed' : 'plain', [
        { value: 'plain', label: 'Plain (3)' }, { value: 'signed', label: 'Signed (+3)' },
      ]);
      display.addEventListener('change', () => { setStatDisplay(block, display.value as 'plain' | 'signed'); context.renderPreviewOnly(); });
      panel.append(labeledControl('Show as', mode), labeledControl('Number display', display));
      renderNumericTrackingControls(context, valueFieldForMode, panel);
      panel.append(
        toggleControl('Roll as a bonus', block.rollable === true, (enabled) => { setStatFlag(block, 'rollable', enabled); context.renderPreviewOnly(); }),
      );
    }
  } else if (block.type === 'track' && valueFieldForMode?.type === 'number') {
    const valueMode = valueDisplayMode(block);
    const mode = selectInput(valueMode ?? 'boxes', [
      { value: 'number', label: 'Number' }, { value: 'boxes', label: 'Boxes' }, { value: 'gauge', label: 'Gauge' },
    ]);
    mode.addEventListener('change', () => {
      if (setValueDisplayMode(template, block.id, mode.value as 'number' | 'boxes' | 'gauge')) context.render();
    });
    panel.append(labeledControl('Show as', mode));
    if (!block.resource) renderNumericTrackingControls(context, valueFieldForMode, panel, { trackBlock: block });
  }

  // Atlas Value options for a Labels and values field (Pairs): number display
  // and roll-as-bonus. Next-roll modifiers are selected from any roll link's
  // context menu, so no block-specific toggle is needed here.
  if (block.type === 'pairs' && valueFieldForMode?.type === 'pairs') {
    const display = selectInput(block.display === 'signed' ? 'signed' : 'plain', [
      { value: 'plain', label: 'Plain (3)' }, { value: 'signed', label: 'Signed (+3)' },
    ]);
    display.addEventListener('change', () => {
      setPairsDisplay(block, display.value as 'plain' | 'signed');
      context.renderPreviewOnly();
    });
    panel.append(labeledControl('Number display', display));
    panel.append(
      toggleControl('Roll as a bonus', block.rollable === true, (enabled) => { setValueBlockFlag(block, 'rollable', enabled); context.renderPreviewOnly(); }),
    );
  }

  if (block.type === 'spells' && valueFieldForMode?.type === 'spells') {
    const look = selectInput(block.look === 'tabs' ? 'tabs' : 'lines', [
      { value: 'lines', label: language === 'pt-BR' ? 'Lista em linhas' : 'Line list' },
      { value: 'tabs', label: language === 'pt-BR' ? 'Abas' : 'Tabs' },
    ]);
    look.addEventListener('change', () => {
      block.look = look.value;
      context.renderPreviewOnly();
    });
    panel.append(labeledControl(translateForgeText('Show as', language), look));
  }

  if (block.type === 'tags') {
    const look = selectInput(String(block.look ?? 'chips'), [
      { value: 'comma', label: translateForgeText('Comma list', language) },
      { value: 'chips', label: translateForgeText('Chips', language) },
      { value: 'bullets', label: translateForgeText('Bullets', language) },
      { value: 'numbered', label: translateForgeText('Numbered', language) },
    ]);
    look.addEventListener('change', () => { block.look = look.value; context.renderPreviewOnly(); });
    panel.append(labeledControl(translateForgeText('Style', language), look));
  }

  if (block.type === 'image') {
    // Canvas Image blocks are always ordinary image fields. Token art is a
    // reserved header field and cannot be assigned to, or adjusted as, an Image block.
    if (block.shape !== 'portrait') block.shape = 'portrait';
    const fieldKey = typeof block.field === 'string' ? block.field : '';
    const isTokenField = fieldKey === 'image';
    const sample = isRecord(template.sample) ? template.sample : {};
    // Use the same reference parser as the Canvas renderer so Markdown images,
    // Obsidian embeds and array-backed values resolve to the identical asset.
    const currentPath = imageReferenceText(sample[fieldKey]);
    const imageRow = el('div', 'statblock-forge__image-field-actions');
    const chooseImage = button('Choose from Vault', () => context.openImagePicker(fieldKey), true);
    chooseImage.classList.add('statblock-forge__properties-secondary-action');
    chooseImage.disabled = isTokenField || !fieldKey || !template.fields.some((item) => item.key === fieldKey && item.type === 'image');
    imageRow.append(chooseImage);
    if (isTokenField) {
    } else if (currentPath) {
      imageRow.append(el('small', 'statblock-forge__hint', currentPath));
      const clearImage = button('Clear sample image', () => context.confirmDelete('sample image', () => {
        if (setTemplateSampleImage(template, fieldKey, null)) context.render();
      }), true);
      clearImage.classList.add('statblock-forge__properties-utility-button', 'is-danger');
      imageRow.append(clearImage);
    } else {
    }
    panel.append(imageRow);

    if (!isTokenField && template.fields.some((item) => item.key === fieldKey && item.type === 'image')) {
      const metadata = context.layout.blocks[block.id]
        ?? (context.layout.blocks[block.id] = { span: 12, rows: 1, appearance: {}, appearanceMode: 'theme' });
      const appearance = metadata.appearance ?? (metadata.appearance = {});
      const framing = el('div', 'statblock-forge__image-framing-controls');
      const heading = el('div', 'statblock-forge__image-framing-heading');
      heading.append(el('strong', '', 'Image framing'));
      framing.append(heading);

      const zoomValue = Math.max(100, Math.min(300, Number(appearance.imageZoom) || 100));
      const positionXValue = Math.max(0, Math.min(100, Number(appearance.imagePositionX ?? 50)));
      const positionYValue = Math.max(0, Math.min(100, Number(appearance.imagePositionY ?? 50)));
      const preview = el('div', 'statblock-forge__image-framing-preview');
      const previewGeometry = context.getImagePreviewGeometry?.(block.id);
      const fallbackSpan = Math.max(1, Math.min(12, Number(metadata.span) || 12));
      const fallbackRows = Math.max(1, Math.min(512, Number(metadata.rows) || 1));
      preview.setCssStyles({ aspectRatio: previewGeometry?.aspectRatio && Number.isFinite(previewGeometry.aspectRatio)
        ? String(previewGeometry.aspectRatio)
        : `${fallbackSpan} / ${fallbackRows}` });
      if (previewGeometry?.clipPath) preview.setCssStyles({ clipPath: previewGeometry.clipPath });
      if (previewGeometry?.borderRadius) preview.setCssStyles({ borderRadius: previewGeometry.borderRadius });
      preview.tabIndex = 0;
      preview.setAttribute('role', 'group');
      preview.setAttribute('aria-label', 'Image framing preview. Drag to reposition; use arrow keys for fine adjustment.');
      const previewImageSrc = currentPath ? context.resolveImage?.(currentPath) : undefined;
      let previewImage: HTMLImageElement | null = null;
      if (previewImageSrc) {
        previewImage = el('img', 'statblock-forge__image-framing-preview-image');
        previewImage.src = previewImageSrc;
        previewImage.alt = valueFieldForMode?.label ?? 'Image preview';
        previewImage.draggable = false;
        preview.append(previewImage);
      } else {
        preview.append(el('span', 'statblock-forge__image-framing-empty', 'Choose an image to preview its framing.'));
      }

      const zoom = el('input', 'statblock-forge__image-framing-range');
      zoom.type = 'range'; zoom.min = '100'; zoom.max = '300'; zoom.step = '5'; zoom.value = String(zoomValue);
      const horizontal = el('input', 'statblock-forge__image-framing-range');
      horizontal.type = 'range'; horizontal.min = '0'; horizontal.max = '100'; horizontal.step = '1'; horizontal.value = String(positionXValue);
      const vertical = el('input', 'statblock-forge__image-framing-range');
      vertical.type = 'range'; vertical.min = '0'; vertical.max = '100'; vertical.step = '1'; vertical.value = String(positionYValue);
      const zoomOutput = el('output', 'statblock-forge__image-framing-output', `${zoomValue}%`);
      const horizontalOutput = el('output', 'statblock-forge__image-framing-output', `${positionXValue}%`);
      const verticalOutput = el('output', 'statblock-forge__image-framing-output', `${positionYValue}%`);

      let previewImageLayout: ReturnType<typeof bindImageFocalLayout> | null = null;
      if (previewImage) {
        previewImageLayout = bindImageFocalLayout(previewImage, preview, () => ({
          zoom: Number(appearance.imageZoom ?? 100),
          x: Number(appearance.imagePositionX ?? 50),
          y: Number(appearance.imagePositionY ?? 50),
        }));
      }

      const updatePreview = (): void => {
        previewImageLayout?.update();
        zoom.value = String(appearance.imageZoom ?? 100);
        horizontal.value = String(appearance.imagePositionX ?? 50);
        vertical.value = String(appearance.imagePositionY ?? 50);
        zoomOutput.textContent = `${zoom.value}%`;
        horizontalOutput.textContent = `${horizontal.value}%`;
        verticalOutput.textContent = `${vertical.value}%`;
      };
      updatePreview();
      framing.append(preview);

      const zoomControl = el('label', 'statblock-forge__image-framing-slider');
      zoomControl.append(el('span', '', 'Zoom'), zoom, zoomOutput);
      framing.append(zoomControl);
      zoom.addEventListener('input', () => {
        appearance.imageZoom = Math.max(100, Math.min(300, Number(zoom.value) || 100));
        updatePreview();
      });
      zoom.addEventListener('change', () => context.renderPreviewOnly());

      // Keep both axes visible. The old collapsed disclosure hid Horizontal
      // focus by default, making the property preview appear vertically-only.
      const axisControls = el('div', 'statblock-forge__image-framing-axis-controls');
      const horizontalControl = el('label', 'statblock-forge__image-framing-slider');
      horizontalControl.append(el('span', '', 'Horizontal focus'), horizontal, horizontalOutput);
      const verticalControl = el('label', 'statblock-forge__image-framing-slider');
      verticalControl.append(el('span', '', 'Vertical focus'), vertical, verticalOutput);
      axisControls.append(horizontalControl, verticalControl);
      framing.append(axisControls);
      const updateFocus = (): void => {
        appearance.imagePositionX = Math.max(0, Math.min(100, Number(horizontal.value) || 0));
        appearance.imagePositionY = Math.max(0, Math.min(100, Number(vertical.value) || 0));
        updatePreview();
      };
      horizontal.addEventListener('input', updateFocus);
      vertical.addEventListener('input', updateFocus);
      horizontal.addEventListener('change', () => context.renderPreviewOnly());
      vertical.addEventListener('change', () => context.renderPreviewOnly());

      if (previewImage) {
        preview.addEventListener('pointerdown', (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = preview.getBoundingClientRect();
          const startX = event.clientX;
          const startY = event.clientY;
          const initialX = Number(appearance.imagePositionX ?? 50);
          const initialY = Number(appearance.imagePositionY ?? 50);
          preview.classList.add('is-dragging');
          try { preview.setPointerCapture(event.pointerId); } catch { /* WebView fallback */ }
          const move = (moveEvent: PointerEvent): void => {
            if (moveEvent.pointerId !== event.pointerId) return;
            moveEvent.preventDefault();
            moveEvent.stopPropagation();
            appearance.imagePositionX = Math.max(0, Math.min(100, initialX - ((moveEvent.clientX - startX) / Math.max(1, rect.width)) * 100));
            appearance.imagePositionY = Math.max(0, Math.min(100, initialY - ((moveEvent.clientY - startY) / Math.max(1, rect.height)) * 100));
            updatePreview();
          };
          const finish = (finishEvent: PointerEvent): void => {
            if (finishEvent.pointerId !== event.pointerId) return;
            preview.classList.remove('is-dragging');
            preview.removeEventListener('pointermove', move);
            preview.removeEventListener('pointerup', finish);
            preview.removeEventListener('pointercancel', finish);
            if (finishEvent.type === 'pointerup') context.renderPreviewOnly();
            else {
              appearance.imagePositionX = initialX;
              appearance.imagePositionY = initialY;
              updatePreview();
            }
          };
          preview.addEventListener('pointermove', move);
          preview.addEventListener('pointerup', finish);
          preview.addEventListener('pointercancel', finish);
        });
        preview.addEventListener('keydown', (event) => {
          const step = event.shiftKey ? 10 : 2;
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
          event.preventDefault();
          if (event.key === 'Home') {
            appearance.imagePositionX = 50;
            appearance.imagePositionY = 50;
          } else {
            if (event.key === 'ArrowLeft') appearance.imagePositionX = Math.min(100, Math.max(0, Number(appearance.imagePositionX ?? 50) + step));
            if (event.key === 'ArrowRight') appearance.imagePositionX = Math.min(100, Math.max(0, Number(appearance.imagePositionX ?? 50) - step));
            if (event.key === 'ArrowUp') appearance.imagePositionY = Math.min(100, Math.max(0, Number(appearance.imagePositionY ?? 50) + step));
            if (event.key === 'ArrowDown') appearance.imagePositionY = Math.min(100, Math.max(0, Number(appearance.imagePositionY ?? 50) - step));
          }
          updatePreview();
          context.renderPreviewOnly();
        });
      }

      const resetFraming = button(translateForgeText('Reset framing', language), () => {
        context.confirmReset(translateForgeText('image framing', language), () => {
          delete appearance.imageFit;
          delete appearance.imageZoom;
          delete appearance.imagePositionX;
          delete appearance.imagePositionY;
          context.render();
        });
      }, true);
      resetFraming.classList.add('statblock-forge__properties-utility-button');
      framing.append(resetFraming);
      panel.append(framing);
    }
  }
}

export function hasNumericTrackingForBlock(template: ForgeTemplate, block: ForgeBlock): boolean {
  const field = template.fields.find((item) => item.key === block.field);
  return (field?.type === 'number' || field?.type === 'rating') && isRecord(field.tracks);
}
