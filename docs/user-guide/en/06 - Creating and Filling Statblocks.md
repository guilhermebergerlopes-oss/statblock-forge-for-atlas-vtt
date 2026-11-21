---
title: Statblock Forge — Creating and Filling Statblocks
tags:
  - statblock-forge
  - documentation/statblocks
---

# Creating and Filling Statblocks

A statblock is an individual sheet created from a template. The template defines structure; the new note stores values for that instance.

## Create from a template

1. Open the **Statblock Forge** ribbon menu or the Command Palette.
2. Choose **Create statblock**.
3. Select a template.
4. Enter the statblock name.
5. Optionally enable **Copy example values**.
6. Confirm creation.

The note is created in the configured **Statblock note folder**. When creation starts from a folder's File Explorer context menu, that folder may be used as the destination.

## Example values

**Copy example values** is off by default. When off, the new sheet receives the supplied name and other Fields start without initial values, except for template-specific behavior. When enabled, values in the template's `sample` section are copied to the corresponding Fields. This does not modify other sheets or the source template.

## First edit

After creation, Forge opens the sheet and focuses the first empty editable Field in template order. If none is empty, it focuses the first editable Field. Reopening or refreshing an existing sheet should not trigger this automatic focus again.

## Edit values

Editing takes place directly in the rendered statblock. Controls depend on Field type:

- In-line and Markdown use text editors.
- Number and Rating use numeric controls.
- List accepts simple items; Groups uses a structured editor for group headings, categories, and values.
- Tabular Data, Entries, Pairs, Counters, and other structured types use dedicated editors.
- Selection displays the options defined by the template.

For Groups (Forge JSON type `groups`; native Atlas import type `spells` is normalized on import), add group headings, category/usage rows, and comma-separated values. `Ctrl/Cmd + Enter` saves, `Tab` moves to the next Field, and `Escape` cancels the current edit.

## What is saved

Editing a sheet changes that note's data and preserves unrelated metadata. It does not automatically change the shared template. Keep the linked template available in the vault so Forge can render the sheet again.

## Update the linked template

To change shared structure or appearance, open the linked template from the ribbon menu, Command Palette, or note context menu. Save the template changes. Open views of linked statblocks may refresh when the template changes.

> [!important] Template versus sheet
> Edit the statblock to change one creature's values. Edit the template to change shared Fields, structure, or appearance.

## Render another note with a template

**Render current note with a Forge template** lets you choose a template for a compatible Markdown or JSON note. This workflow is different from creating a new statblock from a template.

## Create an Atlas token

When the current note meets compatibility requirements and Atlas is available, Forge may offer **Create Atlas token from this statblock**. This is separate from creating or editing a Forge note.

## Next step

Part 2 explains visual template organization in [[07 - Canvas and Layout]].
