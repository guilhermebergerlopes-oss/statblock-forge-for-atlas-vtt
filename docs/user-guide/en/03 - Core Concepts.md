---
title: Statblock Forge — Core Concepts
aliases:
  - Forge terminology
  - Template, Field, and block
tags:
  - statblock-forge
  - documentation/concepts
part: 1
---

# Core Concepts

Forge separates data definitions, presentation, and the Values stored by each sheet. The terms below are used throughout the editor and documentation.

## Template

A **Template** is a reusable statblock model. It defines:

- which Fields exist;
- each Field's type and options;
- the Canvas block/container structure;
- layout and appearance settings;
- optional example Values (`sample`);
- advanced settings associated with Fields or blocks.

A Template is not one specific creature. It is the definition that multiple creatures can share.

## Field

A **Field** defines one piece of data. Every Field has, at minimum:

| Property | Purpose | Example |
|---|---|---|
| `key` | Internal identifier used by data, blocks, and references | `might` |
| `label` | User-facing text, usually shown as the Field label | `Might` |
| `type` | Expected content type and editor/renderer behavior | `number` |

A `key` is not merely a decorative name: formulas, blocks, settings, and note Values may depend on it. Prefer short, stable keys without spaces, beginning with a letter. The Template validator accepts identifiers with letters, numbers, `_`, and `-`, up to 40 characters, and checks collisions without case sensitivity.

The `label` can be changed to improve presentation without, by itself, changing the identifier used by data. Forge also supports empty labels in some contexts to show only the Value; that does not mean a Field can have an empty key.

The `type` determines which Values and options make sense. For example, `number` stores a numeric value, `checkboxes` stores boolean states for named options, and `entries` stores a collection of named ability records.

See [[05 - Fields]] for the complete Field type catalog.

## Value

A **Value** is the content of a Field in one specific statblock. If a Template defines `might` as a Number Field, each statblock using that Template can have its own `might` Value.

Example:

| Template/Field | Statblock A | Statblock B |
|---|---:|---:|
| `might` (`number`) | 8 | 13 |
| `level` (`rating`) | 2 | 5 |
| `hp` (`number`) | 18 | 42 |

The Field definition is shared by both sheets. Only the Values belong to each instance.

### Calculated Values and Values used by formulas

Some numeric Fields can have a Number/Rating formula that calculates their Value from other Fields. A `dice` Field can also have a **Dice Formula** that uses other Values to build a roll expression.

Conceptual Dice Formula stored in the Template:

```text
{proficiency}d{might}+{level}
```

With `proficiency = 2`, `might = 8`, and `level = 3` in the current instance, the resolved expression is:

```text
2d8+3
```

The formula text belongs to the Template definition; the substituted numbers come from the current statblock. See [[25 - Formulas in Number and Rating]] and [[27 - Dice Fields and Set Dice]]: Number/Rating formulas, Dice Formulas, and Rest formulas are different languages/contexts.

## Block

A **block** is a visual element in the layout. It can:

- present one Field;
- combine multiple Fields;
- display static content;
- act as a visual or structural element.

A Field does not determine where it appears. It must be connected to a block on the Canvas. The block does not replace the Field definition; it consumes and presents the data.

### Initial mapping between Field types and blocks

When a Field is added/dragged to the Canvas, Forge chooses a suitable default block type. The initial mapping in the code is:

| Field type | Default block | Typical use |
|---|---|---|
| `inline`, `number`, `rating`, `dice`, `selection` | `Stat` | One value, such as type, attribute, level, HP, or a dice formula. |
| `markdown` | `Text` | Description with Markdown content. |
| `list` | `Tags` | Compact list of tags or keywords. |
| `scores` | Internal `Table` storage | Row/column data retained in Atlas-native format; not created as an ordinary Field. |
| `entries` | `Entries` | Collection of named abilities/entries. |
| `pairs` | `Pairs` | Key/value pairs. |
| `image` | `Image` | Vault-linked image. |
| `groups` | `Groups` | Collection of spell groups/entries (formerly labeled Spells). |
| `counter` | `Counter` | Rows with uses, maximum, and recovery. |
| `checkboxes` | `Checkboxes` | Checkable options. |

Forge-owned JSON stores the reorganized IDs `inline`, `selection`, `counter`, and `groups`; templates using the earlier IDs `text`, `choice`, `counters`, and `spells` remain readable. When importing an Atlas `.atlastemplate`, Forge normalizes native Atlas IDs to the current Forge IDs. This is the initial creation mapping, not a promise that each Field can appear only once or that every block is compatible with every type. The inspector filters choices when a block requires a specific type. See [[05 - Fields]] and the individual block notes for detailed rules.

### Other presentation blocks

The Canvas also offers blocks that do not correspond to one Field:

| Block | When to use it | Example |
|---|---|---|
| `Title` | Give heading hierarchy to an eligible Field | Creature name as a title. |
| `Line` | Present several Fields on one line | `Size · Type · Alignment`. |
| `Track` | Display a Number with current/maximum tracking | HP, mana, or energy shown as boxes/bar. |
| `Heading` | Add a static section heading | `Defenses`. |
| `Text` without a Field | Write static text | A rule note or caption. |
| `Divider` / `Vertical divider` | Visually separate content | Divider between groups. |

`Line` can reference multiple Fields. `Track` uses a Number Field and tracking settings. `Metric` and `Table` are Canvas Block types with data-Container behavior: Metric groups scalar Fields (`inline`, `number`, `rating`, `dice`, and `selection`), while Table groups compatible user Fields. Pairs remains a standalone Collection. Table owns a hidden Atlas-native `scores` storage adapter; it is not a user Field. See [[10 - Containers Overview]].

## Container

A **Container** organizes Fields or layout elements. Forge has two families:

- **Section, Row, and Tabs:** structural Containers that arrange layout elements.
- **Metric:** a data Container for scalar Fields of type `inline`, `number`, `rating`, `dice`, and `selection`.
- **Table:** a data Container for compatible Fields, with Atlas-native `scores` storage managed internally. Pairs remains a standalone Collection.

Metric and Table are Block types, not Field types. They appear and are organized on the Canvas like other Blocks, while also accepting child Fields. Their child Fields remain the source of Values; Table's native `scores` adapter is private implementation storage. See [[10 - Containers Overview]] and the layout notes.

## Statblock

A **statblock** is an instance created from a Template. Forge creates a Markdown note, stores the link to the Template, and initializes Values according to the user's choices.

Example:

- Template: `Ash Creature` — defines `name`, `might`, `hp`, `proficiency`, and `attack`.
- Statblock `Ash Guard` — Might 8, HP 18, Proficiency 2.
- Statblock `Ash Brute` — Might 13, HP 42, Proficiency 3.

Both notes use the same structure, but their Values are independent.

## Sample values

A Template can store an example object (`sample`) to preview the layout and demonstrate expected content. When creating a statblock, **Copy example values** starts unchecked.

- Unchecked: ordinary Samples are not copied; the note starts with the supplied name and any Template-pinned images, when configured.
- Checked: Samples defined for Fields are copied. Structured data is cloned so the new instance does not share editable objects with the Template.

The entered name takes precedence in the reserved name Field when that Field exists. See [[06 - Creating and Filling Statblocks]].

## Files and identity

| Element | Content/identity |
|---|---|
| `.forgetemplate` | Atlas-compatible Template plus the `statblockForge` namespace holding Forge-only layout metadata. |
| `.atlastemplate` | Atlas-native file without the Forge metadata namespace. |
| `.md` note | Instance Values and Template-link metadata. |
| Template ID | Stable identity used to locate the Template and preserve links. |
| Block ID | Identity of a visual element in the layout. |
| Field key | Identity of a data property. |

Do not confuse the visible file name, Field key, Template ID, and block ID. Changing each has different consequences.

## Next step

Read [[04 - Creating and Editing Templates]] to create your first model. Then use [[05 - Fields]] to choose data types before building the Canvas.
