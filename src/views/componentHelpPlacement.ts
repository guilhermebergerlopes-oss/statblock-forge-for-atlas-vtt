export type HelpTooltipPlacement = 'right' | 'left' | 'bottom' | 'top';

export interface HelpTooltipRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface HelpTooltipSize {
  width: number;
  height: number;
}

export interface HelpTooltipViewport {
  width: number;
  height: number;
}

export interface HelpTooltipPosition {
  placement: HelpTooltipPlacement;
  left: number;
  top: number;
  maxHeight?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Place the help preview next to its trigger whenever possible. If horizontal
 * space is insufficient, use the side with enough vertical room; otherwise
 * choose the side with the most available space and clamp it to the viewport.
 */
export function placeHelpTooltip(
  anchor: HelpTooltipRect,
  popup: HelpTooltipSize,
  viewport: HelpTooltipViewport,
  gap = 10,
  padding = 8,
): HelpTooltipPosition {
  const rightSpace = viewport.width - anchor.right - padding;
  const leftSpace = anchor.left - padding;
  const bottomSpace = viewport.height - anchor.bottom - padding;
  const topSpace = anchor.top - padding;

  const rightFits = rightSpace >= popup.width + gap;
  const leftFits = leftSpace >= popup.width + gap;
  const bottomFits = bottomSpace >= popup.height + gap;
  const topFits = topSpace >= popup.height + gap;

  let placement: HelpTooltipPlacement;
  let maxHeight: number | undefined;
  // Prefer the inward-facing side so options in the left half of the picker
  // show the preview to their right, while options in the right half show it
  // to their left. Re-evaluating each hovered trigger makes the preview flip
  // as the pointer moves across the picker. Fall back only when that side
  // cannot fit the full popup.
  const preferredSide: HelpTooltipPlacement = anchor.left + anchor.width / 2 <= viewport.width / 2 ? 'right' : 'left';
  if (preferredSide === 'right' && rightFits) placement = 'right';
  else if (preferredSide === 'left' && leftFits) placement = 'left';
  else if (rightFits) placement = 'right';
  else if (leftFits) placement = 'left';
  else if (bottomFits && topFits) placement = bottomSpace >= topSpace ? 'bottom' : 'top';
  else if (bottomFits) placement = 'bottom';
  else if (topFits) placement = 'top';
  else {
    // If neither side can fit the full preview, constrain its height to the
    // larger free area. The tooltip becomes scrollable instead of overlapping
    // its trigger or being cut off by the viewport.
    placement = bottomSpace >= topSpace ? 'bottom' : 'top';
    maxHeight = Math.max(48, (placement === 'bottom' ? bottomSpace : topSpace) - gap);
  }

  let left: number;
  let top: number;
  if (placement === 'right') {
    left = anchor.right + gap;
    top = clamp(anchor.top + (anchor.height - popup.height) / 2, padding, viewport.height - popup.height - padding);
  } else if (placement === 'left') {
    left = anchor.left - popup.width - gap;
    top = clamp(anchor.top + (anchor.height - popup.height) / 2, padding, viewport.height - popup.height - padding);
  } else {
    left = clamp(anchor.left + (anchor.width - popup.width) / 2, padding, viewport.width - popup.width - padding);
    top = placement === 'bottom' ? anchor.bottom + gap : anchor.top - popup.height - gap;
    top = clamp(top, padding, viewport.height - popup.height - padding);
  }

  const effectiveHeight = Math.min(popup.height, maxHeight ?? popup.height);
  return {
    placement,
    left: clamp(left, padding, viewport.width - popup.width - padding),
    top: clamp(top, padding, viewport.height - effectiveHeight - padding),
    ...(maxHeight !== undefined ? { maxHeight } : {}),
  };
}
