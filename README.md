# Statblock Forge for Atlas VTT

Statblock Forge for Atlas VTT is a community extension. It is not made, endorsed or supported by Atlas VTT or Atlas Online. [Support and issue reporting](https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues).

**Creator and maintainer:** Guilherme Berger Lopes.

An independent Obsidian plugin for creating reusable statblock templates and linked statblock notes. Forge includes a visual canvas editor, nested layouts, a per-template configurable 4–24 column Grid (12 by default) with a solid primary Canvas grid and subtly dashed nested block grids, structured Fields, dice links with a right-click **Add to next roll** action, and Atlas-compatible export workflows. Secondary Canvas controls are grouped under **More options**; **Statblock Mode**, **Add block**, and **Add container** remain directly available. The Statblock Mode command defaults to `Mod + Shift + S` and can be remapped in **Statblock Forge settings** by clicking the shortcut field and pressing a key combination. `Mod` means Ctrl on Windows/Linux and Cmd on macOS. Hold `N` and click any roll link to add or remove its formula from that statblock's next-roll queue; a normal click still rolls, and right-click keeps the context menu.

## Build from source

### Requirements

- Node.js 22 or newer
- npm

### Build

1. Extract this source package.
2. Open a terminal in the project directory.
3. Install the development dependencies with `npm install`.
4. Run `npm run build`.

The build generates `main.js` and the compiled `styles.css` needed by Obsidian. Run `npm run typecheck` to check TypeScript without generating a bundle.

## Install

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/statblock-forge/`, then enable **Statblock Forge for Atlas VTT** in Obsidian Community plugins.

## Template Compendium

The template editor includes a separate **Compendium** tab for reusable content. Each Collections Field (Entries/Abilities, List, Pairs, or Spells) owns an independent library identified by a stable Forge-only Field ID, so two Fields with the same visible label never share entries. The selector opens in a floating popover with search and category filters. Ability previews show every configured Part in both the template library and the statblock picker. The **Custom ability** and **Add from...** actions share the same button styling. The selector includes the Field key to distinguish same-label Fields. Renaming a Field key keeps its library attached; removing the Field removes only its library. Duplicate saved IDs are normalized to prevent accidental sharing.

Create and edit reusable entries in the template. In an editable statblock, add a copy from the linked Field's Compendium or create a **Custom ability** directly in the statblock. Custom abilities and changes made to copied entries remain local to that statblock and never write back to the template library. Inserted Entries, List, Pairs, and Spells values are deep-copied before the note is updated. Compendium data is stored in Forge metadata/sidecars and is not added to the native Atlas template JSON.

Each library item can also have a freeform **Category**. Categories are scoped to the owning Field ID, shown as grouped sections, and can be filtered independently in the Template Editor and the statblock picker. Search matches item names, categories, descriptions, Parts, and other serialized content. Existing items without a category remain available under **Uncategorized**; entering a new category name while editing an item creates that category for the current Field library.

## Compendium tests

Run `npm run test:compendium` to execute the automated isolation, persistence, duplication, category, search/filter, and statblock-copy checks for the template Compendium. The tests use Node.js built-in test APIs and do not require Obsidian to be running.

## Dice links

Right-click any clickable dice formula in a Forge statblock and choose **Add to next roll**. The formula is queued for the next successful roll in that statblock; queued formulas are temporary and are not written to the template or note. Select the same link again to remove it from the queue.

## Compatibility

Forge is an independent community plugin. It can integrate with Atlas VTT when Atlas is installed, but it does not replace or modify Atlas. Token Conditions are defined, applied, and stored by Atlas; Forge no longer provides a duplicate Condition catalog, per-statblock Condition panel, or Condition-targeted Rest rules. Atlas-native per-Value `addsToRolls` switches are omitted from newly exported templates because the Forge context-menu action replaces that editor setting.

## License

This project is distributed under GNU AGPL-3.0-only. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
# statblock-forge-for-atlas-vtt
