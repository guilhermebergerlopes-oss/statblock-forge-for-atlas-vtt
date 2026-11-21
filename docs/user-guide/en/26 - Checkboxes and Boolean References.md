---
title: Statblock Forge — Checkboxes, Selection, and Boolean References
aliases:
  - Boolean Fields
  - Boolean options
  - Selection as Boolean
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/formulas
part: 4
---

# Checkboxes, Selection, and Boolean References

A **Checkboxes** Field stores boolean options: checked (`true`) or unchecked (`false`). Each set has its own **Multiple choices** setting. New Fields start with it disabled, allowing only one checked option at a time. Enable it to allow several checked options in the same set. The setting is per Field, so other Checkboxes sets can have their own selections without interfering.

Use Checkboxes for on/off characteristics: flying, swimming, shielded, darkvision, a stance, or equipment bonuses. Do not use a Checkbox when the data needs more than two states; Selection, Number, or another Field may be more appropriate.

## Single and multiple choices

In the Field inspector, enable **Multiple choices** to allow more than one checked option in that set. When disabled, checking an option unchecks the other options in the same Field. Unchecking the selected option leaves the set with no selection. Other Checkboxes Fields are never affected.

Older templates without this setting open in multiple-choice mode to preserve their previous behavior. Newly created Checkboxes Fields start in single-choice mode. When multiple choices are disabled on a set whose sample already has several checked options, only the first configured option remains checked.

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


## Selection as a boolean

A **Selection** Field can also be used as a boolean formula input. Each configured option can be referenced individually: the currently selected option evaluates to `1`; the other options in that Field evaluate to `0`. When no option is selected, all options evaluate to `0`. The Field itself, without an option suffix, evaluates to `1` when it contains any selection and `0` when it is empty.

An option reference uses the Field key, a dot, and a key derived from the option label. Forge generates this key automatically: it lowercases the label, removes accents, and replaces spaces and punctuation with `_`. For example:

| Field | Configured option | Formula reference |
|---|---|---|
| `stance` | `Aggressive` | `stance.aggressive` |
| `stance` | `Defensive` | `stance.defensive` |
| `stance` | `Night Vision` | `stance.night_vision` |

Use `@` or braces as with other formula references:

```text
@stance.aggressive
{stance.night_vision}
attack + stance.aggressive * 2
```

Each option reference always returns `1` or `0`. This works with both single-choice Selection and Selection with **Pick several** enabled: in multiple-choice mode, every selected option independently evaluates to `1`.

If different labels produce the same key, Forge adds a numeric suffix (`_2`, `_3`, ...). Avoid identical labels: because the native Value stores the option text, two options with exactly the same label cannot be distinguished. Since keys are derived from labels, renaming an option may change its formula reference; review formulas that use the option after changing its label. Custom values allowed by **Allow other values** make the Field itself evaluate to `1`, but do not create an option reference until they are added to the configured list.

### Example — stance bonus

With `stance = Aggressive` and `attack = 4`:

```text
attack + stance.aggressive * 2
```

The result is `6`. If the stance is `Defensive` or no option is selected, the result is `4`.

## Where boolean references work

Checkboxes and Selection references are resolved by the same formula evaluator. They are available in:

| Context | Application |
|---|---|
| **Number/Rating Formula** | A numeric Field formula can reference Checkboxes and Selection options. |
| **Metric slot Formula** | A Metric slot formula can reference both categories and updates when one of those Fields changes. |
| **Scores: derived column** | A derived column can reference both categories and the current cell's `value`. |

Rest formulas and Dice Formulas continue to use their own grammars and do not automatically receive these boolean references.

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
