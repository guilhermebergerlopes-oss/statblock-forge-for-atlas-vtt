---
title: Statblock Forge — Resizing Blocks
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Resizing Blocks

A block can be resized directly on the Canvas or numerically in the sidebar inspector.

## Resize on the Canvas

1. Hover over a block to find the resize handle in its lower-right corner.
2. Drag the handle to change width and height.
3. Watch the indicator near the pointer: it shows the planned columns and rows (`Span × Rows`).
4. Release to apply the change.

During the gesture, Forge previews the new placement. In a Grid, neighboring blocks are temporarily repositioned to avoid overlap. The Canvas can auto-scroll when the pointer reaches the edge of its scrollable area.

## Resize in the inspector

Select a block and adjust:

- **Width (12-part Span scale):** Span, from 1 to 12; the value maps proportionally to the configured physical columns.
- **Height (rows):** Rows, from 1 to 10,000.

Numeric changes apply when confirmed. These fields are useful for precise adjustments or restoring known dimensions.

## Container behavior

### Blocks in a Grid

Width uses the Grid's configured physical columns. If a block grows beyond the remaining space to its right, the placement engine may move it to a later row. Siblings are recalculated to avoid collisions.

### Sections used in Tabs

Each tab has its own Section. The Section representing a tab can also be resized from its lower-right handle; it uses an independent Grid with the same configured column count as a normal Section. Blocks inside the tab remain individually resizable.

### Blocks in a Row

Row children share width proportionally. A child's Span acts as a relative weight, not as a fixed column position. Increasing or decreasing it changes that child's share compared with its siblings. Select a child to show the same lower-right resize handle used by Grid blocks; the handle adjusts the child's share against the other items on its visual Row line.

### Height and content

Rows is the minimum allocation saved in the template. Depending on the block type, content may need extra visual space or use internal scrolling without changing the saved Rows value.

## Limits and recommendations

- Span must be between 1 and 12.
- Rows accepts 1 through 10,000.
- Resizing does not change the linked Field or stored statblock value.
- Narrower blocks can make text and lists taller due to line wrapping.
- Resizing a Row child changes its width share; it does not move it to another main-Grid column.

## See also

- [[08 - 12-Column Grid]] — placement rules.
- [[12 - Row]] — horizontal child distribution.
