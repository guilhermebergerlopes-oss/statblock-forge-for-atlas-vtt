---
title: Statblock Forge — Fields
tags:
  - statblock-forge
  - documentation/fields
---

# Fields

Fields are the data properties of a statblock. Each Field has an internal `key`, a user-facing `label`, and a `type`. The type determines the value format and available editing controls.

## Available types

| Type | Use | General format |
|---|---|---|
| Text | Short names, categories, or plain text. | Text |
| Markdown | Descriptions and formatted content. | Markdown text |
| Number | Quantities, HP, range, and numeric values. | Number |
| Rating | Levels, ranks, or numeric/representative scales. | Rating value |
| Dice | Dice expressions. | Notation such as `2d6+2` |
| Choice | Selection from template-defined options. | One or more options |
| List | Simple collections of items. | Text list |
| Tabular Data | Values stored in rows and columns. | Tabular data structure |
| Entries / Abilities | Abilities, attacks, or powers. | Entries with configurable parts |
| Pairs | Named key/value data. | Pair object |
| Image | An image associated with the sheet. | Image reference |
| Spells | Spellcasting groups with use/level labels and spell lists. | Headers and `{ level: 'spells' }` records in Atlas-native format |
| Counters | Counters with values and limits. | Counter collection |
| Checkboxes | Boolean options. | Boolean value map |

## Tabular Data and the Table block

**Tabular Data** is a Field type: it stores the statblock's rows, columns, and values. The **Table** block is a layout element that references this Field and controls how those values are presented on the Canvas and in the statblock. The block does not create a second copy of the data.

In **Properties**, create or configure a **Tabular Data** Field. In **Structure**, add a **Table** block and link it to that Field to display the data.

## Header Fields

The starter template includes reserved header Fields:

| Key | Default label | Type | Meaning |
|---|---|---|---|
| `name` | Name | Text | Creature or character name. |
| `image` | Token art | Image | Header Token art. |
| `level` | Level | Rating | Level or classification. |
| `type` | Type | Text | Creature category or type. |
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

## Spells Fields

The **Spells** type has its own editor in the statblock. Click the block to configure one or more spellcasting groups. Each group can have a heading (for example, *Innate Spellcasting*) and multiple lines with a use/level label (such as *At will*, *1st level*, or *1/day*) and comma-separated spell names.

In the block inspector, choose **Line list** or **Tabs**. Tabs creates one tab for each use/level label within a group. Forge saves the value using Atlas' native structure; it does not introduce a proprietary data format. When the Field is empty, the preview shows a prompt to add the first group; newly created statblocks start without spells.

## Type-specific settings

- **Number:** unit, tracking, and formulas where supported.
- **Rating:** numeric configuration and formulas where supported.
- **Choice:** options and single/multiple selection mode.
- **Tabular Data:** columns and row/column permissions.
- **Entries / Abilities:** name and description keys plus additional Parts.
- **Counters:** row presets and maximum values.
- **Checkboxes:** boolean options that formulas can reference as `1` (checked) or `0` (unchecked).
- **Image:** image reference and framing.

Exact controls depend on the type and context.

## Advanced features

Part 4 covers Number/Rating formulas, Checkboxes as boolean references, dice, Counters, Atlas-native Conditions, Rest, and player permissions. Start with [[25 - Formulas in Number and Rating]].

## Deleting Fields

Before deleting a Field, check for blocks, formulas, Rest rules, or other references. Forge removes recognized structural links but protects dependencies that could invalidate calculations or rules.

## Editing values in a statblock

Fields are filled in the rendered statblock. Text, numbers, lists, Entries, Tabular Data, Counters, and other structures use suitable controls. When creating a sheet, Forge may focus the first empty editable Field. Values `0` and `false` count as filled; blank text and empty structures count as empty.

## Choosing a type

| Need | Suggested type |
|---|---|
| Current HP or number of uses | Number or Counter, depending on behavior |
| Narrative text | Markdown |
| Damage such as `3d8+2` | Dice |
| Category selected from options | Choice |
| Tags or senses | List |
| Attributes arranged in rows and columns | Tabular Data |
| Attacks with range, damage, and cost | Entries / Abilities |
| Named resistances with values | Pairs |
| Portrait or artwork | Image |
| Spellcasting groups and spells by use/level | Spells |
| Reusable boolean options | Checkboxes |

## Next step

After defining Fields and linking them to the layout, create an instance using [[06 - Creating and Filling Statblocks]].
