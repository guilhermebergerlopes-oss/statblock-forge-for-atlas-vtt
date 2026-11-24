---
title: Statblock Forge — Counters
aliases:
  - Counter Fields
  - Usage counters
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/counters
part: 4
---

# Counters

A **Counter** Field defines multiple named counter rows. Each row has a maximum, tracks how many uses have been spent, and can optionally define a recovery formula (`regain`). It is useful for charges, per-rest uses, special ammunition, limited activations, and finite-use abilities.

The Template defines row presets. Each statblock keeps its own usage state and its own assignments to Rest buttons.

## Create a Counter Field

1. In the Template, add a Field in **Values** and select the **Counter** type.
2. Select the Field in the Fields list.
3. In the inspector, open **Counter rows**.
4. Click **Adicionar Counter** (Add Counter).
5. Enter an optional name, maximum, and optional **Recovery** formula.
6. Use the arrows to reorder rows and `×` to remove a row.
7. Save the Template and check the **Counters** block on the Canvas.

Each preset row has:

| Property | Meaning | Rule |
|---|---|---|
| `name` | Displayed name | Text; may be blank. |
| `max` | Maximum uses | Integer from `0` to `99`. |
| `regain` | Dice regained by **Restore to full** | Optional valid literal dice formula containing at least one die. |

A row with `max = 0` is not displayed on the statblock. New rows start with a blank name and a maximum of `1`.

## How a counter is stored

Each row's state mainly uses:

- `max`: row limit;
- `used`: number of uses already spent;
- `remaining`: displayed value, calculated as `max - used`;
- `reset`: ID of the associated Rest button, when selected;
- `regain`: row formula, when configured.

`remaining` is derived; the persisted field is `used`. Spending a use increases `used`; recovery decreases it. The value stays between `0` and `max`.

Illustrative row data:

```json
{
  "name": "Breath Weapon",
  "max": 3,
  "used": 1,
  "regain": "1d4"
}
```

This row has `2 / 3` uses remaining. `reset` may be added on the sheet when the row is assigned to a Rest button; it is not inherited from the Template preset.

## Referencing Counters in formulas

Counter Fields can be read by Number/Rating Formula, Dice Formula, Table/Metric formulas that use the shared numeric resolver, and Rest formulas (including a row's `regain`). Use the Counter Field key followed by a zero-based row index and a numeric property:

| Reference | Value |
|---|---|
| `{spell_slots.0.max}` | Maximum uses in the first configured row. |
| `{spell_slots.0.used}` or `{spell_slots.0.spent}` | Uses already spent in that row. |
| `{spell_slots.0.remaining}` | Uses still available: `max - used`. |
| `{spell_slots.0.current}` or `{spell_slots.0.available}` | Aliases for `remaining`. |
| `{spell_slots.total.max}` | Sum of the maximums of all visible rows. |
| `{spell_slots.total.used}` or `{spell_slots.total.spent}` | Sum of uses spent in all visible rows. |
| `{spell_slots.total.remaining}`, `{spell_slots.total.current}`, or `{spell_slots.total.available}` | Sum of uses remaining in all visible rows. |
| `{spell_slots.count}` or `{spell_slots.total.count}` | Number of visible rows (`max > 0`). |
| `{spell_slots.0.percent}` / `{spell_slots.0.remainingPercent}` | Percentage of the first row's uses that remain (`remaining / max * 100`). |
| `{spell_slots.0.availablePercent}` / `{spell_slots.0.currentPercent}` | Aliases for `remainingPercent`. |
| `{spell_slots.0.usedPercent}` / `{spell_slots.0.spentPercent}` | Percentage of the first row's uses that have been spent (`used / max * 100`). |
| `{spell_slots.0.isFull}` / `{spell_slots.0.isEmpty}` | Boolean state of the row, returned as `1` or `0`. |
| `{spell_slots.total.remainingPercent}` / `{spell_slots.total.percent}` | Percentage remaining across all visible rows, calculated from summed values (weighted by each row's maximum). |
| `{spell_slots.total.usedPercent}` / `{spell_slots.total.spentPercent}` | Percentage spent across all visible rows. |
| `{spell_slots.total.isFull}` / `{spell_slots.total.isEmpty}` | Whether the visible Counter pool is full or empty, returned as `1` or `0`. |
| `{spell_slots.max}`, `{spell_slots.used}`, `{spell_slots.remaining}`, `{spell_slots.count}` | Short aliases for the corresponding aggregate paths under `.total`. |

The row index starts at `0` and follows the merged Template preset/statblock row order. A row with `max = 0` is hidden but keeps its position in the indexed references; hidden rows are excluded from `total` and `count`. The resolver uses the effective rows shown by the statblock: if a preset row has not yet been written into the statblock Value, its configured maximum is still available to formulas and its `used` starts at `0`.

Examples:

```text
{spell_slots.0.remaining} + {spell_slots.1.remaining}
floor({spell_slots.total.remaining} / 2)
{spell_slots.count} >= 2 ? {spell_slots.0.max} : 0
{spell_slots.0.isEmpty} ? 0 : 1d{spell_slots.0.max}
{spell_slots.total.remainingPercent} >= 50 ? 2 : 1
{spell_slots.remaining} + {spell_slots.used}
```

Percentage references return a decimal from `0` to `100` and are not rounded. `percent` is an alias for `remainingPercent`. `isFull` is true (`1`) when a visible row/pool has a positive maximum and no uses spent; `isEmpty` is true (`1`) when it has a positive maximum and no uses remaining. A hidden row with `max = 0` has no percentage or full/empty state. Property names are case-insensitive; `remaining_percent` and `remaining-percent` are also accepted spellings.

Every aggregate property can omit `.total`: `{spell_slots.remaining}` is equivalent to `{spell_slots.total.remaining}`, and `{spell_slots.remainingPercent}` or `{spell_slots.isFull}` read the matching aggregate derived value. Use the `.0`, `.1`, etc. form when you need one particular row. Aggregate percentages are calculated from the sum of remaining/maximum or used/maximum, not by averaging the row percentages.

Only numeric Counter properties are formula inputs. The row's `name`, `reset`, and `regain` text are not numeric references. If a row/path is missing or its stored state is invalid, the reference is unavailable rather than being silently changed to zero. In Dice Formula and Rest dice expressions, resolved values must also satisfy the dice parser's whole-number limits; percentage values with fractions therefore cannot be used as dice counts or faces until a Number/Rating formula converts them to an integer.

## How Counters are displayed

The **Counters** block arranges each counter in its own cell. The number of counters per visual row is a block property, **Counters per row**:

- default: `2`;
- enter any positive whole number; there is no configured maximum.

The indicator depends on each row's `max`:

| Maximum | Display |
|---|---|
| `1` to `10` | Individual pips/markers. Clicking a marker sets how many uses remain. |
| `11` to `99` | Numeric `−` and `+` stepper. |
| `0` | Row hidden. |

### Show numeric values

The **Show numeric values (remaining / maximum)** option controls the additional `remaining / max` display.

- It is off by default for small counters.
- It can be enabled to show, for example, `3 / 5` alongside pips.
- If any row has `max > 10`, Forge automatically enables the option because the large stepper needs to show the numeric value.

The visual indicator and displayed numbers do not change counter logic.

## The `regain` formula

`regain` is a literal dice formula attached to a Counter row. The Template editor validates it, and it must:

- be accepted by the dice parser;
- contain at least one dice term;
- stay within the dice engine's limits.

Valid examples:

```text
1d4
2d6+1
(1d8+2)
```

Do not use `floor()`, `max()`, or ternaries in `regain`. The formula must contain at least one die, but it may use `@field` and `{field}` references resolved against the statblock Values during Rest. The dice parser limits still apply (100 characters, 20 terms, and the other limits described in [[27 - Dice Fields and Set Dice]]).

### When `regain` is used

A row's formula is consulted when a Rest rule of **Restore to full** reaches that Counter:

- Without `regain`: the row is fully restored; `used` is set to zero.
- With `regain`: Forge rolls that row's formula and decreases `used` by the result, never below zero.

For example, a row with `used = 3` and `regain = 1d4` can recover 1–4 uses, limited to the number already spent. A row with `used = 0` is already full and needs no recovery.

**Restore formula** is different: it calculates/rolls one amount and applies that amount to the selected rows. It is not the same as rolling each row's individual `regain`.

## Assign a row to a Rest button

On the statblock, each row can be assigned to a Rest button through its recovery selector. The assignment stores the button's stable ID in the row's `reset` property.

In Rest rule configuration, a Counters target can include:

- **All rows** — every eligible row in the Field;
- rows assigned to one or more selected Rest buttons.

Assignment belongs to each statblock. The Template defines the presets `name`, `max`, and `regain`, but does not decide which button an individual character uses to recover that row.

## Counters in Rest rules

| Operation | Behavior for Counters |
|---|---|
| **Restore to full** | For each selected row, sets `used` to zero when there is no `regain`; otherwise rolls that row's own formula. |
| **Restore formula** | Calculates/rolls an amount and decreases `used` on selected rows by the recovered amount. |
| **Restore a share** | Calculates the supported share of the maximum and restores uses on selected rows. |
| **Set value** | Sets the number of remaining uses on selected rows. |
| **Spend** | Consumes uses from a Counter as the source for recovering another target, according to the configured rule. |

Rows are selected by the rule scope and `reset` assignments. See [[31 - Rest Rules and Formulas]].

## A Counter Field is not a Resource

These concepts can look similar but use different models:

| Counter Field | Resource |
|---|---|
| Can group multiple named rows in one Field. | Represents a tracked value, often a Number Field or an Atlas collection Resource. |
| Each row has `max`, `used`, and optional `regain`. | Uses a tracking direction (counts up/down), current value, and maximum. |
| `reset` identifies the associated Rest button. | Availability/storage may belong to Forge or Atlas. |
| Displayed by a Counters block. | Can be displayed by Track or used by Rest rules. |

A Rest action can spend a Counter and recover a Resource, or spend a Resource and recover Counters.

## Ability Part Counter is different

A **Counter inside an Ability Part** is a local usage control attached to one Entry/Ability part. It can appear as pips or checkboxes and has its own maximum (the part model supports values from 1 to 12).

That counter belongs to that ability part. It is not a Counter Field, does not use the same list of rows, and does not use the Counter Field's `reset`/`regain` Rest assignment.

## Template changes and existing sheets

Template presets describe the initial rows. Each statblock's usage values belong to that instance. When editing a Counters structure, review existing sheets and their Values before removing or renaming rows; matching can depend on preset order/identity and existing names.

Back up statblock notes before bulk changes.

## Troubleshooting

| Symptom | Check |
|---|---|
| A row does not appear | Check that `max` is greater than zero. |
| A stepper appears instead of pips | The maximum is above 10. |
| `remaining / maximum` is missing | Enable **Show numeric values**; for max above 10 it is forced. |
| `regain` is rejected | Use a valid literal dice formula containing at least one die. |
| A Rest rule does not affect the row | Check the rule scope and the row's button assignment in `reset`. |
| A counter does not fully recover | Check whether `regain` is set; with a formula, recovery is the roll result, not automatically the maximum. |

## See also

- [[27 - Dice Fields and Set Dice]] — dice notation and parser limits.
- [[29 - Conditions]] — Token Conditions managed by Atlas.
- [[30 - Rest Setup and Flow]] — Rest buttons.
- [[31 - Rest Rules and Formulas]] — operations that spend/recover Counters.
- [[32 - Rest Choices and Actions]] — costs and action choices.
