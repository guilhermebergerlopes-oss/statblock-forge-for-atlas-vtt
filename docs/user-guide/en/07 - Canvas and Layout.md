---
title: Statblock Forge — Canvas and Layout
aliases:
  - Forge Canvas
  - Statblock layout
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Canvas and Layout

The **Canvas** is the visual area of the template editor. Blocks are positioned, arranged in containers, and resized here. The preview uses the same renderer as the statblock, so structural changes can be reviewed while editing.

## Canvas toolbar

| Control | Purpose |
|---|---|
| **Dense Layout** | Switches between compact placement and stable/manual block positions. See [[14 - Dense Layout]]. |
| **Background grid** | Shows or hides guides for the configurable main Grid and the independent Grids inside Sections. It does not change saved placement. |
| **More options** | Expands or collapses secondary controls such as Grid columns, Dense Layout, sheet width, and selection actions. |
| **Add block** | Groups content and presentation choices. Heading can be static or linked to a In-line Field; Divider selects an orientation; Collections and Resources resolve to the block matching the Field type. Choices without a compatible Field are hidden. |
| **Add container** | Creates a Section, Row, or Tabs where allowed. |
| **↑ / ↓** | Moves the selected block within its sibling order in the same container. |
| **Ungroup** | Removes a selected Row wrapper while keeping its children. |

By default, **Statblock Mode**, **Add block**, and **Add container** remain visible. Other toolbar controls are collapsed under **More options**.

The **Toggle Statblock mode** command uses `Mod + Shift + S` by default. To change it, open **Statblock Forge settings**, click the **Statblock Mode shortcut** field, and press the desired key combination. `Mod` means Ctrl on Windows/Linux and Cmd on macOS.

Insertion menus are on the Canvas toolbar. Selecting a block also exposes its settings in the sidebar, including size, appearance, and type-specific options.

## Layout structure

- The main Canvas contains a configurable Grid, set to 12 columns by default and adjustable from 4 to 24 in **More options → Grid columns**.
- A **Section** creates its own Grid for its children.
- A **Row** places children side by side in a flexible horizontal strip.
- A **Tabs** container displays Sections as tabs; each Section holds its tab content. Each tab panel uses the same configured column count as the template, so its Section and child blocks can be resized.

A Grid is not a block you add. It is the positioning system used by the main Canvas and inside Sections.

## Insert a block or container

1. Select the Canvas, a block, or the container where you want to work.
2. Open **Add block** for content or **Add container** for structure.
3. Choose the type and, when required, its Field.
4. Adjust width, height, and appearance in the inspector.

When the last selected block is a compatible container, the new item is inserted inside it. If that container does not accept the chosen type, Forge finds the nearest ancestor level that does and inserts the new item immediately after the selected block (or after the ancestor container used as the insertion anchor). With a multi-selection, the last selected block is the insertion reference.

Tabs accepts only Sections as direct children, and Row does not accept Row or Tabs. When one of those incompatible types is selected, Forge places the new item beside the container at the nearest compatible level. To add content to an existing tab, select that tab's Section.

## Empty Canvas

When there are no blocks, the editor displays **No blocks placed**. This does not mean the template is invalid; add the first block or container to begin.

## Next notes

- [[08 - 12-Column Grid]] covers the configurable Grid, cells, placement, and automatic height.
- [[09 - Resizing Blocks]] explains size controls.
- [[10 - Containers Overview]] compares Section, Row, and Tabs.
