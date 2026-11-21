---
title: Statblock Forge — Rest Setup and Flow
aliases:
  - Rest configuration
tags:
  - statblock-forge
  - documentation/advanced-features
  - documentation/rest
part: 4
---

# Rest Setup and Flow

**Rest** lets a Template offer downtime actions that restore Resources, recover Counter uses, or set values. The configuration belongs to the Template; effects are calculated against the Values and state of the statblock that runs the rest.

Rest is not a timer or an automatic time-based recovery system. It is a configurable set of actions, rules, and choices that the user triggers from a sheet.

## Where to configure Rest

1. Open the Template in the Forge editor.
2. In the Canvas action bar, select **Rest**.
3. In the sidebar, configure the Rest buttons.
4. Inside each button, configure always-applied rules and, when needed, **Player choices** steps.
5. Save the Template.

The editor keeps records it recognizes and preserves unknown recovery JSON entries and properties. If the editor displays a warning about incomplete or unsupported entries, inspect its diagnostics and use **Edit JSON** to repair the original data; do not assume a rule is active when Forge marked it as unknown.

## Rest buttons

A Template can contain up to **6 Rest buttons**. Each button has a name, direct rules, and optional choice steps. Use names that describe the offered action, for example:

- **Short Rest** — limited recovery between encounters.
- **Long Rest** — broader recovery at the end of a journey.
- **Downtime** — choices such as study, repair, or recovery during a longer break.

Buttons can be reordered with the up/down controls. Their order is reflected in Counter selectors that assign rows to Rest buttons. Associations are stored by stable button IDs, not by the visible button name.

## Direct rules and action rules

Rules placed directly under **Rules** run whenever the Rest button is confirmed. Rules inside a **Player choices** action run only when that action is selected.

This allows fixed and optional effects to be combined. For example, a rest can always restore 1 Focus and also let the player choose **Study**, **Repair**, or **Recover**.

Each button supports up to **16 direct rules**. Each action supports up to **16 action rules**. Supported operations and targets are described in [[31 - Rest Rules and Formulas]].

## When the chooser opens

A button runs immediately when it has no choice steps and no Spend rule that requires a quantity to be selected.

The Rest chooser opens when the button has at least one **Player choices** step or a **Spend another resource** rule. In the chooser, the user selects actions and enters how many units to spend from each available source. **Confirm** is enabled only when all steps satisfy their minimum and maximum pick limits.

The chooser is a temporary panel anchored to the Rest button. **Cancel**, the close button, clicking outside, or pressing `Esc` closes it without applying the rest.

## Where Rest appears on the sheet

Configured buttons appear below the statblock content. Forge does not render a Conditions panel: Token Conditions are configured and applied directly in Atlas. See [[29 - Conditions]] for the collection catalog and the Token context-menu submenu.

Forge Rest rules modify only compatible Resources and Counters. They do not change Atlas-native Conditions.

## Configuration limits

| Element | Limit |
|---|---:|
| Rest buttons per Template | 6 |
| Direct rules per button | 16 |
| Player-choice steps per button | 8 |
| Actions per step | 8 |
| Rules per action | 16 |
| Picks per step | 0 to 6 |
| Button name and step prompt | 100 characters |
| Action description | 400 characters |
| Rest formula | 100 characters |

Without repeated picks, an action can be selected only once and the maximum cannot exceed the number of available actions. With **Allow the same action more than once**, one action can occupy multiple picks, up to the six-pick limit.

## Execution flow

1. The user activates a Rest button on the sheet.
2. If choices or spends are required, the chooser requests actions and quantities.
3. Forge rereads the current note values and validates the request. This prevents applying choices made against values that became stale while the chooser was open.
4. Direct button rules are calculated first; rules from selected actions are then calculated in selection order.
5. Local Resources and Counters are written to the sheet. An Atlas collection Resource is written to the corresponding Atlas character/Token state. Before the first Atlas write, Forge validates all affected stores and checks that the Resource values still match the snapshot used for calculation.
6. The result modal reports rolls, spends, Counter and Resource changes, and rules that were skipped.

Atlas Resource writes use a compensating transaction rather than a cross-system database transaction: Forge records the previous value of every affected token/form and PartySync store. If a later Atlas store write or the statblock note write fails, Forge attempts to restore only the entries changed by that Rest. Entries that were never changed are left alone, and entries edited by another operation are not overwritten. A rollback conflict is reported with the original write error so the state can be reconciled rather than silently discarding a newer edit.

An invalid rule does not necessarily prevent other valid rules from being calculated. The result summary identifies targets or formulas that could not be applied.

## Persistence and compatibility

Rest buttons are stored in the Template's `recovery` property, using the Atlas-compatible recovery data format. Conditions are not part of Forge layout or Rest data; they are configured in Atlas collection rules.

On a sheet, Counter Values and local Resource state are saved in their corresponding Fields/tracking data. Conditions belong to Atlas Token state. Collection Resources remain owned by Atlas and require a compatible Atlas context to be written.

The editor preserves recovery entries and properties it cannot interpret. Legacy Condition (`step`/`clear`) rules are not executed by Forge and remain in JSON for inspection; use Atlas-native Conditions instead.

## Example design: Short Rest and Long Rest

Consider a character with tracked `hp`, a Number Field `mana` configured as a Resource, and a Counter Field named `abilities`:

- **Short Rest:** a direct rule restores `1d8` `hp`; another rule restores half of `mana` maximum, rounded down. A Counter rule may restore only rows assigned to Short Rest.
- **Long Rest:** restores `hp` to maximum and recovers Counter rows assigned to Long Rest. Since rows can be associated with multiple buttons, configure each row's association to match the rests allowed to recover it.
- **Downtime:** always restores a small Resource and opens a step with `min = 1`, `max = 1`; the user chooses **Study**, **Repair**, or **Recover**, and each action applies its own rules.

These names and effects are configuration examples; actual results depend on the Fields, tracking, Counters, and formulas defined in the Template.

## Quick troubleshooting

| Symptom | Check |
|---|---|
| The button does not appear | Confirm that the Template has a recognized Rest button and that the statblock uses that Template. |
| The button runs without opening the chooser | Check whether it has a choice step or a recognized Spend rule. |
| A step cannot be confirmed | Review `Minimum picks`, `Maximum picks`, the number of actions, and the repeat option. |
| A Condition is missing from a Token | Check the collection **Conditions** catalog in Atlas settings and apply the Condition from the Token context menu. |
| A rule is reported as skipped | Read the result reason; check target, tracking, formula, reference, and Atlas context. |
| An Atlas collection Resource does not change | Confirm the Atlas character link and that an Atlas map with the current Resource state is open. |

## See also

- [[31 - Rest Rules and Formulas]] — operations, targets, formulas, and examples.
- [[32 - Rest Choices and Actions]] — steps, limits, selection, and ally actions.
- [[28 - Counters]] — rows, uses, `reset`, and `regain`.
- [[29 - Conditions]] — Atlas-managed Token catalog and state.
- [[27 - Dice Fields and Set Dice]] — dice notation and roll sets.
