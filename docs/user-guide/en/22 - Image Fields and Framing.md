---
title: Statblock Forge — Image Fields and Framing
aliases:
  - Image Fields
  - Image cropping
tags:
  - statblock-forge
  - documentation/appearance
  - documentation/fields
part: 3
---

# Image Fields and Framing

An **Image** Field displays an illustration, portrait, map, or other image associated with a statblock. It is different from Token art reserved in the header: ordinary Image Fields use image references as Values; Token art uses Atlas Token links.

## Create and associate an Image Field

1. In the Template's **Fields** area, create a Field of type `Image`.
2. Set a `Label` and `Key`, for example `portrait` or `lair_map`.
3. Add an **Image** block to the Canvas or drag the Field onto the Canvas.
4. In the block inspector, confirm that the block is associated with the intended Key.
5. Use **Choose from Vault** to select a sample image for the Template preview.

The picker recognizes Vault files with these extensions: `png`, `jpg`, `jpeg`, `jfif`, `gif`, `webp`, `avif`, `apng`, `bmp`, `svg`, `ico`, `tif`, and `tiff`. Extension matching is case-insensitive. The picker lists local Vault files; it is not a general URL browser.

## How the Field stores an image

The Field stores an image reference as its Value. Depending on the source, Forge can resolve:

- a Vault file path, such as `Bestiary/ash-drake.webp`;
- an Obsidian wikilink, such as `[[Bestiary/ash-drake.webp]]`;
- an Obsidian embed, such as `![[Bestiary/ash-drake.webp]]`;
- a Markdown image link, such as `![Ash drake](Bestiary/ash-drake.webp)`;
- a recognized remote reference, such as an `http(s)` URL or `data:image` reference.

Arrays are examined until the first non-empty text reference is found. For Vault files, the resolver checks Obsidian's link cache and then tries direct path resolution; paths relative to the source file may also be considered.

> [!note] Choose from Vault versus Value
> **Choose from Vault** sets the Template's sample image. Each statblock's Value remains stored in its own note/data. Changing the sample does not automatically replace every sheet's Value.

## Template sample

The selected sample is saved in `template.sample[fieldKey]`. It feeds the Canvas and Template preview. When creating a statblock, the user can choose whether to copy sample values as part of the creation flow. If samples are not copied, the sheet keeps its own Values.

In a rendered statblock, click an ordinary Image block to open image actions when editing is permitted. An ordinary Image Field offers **Choose from Vault…** and **Remove image**. Removing an image clears that sheet's Value; it does not delete the original Vault file.

## Pin the image from the Template

The sample-image action menu includes **Pin image to statblocks**.

1. Choose a sample image first.
2. Open the sample image socket actions in the Template.
3. Enable **Pin image to statblocks**.
4. Save the Template.

A pinned image is controlled by the Template:

- it is applied to statblocks created from that Template;
- Forge reapplies the pinned Value when the sheet is loaded, also repairing older linked data;
- replace and remove actions are blocked in the statblock;
- in the Template, **Clear sample image** is disabled while the image is pinned.

You can still choose a different image in the Template: the new sample becomes the image pinned to the sheets. To allow each statblock to change or clear its own image again, disable **Pin image to statblocks**. The reserved `image` Key (Token art) cannot be pinned as an ordinary image.

Renaming a Field preserves its pin association; deleting the Field or changing it away from type `Image` removes stale pin metadata from the layout.

## Frame the image in the Template

Select the Image block on the Canvas. The **Properties** inspector shows an interactive preview and these controls:

| Control | Range | Meaning |
|---|---:|---|
| **Zoom** | 100–300% (steps of 5) | Magnification of the image inside its frame. |
| **Horizontal focus** | 0–100% | Focal point on the horizontal axis, left to right. |
| **Vertical focus** | 0–100% | Focal point on the vertical axis, top to bottom. |

Defaults are zoom `100%` and focus `50% / 50%` (center). Drag the preview to adjust both axes. With the preview focused, use the arrow keys for fine adjustments: the normal step is 2 percentage points; `Shift` uses a 10-point step. `Home` centers both axes at 50%.

Use **Reset framing** to remove zoom and focus overrides and return to neutral framing. The action asks for confirmation.

## Why is the image cropped?

Image blocks use `cover`: the frame is completely filled while preserving the image's aspect ratio. When the file and block have different aspect ratios, part of the image falls outside the frame. Increasing Zoom can intensify the crop. Adjust Horizontal/Vertical focus to keep the important subject visible.

> [!warning] There is no Cover/Contain toggle
> The current behavior always fills the frame (`cover`). The older selector for showing the whole image (`contain`) is not available in the current interface.

## Token art is not an ordinary Image Field

The reserved `image` Key represents header Token art and is handled through Atlas. On the header block, Forge offers actions to create a Token in Atlas or link an existing Token when the context meets the requirements. Do not use **Choose from Vault** for this Key. For an independent portrait, create an `Image` Field such as `portrait`.

## See also

- [[20 - Token Art Frame]] — decorative Token-art rim.
- [[21 - Per-Block Appearance]] — block appearance and frame.
- [[23 - Framing Images in the Statblock]] — local adjustment while using a sheet.
