---
title: Statblock Forge — Moving and Reordering Blocks
aliases:
  - Canvas drag and drop
  - Field and block order
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Moving and Reordering Blocks

The Canvas contains two separate order structures: the **Field order in the template** and the **block tree in the layout**. They are related, but they are not the same. Reordering a Field in the palette does not automatically move its block on the Canvas; moving a Canvas block does not change the Field list order.

This note covers selection, dragging, drop targets, Grid repositioning, and container restrictions. For the effect of Dense Layout on drag results, see [[14 - Dense Layout]].

## 1. Select Canvas blocks

- **Click** a block to select the deepest block at that point. Its settings appear in the sidebar inspector.
- **Ctrl-click** on Windows/Linux, **Cmd-click** on macOS, or **Shift-click** adds or removes a block from the current selection.
- **Alt-click** a child block selects its containing Section instead. Repeating the gesture at nested levels lets you move upward through the Section hierarchy.
- Sections and Rows have dedicated selection handles on their edges. These handles let you select the container rather than one of its children.
- In a Text block, Forge selects the block at the start of the pointer gesture without preventing the subsequent click on rendered Markdown links.

Multi-selection is useful for inspecting or performing actions that accept multiple IDs, such as removal. The **↑ / ↓** order buttons appear only when one block is selected. A drag payload identifies one block at a time; do not treat a multi-selection as a group that will move together.

## 2. Drag an existing block

1. Start dragging from the block area, not from its resize handle.
2. Move the pointer to the intended destination.
3. Check the drop highlight and insertion indicator.
4. Release to apply the move.

The resize handle does not start a block drag. While a block is being resized, Forge blocks drag-and-drop to avoid accidentally moving it.

### How Forge interprets a drop target

The pointer location determines whether the block becomes a child of a container or is inserted before/after another block:

| Target area | Interpretation |
|---|---|
| Central area of a **Section**, **Row**, or **Tabs** | Attempts to insert the block as a child, if the type combination is allowed. |
| Near an edge of a block | Inserts before or after that sibling. The nearest edge determines the axis and position. |
| Empty area inside a Grid | Uses the Grid that received the drop and, when applicable, the cell under the pointer. |
| General empty Canvas area | Appends the block to the end of the root list. |

The central drop area is an inner region of the container; the pointer does not need to hit its exact visual center. Outside that region, Forge interprets the gesture as insertion beside the target block.

## 3. Reposition inside the Grid

The result depends on **Dense Layout**:

- With **Dense Layout off**, a drop over a Grid can record the requested column and row. This places the block in a specific cell rather than only changing its order.
- With **Dense Layout on**, dragging changes the structural order of siblings. The compact layout algorithm calculates the resulting positions; the cell under the pointer is not retained as a manual anchor.

### What happens when the target cell is occupied

When the requested cell is already occupied, Forge inserts the block before the first block that collides with the requested rectangle. It recalculates the sparse Grid and pushes affected blocks downward, preserving their columns where possible. Blocks without a collision keep their positions.

Coordinate-based placement applies to direct children of the root Grid and direct children of a **Section** Grid. **Row** children continue to use the Row's flexible ordering, and Sections that are direct children of **Tabs** continue to be ordered as tabs.

### Example: move one block without rearranging an entire row

Imagine a Grid with `AC` in the first column, `HP` to its right, and `Speed` below. With Dense off, dropping `Speed` into an empty cell farther right creates a new anchor for it. If another block occupies the same area, only blocks affected by the collision are pushed down.

With Dense on, moving `Speed` between `AC` and `HP` changes sibling order; compaction determines the new arrangement of the siblings that need recalculation.

## 4. Use the ↑ and ↓ buttons

When one block is selected, **↑** and **↓** appear in the selection group inside **More options** on the Canvas toolbar.

- Each click swaps the selected block with the immediately previous or next sibling.
- A button does not move the block into another container.
- The operation never crosses Section, Row, or Tabs boundaries.
- A button is disabled when there is no sibling in that direction.
- The selected order becomes the basis for that sibling group; Forge clears the group's manual anchors so old coordinates do not conflict with the chosen order.

Use these buttons when you want to change only sibling order, without choosing a visual Grid cell.

## 5. Reorder Fields in the palette

Each Field in the sidebar **Fields** list has an ordering handle separate from its Field-name button.

- Drag the `⠿` handle to change the Field's position in the list.
- With the handle focused, press **↑** or **↓** to swap the Field with the previous or next one. Focus remains on that Field's handle after rendering.
- Drag the **Field name**, not the handle, to add or move its Canvas representation.
- Click the Field name to open its settings.

Palette order is the order of Field definitions in the template. It is independent of Canvas block order and does not change Values already stored in statblock notes.

## 6. Drag a Field onto the Canvas

The Field name in the palette can be dragged onto a Grid, block, or container:

- If the Field is not represented in the layout yet, Forge creates the block corresponding to the Field type/category.
- If the Field is already represented, Forge moves the existing block. It does not create a second independent representation of the same Field.
- The Field and its key remain the same. The gesture changes where it is presented; it does not create a new data property.
- **Metric** and **Table** are data Containers created with **Add Container**. Drag compatible Fields inside them to add those Fields as children: Metric accepts scalar Fields; Table accepts compatible Fields; Pairs remains a standalone Collection. The Table's `scores` Field is managed internally and should not be added to the palette as an ordinary Field.

### Drop a Field directly onto Tabs

Tabs accepts Sections as direct children. Therefore, when a Field is dropped directly onto Tabs, Forge creates a new Section, uses the Field label (or its key if no label exists) as the tab heading, and places the block inside that Section.

If the Field already had a block elsewhere in the layout, that existing representation is moved into the new Section. To add a Field to an existing tab, drop it onto the Section representing that tab, not onto the Tabs wrapper.

## 7. Structural rules and rejected moves

| Rule | Result |
|---|---|
| **Tabs** accepts only **Section** as a direct child. | Dropping an ordinary block into Tabs does not create an invalid child. To create a tab, Forge wraps it in a Section. |
| **Row** cannot directly contain another **Row** or **Tabs**. | Forge searches for a compatible ancestor level for side insertion, or rejects an explicit move to an invalid destination. |
| A container cannot be moved into itself or one of its descendants. | Forge prevents cycles in the layout tree. |
| ↑ / ↓ operate only between siblings. | Drag the block to change its parent container. |
| A Field has one Canvas representation per layout binding. | Dragging an already placed Field moves its existing block. |

Moving between containers preserves the block object and its settings, but size and position may be recalculated in the destination group. The destination Grid may have a different width and content from the source Grid.

## 8. Row: remove the container without deleting its children

When a **Row** is selected, the **More options** toolbar includes **Ungroup**. It removes the Row wrapper and returns its children to the Row's parent sibling level, preserving their order. Forge clears the group's anchors so the parent container can calculate the new arrangement.

Ungroup is not the same as Delete: deleting a Row removes the selected container and may remove its descendant tree. Use **Ungroup** when you want to keep the blocks and only remove the horizontal strip.

## Troubleshooting

| Symptom | Likely cause | What to do |
|---|---|---|
| The block was inserted before/after but did not enter the container. | The drop occurred near an edge, outside the central insertion area. | Drag again into the container's central area. |
| The block will not move from its corner. | The drag began on the resize handle. | Start dragging from another part of the block. |
| The block moved to a different position after drop. | Dense Layout is on, or a collision occurred in the sparse Grid. | Check Dense mode and the sibling anchors. |
| I cannot drop an ordinary block into Tabs. | Tabs only accepts direct Section children. | Drop a Field directly on Tabs so Forge creates a Section, or select an existing tab Section. |
| ↑ / ↓ cannot move the block into another Section. | The buttons swap siblings only in the same container. | Drag the block into the destination Section. |
| Dragging a Field did not create another block. | The Field already had a representation. | Forge moves the existing block to avoid duplication. |

## See also

- [[07 - Canvas and Layout]] — Canvas toolbar, insertion, and structure.
- [[08 - 12-Column Grid]] — Grid cells and coordinates.
- [[09 - Resizing Blocks]] — width and height.
- [[10 - Containers Overview]] — container rules.
- [[12 - Row]] — horizontal distribution and Ungroup.
- [[14 - Dense Layout]] — compact and manual placement.
