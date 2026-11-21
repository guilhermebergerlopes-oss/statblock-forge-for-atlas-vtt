---
title: Statblock Forge — Creating and Editing Templates
aliases:
  - Create Forge Templates
  - Template editor workflow
tags:
  - statblock-forge
  - documentation/templates
part: 1
---

# Creating and Editing Templates

This note follows the workflow for creating, editing, saving, and maintaining a Template. The most important principle is: **define Fields, then organize them in Canvas Blocks**. Metric and Table are special Block types with data-Container behavior: Fields are placed inside them rather than converted into new Field types.

## Create a new Template

1. Click the **Statblock Forge** ribbon icon and choose **Create new template**, or use **Create new Forge template** in the Command Palette.
2. Forge opens an editor with a new, unsaved Template.
3. Review the reserved header Fields.
4. Add the Fields required by your system.
5. Connect Fields to ordinary blocks or place them inside data Containers.
6. Use **Add Container** to create Section, Row, Tabs, Metric, or Table; then adjust size and appearance.
7. Use Save to name and write the Template file.

The initial Template includes these conventional header Fields:

| Default key | Initial label | Type | Common purpose |
|---|---|---|---|
| `name` | Name | `inline` | Name shown in the header. |
| `image` | Token art | `image` | Header Token artwork. |
| `level` | Level | `rating` | Statblock level/rank. |
| `type` | Type | `inline` | Creature/character type. |
| `hp` | HP | `number` | Hit Points. |
| `description` | Description | `markdown` | Description text. |

The Template also includes initial Samples for preview. Header Fields are special properties when identified by their key or `meaning`; avoid creating a second Field for the same concept unless you have a clear reason. See [[05 - Fields]] for Field types and reserved header behavior.

## Open an existing Template

Use **Open template** in the ribbon or **Open template in Forge…** in the Command Palette. The picker searches the Vault for compatible Templates and opens the selected file in the editor.

Forge recognizes:

- `.forgetemplate`: Forge-saved format, including Forge layout metadata;
- `.atlastemplate`: Atlas-native format, when its structure is compatible;
- certain legacy structures recognized by Forge's migration logic.

Files with invalid JSON, incomplete structure, missing metadata, or unsupported metadata versions may open with warnings or in a protected state. This is intended to prevent a save from silently rebuilding and destroying information Forge cannot interpret.

## Editor areas

The editor has three main work areas:

### Canvas

The **Canvas** is the visual representation of the layout. You can add, drag, select, and resize blocks, and organize containers. The Canvas does not store each creature's Values; it configures how data will be presented.

### Data

The **Data** tab shows the block/container tree. Use it to select nested elements, find blocks by name, and understand hierarchy. Selecting a container lets you access its children and reorganize the structure.

### Properties

The **Properties** tab shows settings for the selected element. Controls depend on the element type:

- Field-linked block: Field, presentation, and type-specific properties;
- `Metric Container`: child Field order and presentation options; `Line`: Field set/order and presentation options;
- `Section`, `Row`, and `Tabs`: structural properties;
- appearance: inheritance mode, color, border, alignment, padding, and other styles;
- player permissions: controls where applicable.

The Field editing area is used to create, rename, reorder, configure, and remove Fields. It is separate from the Canvas.

## Create Fields before building the layout

In the **Fields** area, add a Field and configure:

1. **Label:** readable text shown in the UI.
2. **Key:** identifier used in JSON and internal references.
3. **Type:** data type; determines available editors and options.
4. **Type-specific options:** for example, unit and formula for Number/Rating, options for Choice/Checkboxes, Table storage/column settings, Entries structure, or Dice Formula settings.

Forge validates duplicate keys and invalid identifiers. A key must begin with a letter and may contain letters, numbers, `_`, and `-`, up to 40 characters. Keys are compared case-insensitively. `formerKeys` preserves recognized old aliases during migrations; do not reuse an old key as a new Field's key.

> [!important] Adding a Field does not change the Canvas
> After creating a Field, drag it to the Canvas or create a compatible block and select the Field in its inspector. Until a block is connected, the Field can exist in the Template without appearing in the visual composition.

## Connect Fields to blocks

Forge chooses a suitable default block when a Field is dragged to the Canvas. Examples:

- `number`, `rating`, `inline`, `selection`, and `dice` typically start as `Stat`;
- `markdown` starts as `Text`;
- `list` starts as `Tags`;
- `scores` is managed internally by a Table Container; do not create it as a standalone Field;
- `entries` starts as `Entries`;
- `pairs` starts as `Pairs`;
- `image` starts as `Image`;
- `groups` is presented as `Groups`;
- `counter` starts as `Counter`;
- `checkboxes` starts as `Checkboxes`.

Other elements—such as `Title`, `Line`, and `Track`—serve specific presentations. `Metric` and `Table` are Canvas Block types with data-Container behavior: Metric groups scalar Fields, while Table accepts compatible user Fields. Pairs remains a standalone Collection. Each child Field becomes a column. **Show Labels in columns** controls headings and **Show Labels in rows** independently names data rows; both can be enabled together. **Allow adding rows in statblocks** exposes an Add row action in editable statblocks. Fields can be reordered in the Table inspector. Tables can optionally expose row labels and an Add row action in editable statblocks. Table's Atlas-native `scores` adapter is private storage, not a user Field. Drag a compatible Field onto a data Container Block to add it as a child. See [[05 - Fields]] and [[10 - Containers Overview]].

## Configure example Values (Samples)

Samples belong to the Template and are used to test the preview and demonstrate expected values. They are not the permanent Values of each creature.

1. Open the Template's Samples/JSON configuration.
2. Enter values compatible with each Field's type.
3. Return to the Canvas or preview to check the result.
4. When creating a note, choose whether to copy Samples using **Copy example values**.

Example data shape:

```json
{
  "name": "Ash Guard",
  "might": 8,
  "level": "2",
  "attack": "2d8+3",
  "traits": ["Armored", "Ash-touched"]
}
```

This example is illustrative. The keys `might`, `level`, `attack`, and `traits` are accepted only if declared in the Template with compatible types. `level` is a string here because a Rating Field may store its representation as a string; check the Field-specific note before defining your JSON.

## Save: Update or Save as New

When saving, the entered name determines the action:

| Situation | Action | Effect |
|---|---|---|
| Saved Template, same name | **Update** | Updates the existing file and keeps the Template ID, preserving links from notes that already use it. |
| New, unsaved Template | **Save** | Creates the Template file for the first time. |
| Saved Template, different name | **Save as New** | Creates a new copy with a new ID; the source Template remains unchanged and existing notes stay linked to it. |

Before updating, Forge compares the original file content with the current file. If another operation changed, moved, or removed the file while the editor was open, the save may be rejected as a conflict. Reopen the file and reconcile changes rather than silently overwriting a newer version.

A copied Template receives a new ID to avoid collisions and may record its lineage in `derivedFrom`. Do not manually copy IDs between Templates.

### Saving `.forgetemplate` and `.atlastemplate`

- A Template created in Forge is saved as `.forgetemplate`.
- Updating a `.forgetemplate` keeps the Forge format and its `statblockForge` metadata.
- An `.atlastemplate` is a read-only source. When opened, Forge imports its data and creates a `.forgetemplate` copy for editing; the original Atlas file is never updated by Forge.
- During import, Forge may read an existing legacy layout sidecar to recover compatible settings. Forge does not create, export, or update `.atlastemplate` files or Atlas sidecars.

Use `.forgetemplate` as the Forge working format. `.atlastemplate` files can be opened as import sources, but editing continues in the `.forgetemplate` copy. See Part 5 for compatibility details.

## Conflicts, copies, and backups

- If a Template already exists with the intended name, choose another name or follow the explicit confirmation workflow offered by Forge.
- A confirmed replacement of an existing `.forgetemplate` creates a versioned backup under `.statblock-forge/backups/` inside the configured Template folder.
- Use **Recover Forge template backup…** in the Command Palette to inspect and restore verified backups. Forge validates the backup contents and original Template ID before offering restoration.
- Restoring over an existing file requires a second confirmation and creates a separate safety backup first. Compare-and-swap preserves edits made after the confirmation was shown.
- Older raw `.forgetemplate.bak` files remain discoverable. When their original folder is unknown, Forge resolves the target by stable Template ID or restores a separate copy instead of overwriting an unrelated file.
- Updating the same file is different from creating a copy and replacing another file.
- Before broad changes, also keep an external backup of the Vault.

## Unsaved drafts

Forge stores recovery data for unsaved Template edits. When the plugin starts, it may offer to recover a closed draft. You can also use **Recover unsaved Forge template drafts** in the Command Palette.

Recovery is an opportunity to continue an interrupted edit; it does not replace normal saving. After recovery, review the Template and choose Update or Save as New according to your intent.

## Delete a Template

Use **Delete template…** in the Command Palette and confirm. The file is moved to the Obsidian trash; Forge does not automatically delete Markdown notes that were created from it.

Keep in mind:

- notes linked to a deleted `.forgetemplate` may no longer find their original source for linked editing/rendering;
- existing notes and `.atlastemplate` copies are not deleted when the `.forgetemplate` is removed;
- deleting an `.atlastemplate` may cause references using its ID to stop finding that Template in Atlas.

Before deleting, locate notes that use the Template and confirm that its source is no longer needed.

## Recommended workflow

1. Create the Template and define its Fields.
2. Check keys and types before adding formulas.
3. Add blocks that present each Field.
4. Group content with Section, Row, or Tabs.
5. Configure Samples and use the preview to review the result.
6. Save the Template.
7. Create a test statblock note.
8. Test editable Values, formulas, and rolls.
9. Only then reuse the Template in production content.

## Next step

Read [[05 - Fields]] to understand each type before building a larger schema. For instance creation, see [[06 - Creating and Filling Statblocks]].
