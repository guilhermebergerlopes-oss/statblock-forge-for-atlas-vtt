---
title: Statblock Forge — Per-Block Appearance
aliases:
  - Block appearance
  - Per-block visual customization
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Per-Block Appearance

Per-block appearance lets an individual block inherit the Template's global theme or use its own overrides. It changes presentation, not the Field or its stored Value.

## Open the inspector

1. Open a Template in the editor.
2. Select a block on the Canvas or in the **Data** tree.
3. Expand **Block appearance** in the sidebar inspector.
4. Enable **Custom appearance** to edit the individual controls.

Each block has its own appearance state. Changing one `Stat` does not automatically change another `Stat`, even if both show Fields of the same type.

### Copy appearance between blocks

In **Block appearance**, click **Copy appearance** on the source block. Select another block and click **Paste appearance**. Paste becomes available after an appearance has been copied. The in-session appearance clipboard works across blocks and Templates while the plugin remains active.

Only the appearance mode (**Theme** or **Custom**) and the block's visual settings are copied. The destination block's content, linked Fields, formulas, dimensions, position, visibility, and other structural properties remain unchanged. These explicit inspector actions are used instead of `Ctrl+C`/`Ctrl+V` so normal text copying, input editing, and Obsidian shortcuts keep their expected behavior.

## Theme and Custom modes

| Mode | Behavior |
|---|---|
| **Theme** | The block inherits colors and surfaces from the statblock's global theme. This is the default for new blocks. |
| **Custom** | Enables **Surface**, **Text**, and, where compatible, **Indicators** controls. |

Switching from **Custom** to **Theme** suspends the overrides but does not delete them. Switching back to **Custom** restores the previous values. **Reset** removes the block's individual appearance and returns it to **Theme**.

Appearance is saved in the Template's Forge layout and associated with the block ID. It is not stored in the Field Value. A duplicated or newly created block has its own appearance configuration.

## Surface

**Surface** controls customize the block box.

| Control | What it changes | Range / options |
|---|---|---|
| **Corner shape** | Basic corner shape | `Square`, `Rounded`, `Oval` |
| **Background** | Background color | Hexadecimal `#RRGGBB` |
| **Opacity (%)** | Background opacity | 0–100% |
| **Border** | Outline color | Hexadecimal `#RRGGBB` |
| **Border shape** | Outline geometry | `Default`, `Double`, `Oval`, `Diamond`, `Regular hexagon`, four `Triangle` options, `Pointed`, `Angular`, `Hexagonal`, `Shield` |
| **Border style** | Line style | `Solid`, `Dashed`, `Dotted`, `Double`, `None` |
| **Thickness (px)** | Outline thickness | 0–16 px |
| **Corner radius (px)** | Rounded-corner radius | 0–100 px |
| **Shadow color** | Shadow color | Hexadecimal `#RRGGBB` |
| **Blur (px)** | Shadow blur | 0–64 px |
| **Horizontal offset (px)** | Horizontal shadow offset | −32 to +32 px |
| **Vertical offset (px)** | Vertical shadow offset | −32 to +32 px |
| **Spread (px)** | Shadow spread/contraction | −16 to +32 px |
| **Opacity (%)** | Shadow opacity | 0–100% |

### Border geometry

- **Default** uses the block's normal shape and lets you choose a line style.
- **Double** draws a double border.
- **Oval**, **Diamond**, **Regular hexagon**, the four **Triangle** options, **Pointed**, **Angular**, **Hexagonal**, and **Shield** use a clipped geometric outline.
- With geometric presets, **Corner shape** and **Corner radius** do not apply and may be unavailable.
- **Border style** can be selected for the **Default** preset; the other presets define their own outline geometry.

A geometric frame is made from an outer layer and an inner surface. On Image blocks, the artwork is clipped as well so it remains inside the border.

## Text

The **Text** group separates three color roles:

| Control | Affects |
|---|---|
| **Text** | Fallback color for block text. |
| **Labels** | Field names, headings, descriptors, headers, and labels. |
| **Values** | Numeric or text values shown by the block. |

When **Labels** or **Values** have their own colors, they take precedence for those elements. **Text** remains the fallback for the rest of the content.

Additional controls:

- **Horizontal alignment:** `Left`, `Center`, or `Right`.
- **Vertical alignment:** `Top`, `Middle`, or `Bottom`.
- **Padding (px):** internal spacing from 0 to 96 px.

The result of alignment depends on the block and its container. For example, aligning a Row child's content does not replace the horizontal distribution defined by the Row itself.

## Indicators

The **Indicators** group appears when a block can show numeric tracking:

- a `Track` block;
- a `Counters` block;
- a block associated with a `Number` or `Rating` Field that has compatible `tracks` configuration.

It provides:

| Control | Effect |
|---|---|
| **Filled marks** | Color of filled segments. |
| **Empty marks** | Color of empty segments. |
| **Outline** | Outline color of the segments. |

These colors do not replace **Labels** or **Values**; they affect only visual indicators.

## Ability Part Counters

Counters inside **Ability Parts** have per-part appearance settings. Each part can inherit the theme or use its own indicator colors. This lets one ability use a different Counter color without forcing other parts to use the same appearance.

## Image framing is also block-specific

When the selected block is an `Image` block representing an ordinary `image` Field, the inspector also shows **Image framing**. Those controls are covered in [[22 - Image Fields and Framing]]. They do not apply to the reserved header Token art.

## Practical example

To highlight an HP block:

1. Select the HP `Track` block.
2. Enable **Custom appearance**.
3. Under **Surface**, choose `Rounded`, a dark background, a red border, and a subtle shadow.
4. Under **Indicators**, set **Filled marks** to red, **Empty marks** to gray, and **Outline** to a light color.
5. Under **Text**, keep Labels readable and make Values more prominent.

The current HP Value, maximum, and recovery rules remain Field/Rest data. Appearance does not modify them.

## Recommendations and limits

- Choose the global theme first; use Custom only for blocks that need exceptions.
- Avoid combining very opaque backgrounds, thick borders, and strong shadows on every block, as this can reduce visual hierarchy.
- Numeric values are bounded and normalized by Forge when the layout is loaded.
- Forge appearance is Forge-specific metadata. It is not portable CSS for the native Atlas renderer and does not change the Vault theme.

## See also

- [[16 - Appearance Overview]] — appearance hierarchy.
- [[18 - Creating and Customizing Themes]] — global palette.
- [[20 - Token Art Frame]] — Token rim.
- [[22 - Image Fields and Framing]] — image controls.
