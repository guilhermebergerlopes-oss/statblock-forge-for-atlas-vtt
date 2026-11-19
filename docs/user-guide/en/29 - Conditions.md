---
title: Atlas-native Conditions
aliases:
  - Atlas VTT Conditions
  - Atlas token states and conditions
tags:
  - statblock-forge
  - documentation/atlas-integration
  - atlas/conditions
part: 4
---

# Atlas-native Conditions

**Conditions are no longer managed by Statblock Forge.** Atlas VTT already has its own per-collection Conditions catalog and stores active state directly on Tokens. Forge does not maintain a parallel catalog, render its own Conditions panel, or change those states when Rest actions run.

This separation avoids two competing systems for the same concept. Use Forge to define Fields, Values, formulas, Counters, and compatible Rest actions; use Atlas to define, apply, increase, decrease, and remove Token Conditions.

## Where to configure Conditions

1. Open an Atlas map view.
2. Open the settings for the collection used by the map.
3. Open **Conditions** in the collection's rules settings.
4. Create or edit definitions: name, colour, icon, and, when applicable, whether the Condition is valued.
5. Save the collection settings.

Definitions belong to the collection rules. Each Token keeps its own state, so different Tokens can have different active Conditions while using the same catalog.

## Apply Conditions to Tokens

1. On the Atlas map, right-click a Token (or select multiple Tokens and open the context menu).
2. Open the **Conditions** submenu.
3. Choose a Condition to toggle its presence on the selected Tokens.
4. For valued Conditions, use the submenu's `−` and `+` controls to decrease or increase the value.

When multiple Tokens are selected, Atlas indicates whether a Condition is present on all or only some of them. The operation applies to the selected group.

The **Initiative Tracker** also displays combatants' active Conditions, including their names and, for valued Conditions, their intensity.

## Valued and non-valued Conditions

The Condition definition is configured in the Atlas collection settings:

- **Non-valued:** works as an active/inactive state. The Conditions submenu toggles its presence.
- **Valued:** stores a numeric intensity. The submenu offers controls to decrease or increase the value; when intensity reaches zero, the Condition is no longer active.

The icon and colour belong to the collection definition. Active state and value belong to the Token.

## What Forge does — and does not do

Forge does not:

- create or edit the collection's Conditions catalog;
- store Condition state in statblock frontmatter;
- render its own panel to apply or remove Conditions;
- execute Rest rules that increase, decrease, or clear Conditions;
- synchronize Forge Condition IDs with Atlas Condition IDs.

Forge remains compatible with Atlas statblock and Token workflows. After a note is published and linked to a Token, that Token's Conditions are managed by Atlas, independently of the statblock's Fields and Values.

## Legacy Forge Condition data

Older Forge versions stored definitions in Template layout (`forgeConditionDefinitions`) and per-sheet state in the reserved properties `__forgeConditions` and `__forgeConditionValues`. These values are no longer interpreted or displayed by Forge.

For safety, Forge preserves these legacy properties when it opens and saves Templates or notes. Preservation is not migration: Forge does not automatically convert old IDs or values into Atlas Conditions, because the catalog and state belong to different objects (Template/note versus collection/Token).

Legacy Rest rules with `step` or `clear` operations targeting Conditions are also no longer executed. If they remain in JSON, they are retained as unsupported records and reported by Rest diagnostics. They do not change Atlas Conditions.

> [!important] Before cleaning up legacy data
> Back up the Template and statblock notes. Check the Atlas collection catalog and manually apply any needed Conditions to the corresponding Tokens. Only then remove legacy properties through the JSON editor, if desired. Do not delete `__forgeConditions`, `__forgeConditionValues`, or `forgeConditionDefinitions` before checking whether you still need to consult their old values.

## Conditions, Checkboxes, and Counters

| Feature | Owner | Recommended use |
|---|---|---|
| **Atlas Conditions** | Atlas: per-collection catalog and per-Token state. | States such as Poisoned, Stunned, Frightened, or Exhausted that travel with a Token on the map. |
| **Forge Checkboxes** | Forge: boolean options in statblock Fields. | Traits and choices that participate in Number/Rating formulas. |
| **Forge Counters** | Forge: rows with `max`, `used`, and `regain`, compatible with statblock/Atlas workflows. | Uses, charges, and finite resources that can be spent and recovered. |

Do not use Forge Checkboxes or Counters as substitutes for Atlas Conditions when the state needs to appear on the Token or in the Initiative Tracker. Likewise, do not expect an Atlas Condition to behave as a numeric Forge Field.

## Combined example

A character statblock may have:

- `hp` as a Number/Resource;
- `spell_slots` as Counters;
- `concentration` as a Checkbox for a boolean option used in formulas;
- **Poisoned** and **Stunned** as Atlas collection Conditions.

Forge calculates and presents the statblock's Values, rolls, and Counters. Atlas applies Poisoned or Stunned to the Token through the **Conditions** submenu and displays those states in the Initiative Tracker. A Forge Rest action may restore `hp` or `spell_slots` uses, but it does not change the Token's Conditions.

## See also

- [[26 - Checkboxes and Boolean References]] — boolean Field options.
- [[28 - Counters]] — uses and charges managed by Forge.
- [[30 - Rest Setup and Flow]] — Rest actions available in Forge.
- [[31 - Rest Rules and Formulas]] — Resources and Counters; Conditions belong to Atlas.
