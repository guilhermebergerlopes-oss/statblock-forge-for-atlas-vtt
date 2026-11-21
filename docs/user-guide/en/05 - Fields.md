---
title: Statblock Forge — Fields
tags:
  - statblock-forge
  - documentation/fields
---

# Fields

Fields are the data properties of a statblock. Each Field has an internal `key`, a user-facing `label`, and a `type`. The type determines the value format and available editing controls. Metric and Table are Containers, not Field types.

## Field groups

The Field picker organizes Fields into five presentation groups. Forge files write the reorganized IDs described below; the editor normalizes them for its runtime model and remains compatible with older files.

| Group | Presented types | Use |
|---|---|---|
| **Values** | Number, Rating, Dice, Counter | Numeric values, ratings, dice expressions, and counters. |
| **Text** | In-line, Markdown | Inline plain text and formatted content. |
| **Choice** | Checkboxes, Selection | Boolean options and selection from template-defined options. |
| **Image** | Image | An image associated with the sheet. |
| **Collections** | List, Entries, Pairs, Groups | Lists, structured entries, key/value pairs, and grouped content. |

Forge `.forgetemplate` files and JSON sidecars write the reorganized IDs: **In-line** uses `inline`, **Selection** uses `selection`, **Counter** uses `counter`, and **Groups** uses `groups`. When opening older templates, Forge recognizes the previous IDs (`text`, `choice`, `counters`, and `spells`) and normalizes them automatically. When importing `.atlastemplate`, native Atlas IDs are normalized to current Forge IDs. **Checkboxes** remains `checkboxes`. The `scores` storage used by the Table Container is internal and is not offered as a regular Field.

## Tabular data and the Table Container

**Table** is not a Field: it is a data Container created with **Add Container → Table**. Forge manages an Atlas-native `scores` Field to store the table's rows and values. This technical Field is hidden from the Field palette, and its settings are available through the Table inspector.

To add data, drag any compatible Field except **Pairs** into the Table or use **Fields inside this Table** in the inspector. Each assigned Field becomes a column. **Show Labels in columns** controls Field headings; **Show Labels in rows** independently displays a label for each data row, and both options can be enabled together. When **Allow adding rows in statblocks** is enabled, editable statblocks show an **Add row** action. Additional rows store their own values without changing the original Field values. Reorder assigned Fields with the up/down controls. Removing a Field only removes its Table link; the original Field and its Values remain in the Template and statblocks.

Pairs Fields remain independent Collections and are not linked to Tables. When older Templates contain Pairs links or the previous Table column configuration, Forge detaches those links during migration while preserving the original Fields and their sample Values. Older `scores` Fields and Scores blocks continue to be recognized as Tables.

## Header Fields

The starter template includes reserved header Fields:

| Key | Default label | Type | Meaning |
|---|---|---|---|
| `name` | Name | In-line (JSON ID `inline`) | Creature or character name. |
| `image` | Token art | Image | Header Token art. |
| `level` | Level | Rating | Level or classification. |
| `type` | Type | In-line (JSON ID `inline`) | Creature category or type. |
| `hp` | HP | Number | Hit points. |
| `description` | Description | Markdown | Main description. |

These are header elements and do not need to be added to the Grid as regular blocks. The reserved `image` Field provides the Token-art area.

## Keys

A `key` is the internal identifier used to store and locate a value. A `label` is the readable name shown in the interface.

Documented key rules:

- 1–40 characters.
- Must begin with a letter.
- May contain letters, numbers, `_`, and `-`.
- Must be unique, ignoring case.
- Reserved keys cannot be used by custom Fields.

When a key is renamed, Forge records the previous key in `formerKeys` and updates recognized references in the layout, samples, and other supported settings.

## Groups Field (Forge JSON type `groups`; Atlas import type `spells`)

The **Groups** presentation type (Forge JSON ID `groups`; Atlas import ID `spells`) has its own editor in the statblock. Click the block to configure one or more groups. Each group can have a heading and multiple rows; every row has a category or usage label and one or more comma-separated values.

In the block inspector, choose **Line list** or **Tabs**. Tabs creates one tab for each category or usage label within a group. Forge saves the value using Atlas' native structure; it does not introduce a proprietary data format. When the Field is empty, the preview shows a prompt to add the first group; newly created statblocks start with empty Groups values.

## Type-specific settings

- **Number:** unit, tracking, and formulas where supported.
- **Rating:** numeric configuration and formulas where supported.
- **Selection:** options and single/multiple selection mode; each option can be referenced in formulas as `1` (selected) or `0` (not selected).
- **Table:** ordered child Fields and the option to show their labels as row headings; the internal `scores` Field is managed by the Container.
- **Entries / Abilities:** name and description keys plus additional Parts.
- **Counter:** row presets and maximum values.
- **Checkboxes:** boolean options that formulas can reference as `1` (checked) or `0` (unchecked).
- **Image:** image reference and framing.

Exact controls depend on the type and context.

## Advanced features

Part 4 covers Number/Rating formulas, Checkboxes and Selection as boolean references, dice, Counters, Atlas-native Conditions, Rest, and player permissions. Start with [[25 - Formulas in Number and Rating]].

## Deleting Fields

Before deleting a Field, check for blocks, formulas, Rest rules, or other references. Forge removes recognized structural links but protects dependencies that could invalidate calculations or rules.

## Editing values in a statblock

Fields are filled in the rendered statblock. Text, numbers, lists, Entries, Tabular Data, Counters, and other structures use suitable controls. When creating a sheet, Forge may focus the first empty editable Field. Values `0` and `false` count as filled; blank text and empty structures count as empty.

Every Collection supports custom values that belong only to the current statblock, without adding them to the shared Compendium. Use **Custom** for List, Pairs, and Groups; Entries has its own **Custom** action for adding an ability. Values inserted from the Compendium remain editable copies.

## Choosing a type

| Need | Suggested type |
|---|---|
| Current HP or number of uses | Number or Counter, depending on behavior |
| Narrative text | Markdown |
| Damage such as `3d8+2` | Dice |
| Category selected from options | Selection |
| Tags or senses | List |
| Attributes arranged in rows and columns | Table Container |
| Attacks with range, damage, and cost | Entries / Abilities |
| Named resistances with values | Pairs |
| Portrait or artwork | Image |
| Grouped values organized by category or use | Groups |
| Reusable boolean options | Checkboxes |

## Next step

After defining Fields and linking them to the layout, create an instance using [[06 - Creating and Filling Statblocks]].
