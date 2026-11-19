---
title: Statblock Forge — Overview
aliases:
  - About Statblock Forge
  - What is Forge
tags:
  - statblock-forge
  - documentation/introduction
part: 1
---

# Overview

**Statblock Forge** is an independent Obsidian plugin for creating, editing, and rendering statblocks from reusable Templates. The editor provides a configurable 4–24-column Grid, blocks linked to Fields, nested containers, and appearance controls. A Markdown note can link to a Template and store the Values for one creature, character, NPC, or other record.

The central design goal is to separate **reusable structure** from **instance data**. A Template defines which data exists and how it is presented; each statblock stores its own Values.

## What Forge provides

- **Templates:** create models from scratch, open existing models, edit Fields, and save updates or copies.
- **Fields:** define data types such as Text, Number, Rating, Dice, Choice, Markdown, List, Scores, Entries, Pairs, Image, Spells, Counters, and Checkboxes.
- **Canvas:** compose blocks and containers, choose positions, resize content, and organize layouts.
- **Presentation blocks:** display individual values, metrics, groups of Fields, lists, tables, abilities, pairs, images, spells, Counters, and related controls.
- **Appearance:** apply themes, frames, colors, borders, shapes, and per-block styles.
- **Formulas:** calculate Number/Rating Values, build Dice Formulas from other Fields, and link dice expressions found in text.
- **Statblocks:** create Markdown notes linked to Templates and edit their Values in the rendered view.
- **Advanced features:** Counters, Rest, Compendium, player permissions, and integration with Atlas-native features.

Availability depends on the Field type, the block being used, and—in some cases—the presence of a compatible Atlas integration. The following notes distinguish these levels.

## Basic workflow

```text
Create a Template
    ↓
Define Fields (data and types)
    ↓
Connect Fields to Canvas blocks
    ↓
Arrange layout and appearance
    ↓
Save the Template
    ↓
Create a Markdown statblock note
    ↓
Fill in instance Values
    ↓
Render, edit, and use the sheet
```

## A Template and a statblock are different things

| Element | Stores | Example |
|---|---|---|
| Template | Field definitions, layout, settings, and Samples | `Creature — Humanoid` |
| Field | Definition of one property | `might`, type `number` |
| Value | One Field's value in one sheet | `might = 8` for one creature |
| Block | How data or content appears | `Stat` for Might; `Metric` for several Values side by side |
| Statblock | A complete instance with its own Values | `Ash Guard`, `Might = 8`, `HP = 24` |

Two statblocks can use the same Template without sharing their Values. Changing `might` in one note does not change the Value in another note using that Template.

## Separation of responsibilities

```text
Template (.forgetemplate / .atlastemplate)
  ├─ Fields: keys, labels, types, and options
  ├─ Layout: blocks, containers, and order
  ├─ Presentation settings
  └─ Optional Samples

Markdown statblock note
  ├─ Template link
  ├─ Values for this instance
  └─ Note-specific metadata

Atlas VTT (when installed and compatible)
  ├─ Scene data and Resources owned by Atlas
  ├─ Atlas dice sets and roll engine
  └─ Presentation of rolls routed to Atlas
```

> [!important] Forge is not Atlas's native editor fork
> Statblock Forge is an independent plugin. It reads and produces compatible formats through defined workflows and can use Atlas public APIs when available. This integration does not replace Atlas interfaces or internal data.

## Formats and files

| File/data | Purpose |
|---|---|
| `.forgetemplate` | Template saved by Forge. It keeps the Atlas-compatible JSON structure and includes the `statblockForge` namespace for Forge-only layout metadata. |
| `.atlastemplate` | Atlas-native Template. Forge can open compatible files and export a clean copy without Forge-only metadata. |
| `.md` note | Individual statblock, with Values and a link to its source Template. |
| Layout sidecar | When editing/saving Atlas-format files, Forge may store its own layout metadata under `.statblock-forge/layouts/` inside the configured Template folder. |
| `.forgestyle` | Portable package of custom themes and frames. |

Do not manually edit link metadata or sidecar data unless you understand the relationship among `templateId`, Field keys, and block IDs. See Part 5 for integration details as it becomes available.

## Forge and Atlas: ownership boundaries

| Feature | Main responsibility |
|---|---|
| Forge visual editor, `.forgetemplate` files, and Forge sidecars | Forge |
| Markdown statblock note and Forge Value editor | Forge |
| Fields and layout in `.atlastemplate` format | Atlas-compatible Template contract; Forge export removes Forge-only metadata |
| Scene data, tokens, and Resources owned by Atlas | Atlas |
| Interpretation, execution, and display of rolls routed through Atlas APIs | Atlas |
| Forge-local Rest buttons and rules | Forge, with Atlas adapters for Resources/rolls when applicable |

Exact compatibility depends on the installed version and available public API. Forge keeps fallback paths for workflows that do not expose a given capability; do not assume every Atlas feature is available in every installation.

## Requirements and known limits

- Obsidian **1.8.7 or later**, according to `minAppVersion` in the manifest.
- The manifest marks the plugin as **desktop-only**.
- Forge works with Vault files. Backups are recommended before converting, overwriting, or reorganizing Templates.
- A formula or block can depend on Fields that must exist and resolve to the expected type. Formula notes explain those dependencies.

## Which part should I read?

- To build a statblock from scratch: Parts 1 and 2.
- To customize its visual identity: Part 3.
- To model derived attributes, dice, Counters, and Rest: Part 4.
- To understand file formats and project integration: Part 5.

## Next step

Read [[02 - Installation and Setup]] to prepare the plugin and Vault folders. Then continue to [[03 - Core Concepts]] and [[04 - Creating and Editing Templates]].
