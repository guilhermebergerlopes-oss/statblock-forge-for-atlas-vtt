---
title: Statblock Forge — Rest Rules and Formulas
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/rest
part: 4
---

# Rest Rules and Formulas

A Rest rule defines **what changes**, **which operation is performed**, and, when needed, **how much is restored or spent**. The editor provides five operations for Resources and Counters. Conditions are managed by Atlas and are not valid targets for Forge Rest rules.

## Supported operations

| Editor operation | Stored ID | Target | Effect |
|---|---|---|---|
| **Restore to maximum** | `full` | Resource or Counters | Moves a Resource to its full/empty boundary according to tracking direction; recovers spent Counter uses. |
| **Restore an amount** | `amount` | Resource or Counters | Calculates or rolls an amount to restore. An optional minimum is supported. |
| **Restore a fraction** | `share` | Resource or Counters | Restores 25% or 50% of the maximum, with up/down rounding and an optional minimum. |
| **Set value** | `set` | Resource or Counters | Sets the current value; for Counters, the number means remaining uses. |
| **Spend another resource** | `spend` | Resource or Counters | Spends units from another Resource/Counter source and calculates recovery per unit. |

All five available operations use Resource or Counter targets.

## How Forge identifies a Resource

A **local Resource** is based on a Number Field configured for tracking. Tracking can be defined in either of these ways:

1. `tracks` on the Field itself, with **Counts down** or **Counts up** direction; or
2. an unbound **Track** block that points to a Number Field and defines its direction.

A Number Field can also reference another Number Field as its maximum. If no maximum is configured, or the configured key does not resolve to a valid Number Field, Forge uses the tracked Field itself as the maximum.

### Counts down and Counts up

| Direction | Full state | Spend | Restore |
|---|---|---|---|
| **Counts down** | Current = maximum | Decreases current. | Increases current up to maximum. |
| **Counts up** | Current = 0 | Increases current up to maximum. | Decreases current toward zero. |

Example: `hp` with maximum 20 and **Counts down** starts at 20; taking 6 damage leaves 14, and restoring 4 leaves 18. An **Counts up** Resource with maximum 6 starts at 0; spending 2 moves it to 2, and restoring 1 moves it back to 1.

### Where the current value is stored

When a Field is also its own maximum, the maximum remains associated with the Number Field and the current amount is stored in the sheet's reserved `__forgeResourceValues` state. When the maximum is another Field, the current amount is stored in the tracked Field and the maximum is read from the configured Number Field.

Tracking state is per statblock. Two characters using the same Template do not share a current Resource value.

### Atlas collection Resources

When a Template is linked to an Atlas collection context and a collection Resource reads a compatible Field, that Resource may be offered as a target/source in the editor. Its current value remains owned by the Atlas character/token state; it is not converted into a local Counter or an ordinary Forge Value.

Static collection Resources or Resources without an available current value cannot be changed. Writing a collection Resource requires the corresponding character to be available in a compatible Atlas context; without it, the rule may be skipped or not offered.

## Counters as targets and sources

A **Counters** Field has rows with a name, maximum, and used amount (`used`). Remaining uses are `max - used`. Spending a Counter increases `used`; restoring it decreases `used`.

Counter rules can target:

- **All rows:** every valid row in the Field;
- selected rows assigned to specific Rest buttons.

The association uses stable Rest button IDs even though the editor displays button names. Renaming or reordering a button should not be treated as creating a new ID.

### Restore to maximum and `regain`

When Counter uses are restored to maximum, each selected row without a `regain` formula has `used` set to zero. If a row has `regain`, Forge rolls that formula for the row when it still has spent uses and decreases `used` by the rolled amount, never below zero.

`regain` is a dice formula that must contain at least one die. It accepts `@field_key` and `{field_key}` references, resolved against the statblock Values during Rest. `regain` is evaluated per row, unlike **Restore an amount** targeting a Counter Field.

### Restore an amount on Counters

For an `amount` rule whose target is a Counter Field, the formula is calculated/rolled **once for the Counter Field**. The same recovered amount is then applied to the selected rows. It does not roll independently for each row.

By contrast, **Restore a fraction** calculates from each selected row's own maximum, so rows with different maxima can recover different amounts.

## The five operations in detail

### 1. Restore to maximum (`full`)

- **Resource:** Counts down moves to maximum; Counts up moves to zero.
- **Counters:** sets `used` to zero in selected rows, except when a row has `regain`; that formula is rolled and only the amount obtained is recovered.

### 2. Restore an amount (`amount`)

Enter a formula and, optionally, a **Minimum**. The applied gain is the greatest of zero, the configured minimum, and the calculated/rolled result.

Formula examples:

```text
1d8
2d6+2
@level d4
(@proficiency+1)*2
```

`@level d4` uses `level` as the dice count. If `level = 3`, the filled formula becomes `3d4`. `(@proficiency+1)*2` is deterministic: with `proficiency = 2`, it calculates 6 without rolling dice.

For a Counts down Resource, the gain increases current; for Counts up, it decreases current. For Counters, it decreases `used` on selected rows.

### 3. Restore a fraction (`share`)

Choose **25%** or **50%**, a rounding direction (**Round down** or **Round up**), and optionally a minimum.

Example with maximum 17:

- 25% rounded down = 4;
- 25% rounded up = 5;
- 50% rounded down = 8;
- 50% rounded up = 9.

When configured, the minimum replaces a smaller fraction: the gain is `max(minimum, rounded fraction)`. For Counters, the calculation uses each selected row's own maximum.

### 4. Set value (`set`)

Set the current value to a fixed non-negative integer, or enable **Use another field as the value** and select a Number/Rating Field. The reference is read as that Field's calculated numeric value.

For Counters, the number represents **remaining uses**, not `used`. Example: a row with maximum 5 and `Set value = 2` ends with 2 remaining uses (`used = 3`).

The final value is clamped to the valid target range. A missing or non-numeric source Field causes the rule to be skipped.

### 5. Spend another resource (`spend`)

This operation has a **recovery target** and a **spend source**:

- **Target field:** Resource or Counters that receives recovery;
- **Spend from:** Resource or Counters from which units are consumed;
- **Per unit:** recovery formula for each unit spent;
- **Maximum spent (optional):** an additional cap on the number of units the user may choose.

Available units are limited by the source's current balance. For a Counts down Resource, available is the current value; for Counts up, it is `maximum - current`; for Counters, it is the sum of remaining uses in the selected source rows.

The **Per unit** formula is combined according to the selected number of units before evaluation/rolling. For example, two units of `1d8+2` represent two summed portions (`2d8+4` in the linear form). Formulas with modifiers that cannot be scaled linearly are kept as separate portions.

Forge validates the source, target, amount, and formula against current Values. It only applies the spend and recovery when the operation can be calculated. A Spend rule can open the chooser even when the button has no player-choice steps.

## Rest formula syntax

**Restore an amount**, **Per unit**, and `regain` use the Forge/Atlas dice parser, not the Number/Rating formula language.

### `@field` and `{field}` references

Use `@` or braces around a Field key to insert its numeric value. Both forms can be mixed in one formula:

```text
@level d4
1d8+@proficiency
(@might+2)*2
```

For Number/Rating Fields, Forge reads the Field's calculated numeric value. A reference that does not resolve to a safe integer is rejected; the engine does not silently round fractions to use them as dice counts or constants.

If a reference is followed by `d` (with or without a space), it is interpreted as a dice count and must be between 0 and 999. In other contexts, it is an integer constant with an absolute maximum of 9,999. References can use dotted paths when data is nested, such as `@attributes.might`.

### Operators and dice

The dice grammar supports `+`, `-`, `*`, `/`, parentheses, and the dice terms documented in [[27 - Dice Fields and Set Dice]], including percentile/Fate dice and modifiers recognized by the parser. Division keeps fractional values while the expression is evaluated; the final total is truncated to an integer.

Rest formula fields are limited to **100 characters**. The parser also applies its own limits for terms, dice, faces, and nesting depth.

> [!warning] Do not mix formula families
> Rest formulas accept `@field_key` and `{field_key}` references. They do not accept `floor()`, `ceil()`, `round()`, `min()`, `max()`, comparisons, boolean operators, or ternaries. Use [[25 - Formulas in Number and Rating]] for deterministic Field calculations and [[27 - Dice Fields and Set Dice]] for dynamic dice rolls in `dice` Fields.

> [!important] `regain` exception
> A Counter row's `regain` formula must contain at least one die. It also accepts `@field_key` and `{field_key}` references, resolved against the statblock Values during Rest; each row is evaluated separately.

## Order, failures, and data safety

Direct button rules are calculated first; rules from each selected action are then calculated in selection order. Where applicable, each rule works with changes made by earlier rules in that same execution.

If a target, formula, reference, spend source, or stored data cannot be resolved, the result marks that rule as **Not applied**. Other valid rules can still be applied.

Before writing, Forge rereads the sheet file and validates choices and spend amounts against current balances. This prevents a spend from exceeding a value that changed while the chooser was open.

## See also

- [[30 - Rest Setup and Flow]] — buttons, execution, and limits.
- [[32 - Rest Choices and Actions]] — steps, actions, and spend requests.
- [[25 - Formulas in Number and Rating]] — numeric calculations.
- [[27 - Dice Fields and Set Dice]] — dice grammar and roll sets.
- [[28 - Counters]] — `max`, `used`, `reset`, and `regain`.
- [[29 - Conditions]] — Token Conditions are managed by Atlas, outside Forge Rest rules.
