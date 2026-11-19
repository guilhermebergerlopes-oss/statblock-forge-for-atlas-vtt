---
title: Statblock Forge — Framing Images in the Statblock
aliases:
  - Live image zoom and pan
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Framing Images in the Statblock

In addition to the default framing defined by the Template, Forge lets you zoom and reposition an image directly in a rendered statblock. This adjustment is local to that sheet and that Image block; it does not change the Template or the image file.

## Zoom with the mouse wheel

Place the pointer over a loaded image and use:

| Input | Action |
|---|---|
| Wheel without modifiers | Scrolls the statblock vertically. |
| `Alt` + wheel | Scrolls the statblock horizontally. |
| `Ctrl` + wheel up | Increases image zoom by 10 percentage points. |
| `Ctrl` + wheel down | Decreases image zoom by 10 percentage points. |

Zoom ranges from **100% to 300%**. At 100%, the image is at its minimum size; at 300%, it is at the maximum. Once a limit is reached, the wheel no longer changes the image and can continue scrolling the statblock. The image shortcut is `Ctrl` + wheel without `Alt` or `Meta`.

## Reposition the image

When zoom is above 100%, press the primary mouse button and drag the image to move the visible content inside its frame.

- At 100%, dragging is disabled because there is no additional enlarged area to pan.
- Forge limits movement to the overflow created by zoom.
- The block viewport remains filled; dragging should not reveal empty areas outside the image.
- If the interaction is cancelled (for example, when the pointer is cancelled), the incomplete movement is reverted.

The horizontal/vertical focus defined in the Template remains the baseline. Dragging while using the sheet adds a local adjustment for that sheet.

## Automatic saving

The local frame is saved automatically after zoom changes or when a drag finishes. Forge groups very close writes to avoid saving the file on every pointer movement. You do not need to edit the Field Value or save the Template.

Each record is associated with the **Image block ID**, not only the Field Key. Therefore, if the same image or Field is displayed in two different blocks, each block can have its own local framing.

### Markdown notes

Forge stores adjustments in the note's frontmatter under `statblock-forge-image-frames`:

```yaml
---
statblock-forge-image-frames:
  image-block-uuid:
    zoom: 140
    x: 44
    y: 62
---
```

`image-block-uuid` represents the real block ID in the Template. This is an illustrative example; do not copy that literal ID into another sheet.

### JSON sources

For a plain JSON source, the property is stored at the root. If the file uses the `statblock-forge-data` envelope, the property is stored inside `data`:

```json
{
  "statblock-forge-image-frames": {
    "image-block-uuid": {
      "zoom": 140,
      "x": 44,
      "y": 62
    }
  }
}
```

Each frame contains `zoom`, `x`, and `y`. Forge normalizes zoom to 100–300 and coordinates to 0–100. `50/50` is the neutral center for the local adjustment.

## Template versus statblock

| Adjustment | Where it is saved | Who receives it |
|---|---|---|
| Zoom/focus in the Image Field inspector | Template Forge layout | Template preview and sheets that use the Template as their baseline. |
| Zoom/drag while using the sheet | The sheet's `statblock-forge-image-frames` metadata | Only that sheet instance and block. |
| Image path/Value | The Image Field Value | The sheet containing that Value, unless the Template pins the image. |

The local adjustment does not change the Template sample, move pixels in the original file, or replace the Image Field Value. A different sheet keeps independent framing.

> [!tip] Recommended workflow
> Set the general framing in the Template first. Then use `Ctrl` + wheel and drag on the rendered statblock only for creature- or character-specific corrections.

## Limitations

- Live framing requires an image that loaded successfully.
- Local dragging is unavailable at zoom 100% or below.
- Movement is bounded to keep the frame filled.
- If an image Field is pinned by the Template, its Value cannot be replaced or removed in the statblock; framing remains separate data.

## See also

- [[22 - Image Fields and Framing]] — default framing and samples.
- [[20 - Token Art Frame]] — Token art and its separate rim.
