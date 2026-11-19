---
title: Statblock Forge — Dense Layout
aliases:
  - Compact layout
  - Dense positioning
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Dense Layout

**Dense Layout** controls how direct children of a Grid are positioned. It is a global Template layout setting: it applies to the main Grid and to internal Grids inside Sections, including Tabs panels.

Dense is different from **Background grid**:

- **Dense Layout** changes the placement algorithm and, in Rows, visual spacing.
- **Background grid** only shows or hides Canvas guide lines. It does not change block positions or sizes.

New Templates start with Dense enabled.

## Dense On: compact placement

With **Dense Layout On**:

1. Forge walks through siblings in the Template's structural order.
2. It calculates each block's size and finds a free position for the entire rectangle.
3. When a path of free positions exists, the algorithm searches for a position farther up and/or left that remains reachable without crossing occupied blocks.
4. Blocks are not rotated, shrunk, or overlapped to fill gaps.

The goal is to compact reachable empty space while keeping every block's size unchanged. This does not mean every visual hole will be filled: if a block cannot slide to a free area without crossing a collision, it stays in a later position.

Sibling order matters. Moving a block up or down in the structure can change placement results for several following blocks.

## Dense Off: position anchors

With **Dense Layout Off**, Forge preserves manual positions for direct children of each Grid:

- When Dense is turned off, currently visible positions are captured as column and row anchors.
- Each block keeps its reference column and row.
- If another block occupies part of an anchored position, the colliding block is pushed downward while keeping its column whenever possible.
- A collision does not move a block sideways to fill a gap.
- When a block above becomes smaller, blocks below do not automatically move upward just because space became free.

This mode preserves manual composition. Forge prefers to keep the known vertical/horizontal anchor instead of rearranging the block into any available gap.

### Simplified example

```text
Dense Off
Columns:   1–4       5–8       9–12
Row 1:    [Block A] [Block B] [Block C]
Row 2:    [Block D]           [Block E]
```

If Block A grows and collides with Block D, D is pushed downward in the same column range. It does not move into the empty space below Block B or C.

## Manually place a block in a cell

With Dense off, you can drag a block directly into a Grid cell:

1. Turn **Dense Layout** off.
2. Drag the block by its body, not by its resize handle.
3. Drop it in a Grid position, including an empty area, or over another block at the desired cell.
4. Forge calculates the column and row under the pointer and applies the new anchor.
5. If the destination is occupied, colliding blocks are moved downward according to the Dense Off rule.

This works for direct children of the main Grid and direct children of internal Section Grids. Direct Row children do not have their own Grid coordinates; Sections that are direct Tabs children follow tab order. For those cases, use structural drag-and-drop or order controls.

## Switching between Dense On and Off

- **On → Off:** Forge captures visible positions as new anchors. The composition you were seeing becomes the starting point for manual mode.
- **Off → On:** anchors stop controlling placement. Forge returns to compact placement based on sibling order.
- **On → Off again:** the currently compacted positions are captured as new anchors.

Switching modes does not change `Span`, `Rows`, Fields, or Values; it changes how position is calculated.

## Reordering is not the same as repositioning

There are two different operations:

| Operation | What changes | When to use it |
|---|---|---|
| **Move ↑ / ↓ or drag before/after** | Structural sibling order. | When reading order or layout sequence should change. |
| **Drop into a cell with Dense Off** | The block's spatial anchor in the Grid. | When you want to preserve a specific manual composition. |

After an explicit structural reorder, Forge clears anchors for the affected sibling group so the new order is respected. See [[15 - Moving and Reordering Blocks]].

## Containers and anchor scope

- The main Grid has its own sibling group and anchors.
- Each Section has an internal Grid with anchors independent from outside siblings.
- Each Section panel inside Tabs has its own internal Grid.
- Direct Row children are distributed by Span and order, not by Grid anchors.
- A Section, Row, or Tabs container itself occupies a position in its parent's Grid; its descendants belong to the container's internal structure.

The Grid's physical column count can be changed in the Canvas options. Anchors record the column count in which they were created so Forge can proportionally adjust their column when the configuration changes. `Span` remains on the logical 1–12 scale; see [[08 - 12-Column Grid]].

## Dense and space released by hidden or collapsed content

A separate rule applies to content that is no longer displayed in the final statblock:

- A collapsed Section stops occupying height.
- Blocks marked **Hidden** for players are removed from the player's view.
- Forge can reclaim some released rows for blocks below, provided their columns overlap.
- Remaining blocks keep their horizontal coordinates; freed space does not make a block jump to another column.

This visible-space adjustment is not the same as the Template's Dense placement algorithm. See [[11 - Section]] and [[21 - Per-Block Appearance]].

## Dense also affects Row spacing

Although Row children do not use Grid anchors, the Dense setting changes the gaps between them: with Dense on, Row's horizontal and vertical gaps are more compact; with Dense off, normal spacing is used. Child order and Span weights remain unchanged.

## Which mode should I use?

| Goal | Recommended mode |
|---|---|
| Let Forge compact the layout according to Template order. | **Dense On** |
| Create intentional gaps or a fixed spatial composition. | **Dense Off** |
| Drag a block to a specific cell. | **Dense Off** |
| Let block order determine the composition. | **Dense On**, or use ↑ / ↓ to set the sequence before compacting. |
| Only adjust spacing between Row children. | Use Dense knowing that it also changes Row spacing. |

## Common issues

| Symptom | Explanation | Fix |
|---|---|---|
| A block moved after enabling Dense. | Placement returned to structural order and searched for a reachable compact position. | Reorder siblings or turn Dense off to capture the current composition. |
| A block was pushed down. | Its anchor was occupied by another block. | Resize or move the colliding block, or adjust the affected block's anchor. |
| A block does not move up after another shrinks. | Dense Off preserves its row anchor. | Reposition it manually or enable Dense to compact. |
| I cannot drag a Row child to a cell. | Row does not use Grid coordinates for direct children. | Adjust the child's Span, Align, or order. |
| The background grid disappeared but layout did not change. | Background grid only controls visual guides. | Enable Background grid; use Dense to change placement. |

## See also

- [[08 - 12-Column Grid]] — physical columns, logical Span, and dimensions.
- [[09 - Resizing Blocks]] — how size and content affect required rows.
- [[10 - Containers Overview]] — where each Grid exists.
- [[11 - Section]] — internal Grids and collapsible content.
- [[12 - Row]] — flexible distribution and Dense spacing.
- [[15 - Moving and Reordering Blocks]] — structural and manual movement.
