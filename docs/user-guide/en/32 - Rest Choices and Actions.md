---
title: Statblock Forge — Rest Choices and Actions
aliases:
  - Rest player choices
  - Conditional Rest actions
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/rest
part: 4
---

# Rest Choices and Actions

**Player choices** lets a Rest button present alternatives before execution. Each step has a prompt, pick limits, and a list of actions. Each action can contain its own rules; those rules only participate in the rest when that action is selected.

Use steps when a rest offers alternatives such as study, crafting, treating an ally, or choosing an activity. Do not create a step for an effect that must always happen: put that effect directly under the Rest button's **Rules**.

## Structure: button, step, action, and rule

```text
Rest button
├── Direct rules (always applied)
└── Player choices
    ├── Step 1 (prompt and pick limits)
    │   ├── Action A
    │   │   └── Action rules
    │   └── Action B
    │       └── Action rules
    └── Step 2
        └── Actions...
```

- **Rest button:** defines the primary action and direct rules.
- **Choice step:** presents a question and limits how many actions can be selected.
- **Action:** an option shown inside a step, with a name, description, and its own rules.
- **Action rule:** changes a Resource or Counter when that action is applied to the resting character.

## Create steps

In the Template editor, open **Rest**, select a button, and use **Add choice step**. Configure:

- **Prompt:** question shown in the chooser. Keep it clear and contextual.
- **Minimum picks:** minimum required selections; may be 0.
- **Maximum picks:** maximum selections; from 1 to 6.
- **Allow the same action more than once:** allows the same action to be selected repeatedly within the step.

A button supports up to **8 steps**. Each step supports up to **8 actions**. If repetition is off, an action can only be selected once and the maximum cannot exceed the number of available actions. If repetition is on, the same action can be selected multiple times, but the maximum is still 6.

### Pick-limit examples

| Available actions | Repeat | Minimum | Maximum | Result |
|---:|---|---:|---:|---|
| 3 | No | 1 | 1 | Choose exactly one of the three actions. |
| 3 | No | 0 | 2 | Choose none, one, or two different actions. |
| 2 | Yes | 0 | 6 | Repeat one action or combine both, up to six picks. |
| 4 | Yes | 2 | 3 | Make two or three picks, including repeats. |

When an action is removed or repetition is disabled, Forge normalizes the limits so the step remains valid. Review `Minimum picks` and `Maximum picks` after changing the action list.

## Configure actions

Use **Add action** inside a step. Each action has:

- **Name:** label displayed to the player;
- **Description:** optional text up to 400 characters;
- **May be taken for another character:** lets the choice be marked as intended for another character;
- **Action rules:** up to 16 rules applied when the action is selected for the resting character.

A step must contain at least one action to be executable. An action may have no rules—for example, a narrative or organizational choice—or may contain recovery/spend rules as described in [[31 - Rest Rules and Formulas]].

## How choices are presented

The chooser opens anchored to the Rest button. For each step, it shows the prompt, selection progress, and actions:

- Without repeats: each action has a checkbox.
- With repeats: each action has a `−`, count, and `+` stepper.
- The selected count in a step cannot exceed `Maximum picks`.
- Confirm remains disabled until every step meets its minimum and maximum.
- `Esc`, **Cancel**, the close button, or clicking outside closes the chooser without running the rest.

If direct button rules or selected actions include **Spend another resource**, the chooser also displays spend controls. Available spend is calculated from the source's current balance and **Maximum spent**, when configured.

## Selection order

Forge preserves the order in which actions were selected when it builds the Rest request. This matters when several actions contain rules that use Resources/Counters or when more than one action spends from the same resource.

When a selection is removed, the remaining selections keep their relative order. Spend values associated with other actions are remapped to their new positions; Forge should not transfer a spend amount from one action to another just because an index changed.

## Actions for another character

When **May be taken for another character** is enabled, the chooser displays **For** with two options:

- **This character:** the action's rules may be applied to the sheet that is resting.
- **Another character:** records the choice as intended for an ally.

> [!important] It does not modify another sheet automatically
> Choosing **Another character** does not find another note, locate another statblock, or write Values to another character. The selection is recorded in the result as an action for someone else, and that action's rules are not applied to the current sheet. To recover another sheet, open that statblock and run Rest there.

If an action can be repeated, the **For** selection determines the destination of the selected action; an action marked for another character does not spend Resources/Counters from the current sheet or apply its rules to it.

## Direct rules versus action rules

Consider a **Downtime** button:

- Direct rule: always restores 1 point of `focus`.
- Step: prompt **How did you spend your downtime?**
- **Study:** applies a rule that restores `1d4` `mana`.
- **Repair:** applies a rule that restores 2 points of an appropriate Resource.
- **Recover:** applies a rule that restores a Resource or Counter uses.

If the player chooses **Study**, the direct rule and Study rules run. Repair and Recover rules do not run.

To require exactly one action, set `Minimum picks = 1` and `Maximum picks = 1`. To allow skipping the step, set `Minimum picks = 0`.

## Spend rules inside choices

An action can contain a Spend rule. When that action is selected for the current character, the chooser asks how many units to spend. The selected amount cannot exceed:

1. the available source balance;
2. **Maximum spent**, if configured;
3. the current step and request limits.

An action selected for **Another character** does not offer spending against the current sheet because its rules are not applied to that sheet. See [[31 - Rest Rules and Formulas]] for how **Per unit** is combined and applied.

## Complete example: Camp Rest

**Button:** `Camp Rest`

**Direct rule:** `Restore an amount` on Resource `hp`, formula `1d6`.

**Step 1 — Prompt:** `What do you do during the watch?`

- `Minimum picks = 1`
- `Maximum picks = 1`
- Repetition off.

**Actions:**

- **Study the map:** a `Set value` or `Restore an amount` rule for a preparation Resource.
- **Treat wounds:** a `Restore an amount` rule that restores `1d4` of a healing Resource.
- **Watch over an ally:** enable **May be taken for another character**. When the user chooses **Another character**, Forge records the intention but does not automatically change the ally's sheet.

Result: the direct HP rule always runs; only the rules of the action selected for the current character are applied.

## See also

- [[30 - Rest Setup and Flow]] — general limits and execution flow.
- [[31 - Rest Rules and Formulas]] — operations, formulas, and spend behavior.
- [[28 - Counters]] — using Counters in Rest rules.
