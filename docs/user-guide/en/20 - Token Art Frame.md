---
title: Statblock Forge — Token Art Frame
aliases:
  - Token border
  - Token art border
tags:
  - statblock-forge
  - documentation/appearance
part: 3
---

# Token Art Frame

**Token border** styles the decorative rim around the Token art reserved in the statblock header. It is separate from the outer statblock frame and from frames applied to ordinary Image blocks.

> [!important] Token art is not an ordinary Image Field
> The reserved `image` Field is integrated with the Atlas Token workflow. On a Forge v2 statblock, you can choose a local Vault image and create a native Atlas TokenAsset linked to the note. Forge copies the image into `atlas-vtt/assets`; it does not modify the source image or the statblock note. You can also link existing Atlas Characters. For portraits, illustrations, and maps that should not become tokens, create a separate **Image** Field. See [[22 - Image Fields and Framing]].

## Where to configure it

1. Open the Template in the editor.
2. Go to **Appearance**.
3. Expand **Token border**.
4. Enable **Customize token border**.
5. Choose **Border shape**, **Token border color**, and **Thickness (px)**.
6. Review the header preview and save the Template.

When **Customize token border** is disabled, Forge does not apply the custom decorative rim. The controls are disabled, but the stored configuration does not have to be erased; enabling the option again restores it.

## Available shapes

| Border shape | Appearance and use |
|---|---|
| **Default** | Simple circular outline, close to the standard rim. |
| **Double** | Double circular outline. Useful for highlighting important characters without changing the overall shape. |
| **Oval** | Elliptical frame. |
| **Diamond** | Diamond silhouette for relics, special avatars, or unusual creatures. |
| **Regular hexagon** | Regular hexagon. |
| **Triangle up / right / down / left** | Triangle pointing up, right, down, or left. |
| **Pointed** | Frame with a pointed lower end. |
| **Angular** | Polygonal frame with chamfered corners. |
| **Hexagonal** | Hexagonal silhouette. In the square Token area it uses the same regular proportion as the hexagonal rim; the separate name is retained as its own preset. |
| **Shield** | Shield silhouette with a straight top and pointed lower end. |

Geometric presets change the rim's outline. They are not filters applied to the image: the artwork remains the Token art supplied through Atlas.

## Color and thickness

- **Token border color** accepts a six-digit hexadecimal color (`#RRGGBB`).
- Its initial color follows the statblock theme accent unless a custom color was saved.
- **Thickness (px)** ranges from **1 to 12 px**, in **0.5 px** steps.
- Without a custom value, the default is **2 px**; **Double** starts at **3 px**.

Thickness changes the decorative rim. It does not modify the image file, the Token on the Atlas map, or the dimensions of an Image block.

## What this frame does not change

The Token frame does not:

- select or replace the linked Token;
- create a Token on the map;
- convert an ordinary Image Field into a Token;
- update an existing Atlas TokenAsset when the Forge note's Token art Value changes;
- change framing on an ordinary `image` Field;
- change the outer statblock frame;
- change another block's individual appearance.

To create a TokenAsset from local art or link an existing Token, use the Atlas Token actions available through the reserved Field workflow. Changing the decorative rim does not change the underlying TokenAsset or its image. The rim is presentation only.

## Where the setting is stored

The setting is stored in the Template layout under the Forge property `tokenAppearance` (`enabled`, `borderPreset`, `borderColor`, and `borderWidth`). It follows the Template, not the Token value on an individual sheet. Statblocks using the same Template therefore share the frame configuration even when linked to different Tokens.

Token frames are not included in `.forgestyle` packages. Those packages carry reusable themes and outer frames; they do not carry Tokens, images, or Token frames. See [[24 - .forgestyle Style Library]].

## Example composition

For an important creature, use **Bloodbound Gothic**, keep a **Double** outer frame, and set the Token to **Shield**, dark red, at `3 px`. An additional portrait in the body of the sheet remains an ordinary Image Field with independent framing.

## See also

- [[16 - Appearance Overview]] — appearance layers.
- [[19 - Outer Frame]] — outline around the whole statblock.
- [[21 - Per-Block Appearance]] — individual block styling.
- [[22 - Image Fields and Framing]] — ordinary Vault images.
