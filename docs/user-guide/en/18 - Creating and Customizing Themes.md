---
title: Statblock Forge — Creating and Customizing Themes
aliases:
  - Custom palettes
  - Custom themes
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Creating and Customizing Themes

**Advanced customization** in the template's **Appearance** tab lets you change the selected preset palette, create a reusable custom theme, or update a Custom theme already saved in the plugin library.

There is an important difference between **changing this template's appearance** and **updating the reusable library**. Color edits in the editor immediately affect the template snapshot; the library is updated only when you use the theme save button.

## 1. The eight color roles

Forge uses eight color roles:

| Control | Palette key | Visual role |
|---|---|---|
| **Background** | `background` | Main statblock background. |
| **Surface** | `surface` | Ordinary panel and block surfaces. |
| **Raised surface** | `raised` | Surfaces raised above ordinary panels, such as controls and emphasized internal areas. |
| **Border** | `border` | Theme-linked outlines, dividers, and borders. |
| **Accent** | `accent` | Main highlight color, including emphasis and theme-linked indicators. |
| **Strong accent** | `accentStrong` | Stronger highlight variation for elements that need more contrast. |
| **Text** | `text` | Main text color. |
| **Secondary text** | `muted` | Supporting text, metadata, and less emphasized information. |

The sample swatches show part of the palette. They are not a complete miniature of the statblock and do not necessarily show every special detail of a theme.

## 2. Override a built-in preset without changing its definition

1. Open the template and select a preset in **Theme**.
2. Expand **Advanced customization**.
3. Change the desired color pickers.
4. Review the statblock preview.
5. Save the template.

When a built-in theme is selected, Forge stores the changed colors in `themeOverrides` for that preset ID inside the template layout. The built-in definition shipped with the plugin remains unchanged.

Overrides are kept separately for each preset. For example, you can darken **5e Official Parchment**, then customize **Astral Voyager**, and switch between them without losing either preset's overrides.

### Reset a preset

**Reset** asks for confirmation and removes overrides for the preset selected at that moment. It does not remove overrides for other themes or change the plugin's built-in palette.

For **Obsidian default**, Reset removes custom colors and restores inheritance from the active Obsidian theme variables.

## 3. Create a reusable Custom theme

Use this workflow when you want to store a palette for use in multiple templates:

1. Select a preset that is close to the desired result.
2. Adjust the eight colors in **Advanced customization**.
3. Enter **Custom theme name**.
4. Click **Save as custom theme**.
5. Forge creates a unique ID, adds the palette to the plugin settings library, and embeds a copy of the theme in the current template layout.

The theme appears in the **Theme** list with a **Custom** label. When selected in another template, Forge copies the library theme into that template's layout.

### Edit a saved Custom theme

When a Custom theme from the library is selected:

- Changing colors edits the copy embedded in the current template.
- **Save changes to theme** updates the reusable library entry with the current colors and name.
- **Remove from theme library** removes the reusable entry after confirmation.
- **Export this theme** exports only the current theme as a `.forgestyle` package.

If you change colors and close the editor without using **Save changes to theme**, the template copy may differ from the reusable version in the library. This lets you experiment with a variation in one template without changing every other template that uses the theme.

## 4. Library entry versus template snapshot

Forge keeps two records:

- **Library:** reusable list of Custom themes and frames stored in plugin settings.
- **Snapshot:** a copy of a Custom theme embedded in the layout of each template that uses it.

This separation prevents removing a reusable library item from breaking existing templates. If a theme is removed from the library while a template still uses its copy, that template keeps the theme and may show it in the list as a template copy.

Removing a theme from the library does not remove it from every template. To stop using it in one template, select another theme in the **Theme** list and save the template.

## 5. Export and import themes

- **Export this theme** exports only the currently selected theme (with the colors and name used for the export).
- **Export style library** exports all reusable themes and frames from the plugin library, when saved items exist.
- **Import .forgestyle** opens a file picker and then a review dialog for the styles found in the package.

When an imported package contains an existing ID or name, the dialog lets you keep both as copies, replace the matching style, or skip that item. Importing a palette does not automatically apply it to every template: it first enters the library, and can then be selected in each template.

For format, validation, and conflict handling details, see [[24 - .forgestyle Style Library]].

## 6. Color format and limits

Colors are chosen with the editor's color controls and stored as six-digit hexadecimal values in `#RRGGBB` format, for example `#1E293B` or `#E6D3B3`. Forge does not require CSS, snippets, or manual file editing to customize a palette.

Custom themes use a name, an ID, and the eight color roles. Style names are plain text; the style package validates data before importing it.

## Example: an ice-themed palette

Start with **Glacial Rime** and change a few roles:

| Role | Example value | Intent |
|---|---|---|
| Background | `#07131E` | Deeper background. |
| Surface | `#102535` | Dark-blue panels. |
| Raised surface | `#18384A` | Elevated internal areas. |
| Border | `#276078` | Blue outlines. |
| Accent | `#45C7F2` | Cyan highlight. |
| Strong accent | `#B7F0FF` | Bright headings and emphasis. |
| Text | `#EAF8FC` | Main text. |
| Secondary text | `#9FC5D1` | Metadata and supporting labels. |

After checking readability, choose **Save as custom theme** and name it `Frostbound`. The original Glacial Rime preset remains available, and the new variation appears as Custom.

## See also

- [[17 - Built-in Themes]] — included presets.
- [[16 - Appearance Overview]] — appearance layers.
- [[19 - Outer Frame]] — customize the statblock frame.
- [[24 - .forgestyle Style Library]] — share and import themes.
