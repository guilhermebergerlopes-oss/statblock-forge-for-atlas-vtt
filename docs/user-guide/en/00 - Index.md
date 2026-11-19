---
title: Statblock Forge — Documentation
aliases:
  - Statblock Forge Docs
  - Statblock Forge Manual
tags:
  - statblock-forge
  - documentation
  - index
status: expanded review
forge-version: 0.4.0
---

# Statblock Forge documentation

This manual explains how to create reusable Templates, arrange statblocks in the Canvas, configure Fields, build formulas, and use advanced features in **Statblock Forge for Atlas VTT**. The notes are designed for an Obsidian Vault and use Markdown, YAML frontmatter, wikilinks, and callouts.

> [!info] Scope of this edition
> This edition follows Forge codebase **0.4.0**. It includes Dice Field validation using the roll parser, full-expression recognition in text, Atlas-integrated roll history, and dynamic formulas in `dice` Fields based on Number/Rating Values. The package delivered by **Download documentation** contains 34 notes in the selected language: this index and 33 topic notes, grouped into four parts.

## Recommended reading path

For a first-time user, read the notes in order. If you already know the editor, use the subject index below.

### Part 1 — Fundamentals

1. [[01 - Overview]] — purpose, architecture, and Forge boundaries.
2. [[02 - Installation and Setup]] — requirements, installation, folders, language, and preferences.
3. [[03 - Core Concepts]] — Templates, Fields, blocks, containers, statblocks, and notes.
4. [[04 - Creating and Editing Templates]] — creation, Field/block relationships, saving, and recovery.
5. [[05 - Fields]] — Field types, value formats, and uses.
6. [[06 - Creating and Filling Statblocks]] — instances, Samples, and Value editing.

### Part 2 — Canvas and layout

7. [[07 - Canvas and Layout]] — visual editor overview.
8. [[08 - 12-Column Grid]] — configurable Grid, cells, placement, and height.
9. [[09 - Resizing Blocks]] — width, height, and space allocation.
10. [[10 - Containers Overview]] — structure and nesting rules.
11. [[11 - Section]] — grouping blocks in an internal Grid.
12. [[12 - Row]] — horizontal distribution.
13. [[13 - Tabs]] — tabbed content.
14. [[14 - Dense Layout]] — compact placement and manual positions.
15. [[15 - Moving and Reordering Blocks]] — dragging, insertion, and structural order.

### Part 3 — Appearance

16. [[16 - Appearance Overview]] — visual customization layers.
17. [[17 - Built-in Themes]] — included presets.
18. [[18 - Creating and Customizing Themes]] — palettes and reusable themes.
19. [[19 - Outer Frame]] — statblock outline.
20. [[20 - Token Art Frame]] — decorative frame around header artwork.
21. [[21 - Per-Block Appearance]] — surfaces, text, borders, and indicators.
22. [[22 - Image Fields and Framing]] — Vault images and Template framing.
23. [[23 - Framing Images in the Statblock]] — zoom and repositioning while using a sheet.
24. [[24 - .forgestyle Style Library]] — importing and exporting themes and frames.

### Part 4 — Formulas and advanced features

25. [[25 - Formulas in Number and Rating]] — numeric expressions, dependencies, and references.
26. [[26 - Checkboxes and Boolean References]] — boolean options as formula inputs.
27. [[27 - Dice Fields and Set Dice]] — dice expressions, Value interpolation, and roll sets.
28. [[28 - Counters]] — rows, uses, recovery, and Rest assignment.
29. [[29 - Conditions]] — Atlas-native Conditions, per-collection catalog, and per-Token state.
30. [[30 - Rest Setup and Flow]] — buttons, choices, and Rest execution.
31. [[31 - Rest Rules and Formulas]] — targets, operations, formulas, and spending.
32. [[32 - Rest Choices and Actions]] — steps, actions, and ally choices.
33. [[33 - Player Permissions]] — `edit`, `read`, `hidden`, and `Total Hidden` access.

## Formula quick reference

Forge has different formula families. They are not interchangeable:

| Family | Where it is used | Syntax and example |
|---|---|---|
| **Number/Rating Formula** | Calculates the numeric Value of a Number/Rating Field. | [[25 - Formulas in Number and Rating]]; accepts bare keys, `@key`, and `{key}`. Example: `floor(@strength / 2)`. |
| **Dice Formula** | Configured on a `dice` Field; builds a roll from statblock Values. | [[27 - Dice Fields and Set Dice]]; accepts `@fieldKey` and `{fieldKey}`; both forms can be mixed. Example: `@proficiency d{might}+{level}`. |
| **Rest formula** | Recovery, per-unit spending, and `regain` rules. | [[31 - Rest Rules and Formulas]]; accepts `@field_key` and `{field_key}`. Example: `@level d4` or `{level}d4`. |
| **Scores column formula** | Calculates a derived cell in a Scores table. | [[05 - Fields]]; uses `value` for the current row cell and the column's documented syntax. |
| **Metric formula** | Calculates the value of a Metric slot. | [[05 - Fields]] and [[25 - Formulas in Number and Rating]]; it is slot configuration, not the Field's own formula. |

> [!warning] Do not mix formula syntaxes
> `@key` and `{key}` are alternative Field-reference forms in Number/Rating formulas, Dice Formula, and Rest formulas. Number/Rating formulas also retain bare-key references. `value` belongs to the Number/Rating, Scores, or Metric formula context. Check the relevant note before copying an expression.

## Reading the examples

- `@proficiency` and `{proficiency}` are alternative references to the same Field and can be mixed in Dice and Rest formulas.
- Number/Rating formulas also accept the bare key, such as `strength`, alongside `@strength` and `{strength}`.
- `value` represents the value in the formula's current context; check the matching note.
- An expression shown as `2d8+3` may be the resolved result of a stored configuration such as `{proficiency}d{might}+{level}`.
- A block controls presentation. A Field defines data. The layout must connect them.

## Quick glossary

| Term | Meaning |
|---|---|
| **Template** | Reusable model defining Fields and layout. |
| **Field** | Data definition with a `key`, `label`, `type`, and type-specific options. |
| **Value** | A Field's content in one statblock instance. |
| **Block** | Layout element that presents a Field or static content. |
| **Container** | Structural block that arranges other blocks, such as Section, Row, and Tabs. |
| **Statblock** | Filled instance of a Template. |
| **Sample** | Example Values stored in a Template for preview and optional copying when creating a sheet. |
| **Resource** | A tracked value that can be spent and restored by Rest rules or Atlas. |
| **Counter** | A set of rows with maximum, spent uses, and recovery rules. |
| **Atlas Condition** | A collection-defined state stored on the Token and managed by Atlas, not Forge. |

## Scope, version, and language

- Based on Statblock Forge **v0.4.0**.
- Minimum Obsidian version declared in the manifest: **1.8.7**.
- The plugin is marked desktop-only.
- UI control names remain in English when that is the application's label; Brazilian Portuguese is also available in settings.
- Forge is an independent plugin. Atlas integration uses compatibility contracts and workflows; it does not make Forge Atlas's native editor.

## Downloading the documentation into your Vault

1. Open **Settings → Community plugins → Statblock Forge**.
2. Check **Language**.
3. Set **Documentation folder** if you want another destination.
4. Click **Download documentation**.
5. Open `00 - Index.md` in the created folder.

> [!important] How documentation updates work
> The command creates files only when they do not already exist. It preserves existing Vault notes and **does not overwrite them**. To receive a revised edition, choose a new destination or back up and move/rename the old notes before downloading again. This avoids replacing personal annotations without confirmation.

## Supplemental technical references

The source repository also contains engineering notes under `docs/atlas-integration/` about integration contracts, off-scene rolls, Resource resolution, serialization, and tests. They are source-code technical references and are not part of the 34 notes delivered by **Download documentation**.

## Conventions and recommendations

- Keep the note collection in a dedicated folder so its wikilinks resolve without adjustment.
- When adapting examples, keep the `key` of Fields referenced by formulas, blocks, Rest rules, and Resources stable.
- Before renaming or removing Fields used by formulas or rules, review their dependencies.
- Keep backups of Templates and statblock notes before migrations or bulk changes.
