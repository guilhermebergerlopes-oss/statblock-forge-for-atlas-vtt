---
title: Statblock Forge — Appearance Overview
aliases:
  - Forge appearance
  - Statblock visual layers
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Appearance Overview

A Forge statblock is styled through independent layers. The template defines the global theme and outer frame; the header can have a dedicated Token art frame; each block can inherit the theme or use individual overrides; Image blocks have their own framing controls.

These layers are not one shared border or one shared theme. For predictable results, choose the global appearance first, then customize only the blocks or images that need a different treatment.

## 1. Appearance layers

| Layer | Where to configure | Scope |
|---|---|---|
| **Theme** | Template → **Appearance** | Global statblock palette: background, surfaces, borders, accents, and text. |
| **Outer frame** | Template → **Appearance → Custom outer border** | Outline around the entire statblock surface. |
| **Token border** | Template → **Appearance → Token border** | Decorative frame around the Token art reserved in the header. |
| **Block appearance** | Select a block → inspector → **Block appearance** | Surface, borders, shadows, text colors, alignment, and indicators for that block. |
| **Image framing** | Select an Image block or adjust the image on the sheet | Zoom and focal point for a regular image linked to an Image Field. |

### Example composition

A creature sheet could use **5e Official Parchment** as its theme, a **Double frame** as its outer border, a **Shield** frame around its Token art, and **Custom** appearance only for an alert block. A portrait Field displayed through an Image block still has its own framing, independent of Token art.

## 2. Theme: global appearance

A theme supplies a palette of eight color roles and guides the appearance of elements that inherit it. Select it in the template's **Appearance** tab.

- **Built-in theme:** one of the presets included with Forge.
- **Custom theme:** a reusable palette created by the user or imported.
- **Theme overrides:** color changes made on top of a built-in preset without changing the preset definition.

The theme is stored in the template's Forge layout metadata. Each template can use a different appearance even when its Fields and block structure are the same. See [[17 - Built-in Themes]] and [[18 - Creating and Customizing Themes]].

## 3. Outer frame and Token border are different

The **outer frame** surrounds the entire statblock. It can use one or two lines, with controls for thickness, radius, and spacing.

The **Token border** surrounds only the Token art reserved in the header. It has its own geometric shapes, such as circle, oval, diamond, hexagon, or shield. It does not change the overall outline or regular Image Fields.

For illustrations, portraits, and maps placed in the body of a sheet, use an **Image** Field and configure its Image block. See [[19 - Outer Frame]], [[20 - Token Art Frame]], and [[22 - Image Fields and Framing]].

## 4. Block appearance: inherit or customize

Every new block starts in **Theme** mode. In this mode, its presentation follows the statblock's global theme. When needed, select **Custom** in the inspector to style the individual block.

Depending on the block type, custom appearance can control:

- **Surface:** background, opacity, border, shape, thickness, radius, and shadow.
- **Text:** general text color, Labels color, Values color, and alignment.
- **Indicators:** colors for filled marks, empty marks, and outlines on compatible indicators.

Changing from **Custom** to **Theme** suspends the overrides but does not delete them. Switching back to **Custom** restores them. **Reset** removes the individual appearance and returns to **Theme** mode. See [[21 - Per-Block Appearance]].

## 5. Where appearance data is stored

| Data | Storage | Effect when reusing the template |
|---|---|---|
| Theme ID and palette overrides | Template's Forge layout metadata | The template keeps its preset and customized colors. |
| Custom theme snapshot | Template's Forge layout metadata | The sheet keeps the palette even if the library entry is removed. |
| Outer frame snapshot | Template's Forge layout metadata | The applied frame remains in the template independently of the library. |
| Reusable theme and frame library | Forge plugin settings | Styles can be reused by other templates and exported. |
| Per-block appearance | Block or Ability Part layout metadata | The override follows that specific block/part. |
| Per-sheet Values and image framing | Statblock instance data, where applicable | Each statblock can have its own image data. |

The library and the template are related, but they are not the same record. Removing a theme or frame from the library removes its reusable entry; it does not erase snapshots already stored in templates.

## 6. Compatibility with Atlas and the Obsidian theme

> [!important] Forge appearance is not an Obsidian vault theme
> These presets style statblocks rendered by Forge. They do not change the Vault theme, Markdown notes, the Obsidian window, or other plugins.

Theme, outer-frame, and per-block appearance metadata are Forge-specific. The native Atlas renderer does not automatically interpret Forge-only appearance metadata. Data and dice interoperability is separate from visual styling.

The **Obsidian default** preset is special: without overrides, the statblock inherits colors from the active Obsidian theme. Other presets apply a Forge palette to the statblock regardless of whether the Vault is using a light or dark theme.

## 7. Recommended workflow

1. Open the template and go to **Appearance**.
2. Choose a theme that suits the purpose of the sheet.
3. Adjust the palette only if the preset needs small corrections.
4. Configure the outer frame if you want a global outline.
5. Configure the Token frame separately if the header art needs one.
6. Return to the Canvas and use **Block appearance** only for blocks that need exceptions.
7. Review the preview at different widths and with realistic sample Values.
8. Save the template.

## See also

- [[17 - Built-in Themes]] — included presets.
- [[18 - Creating and Customizing Themes]] — custom palettes and snapshots.
- [[19 - Outer Frame]] — statblock outline.
- [[20 - Token Art Frame]] — Token art border.
- [[21 - Per-Block Appearance]] — block-level overrides.
- [[22 - Image Fields and Framing]] — Image Fields.
- [[23 - Framing Images in the Statblock]] — edit image framing while using a sheet.
- [[24 - .forgestyle Style Library]] — import and export themes and frames.
