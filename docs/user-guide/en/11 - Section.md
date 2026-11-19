---
title: Statblock Forge — Section
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Section

A **Section** is a container with an optional heading and an internal Grid. Use it to group blocks that belong to the same subject and need their own layout area, such as attributes, defenses, traits, equipment, or the content of a tab.

A Section may contain content blocks, other Sections, Rows, and Tabs. Its children are arranged in the Section's Grid, not in the Canvas's main Grid.

## Fixed Heading and Dynamic heading

Select the Section on the Canvas to edit its properties in the inspector.

| Property | Purpose | Example |
|---|---|---|
| **Heading** | Sets a fixed Section title. | `Defenses` |
| **Dynamic heading** | Selects a Field as the title source. | Field `phase_name` |

A dynamic heading takes precedence when its Field has a readable value. If the Field is empty, Forge falls back to the fixed Heading. If both are empty, the Section can appear without a title.

Example: set `Heading = Phase` and `Dynamic heading = phase_name`. A statblock with `phase_name = Awakened` shows `Awakened`; another statblock without that value keeps the title `Phase`.

Any Field in the Template can be selected as the dynamic source. Forge uses the readable content of its Value; for predictable headings, Text or Choice is usually clearer than a collection or numeric value.

## Behavior: always open or collapsible

The **Behavior** property controls how the Section appears in the statblock:

| Inspector option | Initial state | User action |
|---|---|---|
| **Always open** | Content appears in the layout normally. | The Section has no collapse control. |
| **Collapsible — initially open** | Content is initially visible. | The user can collapse and reopen it using the control below the statblock. |
| **Collapsible — initially closed** | Content is outside the initial layout. | The user opens it using the control below the statblock. |

In the published statblock and the interactive Canvas preview, collapsible Sections are represented by buttons in the statblock footer. A button uses the Section heading; if there is no heading, Forge generates a numbered label such as `Section (1)`. A Section configured to start open also has a button that lets the user collapse it.

### What happens to space when a Section is collapsed?

Collapsed content stops occupying its vertical area. Forge recalculates released space for blocks below it **that share columns with the released area**. Blocks beside it in non-overlapping columns keep their horizontal positions. Released space does not automatically turn into a column change.

When reopened, the Section restores its content and the layout below is recalculated to prevent overlap. Nested Sections remain subject to their parent container; if a child Section is inside a collapsed parent, the parent must be revealed to access it.

> [!important] Collapsible is not the same as Hidden
> A collapsible Section remains part of the statblock and can be opened by the user. A block marked **Hidden** for players is removed from the player's view and does not receive a footer button. See [[21 - Per-Block Appearance]] for visibility.

## The Section's internal Grid

Every Section creates an independent Grid for its children. The internal Grid uses the same physical column count configured for the Template, but occupies only the area reserved for the Section.

- Section children have positions independent from blocks outside it.
- `Span` still uses the logical 1–12 scale described in [[08 - 12-Column Grid]].
- The Grid can contain Stat, Metric, Line, Text, Entries, Image, Table, another Section, Row, or Tabs.
- Nested Sections create a new Grid for their own children.
- The Section's vertical size must accommodate its descendants; Forge calculates required rows beyond the configured minimum when content needs more space.

An empty Section keeps a minimum area and shows a placeholder on the Canvas. This makes the container easy to select and gives you a target for dropping Fields.

## Create and fill a Section

1. Select the Canvas or a container that accepts Sections.
2. Choose **Add container → Section**.
3. Select the Section to open its properties.
4. Set **Heading**, **Dynamic heading**, and **Behavior** as needed.
5. With the Section selected, use **Add block** or drag Fields from the palette into its internal area.
6. Adjust child `Span` and `Rows` to arrange the Grid.
7. Use **Dense Layout** to choose compact placement or manual positioning; see [[14 - Dense Layout]].

### Example: a defense section

```text
Section: Defenses
├── Stat: Armor Class       Span 3
├── Stat: Saving Throw      Span 3
├── Stat: Damage Threshold  Span 3
└── Row: Resistances        Span 12
    ├── Tags: Resistance    Span 6
    └── Tags: Immunity      Span 6
```

The Section groups the data and creates the internal Grid. The final Row creates a flexible strip inside that Grid. Fields remain independent and can be used by other compatible blocks.

## A Section as a Tabs panel

When a Section is a direct child of Tabs, it represents a tab:

- Its Heading (or Dynamic heading, when it has a readable value) becomes the tab label.
- The title is not repeated as a heading inside the panel.
- Section content remains arranged in its own Grid.
- **← / →** and **Delete tab** controls appear in the inspector.
- The Section's collapsible behavior does not work like a regular Section; panel switching is controlled by Tabs.

See [[13 - Tabs]] for tab rules and the specialized Ability tabs structure.

## Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| The Section has no title. | Heading is empty, Dynamic heading has no readable Value, or its label is hidden. | Set Heading or populate the dynamic Field. |
| A child is not inserted into the Section. | The drop landed on another block's edge, so the operation means before/after insertion. | Drop in the Section's central area or select it before using Add block. |
| The Section is taller than its Rows value. | Its internal layout or child content requires more rows. | Adjust child Span/Rows or rearrange the content. |
| A tab Section does not collapse. | Sections directly inside Tabs are panels, not regular collapsible Sections. | Add another Section inside the panel if you need a collapsible group. |

## See also

- [[10 - Containers Overview]] — nesting rules.
- [[12 - Row]] — horizontal strips inside a Section.
- [[13 - Tabs]] — Sections as tab panels.
- [[14 - Dense Layout]] — positioning within the internal Grid.
