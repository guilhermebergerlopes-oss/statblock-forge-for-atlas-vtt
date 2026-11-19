---
title: Statblock Forge — Row
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Row

A **Row** is a flexible horizontal container. Its children follow structural order and share the Row's width according to `Span`. Use it to align small blocks such as AC, HP, and Speed, or to place two tag blocks in the same strip.

Unlike Section, Row does not create an internal Grid. Its children do not receive independent column/row coordinates; width is distributed and child sequence determines order.

## Span and proportional width

Inside a Row, `Span` acts as a relative weight on a logical 12-part scale. Each visual line can total up to 12 parts. Width calculations also account for the space reserved between children.

| Child | Span | Approximate share of the line |
|---|---:|---:|
| AC | 6 | 50% |
| HP | 3 | 25% |
| Speed | 3 | 25% |

More examples:

| Span sequence | Result |
|---|---|
| `6 + 6` | Two children, each with half the width. |
| `8 + 4` | Two children: approximately two-thirds and one-third. |
| `4 + 4 + 4` | Three children, each with approximately one-third. |
| `6 + 3 + 3` | One child with half and two children with one-quarter each. |
| `8 + 8` | The total exceeds 12; the second child starts a new visual line. |
| `12` | One child fills the entire line. |

Forge groups consecutive children into lines: when the next `Span` would make the total exceed 12, that child starts a new line. Grouping is based on Span values and child order, not on an arbitrary line break caused only by the current window width.

A `Span` total below 12 leaves free space in the line. The **Align** property controls how the remaining space is handled.

## Align

Select the Row to configure **Items alignment**:

| Value | Result |
|---|---|
| **Start** | Children begin at the start of the line; this is the default. |
| **Center** | The group of children is centered within the line. |
| **Spread** | Free space is distributed between children. |

Align does not change Span values or block order. It changes the visual alignment of the group within each line.

## Line height

Each visual line receives enough height for its tallest child. Other children stretch to match the line's height. The Row's total height is the sum of its visual lines.

The `Rows` value set in the inspector remains a minimum allocation. Structural containers such as Row calculate enough rows to contain their children; Entries, Scores, and Spells content may have their own row-count controls or internal scrolling. Exact behavior depends on block type.

An empty Row keeps a minimum height and shows a placeholder on the Canvas.

## Dense Layout and Row spacing

Dense Layout controls Grid placement and also changes visual spacing in Rows:

- With **Dense On**, the gap between children is more compact.
- With **Dense Off**, the normal gap is used.

This does not turn Row children into Grid items. Even with Dense Off, their placement remains flexible and based on Span and order; manual cell positioning applies to direct Grid children, not direct Row children.

See [[14 - Dense Layout]] for the complete behavior.

## Allowed children

A Row can contain content blocks and Sections. A Section inside a Row retains its own internal Grid.

A Row **cannot directly contain**:

- another Row;
- a Tabs container.

Tabs also cannot be inserted inside a Row. If you need nested groups, create a Section as a Row child and place Tabs inside that Section.

## Create and configure a Row

1. Select the Canvas or a Section.
2. Choose **Add container → Row**.
3. Select the Row to make it the insertion target.
4. Add compatible blocks or drag Fields into it.
5. Select each child and adjust its `Span` to distribute width.
6. Select the Row and choose **Items alignment**: Start, Center, or Spread.
7. Reorder children with **↑ / ↓** controls or by dragging them within the Row sequence.

### Example: attribute strip

```text
Row: Combat summary
├── Stat: AC       Span 3
├── Stat: HP       Span 6
└── Stat: Speed    Span 3
```

The line uses `3 + 6 + 3 = 12`. HP receives half the width; AC and Speed receive approximately one-quarter each.

### Example: more items than fit on one line

```text
Row: Defenses
├── Stat: AC           Span 4
├── Stat: Fortitude    Span 4
├── Stat: Reflex       Span 4
├── Stat: Will         Span 4  ← starts the second line
└── Stat: Immunity     Span 8
```

The first three items total 12. The fourth starts a new line. The fifth shares that second line with the fourth according to their Spans.

## Ungroup

When a Row is selected, the Canvas offers **Ungroup**. This removes the Row wrapper and returns its children to the previous level in their current order. Child blocks and their own Field, appearance, Span, and Rows settings are preserved; only the Row container's metadata is removed.

Ungroup does not delete Fields or statblock Values. It changes only the presentation structure.

## Common issues

| Symptom | Likely cause | Fix |
|---|---|---|
| A child appears on another line. | Previous Spans plus the new child exceed 12. | Reduce Spans or plan lines with a total of 12 or less. |
| There is empty space after the children. | The line's Span total is below 12. | Increase Spans or set Align to Center/Spread. |
| A child cannot be moved to a specific cell. | Direct Row children do not use Grid coordinates. | Reorder them or adjust Span. |
| Tabs or another Row cannot be added. | Row's nesting rules block those direct children. | Place them inside a child Section. |

## See also

- [[10 - Containers Overview]] — container compatibility.
- [[11 - Section]] — internal Grid for more complex compositions.
- [[13 - Tabs]] — panels that can live inside a Section child of the Row.
- [[14 - Dense Layout]] — compact mode and spacing.
- [[09 - Resizing Blocks]] — adjust Span and Rows.
