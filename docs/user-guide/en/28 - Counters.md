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

A **Counters** Field defines multiple named counter rows. Each row has a maximum, tracks how many uses have been spent, and can optionally define a recovery formula (`regain`). It is useful for charges, per-rest uses, special ammunition, limited activations, and finite-use abilities.

The Template defines row presets. Each statblock keeps its own usage state and its own assignments to Rest buttons.

## Create a Counters Field

1. In the Template, add a Field in the **Counters** category.
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

## How Counters are displayed

The **Counters** block arranges each counter in its own cell. The number of counters per visual row is a block property, **Counters per row**:

- default: `2`;
- minimum: `1`;
- maximum: `6`.

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

Do not use `floor()`, `max()`, ternaries, `{fieldKey}`, or `@field` in `regain`. It is not a Number Formula or a dynamic Rest Formula with references; it is the row's literal dice formula. The dice parser limits still apply (100 characters, 20 terms, and the other limits described in [[27 - Dice Fields and Set Dice]]).

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

## A Counters Field is not a Resource

These concepts can look similar but use different models:

| Counters Field | Resource |
|---|---|
| Can group multiple named rows in one Field. | Represents a tracked value, often a Number Field or an Atlas collection Resource. |
| Each row has `max`, `used`, and optional `regain`. | Uses a tracking direction (counts up/down), current value, and maximum. |
| `reset` identifies the associated Rest button. | Availability/storage may belong to Forge or Atlas. |
| Displayed by a Counters block. | Can be displayed by Track or used by Rest rules. |

A Rest action can spend a Counter and recover a Resource, or spend a Resource and recover Counters.

## Ability Part Counter is different

A **Counter inside an Ability Part** is a local usage control attached to one Entry/Ability part. It can appear as pips or checkboxes and has its own maximum (the part model supports values from 1 to 12).

That counter belongs to that ability part. It is not a Counters Field, does not use the same list of rows, and does not use the Counters Field's `reset`/`regain` Rest assignment.

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
