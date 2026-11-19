---
title: Statblock Forge — Built-in Themes
aliases:
  - Theme presets
  - Included themes
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Built-in Themes

The **Theme** list in the template editor's **Appearance** tab offers eleven presets included with Forge. Each preset combines eight color roles and may also apply its own visual details, such as corner radius, transparency, blur, header accents, or shadows.

## Theme catalog

| Theme | Visual direction | Useful for |
|---|---|---|
| **Obsidian default** | Uses the current Obsidian color scheme without imposing a Forge palette when no overrides exist. | Sheets that should follow the Vault's light/dark theme. |
| **5e Official Parchment** | Warm parchment, dark ink, crimson headings, and copper details. | Classic fantasy sheets, bestiaries, and book-like material. |
| **Astral Voyager** | Dark cosmic tones, silver borders, and gold accents. | Planar creatures, space, astral magic, and mystical content. |
| **Astral Crystal** | Amethyst geode tones, prismatic cyan, and luminous violet. | Crystals, arcane magic, elemental creatures, or magitech. |
| **Gilded Obsidian Vault** | Very dark obsidian, gold details, and a precious-metal appearance. | Bosses, legendary artifacts, and high-contrast sheets. |
| **Bloodbound Gothic** | Dark velvet, cathedral iron, and blood-red accents. | Gothic horror, vampires, curses, and cults. |
| **Glacial Rime** | Deep arctic blue, crystalline edges, and cool cyan. | Ice creatures, polar regions, and frost magic. |
| **Infernal Obsidian** | Volcanic basalt, warm surfaces, and glowing orange highlights. | Demons, fire, forges, and volcanic environments. |
| **Modern Blue Glass** | Translucent navy surfaces, cyan accents, and a glass/HUD effect. | Science fiction, technological interfaces, and modern campaigns. |
| **Eberron Artificer** | Mechanical brass, dark iron, and amber. | Artificers, constructs, alchemy, and arcane machinery. |
| **Sylvan Woodcraft** | Forest green, bark brown, wood, and leaf details. | Fey, druids, forests, and nature creatures. |

These suggested uses are design references, not restrictions. Any preset can be applied to any template and adjusted in the palette editor.

## Choose a theme

1. Open a template in Forge.
2. Go to **Appearance**.
3. Open the **Theme** list.
4. Choose a built-in preset.
5. Review the statblock preview and save the template.

The selection is stored in that template's Forge layout. It does not change the Vault theme or other templates. Multiple statblocks created from the same template use the template's selected theme while keeping their Values independent.

## Obsidian default: special behavior

**Obsidian default** does not apply a fixed palette when no overrides exist. The statblock uses the active Obsidian theme colors and variables. Switching the Vault from light to dark (or vice versa) can therefore change the statblock's appearance too.

You can open **Advanced customization** and define your own colors while keeping **Obsidian default** selected. Those custom roles then replace the corresponding variables while this preset is active. **Reset** removes the preset's overrides and restores Obsidian inheritance.

## Built-in preset, overrides, and Custom theme

- A **built-in preset** uses a definition shipped with the plugin.
- An **override** changes that preset's colors in the current template only. The original preset is not modified.
- A **Custom** theme is a reusable palette stored in the Forge library and copied into the template when selected.

Overrides for different presets are kept separately. Customize `5e Official Parchment`, switch to `Astral Voyager`, and return later without having to recreate the parchment colors. To create, save, and share palettes, see [[18 - Creating and Customizing Themes]].

## Preview and limitations

The color samples shown under **Advanced customization** help compare palettes quickly. They do not represent every detail of a preset: some themes also change border radius, texture, transparency, blur, or header treatment.

Presets style statblocks rendered by Forge. They are not Obsidian CSS themes and do not change the overall Vault interface.

## See also

- [[16 - Appearance Overview]] — appearance layers.
- [[18 - Creating and Customizing Themes]] — override colors and save palettes.
- [[21 - Per-Block Appearance]] — per-block exceptions.
- [[24 - .forgestyle Style Library]] — import and export styles.
