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
- **Fields:** organize data into Values (Number, Rating, Dice, Counter), Text (In-line, Markdown), Choice (Checkboxes, Selection), Image, and Collections (List, Entries, Pairs, Groups).
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
> Statblock Forge is an independent plugin. It integrates directly with Atlas internal runtimes using the inspected 0.17.0 and 0.18.0 source snapshots as baselines for previews, tokens, Resources, and in-map rolls. Newer Atlas versions are not blocked by an exact-version allowlist: Forge attempts forward compatibility and checks the methods and service capabilities required by each feature. This is not a guarantee that every future Atlas API remains compatible; features whose required internals change may remain unavailable until Forge is updated. The integration uses internal services rather than a general public plugin API. Forge does not replace Atlas interfaces or take ownership of Atlas scene, token, or Resource data.

## Formats and files

| File/data | Purpose |
|---|---|
| `.forgetemplate` | Template saved by Forge. It uses Forge-owned Field type IDs and includes the `statblockForge` namespace for Forge-only layout metadata. |
| `.atlastemplate` | Atlas-native Template. Forge can import it as a read-only source and create an editable `.forgetemplate` copy; the original remains unchanged. |
| `.md` note | Individual statblock, with Values and a link to its source Template. |
| Layout sidecar | During import, Forge may read a matching legacy sidecar from `.statblock-forge/layouts/`. Sidecars are read-only input; Forge never creates or updates Atlas sidecars. |
| `.forgestyle` | Portable package of custom themes and frames. |

Do not manually edit link metadata or sidecar data unless you understand the relationship among `templateId`, Field keys, and block IDs. Deep Atlas integration uses the inspected 0.17.0 and 0.18.0 source snapshots as runtime baselines and depends on Atlas internal structures. Newer versions are allowed through capability checks; a feature is available only when its required runtime methods are present.

## Forge and Atlas: ownership boundaries

| Feature | Main responsibility |
|---|---|
| Forge visual editor, `.forgetemplate` files, and Forge sidecars | Forge |
| Markdown statblock note and Forge Value editor | Forge |
| Fields and layout in `.atlastemplate` format | Native Atlas input format; Forge imports compatible data into a `.forgetemplate` copy |
| Scene data, tokens, and Resources owned by Atlas | Atlas |
| In-map rolls routed to the Atlas DiceTool; scene-independent rolls and Forge-owned history | Atlas and Forge, according to roll origin |
| Forge-local Rest buttons and rules | Forge; Resource updates use Atlas internal services and stores |

### Linked Atlas Resource synchronization

When a Forge v2 statblock note is linked to an Atlas Character, the Forge follows the collection or played-campaign Resource definitions for that map. Changes to the note's Resource Fields update the matching Resources on linked Characters in open GM maps through Atlas' token store. Current amounts are preserved and clamped to the new maximum, manually overridden maxima remain untouched, and newly added Resources start full (`drains`) or empty (`fills`). An explicitly empty Field removes its Resource; a missing or non-numeric Field does not. Closed maps follow their linked statblocks when opened, and player views are not directly modified. Atlas continues to own Resource values and synchronization; Forge Rest actions are handled separately.

Deep Atlas integration uses the internal runtimes inspected in Atlas 0.17.0 and 0.18.0 as compatibility baselines. Atlas versions 0.17.0 and newer are allowed; for later versions, Forge checks the required methods and services before each feature operates. If Atlas changes an internal API, the affected feature remains unavailable while the Forge editor and Vault-only workflows continue to work.

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
