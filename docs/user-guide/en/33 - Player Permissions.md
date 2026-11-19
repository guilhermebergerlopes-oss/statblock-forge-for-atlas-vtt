---
title: Statblock Forge — Player Permissions
aliases:
  - Player access
  - Field permissions
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/permissions
part: 4
---

# Player Permissions

The block inspector can show a **Players** setting to control how players may interact with the Fields represented by that block in Atlas contexts that respect access permissions. Forge stores these options in the Template's native `players` property.

This is **not** an Obsidian account system, Vault-folder permission, or encryption. It is access metadata consumed by compatible Atlas views and workflows.

## Access options

| Interface option | Stored value | Behavior |
|---|---|---|
| **Players can edit** | `edit` | Players can view and edit the Field Value. |
| **Players can only read** | `read` | Players can view the Value but cannot edit it. |
| **Hidden from players** | `hidden` | The Field is not presented to players but remains in the final Forge statblock for the GM. |
| **Total Hidden** | Forge layout metadata + `hidden` | Removes the block from the final Forge statblock and marks its Fields as `hidden` for Atlas export. |

`Total Hidden` is not a fourth value in the `players` property. It is a Forge-local layout visibility setting that also applies `hidden` to the represented Fields.

## Default access

- Ordinary Fields default to `edit`.
- `spells` Fields default to `read`; the inspector does not offer `edit` for a block representing only `spells` Fields.
- Fixed header Fields such as `name`, the `image` key, Fields with `display-name` meaning, and Image-type Fields are treated as read-only by Atlas.

Forge stores only deviations from defaults. When a Field returns to its default, its `players` entry is removed. If no exceptions remain, the whole property may be removed. Old entries under `formerKeys` are also cleared when access is changed using the current key.

## Which blocks show the control

The inspector only shows **Players** when the selected block represents Fields whose access can be changed.

| Block type | Fields considered by the inspector |
|---|---|
| **Metric** | Every Field listed in `fields`, plus `headingField` when present. |
| **Entries** | The associated `field`, plus `headingField` when present. |
| **Ability Tabs** | Entries Fields when every tab contains exactly one Section and that Section contains exactly one Entries block. |
| **Field-linked block** | The associated `field`, plus a heading Field when applicable. |
| **Line** | Does not show a Players control. |
| **Block without an editable Field, fixed Field, or Image** | Does not show a control that would have no effect. |

A generic Tabs structure is not automatically recognized as Ability Tabs. For the special rule, each tab must use the Section → Entries structure described above.

## Blocks that represent multiple Fields

When one block represents multiple Fields, the inspector calculates the most restrictive common access to display:

`hidden` is stricter than `read`, which is stricter than `edit`.

For example, if a Metric contains `hp` (`edit`) and `armor` (`read`), the control shows `read`. Choosing `edit` then applies it to every Field represented by the Metric. Review the Fields grouped in a block before changing access in bulk.

## Hidden from players versus Total Hidden

### Hidden from players

The block remains in the layout and final Forge statblock. Players do not receive Fields marked `hidden` in compatible Atlas contexts; the GM retains the content in the statblock.

### Total Hidden

Forge stores `visibility: total-hidden` in the block's layout metadata and marks the represented Fields as `hidden` in `players`.

- In the final Forge-rendered statblock, the block is omitted.
- In the Template copy published to Atlas, the block remains in the layout, but its Fields are exported with `hidden` access so players cannot see them while the GM can.
- The original `.forgetemplate` keeps the block in the editor Canvas so it remains available for editing.

Choosing `edit`, `read`, or `hidden` again removes the `Total Hidden` marker from the block metadata and restores normal block visibility.

## Compatibility and preservation

Forge stores the native Atlas values `edit`, `read`, and `hidden`, while preserving unrelated and unknown entries in the `players` object. An unknown access value is displayed conservatively as `hidden` in the inspector.

These permissions only affect views and workflows that honor Atlas access metadata. They do not prevent someone with direct Vault access from reading or editing the Markdown, frontmatter, or JSON file. Do not use `hidden` as protection for secrets stored in files players can access directly.

## Example

Consider a Metric block containing `hp`, `armor`, and `secret_dc`:

- `hp`: `edit`, so players can update it;
- `armor`: `read`, so players can inspect it but not change it;
- `secret_dc`: `hidden`, so it remains in the GM's statblock but is withheld from players.

If all three Fields are in the same Metric, one Players setting applies the same access to all of them. For different permissions, place the Fields in separate blocks or use separate layout structures.

## See also

- [[03 - Core Concepts]] — Templates, Fields, blocks, and instances.
- [[06 - Creating and Filling Statblocks]] — Values in each sheet.
- [[21 - Per-Block Appearance]] — visual visibility and style; do not confuse these with player access.
- [[30 - Rest Setup and Flow]] — actions and sheet state.
