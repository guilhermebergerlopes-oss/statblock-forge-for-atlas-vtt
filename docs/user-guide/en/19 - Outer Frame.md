---
title: Statblock Forge — Outer Frame
aliases:
  - Statblock outer border
  - Custom outer border
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Outer Frame

The **Custom outer border** section in the **Appearance** tab configures the outline around the entire statblock surface. It is independent of the theme palette, the decorative Token frame, and individual block borders.

Use the outer frame when you want to enclose the sheet as one panel. To highlight only one block, use **Block appearance**; to frame only the header Token art, use **Token border**.

## 1. Choose a frame preset

Under **Outer border preset**, choose one of these options:

| Option | Behavior |
|---|---|
| **Theme default** | Removes the custom frame and lets the theme/renderer control the outline. |
| **No outer border** | Keeps an explicit frame configuration with no visible line (`none`). |
| **Solid frame** | One continuous line. |
| **Double frame** | Double line. |
| **Dashed frame** | Dashed line. |
| **Dotted frame** | Dotted line. |
| **Grooved frame** | Grooved line effect. |
| **Ridge frame** | Raised/ridge line effect. |
| **Custom: name** | A custom frame saved in the Forge library. |

**Theme default** and **No outer border** are not the same option. Theme default removes the custom frame from the layout. No outer border creates a custom frame whose style is `none`, useful when you want the absence of a line to be an explicit selected frame.

When a built-in preset is selected, its initial color comes from the active palette's **Border** role: first from the Custom theme, then from the selected preset's override, and finally from the preset's original palette.

## 2. Adjust the frame

After selecting a preset other than **Theme default**, the editor shows the frame controls:

| Control | Effect | Range | Control step |
|---|---|---:|---:|
| **Border color** | Outer line color. | Hex color `#RRGGBB` | Color picker |
| **Inner line color** | Inner line color when enabled. | Hex color `#RRGGBB` | Color picker |
| **Border thickness (px)** | Outer line thickness. | 0–16 px | 0.5 px |
| **Corner radius (px)** | Rounded corners. | 0–48 px | 1 px |
| **Add inner border** | Enables or disables the second line. | On/off | — |
| **Inner border thickness (px)** | Inner line thickness. | 0–8 px | 0.5 px |
| **Space between borders (px)** | Gap between outer and inner lines. | 0–24 px | 1 px |

Color, thickness, and radius controls update the template preview immediately. When **Add inner border** is off, the inner color, thickness, and spacing controls are disabled; their values are preserved if you enable the option again.

The inner line is drawn as a second solid outline inside the statblock. Its style is not separately configurable as dashed or double; it has its own color, thickness, and inset spacing.

## 3. Example: double frame with an inner line

A frame for a boss sheet could use:

| Property | Example value |
|---|---|
| Preset | `Double frame` |
| Border color | `#8B151B` |
| Border thickness | `3 px` |
| Corner radius | `12 px` |
| Add inner border | On |
| Inner line color | `#D4AF37` |
| Inner border thickness | `1.5 px` |
| Space between borders | `4 px` |

The result is a double outline: the outer line uses the selected style, and the inner line appears as a solid inset contour. The preview shows the combination before you save the template.

## 4. Save a reusable frame

After adjusting the controls, use **Custom border name** to name the frame.

- **Save as custom border** creates a new library entry and embeds a copy in the current template layout. A name is required.
- **Save changes to border** updates the existing library entry with the current values and name.
- **Remove from border library** removes the reusable entry after confirmation. The snapshot already stored in a template keeps working.
- **Export this border** exports only the selected frame as a `.forgestyle` package.
- **Export style library**, at the top of the Appearance tab, exports the entire theme and frame library when it contains items.

If a frame is removed from the library but remains applied to a template, it appears as a template copy/snapshot. It no longer depends on a reusable library entry to render.

## 5. Import frames

Use **Import .forgestyle** in the **Appearance** tab or under **Settings → Style library**. Forge validates the package and opens a review dialog. For each frame, you can add it to the library, keep a copy when a conflict exists, replace a matching item, or skip it.

Importing a frame only adds it to the reusable library. It does not automatically change the frame in every template. Select the frame in **Outer border preset** in each template where you want to use it.

See [[24 - .forgestyle Style Library]] for full package limits and rules.

## 6. Outer frame is not per-block appearance

The outer frame surrounds the entire statblock element. It does not replace surface borders on inner blocks or the header Token frame.

- To change one block's background, shape, border, or shadow, select it and use **Block appearance**: [[21 - Per-Block Appearance]].
- To style the Token art reserved in the header, use **Token border**: [[20 - Token Art Frame]].
- For regular images, configure the Field and Image block: [[22 - Image Fields and Framing]].

## See also

- [[16 - Appearance Overview]] — appearance layers.
- [[17 - Built-in Themes]] — included palettes.
- [[18 - Creating and Customizing Themes]] — colors and Custom themes.
- [[20 - Token Art Frame]] — Token frame.
- [[21 - Per-Block Appearance]] — inner block borders.
- [[24 - .forgestyle Style Library]] — import and export frames.
