/** Scroll routing for a rendered statblock, including nested eligible scroll areas. */
type WheelAxis = 'x' | 'y';

function wheelDeltaForElement(event: WheelEvent, axis: WheelAxis, element: HTMLElement): number {
  const rawDelta = axis === 'x'
    ? (Math.abs(event.deltaY) >= Math.abs(event.deltaX) && event.deltaY !== 0 ? event.deltaY : event.deltaX)
    : event.deltaY;
  if (!Number.isFinite(rawDelta) || rawDelta === 0) return 0;
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return rawDelta * 40;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    return rawDelta * Math.max(1, axis === 'x' ? element.clientWidth : element.clientHeight);
  }
  return rawDelta;
}

function canScrollInDirection(element: HTMLElement, axis: WheelAxis, delta: number): boolean {
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  const overflow = axis === 'x' ? style.overflowX : style.overflowY;
  if (overflow !== 'auto' && overflow !== 'scroll' && overflow !== 'overlay') return false;

  const max = axis === 'x'
    ? element.scrollWidth - element.clientWidth
    : element.scrollHeight - element.clientHeight;
  if (max <= 1) return false;
  const position = axis === 'x' ? element.scrollLeft : element.scrollTop;
  return delta > 0 ? position < max - 1 : position > 1;
}

/**
 * Routes a wheel gesture to the nearest scrollable element under the pointer.
 * If an inner multiline block reaches its edge, the gesture naturally moves
 * outward to the statblock surface and then to the note pane.
 */
export function routeStatblockWheel(
  root: HTMLElement,
  target: EventTarget | null,
  event: WheelEvent,
): HTMLElement | null {
  if (event.metaKey) return null;

  let axis: WheelAxis = event.altKey ? 'x' : 'y';
  if (!event.altKey && event.ctrlKey) {
    const targetElement = target instanceof HTMLElement ? target : root;
    const image = targetElement.closest<HTMLElement>('.statblock-forge__preview-image.is-framing-interactive');
    if (!image) return null;

    // Leave Ctrl+wheel to the image when it can still zoom. At either zoom
    // limit, route the gesture to ordinary vertical statblock scrolling.
    const zoom = Number(image.dataset.imageZoom ?? 100);
    const nextZoom = Math.min(300, Math.max(100, zoom + (event.deltaY < 0 ? 10 : -10)));
    if (nextZoom !== zoom) return null;
  }

  const targetElement = target instanceof HTMLElement && root.contains(target) ? target : root;
  const candidates: HTMLElement[] = [];
  let current: HTMLElement | null = targetElement;
  while (current) {
    candidates.push(current);
    if (current === root) break;
    current = current.parentElement;
  }
  if (!candidates.includes(root)) candidates.push(root);

  // In stacked note layout the render root has natural height, so the actual
  // vertical scroll container is the Obsidian note pane above the root.
  current = root.parentElement;
  while (current) {
    candidates.push(current);
    if (current.classList.contains('workspace-leaf-content')) break;
    current = current.parentElement;
  }

  for (const candidate of candidates) {
    const delta = wheelDeltaForElement(event, axis, candidate);
    if (delta === 0 || !canScrollInDirection(candidate, axis, delta)) continue;

    if (axis === 'x') {
      const max = candidate.scrollWidth - candidate.clientWidth;
      const next = Math.max(0, Math.min(max, candidate.scrollLeft + delta));
      if (Math.abs(next - candidate.scrollLeft) <= 0.5) continue;
      candidate.scrollLeft = next;
    } else {
      const max = candidate.scrollHeight - candidate.clientHeight;
      const next = Math.max(0, Math.min(max, candidate.scrollTop + delta));
      if (Math.abs(next - candidate.scrollTop) <= 0.5) continue;
      candidate.scrollTop = next;
    }
    return candidate;
  }

  return null;
}
