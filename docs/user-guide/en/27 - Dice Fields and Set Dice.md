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
2. **Dice Formula:** the expression is defined in the Template and uses Number/Rating Values from the sheet to build the resolved formula.

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

The editor's syntax validator recognizes explicit Field references in dice expressions as numeric placeholders while checking notation. For a Template-controlled roll, use **Dice Formula**, which validates Number/Rating Field dependencies and accepts both `@fieldKey` and `{fieldKey}`.

## 2. Dynamic Dice Formula with `@field` or `{fieldKey}`

**Dice Formula** is configured in the Dice Field's Template properties. It turns statblock Values into a resolved dice expression. Use `@key` or `{key}` around the exact key of the source Field. Both forms can appear in one expression; use braces for keys containing hyphens:

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
4. Confirm that each placeholder points to another **Number** or **Rating** Field in the same Template.
5. Fill Samples with valid integers to preview the resolved expression.
6. Save the Template and test it on a real statblock.

The configured formula accepts up to **500 characters**. The final expanded expression must still obey the dice parser's limits.

### Which Fields can be referenced

Only **Number** and **Rating** Fields can be referenced by `@fieldKey` or `{fieldKey}`. A Dice Field cannot reference itself.

Every substituted Value must be a **safe integer**. This matters because the number before `d` means the number of dice, and the number after `d` means the die's faces.

| Source Value | Example | Resolution |
|---|---|---|
| Integer | `proficiency = 2` | Valid. |
| Negative integer as a modifier | `modifier = -1` | Can participate as a constant/additive term when the resulting expression is valid. |
| Fractional Rating | `challenge = 1/4` | Not substituted: fractions are not integers. |
| Decimal | `might = 8.5` | Not substituted. |
| Text | `might = "high"` | Not substituted. |
| Missing Field | `{missing}` | Unresolved. |
| Wrong type | `{weaponName}` where the Field is Text | Unresolved. |

If any reference is missing, empty, fractional, or the wrong type, the formula does not produce a roll link. Forge shows an unavailable state (`—`) and does not silently replace a bad reference with zero.

### What happens when a Field changes

- Changing a source Number/Rating Value updates the displayed Dice Formula on the sheet.
- If the source Field has its own formula, its calculated numeric result is used for that substitution.
- Renaming a key through the editor updates recognized `@oldKey` and `{oldKey}` references.
- A Number/Rating Field used by a Dice Formula cannot be deleted or converted to an incompatible type until the dependency is fixed.
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
| Dice Formula | `@proficiency d{might}+{level}` or `{proficiency}d{might}+@level` | Substitutes integer Values and creates a roll. |
| Rest Formula | `(@level)d4`, `1d8+2` | Recovery/spending rule with `@field` references and its own validator. |
| Counter `regain` | `1d4`, `2d6+1` | Literal per-row dice formula used by **Restore to full**. |

> [!warning] Do not copy syntax without adapting it
> Number/Rating, Dice Formula, and Rest accept `@field` and `{field}` references; Number/Rating also keeps direct `field` names. Each formula family retains its own grammar and operators.

## Troubleshooting

| Symptom | Check |
|---|---|
| Dice Formula displays `—` | Confirm all placeholders exist and point to Number/Rating Fields. |
| Formula does not resolve even though the Fields exist | Check that all substituted Values are safe integers. |
| Parser rejects the expression | Check operators, parentheses, modifiers, and parser limits. |
| `avg` is missing | The expression may contain modifiers, references, or operations without a reliable simple average. |
| Custom Set is missing | Check the JSON in `atlas-vtt/dice-sets/`, especially `id`, `name`, `dice`, and `crit`. |
| A roll does not use the expected Set | Check the Template's `diceSetId` and the collection set when using **Collection default**. |

## See also

- [[25 - Formulas in Number and Rating]] — deterministic calculations.
- [[26 - Checkboxes and Boolean References]] — boolean Values used in calculations.
- [[28 - Counters]] — `regain` formulas.
- [[30 - Rest Setup and Flow]] — Rest buttons.
- [[31 - Rest Rules and Formulas]] — recovery references and formulas.
