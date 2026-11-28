Statblock Forge for Atlas VTT is a community extension. It is not made, endorsed or supported by Atlas VTT or Atlas Online.
Support: https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues

# Statblock Forge for Atlas VTT 0.6.1

Create reusable tabletop RPG Templates and character, creature, or NPC statblocks.

## Features
- Visual grid editor with nested Sections, Rows and Tabs; configurable layout and themes.
- Fields for text, numbers, ratings, dice, choices, lists, tables, entries, pairs, images, spells, counters and checkboxes. Dice Fields can display their formula, an Atlas die icon or a custom word while keeping the original roll.
- Formula references, dice rolls, resources, counters and Rest support.
- Per-block and per-field appearance controls, reusable themes and frames.
- Optional Dice Roll Together integration for shared rolls, campaign sessions and GM-authoritative Set Dice.
- Atlas integration for linked statblocks and native dice results when a map is presented.

## Third-party assets
- Dice Field icon choices reuse the pencil-sketch die images from the Atlas VTT dice tray. Their original game-icons.net authors and CC BY 3.0 attribution are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Requirements
- Desktop host application version 1.8.7 or later.
- Desktop runtime.

## Build from source
Requires Node.js 22 or later.

```sh
npm install
npm run build
```

The build creates `main.js`; include it with `manifest.json` and `styles.css` in the plugin folder for installation.
