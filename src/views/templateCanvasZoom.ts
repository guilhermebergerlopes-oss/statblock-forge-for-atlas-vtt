/** Ctrl + mouse-wheel zoom for the template editor Canvas surface. */

export const MIN_TEMPLATE_CANVAS_ZOOM = 0.4;
export const MAX_TEMPLATE_CANVAS_ZOOM = 2.5;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 1));
}

/** Calculate a smooth zoom level from a WheelEvent delta. */
export function templateCanvasZoomAfterWheel(
  currentZoom: number,
  deltaY: number,
  deltaMode: number,
  viewportHeight: number,
): number {
  if (!Number.isFinite(deltaY) || deltaY === 0) return clamp(currentZoom, MIN_TEMPLATE_CANVAS_ZOOM, MAX_TEMPLATE_CANVAS_ZOOM);
  const unit = deltaMode === 1 ? 16 : deltaMode === 2 ? Math.max(1, viewportHeight) : 1;
  const factor = Math.exp(-(deltaY * unit) * 0.001);
  return clamp(currentZoom * factor, MIN_TEMPLATE_CANVAS_ZOOM, MAX_TEMPLATE_CANVAS_ZOOM);
}

/**
 * Attach Ctrl + wheel zoom to the editor Canvas. CSS zoom participates in
 * layout, so scroll extents and hit-testing continue to follow the sheet size.
 * The content point under the pointer is kept stationary while scaling.
 */
export function attachTemplateCanvasZoom(
  dropzone: HTMLElement,
  sheet: HTMLElement,
  initialZoom: number,
  onZoomChange: (zoom: number) => void,
): () => void {
  let zoom = clamp(initialZoom, MIN_TEMPLATE_CANVAS_ZOOM, MAX_TEMPLATE_CANVAS_ZOOM);
  sheet.setCssStyles({ zoom: String(zoom) });

  const onWheel = (event: WheelEvent): void => {
    if (!event.ctrlKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;

    event.preventDefault();
    event.stopPropagation();

    const nextZoom = templateCanvasZoomAfterWheel(zoom, event.deltaY, event.deltaMode, dropzone.clientHeight);
    if (Math.abs(nextZoom - zoom) < 0.0001) return;

    const viewportRect = dropzone.getBoundingClientRect();
    const beforeRect = sheet.getBoundingClientRect();
    const previousScrollLeft = dropzone.scrollLeft;
    const previousScrollTop = dropzone.scrollTop;
    const pointerX = event.clientX - viewportRect.left;
    const pointerY = event.clientY - viewportRect.top;
    const localX = clamp((event.clientX - beforeRect.left) / zoom, 0, beforeRect.width / zoom);
    const localY = clamp((event.clientY - beforeRect.top) / zoom, 0, beforeRect.height / zoom);

    zoom = nextZoom;
    sheet.setCssStyles({ zoom: String(zoom) });
    const afterRect = sheet.getBoundingClientRect();

    const contentX = previousScrollLeft + (afterRect.left - viewportRect.left) + localX * zoom;
    const contentY = previousScrollTop + (afterRect.top - viewportRect.top) + localY * zoom;
    dropzone.scrollLeft = Math.max(0, contentX - pointerX);
    dropzone.scrollTop = Math.max(0, contentY - pointerY);
    onZoomChange(zoom);
  };

  dropzone.addEventListener('wheel', onWheel, { capture: true, passive: false });
  return () => dropzone.removeEventListener('wheel', onWheel, true);
}
