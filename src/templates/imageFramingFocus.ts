export interface ImageFocalLayoutOptions {
  /** Percentage zoom, clamped to the supported 100–300 range. */
  zoom: number;
  /** Template focal point: 0 = left/top, 50 = center, 100 = right/bottom. */
  x: number;
  y: number;
  /** Additional statblock-local pan, expressed as a percentage of the viewport. */
  panXPercent?: number;
  panYPercent?: number;
}

export interface ImageFocalRect {
  width: number;
  height: number;
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/**
 * Calculate the actual rendered image rectangle for a cover crop.
 *
 * Unlike object-position + transform on an <img> whose own box is the viewport,
 * this sizes the image itself to the full cover dimensions before applying the
 * focal point. This keeps both axes pannable even when the source aspect ratio
 * matches the frame, and zoom can reveal pixels outside the original crop.
 */
export function calculateImageFocalRect(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  options: ImageFocalLayoutOptions,
): ImageFocalRect | null {
  if (![naturalWidth, naturalHeight, viewportWidth, viewportHeight].every((value) => Number.isFinite(value) && value > 0)) {
    return null;
  }

  const zoom = clamp(options.zoom, 100, 300, 100) / 100;
  const x = clamp(options.x, 0, 100, 50) / 100;
  const y = clamp(options.y, 0, 100, 50) / 100;
  const panX = clamp(options.panXPercent ?? 0, -100, 100, 0) / 100;
  const panY = clamp(options.panYPercent ?? 0, -100, 100, 0) / 100;

  const coverScale = Math.max(viewportWidth / naturalWidth, viewportHeight / naturalHeight) * zoom;
  const width = naturalWidth * coverScale;
  const height = naturalHeight * coverScale;
  const minLeft = viewportWidth - width;
  const minTop = viewportHeight - height;

  // Interpolate between the two fully covered edges. Then apply any
  // statblock-local pan and clamp so the viewport can never expose gaps.
  const left = clamp(minLeft * x + viewportWidth * panX, minLeft, 0, minLeft / 2);
  const top = clamp(minTop * y + viewportHeight * panY, minTop, 0, minTop / 2);
  return { width, height, left, top };
}

/**
 * Bind a real image to its clipping viewport. Recalculates after the image loads
 * and whenever the viewport changes size. Call update after changing focus/zoom.
 */
export function bindImageFocalLayout(
  image: HTMLImageElement,
  viewport: HTMLElement,
  getOptions: () => ImageFocalLayoutOptions,
): { update: () => void; disconnect: () => void } {
  let disconnected = false;
  const update = (): void => {
    if (disconnected || !image.naturalWidth || !image.naturalHeight) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    const layout = calculateImageFocalRect(image.naturalWidth, image.naturalHeight, width, height, getOptions());
    if (!layout) return;

    image.style.position = 'absolute';
    image.style.inset = 'auto';
    image.style.left = `${layout.left}px`;
    image.style.top = `${layout.top}px`;
    image.style.right = 'auto';
    image.style.bottom = 'auto';
    image.style.width = `${layout.width}px`;
    image.style.height = `${layout.height}px`;
    image.style.maxWidth = 'none';
    image.style.maxHeight = 'none';
    image.style.objectFit = 'fill';
    image.style.objectPosition = '50% 50%';
    image.style.transform = 'none';
    image.style.transformOrigin = '0 0';
    image.style.borderRadius = '0';
  };

  image.addEventListener('load', update);
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
  observer?.observe(viewport);
  if (!observer && typeof window !== 'undefined') window.addEventListener('resize', update);
  if (image.complete) update();

  return {
    update,
    disconnect: () => {
      if (disconnected) return;
      disconnected = true;
      image.removeEventListener('load', update);
      observer?.disconnect();
      if (!observer && typeof window !== 'undefined') window.removeEventListener('resize', update);
    },
  };
}
