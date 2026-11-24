---
title: Statblock Forge — Dice Fields and Set Dice
aliases:
  - Dice expressions and roll sets
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/dice
part: 4
---

# Dice Fields and Set Dice

A **Dice** Field represents an expression to roll, such as `2d6+3`, `1d20+5`, or `(1d8+2)*2`. Forge validates the expression with the dice parser used by its Atlas integration and renders valid expressions as roll links.

There are two distinct ways to configure a Dice Field:

1. **Literal formula:** the roll text is the Field's own Value on each statblock.
2. **Dice Formula:** the expression is defined in the Template and uses the same numeric-compatible Field references as Number/Rating formulas to build the resolved roll.

The **Set Dice** action selects the dice set/rules associated with compatible Template roll contexts. It does not replace the Field expression.

## 1. Literal Dice Field

Without **Dice Formula**, the Field stores a dice expression directly in the statblock Value. This is useful when two creatures from the same Template need different expressions or when the user should be able to edit the expression on the sheet itself.

Examples:

```text
2d6+3
1d20+5
4d6kh3
2d6[fire]
```

The content must be an expression accepted by the parser and contain at least one die. Descriptive prose does not belong in a Dice Field. To place rolls inside descriptive text, use the text roll-link scanner; see the text-roll documentation when available.

### `@field` references in dice text

The editor's syntax validator recognizes explicit Field references in dice expressions as numeric placeholders while checking notation. For a Template-controlled roll, use **Dice Formula**, which accepts `@fieldKey`, `{fieldKey}`, and bare Field keys, with the same numeric-compatible reference lookup as Number/Rating formulas.

## 2. Dynamic Dice Formula with `@field` or `{fieldKey}`

**Dice Formula** is configured in the Dice Field's Template properties. It turns statblock Values into a resolved dice expression. References use the same resolver as Number/Rating formulas: use a bare Field key, `@key`, or `{key}`. Dotted paths can read Checkboxes and Selection options, numeric properties inside structured Values, and Table cells. Braces are safest for keys containing hyphens:

```text
@proficiency d{might}+{level}
{proficiency}d@might+@level
```

Given these Values:

| Field | Type | Statblock Value |
|---|---|---:|
| `proficiency` | Number | 2 |
| `might` | Number | 8 |
| `level` | Rating | 3 |

Forge replaces the placeholders and produces:

```text
2d8+3
```

The configured formula stays in the Template. The numbers `2`, `8`, and `3` belong to the sheet. The same Template can therefore produce `2d8+3` for one creature and `4d10+5` for another without duplicating the Template.

### Configure a Dice Formula

1. Create or select a **Dice** Field.
2. Open that Field's properties.
3. Enter the expression in **Dice Formula** using `@fieldKey` or `{fieldKey}`.
4. Confirm that every reference points to another Field in the same Template and resolves to a numeric-compatible value.
5. Fill Samples with valid integers to preview the resolved expression.
6. Save the Template and test it on a real statblock.

The configured formula accepts up to **500 characters**. The final expanded expression must still obey the dice parser's limits.

### Which Values can be referenced

Dice Formula uses the same reference resolver as Number/Rating formulas. It can read:

- Number and Rating Values, including the displayed result of a Field's own Formula;
- Checkboxes options and Selection options as booleans (`true` becomes `1`, `false` becomes `0`);
- Selection options configured with **Each with a number**, through `.number`;
- nested object properties and array positions when they contain a numeric/boolean Value;
- displayed Table cells, including Table Row Formulas and child Number/Rating formulas;
- any other Field Value that the Number Formula resolver can interpret as a number or boolean.

Examples:

```text
{traits.flying} * {strength}
{stance.aggressive} * {proficiency}
{slots.0.max}d6kh{slots.0.used}
{scores.row2.power}d{strength}kh{strength}
```

For simple keys, bare references and `@key` are also supported. Use braces for keys containing hyphens and for dotted paths when you want the reference to be unambiguous.

### Checkbox-weighted dice pools

A Checkboxes Field can be referenced as a whole Field: it resolves to `1` when at least one configured option is checked and `0` when none is checked. You can multiply that boolean by a numeric Field to include or exclude its contribution from a dice pool:

```text
({cb_strength}*{strength} + {cb_skill1}*{skill1} + {cb_skill2}*{skill2})d{strength}kh{strength}
```

For example, with Strength `3`, Skill 1 `2`, Skill 2 `4`, and only `cb_strength` plus `cb_skill1` checked, the formula resolves to `5d3kh3`: roll five d3 and keep the highest three. You can also reference one option directly, such as `{traits.flying}`.

Counter Fields provide row-level and aggregate references. For example, `{spell_slots.0.max}`, `{spell_slots.0.used}`, and `{spell_slots.0.remaining}` read the first row's maximum, spent uses, and remaining uses. `.spent` aliases `.used`; `.current` and `.available` alias `.remaining`. Indexes start at zero and follow the merged Template-preset/statblock row order. A preset row can be referenced before it is materialized in the statblock Value; its initial `used` is zero.

The aggregate can be read through `.total` paths such as `{spell_slots.total.remaining}`, or with shorter root aliases such as `{spell_slots.remaining}`, `{spell_slots.used}`, and `{spell_slots.max}`. `{spell_slots.count}` returns the number of visible rows. Rows with `max = 0` keep their index but are hidden and excluded from aggregates.

Counters also expose derived values: `.remainingPercent` (aliases `.percent`, `.availablePercent`, and `.currentPercent`), `.usedPercent` (alias `.spentPercent`), `.isFull`, and `.isEmpty`. Percentages are unrounded values from `0` to `100`; full/empty flags are boolean numbers (`1` or `0`). Aggregate percentages are weighted by the rows' maximums. Property names are case-insensitive, and underscore/hyphen spellings such as `.remaining_percent` are accepted. A hidden row with `max = 0` has no percentage or full/empty state.

The same Counter paths work in Number/Rating, Dice Formula, Table/Metric, and Rest formulas. Only numeric properties are formula values; text properties such as `name`, `reset`, and `regain` are not. Dice Formula requires every resolved value used in the roll expression to be a safe integer, so fractional percentages cannot be inserted directly as dice counts/faces. Use a Number/Rating Field formula such as `floor({spell_slots.0.remainingPercent})` when an integer is required.

If a referenced Number/Rating Field has its own Formula, the complete Number Formula is evaluated first — including arithmetic, comparisons, logical expressions, ternary conditions, and supported functions such as `floor`, `ceil`, `round`, `abs`, `min`, and `max. Dice Formula then substitutes that calculated result.

The final substitution still has to be a **safe integer**. Dice counts, die faces, keep/drop amounts, and constants are whole-number values in the dice parser. A fractional Rating such as `1/4`, a decimal such as `8.5`, missing data, or non-numeric text does not produce a roll link. This is the dice-notation constraint; it does not change how Number/Rating formulas display fractional results.

The Dice Formula itself remains a dice expression, not a general Number Formula. Use a referenced Number/Rating Field when you need to calculate a value with Number Formula functions or conditions; the resolved value must still be a safe integer for the dice parser.

A Dice Field cannot reference itself. Missing references and unresolved/circular calculations produce an unavailable state (`—`); values are not silently replaced with zero.

### What happens when a Field changes

- Changing any referenced Value — including a Checkboxes option, Selection option, structured property, or Table cell — updates the displayed Dice Formula on the sheet.
- If a referenced Number/Rating Field has its own Formula, its calculated displayed result is used for that substitution.
- Renaming a key through the editor updates recognized `@oldKey` and `{oldKey}` references.
- A Field referenced by a Dice Formula cannot be deleted until the dependency is fixed. Changing its type is allowed, but the resulting Value must still resolve as a number or boolean.
- The sheet user edits source Values, not the expression defined in the Template.

### Example: attribute and proficiency damage

Template:

| Field key | Type | Dice Formula / setting |
|---|---|---|
| `weapon_dice` | Dice | `@proficiency d{might}+{level}` or `{proficiency}d{might}+@level` |
| `proficiency` | Number | Per-sheet Value |
| `might` | Number | Per-sheet Value |
| `level` | Rating | Per-sheet Value |

Sheet A: `proficiency = 2`, `might = 8`, `level = 3` → `2d8+3`.

Sheet B: `proficiency = 3`, `might = 10`, `level = 4` → `3d10+4`.

Both use the same Template definition.

## Where Dice Fields can appear

A Dice Field follows the normal Field-to-block relationship. Confirmed contexts include:

- **Stat:** displays the formula as an individual roll link.
- **Line:** displays the formula alongside other Fields.
- **Metric Container:** a Dice Field inside the Container can display the resolved expression as a link; a formula configured directly on that Metric slot takes precedence over the Field's Dice Formula.
- **Text inside Entries, Lists, Pairs, and Groups:** dice expressions recognized in text can become links through the text roll scanner. This does not turn the text into a Dice Field and does not by itself create `{fieldKey}` dependencies.

A block controls presentation. The Dice type controls the data. A dynamic formula is applied when the renderer is displaying the associated Dice Field.

## Supported dice notation

The grammar is shared with Atlas's dice parser. Examples:

| Feature | Example | Effect |
|---|---|---|
| Standard die | `1d20`, `2d6` | Rolls one or more numbered dice. |
| Percentile | `d%` | Rolls a d100. |
| Fate | `3dF` | Rolls three dice with −1, 0, or +1 faces. |
| Add/subtract | `2d6+3`, `2d6-1d4` | Combines dice and constants. |
| Parentheses | `(1d8+2)*2` | Groups an expression. |
| Reroll | `4d6r1` | Rerolls results matched by the modifier. |
| Explosion | `2d6!` | Adds rolls when the explosion rule applies. |
| Keep | `4d6kh3`, `2d20kl1` | Keeps higher/lower dice according to the modifier. |
| Drop | `4d6dh1`, `4d6dl1` | Drops higher/lower dice according to the modifier. |
| Count successes/failures | `8d10cs>=8`, `8d10cf<2` | Counts dice meeting the comparison. |
| Label | `2d6[fire]` | Names the dice group in the result. |
| Written advantage/disadvantage | `1d20+5 adv`, `1d20+5 dis` | Requests advantage (`adv`) or disadvantage (`dis`) for the roll. |

> [!note] Statblock roll-link suffix
> `adv` and `dis` are interpreted by the statblock roll-link system, not by the general arithmetic grammar. The suffix must be the final word and does not apply to Number/Rating or Rest Formula.

Modifiers can have their own comparison rules and limits. Not every combination is valid. Start with a simple example and check the editor's validation feedback.

### Parser limits

The engine limits expressions to prevent excessive formulas:

| Limit | Maximum |
|---|---:|
| Expression length passed to the parser | 100 characters |
| Dice/constant terms | 20 |
| Base dice before rerolls/explosions | 100 |
| Faces per die | 1,000 |
| Parenthesis depth | 8 |
| Absolute calculated total | 1,000,000,000 |

A Dice Formula configured in the Template can use 500 characters because it contains placeholders; after substitution, the final expression must obey the dice-roll parser limits. A formula that passes placeholder syntax validation can still become unavailable if its resolved expression exceeds a limit.

## The `avg` hint

For simple linear additive expressions, Forge may show an `avg` hint with an estimated average. The hint appears only for the subset whose average can be calculated reliably.

- `2d6+3` → `avg 10`.
- `2d6-1d4` → `avg 4.5`.
- `3dF` → `avg 0`.
- `d%` → `avg 50.5`.

The interface suppresses the hint for dynamic references (`@...` or `{...}`), rerolls, explosions, keep/drop, success/failure counting, products, and quotients. No `avg` hint does not mean the formula is invalid; it means Forge is not showing a simplified estimate.

## Set Dice

In the Template editor, use **Set Dice** to select the dice set associated with the Template.

| Option | Dice/rules shown |
|---|---|
| **Collection default** | Lets Atlas use the set configured for the active collection. Removes the Template's explicit `diceSetId`. |
| **d20** | `1d20`, natural criticals. |
| **d20 roll-under** | `1d20`, roll-under critical rule. |
| **d100 roll-under** | `1d100`, roll-under rule. |
| **d10 exploding** | `1d10`, exploding-die rule. |
| **Power roll** | `2d10`, edge and bane. |
| **Custom sets** | Valid JSON records found in the expected Vault folder. |

An explicit selection is stored as `diceSetId` in the Template. **Collection default** removes the explicit selection and delegates to Atlas.

### Custom sets

Forge reads custom sets from:

```text
atlas-vtt/dice-sets/
```

It does not create, edit, or export these files. The selector reads valid JSON records with an `id`, a `name`, one or more dice groups, and a supported critical rule. A record can also include explosion, advantage, and disadvantage settings.

General selector validation rules:

- name up to 40 characters;
- 1–6 dice groups;
- each group uses a count of 1–20 and sides of 2–999;
- total count across groups is at most 20 dice;
- `crit` must be `natural`, `roll-under`, `doubles`, `high-total`, or `none`;
- optional explosion/advantage settings must match the format expected by Atlas.

Invalid JSON does not appear in the selector. If a Template points to a `diceSetId` that cannot be found, choose an available set or restore the corresponding custom file. Forge does not modify Atlas's library.

## Advantage, disadvantage, and next-roll queue

Roll links in the statblock use the original Atlas Dice Tool when the statblock belongs to an open map. Without an open map, Forge rolls locally using the Template Dice Set or the same collection Dice Set the verified Atlas runtime would select.

- Click the link to roll normally.
- `Shift` + click requests advantage when the set/rules allow it.
- `Alt` + click requests disadvantage when allowed.
- Right-click a formula and choose **Save roll to Atlas collection**. Name the roll; Forge writes the resolved formula to the owning statblock collection’s `dicePresets`. Atlas allows up to 40 saved rolls, with names up to 40 characters. The formula must be supported by Atlas’s parser and no longer than 100 characters. When the formula is a simple additive roll, the dialog can also save it as an individual Dice Lab look: a matching active Dice Set is copied with its rules and appearance, or the formula's own dice become a natural-critical look. You can edit the saved look later in Atlas' native saved-roll editor. Formulas ending in `adv`/`dis` or using unsupported modifiers remain formula presets without conversion.
- You can also write `adv` or `dis` as the final word of a formula: `1d20+5 adv`, `1d20+5 dis`, or `Stealth +5 adv`. This works in running-text links and Dice Fields.
- When the written suffix and the click shortcut request opposite sides, they cancel. For example, `1d20+5 adv` clicked with `Alt` rolls with neither advantage nor disadvantage.
- The active Dice Set must define a rule for the written side; otherwise, Forge does not silently perform a normal off-map roll.
- You can also write `adv` or `dis` as the final word of a formula: `1d20+5 adv`, `1d20+5 dis`, or `Stealth +5 adv`. This works in running-text links and Dice Fields.
- When the written suffix and the click shortcut request opposite sides, they cancel. For example, `1d20+5 adv` clicked with `Alt` rolls with neither advantage nor disadvantage.
- The active Dice Set must define a rule for the written side; otherwise, Forge does not silently perform a normal off-map roll.
- Right-click opens the roll context menu.
- **Add to next roll** queues the formula without rolling it immediately.
- As a shortcut, hold `N` and click the link to add/remove the formula from the queue.

Queued formulas are added to the next successful roll for the same statblock. The queue is session-only and is not saved in the Template or note. A failed/unavailable roll does not consume pending modifiers.

The context menu includes **Roll history** without requiring the fork. Forge combines persisted `diceLog` entries and transient `rollHistory` entries from open Atlas maps with its own history saved in the plugin's `data.json`. Forge retains up to 20 rolls per statblock and 500 entries overall.

Rolls made through Forge links store the formula, source, Dice Set, and advantage/disadvantage used. When the original map is still open and visible, repeating a roll uses that map's DiceTool. When the map has been closed, Forge repeats it locally with the saved Dice Set. Older entries read directly from a map remain repeatable while that map is available; they are not copied into Forge's persistent history merely by being displayed.

## Dice Formula, Number Formula, and Rest Formula are not interchangeable

| Family | Reference syntax | Result |
|---|---|---|
| Number/Rating | `strength + proficiency`, `value * 2` | Deterministic number; no roll. |
| Dice Formula | `@proficiency d{might}+{level}` or `{traits.flying}d{might}+@level` | Substitutes numeric-compatible references and creates a roll. |
| Rest Formula | `(@level)d4`, `1d8+2` | Recovery/spending rule with `@field` references and its own validator. |
| Counter `regain` | `1d4`, `2d6+1` | Literal per-row dice formula used by **Restore to full**. |

> [!warning] Do not copy syntax without adapting it
> Number/Rating, Dice Formula, and Rest accept `@field` and `{field}` references; Number/Rating also keeps direct `field` names. Each formula family retains its own grammar and operators.

## Troubleshooting

| Symptom | Check |
|---|---|
| Dice Formula displays `—` | Confirm all reference roots exist, the path/option is valid, and every resolved value is a safe integer. |
| Formula does not resolve even though the Fields exist | Check the nested option/property path and confirm all substituted Values are safe integers. |
| Parser rejects the expression | Check operators, parentheses, modifiers, and parser limits. |
| `avg` is missing | The expression may contain modifiers, references, or operations without a reliable simple average. |
| Custom Set is missing | Check the JSON in `atlas-vtt/dice-sets/`, especially `id`, `name`, `dice`, and `crit`. |
| A roll does not use the expected Set | Check the Template's `diceSetId` and the collection set when using **Collection default**. |

## Arithmetic expressions in dice modifiers

Numeric modifier arguments can be calculated dynamically. Put the arithmetic expression in parentheses; Field references use the same `{fieldKey}` / `@fieldKey` syntax as the dice pool:

```text
8d6kh({strength} + {skill})
8d6kl({minimum} + 1)
8d6dh({strength} - 1)
8d6r>=({difficulty} + 1)
```

This applies to keep/drop (`kh`, `kl`, `dh`, `dl`, `k`, `h`, `l`), reroll (`r`, `ro`, `rr`), explosion (`x`, `xo`) thresholds, and success/failure counting (`cs`, `cf`) thresholds. The expression must resolve to a non-negative whole number within the dice engine limit. Invalid or unresolved expressions do not produce a roll.

## See also

- [[25 - Formulas in Number and Rating]] — deterministic calculations.
- [[26 - Checkboxes and Boolean References]] — boolean Values used in calculations.
- [[28 - Counters]] — `regain` formulas.
- [[30 - Rest Setup and Flow]] — Rest buttons.
- [[31 - Rest Rules and Formulas]] — recovery references and formulas.
