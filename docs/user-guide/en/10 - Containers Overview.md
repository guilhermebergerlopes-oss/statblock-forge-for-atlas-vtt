---
title: Statblock Forge — Containers Overview
aliases:
  - Forge containers
  - Container structure
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Containers Overview

A **container** is a structural block that organizes other blocks. It defines how children are grouped, placed, and sized. A container is not a Field: it does not need a Field, does not store a Value, and does not create statblock data by itself.

Forge has three containers: **Section**, **Row**, and **Tabs**. They are not interchangeable; each has different composition and nesting rules.

## Quick comparison

| Container | Composition model | How children are placed | Best use |
|---|---|---|---|
| **Section** | Group with its own Grid. | Each child has an independent position in the internal Grid. | Group attributes, defenses, traits, or equipment in a titled area. |
| **Row** | Flexible horizontal strip. | Children share width proportionally by `Span` and follow sibling order. | Align short values such as AC, HP, and Speed, or build an indicator strip. |
| **Tabs** | Navigation between panels. | Each direct child is a Section; only the active panel is shown. | Separate large groups—attacks, spells, and equipment—without showing all of them at once. |

## How containers relate to the Grid

The main Grid arranges the Canvas's direct children. A **Section** creates another Grid for its own children. Sections used as tabs also have an internal Grid. These Grids use the same physical column count configured for the template; a nested Grid does not reduce its track count just because its parent Section occupies only part of the outer area.

A **Row does not create an internal Grid**. It distributes children across flexible lines using `Span` as a relative weight. **Tabs** organizes Sections into panels; it is not a Grid into which content blocks can be inserted directly.

```text
Canvas / main Grid
├── Section: Defenses            ← owns an internal Grid
│   ├── Stat: Armor Class
│   ├── Stat: Saving Throws
│   └── Row: Resistances          ← horizontal strip inside the Section
│       ├── Tags: Resistances
│       └── Tags: Immunities
└── Tabs: Content                ← occupies a position in the main Grid
    ├── Section: Attacks         ← panel / tab with its own Grid
    │   └── Entries: Attacks
    └── Section: Spells
        └── Spells: Spell list
```

This is an example tree. Each container's position is defined by its parent; its children are positioned by the immediate container.

## Nesting rules

Forge preserves the container tree. Rules for direct children are:

| Parent | May contain | Cannot directly contain |
|---|---|---|
| **Canvas / main Grid** | Content blocks, Section, Row, and Tabs. | — |
| **Section** | Content blocks, other Sections, Rows, and Tabs. | — |
| **Row** | Content blocks and Sections. | Another Row or Tabs. |
| **Tabs** | Sections only. | Stat, Metric, Entries, Row, Tabs, or any content block directly. |

A block also cannot be moved into itself or one of its descendants, which would create a cycle in the tree.

### What happens when an insertion is incompatible?

The **Add block** / **Add container** toolbar considers the last selection:

1. If the last selected block is a container that accepts the chosen type, the new item is inserted inside it.
2. If it does not accept the type, Forge searches for the nearest ancestor level that does and inserts the item beside the selected block or container.
3. With multiple blocks selected, the last selected block is the insertion reference.

An option may therefore remain available even when it cannot be a direct child of the current container: Forge can redirect insertion to a compatible level. To insert content into an existing tab, select that tab's **Section**, not the Tabs container.

### Dragging a Field onto Tabs

When a Field from the palette is dropped directly onto Tabs, Forge creates a new Section, uses the Field label as the new tab title, and places the linked block inside it. If the Field already has a block in the layout, Forge moves that existing representation into the new Section rather than creating a second independent presentation.

To add a Field to an existing tab, drop it onto the Section that represents that tab.

## Containers are not Fields or content blocks

- A **Field** defines a property and its data type, such as `might`, `hp`, or `attacks`.
- A **Value** is the data for one statblock, such as `might = 8`.
- A **content block** presents a Field or text, for example `Stat`, `Metric`, `Entries`, or `Image`.
- A **container** organizes content blocks and other containers.

Creating a Section, Row, or Tabs does not create a new statblock property. See [[05 - Fields]] for data and [[07 - Canvas and Layout]] for blocks.

## Empty containers

A newly created container may show a placeholder on the Canvas until it receives children. This does not mean the Template is invalid. If the preview shows a message such as “Add a Section to create a tab,” add the child type required by that container.

## Choosing a container

| Need | Choose | Example |
|---|---|---|
| Give a group a heading and arrange its items freely. | **Section** | `Defenses`, with AC, saving throws, and resistances. |
| Place small blocks side by side. | **Row** | AC, HP, and Speed in one strip. |
| Switch between groups that do not need to appear together. | **Tabs** | `Melee`, `Ranged`, and `Spells` tabs. |

Do not create a Row just to get a titled area; use Section. Do not create several Sections side by side to simulate proportional horizontal widths; use Row. Do not use Tabs when every group must remain visible at the same time.

## Next notes

- [[11 - Section]] — fixed/dynamic headings, collapsible behavior, and the internal Grid.
- [[12 - Row]] — Span, horizontal distribution, alignment, and line height.
- [[13 - Tabs]] — creation, editing, Ability tabs, and removal.
- [[14 - Dense Layout]] — positioning children in Grids.
- [[15 - Moving and Reordering Blocks]] — dragging, insertion, and structural order.
