---
title: Statblock Forge — Checkboxes and Boolean References
aliases:
  - Boolean Fields
  - Boolean options
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/formulas
part: 4
---

# Checkboxes and Boolean References

A **Checkboxes** Field stores multiple independent options, each with a boolean state: checked (`true`) or unchecked (`false`). These options can be read by Number/Rating formulas and other contexts that use the shared numeric expression evaluator.

Use Checkboxes for on/off characteristics: flying, swimming, shielded, darkvision, a stance, or equipment bonuses. Do not use a Checkbox when the data needs more than two states; Choice, Number, or another Field may be more appropriate.

## Create and configure options

1. In the Template editor, create a Field in the **Checkboxes** category.
2. Set the Field **Label** and `key`, for example `traits`.
3. In the inspector, find **Checkbox options**.
4. Add one option for each independent characteristic.
5. Set the visible label and each option's `Key`.
6. Save the Template and test the options in the preview.

Example:

| Field | Option key | Display label |
|---|---|---|
| `traits` | `flying` | Flying |
| `traits` | `swimming` | Swimming |
| `traits` | `magical` | Magical |
| `defenses` | `armored` | Armored |

The complete reference is the Field key, a dot, and the option key. Because the shared numeric evaluator accepts bare keys, `@`, and braces, the same reference can be written in all three forms:

```text
traits.flying
@traits.flying
{traits.flying}
defenses.armored
```

## Option key rules

An option key is a data identifier, not a user-facing label. It:

- starts with a lowercase letter (`a`–`z`);
- may contain lowercase letters, digits, and `_`;
- is 1–40 characters long;
- must not duplicate another key or conflict with an alias in the same Field.

Valid examples: `flying`, `darkvision`, `resistant_fire`, `trait_2`.

The editor may generate a key from the Label, but verify the final identifier before using it in formulas. Avoid changing keys after Templates and statblocks are already in use.

## How a boolean enters a formula

The stored state remains boolean. During numeric evaluation, a boolean is interpreted as:

| State | Numeric value |
|---|---:|
| Checked (`true`) | `1` |
| Unchecked (`false`) | `0` |

This lets a conditional bonus participate in a calculation without creating a separate Number Field for every toggle.

### Example 1 — bonus from a trait

```text
strength + traits.flying * 2
```

If `strength = 3`:

- `traits.flying = false` → `3 + 0 * 2` = `3`;
- `traits.flying = true` → `3 + 1 * 2` = `5`.

### Example 2 — two required conditions

```text
traits.flying && traits.magical ? 5 : 0
```

The result is `5` only when both options are checked. Otherwise it is `0`.

### Example 3 — option as a multiplier

```text
base_damage * (1 + traits.empowered)
```

If `base_damage = 6`, the result is `6` without Empowered and `12` with it.

### Example 4 — multiple bonuses

```text
strength + traits.flying * 2 + defenses.armored
```

Each option contributes `0` or `1` independently.

## Where boolean references work

Boolean options can be used in contexts that call `evaluatePreviewFormula()`:

| Context | Use |
|---|---|
| **Number/Rating Formula** | A numeric Field formula can reference `traits.flying`. See [[25 - Formulas in Number and Rating]]. |
| **Metric slot Formula** | A formula written directly on a Metric slot can reference Checkboxes options and updates when the option changes. |
| **Scores: derived column** | A derived column using the shared expression evaluator can reference boolean options and the corresponding cell's `value`. |

The **Checkboxes** block is where the user checks/unchecks options; it is not itself a calculation block. Calculation takes place in another context that references the option.

## Sheet Values and Samples

Definitions (keys and labels) belong to the Template. Checked/unchecked state belongs to each statblock.

In normalized data, configured options without an existing value are initialized as unchecked. Therefore, an existing configured option that is unchecked participates as `0`. A reference to a Field/option key that does not exist or is incompatible is not the same as an unchecked option; it may leave the formula unresolved.

Illustrative Value for a `traits` Field:

```json
{
  "traits": {
    "flying": true,
    "swimming": false,
    "magical": true
  }
}
```

Each statblock has its own object. Changing `traits.flying` on one sheet does not change another sheet.

## Renaming options and aliases

When an option key is renamed through the editor, Forge can retain the previous key as an alias to migrate/recover an already-stored boolean. This protects existing Values. Still review formulas: an expression using the old key must be checked and updated to the current identifier where necessary.

Before deleting an option, search for references in Number/Rating, Metric, or Scores. A formula that still points to a removed option must not be treated as though the option were simply unchecked.

## What Checkboxes does not do

- It does not calculate its own numeric Values.
- It does not store levels or counts larger than zero/one.
- It does not create or change Atlas Conditions; use the Atlas collection catalog for Token states.
- It does not automatically create a Number or Metric modifier.
- It does not run expressions inside individual options.

> [!info] Do not confuse this with the old Checkbox Modifiers
> The current model uses a regular Checkboxes Field as the boolean source. The old **Add checkbox modifier** controls are not part of the current workflow.

## Troubleshooting

| Symptom | Likely cause / check |
|---|---|
| Formula returns `—` | Check the Field key, option key, and whether the definition still exists. |
| Checkbox appears unchecked but bonus is present | Check for a migration alias or another data path with the same reference. |
| Renaming an option lost its state | Check the previous alias and the saved statblock object. |
| Key is rejected | Use lowercase letters, digits, and `_`, starting with a letter. |

## See also

- [[25 - Formulas in Number and Rating]] — numeric grammar and functions.
- [[05 - Fields]] — Field types.
- [[29 - Conditions]] — Atlas-native Conditions managed by collection and Token.
