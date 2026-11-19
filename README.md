# Statblock Forge

Statblock Forge is a community extension. It is not made, endorsed or supported by Atlas VTT or Atlas Online.

**Statblock Forge** is an independent tool for building reusable tabletop RPG statblocks. Create a Template, define the data it needs, arrange that data in a visual editor, and then use the Template to create individual character, creature, or NPC sheets. Each sheet keeps its own values while sharing the Template's structure and presentation.

Forge can be used on its own. It also supports compatible workflows with Atlas VTT and can be paired with the **Forked Atlas VTT Compatibility for Statblock Forge** fork for expanded integration.

**Creator and maintainer:** Guilherme Berger Lopes  
**Support and issue reporting:** [GitHub Issues](https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues)

## What you can do

### Build statblocks your way

- Create reusable Templates and use them for multiple characters, creatures, NPCs, or other game entities.
- Define Fields for Text, Markdown, Number, Rating, Dice, Choice, List, Tabular Data, Entries/Abilities, Pairs, Images, Spells, Counters, and Checkboxes.
- Keep a Template's definitions separate from the values stored by each statblock.

### Arrange the information visually

- Use a configurable **4–24 column Canvas Grid** (12 columns by default).
- Compose layouts with blocks and nested containers, including Sections, Rows, and Tabs.
- Resize and reorder blocks, adjust their placement, and use Dense Layout for more compact arrangements.
- Use the **More options** panel for secondary Canvas controls.

### Customize the appearance

- Choose a built-in theme or create a reusable custom theme with an eight-color palette.
- Adjust the outer frame, token-art frame, borders, shapes, and individual block appearance.
- Import and export reusable themes and frames with `.forgestyle` packages.
- Frame and reposition images directly in the statblock.

### Add rules and interactive data

- Calculate Number and Rating values with formulas that reference other Fields.
- Build dynamic Dice Field formulas from the current statblock's values.
- Use clickable dice expressions in statblock text; rolling uses the Atlas dice service when the integration is available.
- Track Resources and Counter uses, including maximums, spending, and recovery.
- Configure Rest buttons with rules, player choices, and actions that affect compatible Resources and Counters.
- Control player access to supported Fields in compatible Atlas workflows.

### Reuse content with the Compendium

The Template editor includes a **Compendium** for reusable Entries/Abilities, Lists, Pairs, and Spells. Each collection Field has its own library by default; compatible Fields can also share a library. Libraries support optional categories and search. Content inserted into a statblock is copied into that sheet, so editing the copy does not change the Template library.

## How a Template becomes a statblock

1. **Create a Template** from the ribbon menu or Command Palette.
2. **Define Fields** for the information your game needs.
3. **Build the Canvas** by connecting Fields to blocks and arranging the layout.
4. **Customize the appearance** with themes and block-level settings.
5. **Save the Template**, then create a statblock note from it.
6. **Fill in the sheet's Values** in the rendered statblock.

A Template defines the reusable structure and presentation. A statblock note stores the Values for one individual. Multiple notes can use the same Template without sharing their sheet data.

## Dice links

With a compatible Atlas integration available, click a dice link to roll its formula. To prepare a roll with additional modifiers:

- Hold **N** and click a dice link to add or remove its formula from that statblock's next-roll queue.
- Alternatively, right-click a dice link and choose **Add to next roll** or **Remove from next roll**.
- Right-click also provides the roll menu and, when available, access to that statblock's roll history.

Queued modifiers are temporary: they apply to the next successful roll for that statblock and are not written into the Template or statblock note.

## Working with Atlas VTT

Atlas integration is optional for creating Templates and editing Forge statblocks. When a compatible Atlas installation and API are available, Forge can use Atlas-supported workflows for dice rolls, roll history, token links, and compatible Resources.

The projects have separate responsibilities:

- **Forge** manages its Template editor, statblock notes, Fields, formulas, appearance settings, Compendium, and Rest rules.
- **Atlas VTT** manages maps, scenes, Tokens, collection Resources, and Token Conditions.

Forge does not maintain a second Conditions catalog or apply Token Conditions through Rest. Configure and manage Conditions in Atlas.

For expanded integration, Forge can be used with the separate **Statblock Forge: Forked Atlas VTT Compatibility** project. Compatibility depends on the versions and public API capabilities available in the installed projects.

## Installation

### Requirements

- Obsidian **1.8.7 or later**.
- Obsidian Desktop; Forge is marked as desktop-only.
- For building from source: Node.js **22 or later** and npm.

### Install a built release manually

1. Create the plugin folder in your vault: `.obsidian/plugins/statblock-forge/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. Open **Settings → Community plugins** and enable **Statblock Forge for Atlas VTT**.

A source ZIP is not a ready-to-install plugin package. Build it first using the steps below.

## Build from source

```bash
npm install
npm run build
```

The build creates `main.js` and the compiled `styles.css`. Copy those files, together with `manifest.json`, into the plugin folder described above.

### Development and checks

```bash
npm test
npm run test:compendium
npm run test:layout
npm run typecheck
```

To build while watching source files:

```bash
npm run dev
```

## Documentation

The full user guide is available in both English and Brazilian Portuguese under `docs/user-guide/`. It covers installation, Templates, Fields, Canvas layout, appearance, formulas, Dice Fields, Counters, Rest, player permissions, and Atlas integration.

You can also download the documentation from **Settings → Community plugins → Statblock Forge → Download documentation**. Choose the language and destination folder in the settings first. Existing documentation files are preserved rather than overwritten.

## Project files

| File or format | Purpose |
|---|---|
| `.forgetemplate` | Template saved by Forge, including Forge-specific layout and appearance metadata. |
| `.atlastemplate` | Atlas-native Template format that Forge can open in supported workflows. |
| Markdown (`.md`) | Individual statblock note with its own Values and a link to its Template. |
| `.forgestyle` | Portable package of reusable custom themes and frames. |
| `.statblock-forge/layouts/` | Sidecar location for Forge layout metadata associated with Atlas-format Templates, when needed. |

Back up Templates and statblock notes before bulk edits, conversions, or manual changes to their JSON/frontmatter data.

## Support

For Forge bugs, questions, or feature requests, open an issue in the [project repository](https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues). Include:

- Forge version;
- application version;
- steps to reproduce the issue;
- relevant error messages or console output.

For issues specifically related to Atlas itself, use the support channels of the original Atlas VTT project.

## License

Statblock Forge is distributed under **GNU AGPL-3.0-only**. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
