---
title: Statblock Forge — Configurable Grid (12 by Default)
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Configurable Grid

The Forge Canvas uses a configurable Grid with **4–24 physical columns** (12 by default). Change it under **More options → Grid columns** in the Canvas toolbar. The setting is stored in the template and applies to the main Grid, nested Sections, and tab panels. Blocks occupy one or more columns and rows. Placement calculations prevent overlap.

## Columns and cells

- Available width is divided equally by the configured number of columns.
- Gaps are subtracted before each cell width is calculated.
- Base cells are square: row height follows column width.
- Rows and columns use uniform measurements within each Grid.

Each block has two main size values:

| Property | Meaning | Range |
|---|---|---:|
| **Width / Span** | Proportional width on a 12-part logical scale. | 1–12 |
| **Height / Rows** | Number of base rows occupied. | 1–10,000 |

`Span = 6` uses half the Grid width; `Span = 12` uses the full width, regardless of the configured physical column count. Rows sets the minimum vertical allocation. Long content may require additional rendered space where the block type supports it.

## Position and order

Block structure order drives placement. With **Dense Layout On**, blocks follow structural order and can move into earlier reachable free positions. With **Dense Layout Off**, blocks keep column/row anchors. Collisions push affected blocks downward rather than sideways, and blocks do not automatically move upward when space opens.

See [[14 - Dense Layout]].

## Content height

Rows is the saved base allocation. It is not a universal clipping limit. Multiline content can need more room in block types designed to expand or scroll. The renderer recalculates sibling placement where expansion is supported. This is distinct from the manual Rows setting.

## Main Grid and Section Grids

The **Background grid** control shows guides on the main Grid and on every independent Grid inside a Section, including nested Sections and tab content. Guides use the resolved column widths, row heights, and gaps calculated for each Grid.

Each Section has an independent internal Grid; its children do not share coordinates with blocks outside that Section. Rows, by contrast, distribute children in flexible lines and do not assign each child an independent Grid position.


## Example

| Block | Span | Approximate result |
|---|---:|---|
| Name | 12 | Full-width row |
| HP | 3 | One quarter width |
| Defense | 3 | One quarter width |
| Movement | 3 | One quarter width |
| Range | 3 | One quarter width |

The four smaller blocks can share a row when order and available space allow. Actual placement also considers height.

## See also

- [[09 - Resizing Blocks]] — change Span and Rows.
- [[10 - Containers Overview]] — understand nested Grids.
- [[14 - Dense Layout]] — control placement behavior.
