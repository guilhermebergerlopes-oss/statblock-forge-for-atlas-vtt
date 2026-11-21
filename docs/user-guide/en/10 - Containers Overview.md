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

A **Container** is a Canvas structure that groups Fields or other layout elements. Forge has two families: **structural Containers** (Section, Row, and Tabs) and **data Containers** (Metric and Table). All five are Containers, but each type accepts different contents and organizes data in its own way.

## Quick comparison

| Container | Family | What it contains | Best use |
|---|---|---|---|
| **Section** | Structural | Compatible blocks and Containers in an internal Grid. | Group attributes, defenses, traits, or equipment in a titled area. |
| **Row** | Structural | Compatible items distributed horizontally. | Align content in a strip, such as AC, HP, and Speed. |
| **Tabs** | Structural | Sections, one per tab. | Separate large groups such as attacks, spells, and equipment. |
| **Metric** | Data | Compatible scalar Fields such as In-line, Number, Rating, Dice, and Selection. | Present Fields as aligned metrics/values without creating extra Fields. |
| **Table** | Data | Compatible user Fields, plus Atlas-native internal storage. | Present Field values in a table. |

## Metric and Table are data Containers

### Metric

A **Metric** is a Canvas Block with data-Container behavior, not a Field. Create one with **Add Container → Metric**. Then drag compatible Fields onto the Metric on the Canvas or add them through the **Fields inside this Metric** inspector.

Metric accepts `inline` (In-line), `number`, `rating`, `dice`, and `selection` (Selection) Fields. The Fields themselves remain the source of data; the Metric groups them and controls their presentation. Removing a Field from a Metric only removes the Container link. It does not delete the Field or its Value.

### Table

A **Table** is a Canvas Block with data-Container behavior. Create one with **Add Container → Table**. Forge manages an internal Atlas-native `scores` Field for the table's rows and values; this technical Field is hidden from the ordinary Field palette.

To add data to a Table, drag a compatible Field into it or use **Fields inside this Table** in the inspector. Each Field becomes a column. **Show Labels in columns** controls the Field headings; **Show Labels in rows** independently shows a label for each data row, so both options can be enabled together. When **Allow adding rows in statblocks** is enabled, an editable statblock shows an **Add row** action. Additional rows store their own values without changing the original Field values. Reorder Fields in the inspector. Removing a Field only unlinks it; its definition and Values remain in the Template.

> Pairs Fields remain independent Collections and cannot be added to Tables. Existing Templates are migrated by detaching old Pairs links and removing obsolete Table column settings while preserving the Fields and their data.

## How Containers relate to the Canvas

The Canvas arranges elements in a tree. Section creates an internal Grid; Row distributes its children horizontally; Tabs displays Sections as panels. Metric and Table are special Canvas Block types with data-Container behavior. They are ordinary members of the Block tree, not Fields; their child Field links are stored separately from the Block's private rendering data.

```text
Canvas
├── Section: Defenses
│   ├── Metric: Main values
│   │   ├── Field: Armor Class (number)
│   │   └── Field: Speed (number)
│   └── Table: Resistances
│       ├── Field: Armor Class (number)
│       └── Field: Speed (number)
└── Tabs: Content
    ├── Section: Attacks
    │   └── Entries: Attacks
    └── Section: Special abilities
        └── Groups: Special abilities
```

A Container's position is defined by its parent; its child Fields are associated with the Metric or Table. To place a data Container in a tab, place it inside that tab's Section. Tabs accepts Sections as direct children.

## Nesting and compatibility rules

- **Tabs** accepts only Sections as direct children. To use a Metric or Table in a tab, add it inside that tab's Section.
- **Metric** accepts scalar `inline` (In-line), `number`, `rating`, `dice`, and `selection` (Selection) Fields.
- **Table** accepts compatible user Fields. Pairs remains a standalone Collection. Fields appear as columns; column headings and data-row labels are independent options. The Table can allow users to add data rows directly in editable statblocks.
- **Section** and **Row** follow their own composition rules and the Canvas's insertion targeting.
- A block or Container cannot be moved into itself or one of its descendants, which would create a cycle.

### Dragging Fields into data Containers

When a compatible Field is dropped inside a Metric or Table, Forge links it to the Container instead of creating a standalone block. An incompatible Field is rejected without losing its current placement. When a Field is dragged out of a Container and onto a regular Canvas position, Forge removes the Container link and creates a normal placement; the Field and its Values are preserved.

Dropping a Field directly onto Tabs follows the special Tabs behavior and creates a Section for the new tab. To add content to an existing tab, drop it onto that tab's Section.

## Containers, Fields, and Values

- A **Field** defines data and its type, such as `hp` (`number`) or `resistances` (`pairs`).
- A **Value** is the data for one statblock instance.
- A **structural Container** organizes other layout elements.
- A **data Container** groups child Fields and controls their presentation; it does not replace or duplicate those Fields.

Table data uses Atlas-native `scores` storage, managed internally by the Container and hidden from the Field palette. Older Templates with Metric or Scores blocks are recognized as Containers during migration; existing Fields and data are preserved.

## Choosing a Container

| Need | Choose | Example |
|---|---|---|
| Give a group a heading and arrange items freely. | **Section** | `Defenses`, with AC, saving throws, and resistances. |
| Distribute compatible content horizontally. | **Row** | AC, HP, and Speed in one strip. |
| Switch between groups. | **Tabs** | `Melee`, `Ranged`, and `Spells` tabs. |
| Group aligned scalar values. | **Metric** | HP, AC, and Speed as Fields inside a Metric. |
| Arrange compatible Fields as columns or labeled rows. | **Table** | Attributes, defenses, or other Field values. |

## Next notes

- [[11 - Section]] — headings, collapsible behavior, and the internal Grid.
- [[12 - Row]] — Span, horizontal distribution, alignment, and line height.
- [[13 - Tabs]] — creation, editing, Ability tabs, and removal.
- [[14 - Dense Layout]] — positioning children in Grids.
- [[15 - Moving and Reordering Blocks]] — dragging, insertion, and structural order.