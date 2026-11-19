---
title: Statblock Forge — Formulas in Number and Rating
aliases:
  - Numeric formulas
  - Number Formula
  - Rating Formula
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/formulas
part: 4
---

# Formulas in Number and Rating

**Number** and **Rating** Fields can display a calculated result instead of showing only the stored Value. The formula belongs to the Field definition in the **Template**; input data remains on each statblock. This lets one reusable rule produce different results for different characters or creatures.

This formula family is deterministic: it calculates a number from available data. It does not roll dice and is not the same language as **Dice Formula** or **Rest** rules.

## Where to configure

1. Open the Template in the Forge editor.
2. Select a **Number** or **Rating** Field in the Field list.
3. Find **Formula** in the Field inspector.
4. Enter the expression and review the Sample/preview.
5. Save the Template.

The property is optional. When empty, Forge displays the Field's base Value. Formula text is limited to **500 characters**. Reserved Fields such as `hp` and `level` may also appear in **Statblock Header** settings; the formula still belongs to the corresponding Field.

## What `value` means

Inside a Field's own formula, `value` means the base Value stored in that same Field. It lets you transform the entered number without replacing the original input.

Example: the `armor` Field stores `12` and uses:

```text
value + proficiency
```

With `proficiency = 2`, the sheet displays `14`. The base `12` remains the stored data; `14` is calculated for display and for contexts that request the Field's numeric value.

`value` does not mean “the last calculated result on the sheet” or another Field's Value. Use that Field's key for another property.

## Referencing other Fields

Use the Field's `key` directly, without `@` and without braces:

```text
strength + proficiency
attributes.dexterity + 2
```

The evaluator looks up the key in the statblock's Values record. Dot-separated paths can access nested object properties; numeric path segments can select array positions when the data contains an array.

### Identifier rules

The formula tokenizer recognizes names beginning with a letter or `_`, followed by letters, digits, `_`, or dots. For formula references, prefer keys such as `might`, `proficiency`, `base_hp`, and `attributes.dexterity`.

Although general Forge Field keys may contain hyphens, a hyphen inside a formula name is read as the subtraction operator. Avoid hyphenated keys when they need to be referenced in a Number/Rating formula.

A reference must exist and resolve to a usable number or boolean. A missing Field, empty Value, or non-numeric text makes the result unavailable; Forge does not silently convert invalid text to zero.

### Fractional Ratings

A Rating may store a representation such as `1/4`. In numeric formula context, Forge converts it to a decimal (`0.25`) without replacing the original representation stored on the sheet.

Example:

```text
challenge_rating * 4
```

If `challenge_rating` is a Rating with Value `1/4`, the expression returns `1`.

This fraction handling is specific to Rating. A Number containing the text `1/4` is not a valid numeric input; store a number or use an appropriate expression instead.

## Operators and precedence

The evaluator follows conventional mathematical precedence. Parentheses can make the intended order explicit.

| Group | Syntax | Use |
|---|---|---|
| Grouping | `( ... )` | Sets calculation order. |
| Unary | `+x`, `-x`, `!x` | Keeps/inverts sign; `!` negates a logical condition. |
| Multiplicative | `*`, `/`, `%` | Multiplication, division, and remainder. |
| Additive | `+`, `-` | Addition and subtraction. |
| Comparison | `>`, `>=`, `<`, `<=`, `==`, `!=` | Compares two values. |
| Logical | `&&`, `||` | Logical AND and OR, with short-circuit evaluation. |
| Conditional | `condition ? A : B` | Chooses a result based on a condition. |

The literals `true` and `false` are also recognized. In a numeric expression, booleans can be used as `1` and `0`; inside `&&`, `||`, `!`, and a ternary test, they retain logical behavior.

## Mathematical functions

| Function | Parameters | Result |
|---|---|---|
| `floor(x)` | One | Rounds down. |
| `ceil(x)` | One | Rounds up. |
| `round(x)` | One | Rounds to the nearest integer. |
| `abs(x)` | One | Absolute value. |
| `min(a, b, ...)` | One or more | Smallest argument. |
| `max(a, b, ...)` | One or more | Largest argument. |

Examples:

```text
floor(value / 2)
max(strength, dexterity) + 2
abs(modifier)
```

Only these functions are available. The evaluator does not allow arbitrary calls, APIs, assignments, or JavaScript execution.

## Complete examples

Assume a statblock has:

| Field | Stored Value |
|---|---:|
| `strength` | 3 |
| `dexterity` | 5 |
| `proficiency` | 2 |
| `armor` | 12 |
| `hp_base` | 18 |

**Attack bonus based on Strength:**

```text
strength + proficiency
```

Result: `5`.

**Defense based on the higher ability:**

```text
max(strength, dexterity) + 2
```

Result: `7`.

**Hit Points with half the level:**

```text
hp_base + floor(level / 2)
```

With `level = 5`, result: `20`.

**Conditional bonus:**

```text
strength >= 4 ? proficiency + 1 : proficiency
```

With Strength `3`, result: `2`; when Strength reaches `4`, result `3`.

## Relationship to blocks and other formulas

The formula belongs to the Field, not to the block. The same Field can be presented by a compatible block without duplicating its expression.

| Context | How the formula is used |
|---|---|
| **Header** | Reserved numeric Fields such as HP and Level can display their calculated result. |
| **Stat** | Displays the calculated numeric Field as an individual value. |
| **Line** | Displays the same result alongside other Fields. |
| **Metric** | A slot referencing Number/Rating can display the Field's calculated numeric value. The slot can also have its own independent formula. |
| **Track** | A numeric Field used as a tracked value or maximum can provide its calculated result to the tracking control. |
| **Scores** | Derived columns can use their own formulas and the cell's `value`; this is column configuration, not the Number/Rating Field formula. |

### Field formula versus Metric slot formula

A Number/Rating Field formula follows the Field wherever it is displayed. A formula configured directly on a **Metric** slot belongs to that block and calculates that slot. If the Metric slot has its own formula, it supplies the displayed slot value instead of simply reading the associated Field Value.

Example of a Metric slot formula:

```text
strength + proficiency
```

It can create a derived Metric number without changing the `strength` Field Value or its own formula.

## Dependencies and practical limits

- Renaming a key through the editor updates formula references recognized by Forge.
- Deleting a Field still referenced by formulas, settings, or rules is blocked until the dependency is removed or redirected.
- Evaluation uses the Values available in the instance. Do not treat Number/Rating formulas as a recursive calculation chain: a reference reads the corresponding Value in the sheet record; it does not automatically execute the referenced Field's own formula.
- If the result is non-finite, a reference cannot be read, or an expression is invalid, Forge displays an unavailable result (`—`) in compatible visual contexts.
- Division and remainder by zero do not produce a valid number.

## Troubleshooting

| Symptom | Check |
|---|---|
| Formula displays `—` | Confirm that all keys exist and their Values are numeric. |
| `value` is not the expected number | Check the base Value stored in this Field. |
| A dotted reference fails | Check the actual object structure in Sample/JSON. |
| A fraction fails | Confirm the source Field is Rating, not Number. |
| It works in Dice but not Number | Check syntax: Number uses names without `{}`; Dice Formula uses `{fieldKey}` placeholders. |

## See also

- [[26 - Checkboxes and Boolean References]] — use boolean options as inputs.
- [[27 - Dice Fields and Set Dice]] — random expressions and dynamic dice formulas.
- [[31 - Rest Rules and Formulas]] — `@field` references and recovery expressions.
- [[05 - Fields]] — Field types and properties.
