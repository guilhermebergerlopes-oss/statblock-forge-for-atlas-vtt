---
title: Statblock Forge — Tabs
aliases:
  - Statblock Forge tabs
tags:
  - statblock-forge
  - documentation/layout
part: 2
---

# Tabs

The **Tabs** container creates a navigation strip between panels. Each tab is a direct child **Section** of Tabs. Only the active panel is visible in the statblock.

Use Tabs when content groups are related but do not need to be visible at the same time, such as melee attacks, ranged attacks, and spells.

## Structure

```text
Tabs: Combat options
├── Section: Melee
│   ├── Entries: Melee attacks
│   └── Stat: Reach
├── Section: Ranged
│   └── Entries: Ranged attacks
└── Section: Special abilities
    └── Groups: Special abilities
```

Tabs organizes the tabs. Each Section is a panel and has its own internal Grid. Content remains linked to Template Fields; switching tabs does not duplicate or change Values.

## Tabs heading and tab labels

The Tabs block itself can have an optional fixed **Heading**, displayed above the tab strip. Each tab's title comes from its Section:

- The Section's **Heading** sets the fixed tab label.
- The Section's **Dynamic heading** can use a Field as the label when it has a readable Value.
- If the Section has no title, Forge uses a fallback label such as `Tab 1`, unless the label has been hidden.

The Tabs Heading does not replace Section headings. It names the set; Sections name individual panels.

## Create Tabs and add tabs

1. Select the Canvas or a Section (Tabs cannot be placed inside a Row).
2. Choose **Add container → Tabs container**.
3. Select the new Tabs container.
4. Use **Add tab** in the inspector or **Add container → Tab (Section)** in the Canvas toolbar.
5. Forge creates a child Section; select it to set Heading/Dynamic heading.
6. With the Section selected, add blocks or drag Fields into the panel.
7. Repeat for each tab.

The first tab is active in a new statblock rendering. In the editor, Forge preserves the active tab selection while the preview is updated during that editing session.

### Add a Field directly to Tabs

Tabs accepts Sections only. If you drag a Field directly onto the Tabs container, Forge creates a new Section, uses the Field label as its heading, and places the corresponding block inside it. This creates a new tab.

To add a Field to an existing tab, drag it onto that tab's Section.

## Edit and reorder tabs

Select a Section that is a direct child of Tabs. The inspector shows tab-specific controls:

- **←** moves the tab one position to the left.
- **→** moves the tab one position to the right.
- **Heading** changes the fixed tab label.
- **Dynamic heading** sets or removes the Field used as the dynamic label.
- **Delete tab** removes the selected tab.

The order of Section children inside Tabs is the order of the tab strip. Moving a tab does not change Values in Fields belonging to other tabs.

## Removing a tab: what is deleted?

**Delete tab** removes the selected Section and its nested blocks from the layout tree, along with those blocks' appearance and placement metadata. Other tabs remain, and Forge activates another one when necessary.

Field definitions and Values already stored in notes are separate from the layout tree; removing a tab's presentation does not automatically delete its Field or erase its Values. If the Field is no longer needed, review it separately in the Field editor.

## Rules and limits

- Tabs accepts Sections only as direct children.
- Do not place Stat, Metric, Row, Entries, or other blocks directly inside Tabs; put them inside a Section.
- Row cannot contain Tabs. To use Tabs in a horizontal composition, place a Section inside the Row and Tabs inside that Section.
- Each Section panel uses the Grid configured for the Template.
- Tabs reserves enough height for the tallest tab, plus the navigation strip and its optional fixed Heading.
- In the published statblock, the panel area is constrained by the Tabs block size; resize the container so its content fits.

If an older Template contains incompatible direct children inside Tabs, Forge displays a warning in the preview. Incompatible items are preserved in the Template, but a Tabs panel only presents Sections as tabs. Fix the tree by moving the content into a Section.

## Ability Tabs: specialized Entries structure

Forge recognizes a Tabs container as **Ability Tabs** when every direct child Section contains exactly one Entries block. This matches the Abilities structure used by Atlas.

```text
Tabs: Abilities
├── Section: Actions
│   └── Entries: actions
├── Section: Reactions
│   └── Entries: reactions
└── Section: Legendary Actions
    └── Entries: legendary_actions
```

Each tab has its own Entries Field and therefore its own list of Values. Entry Part definitions are shared/cloned from the first Field's shape when new tabs are created.

### Split into tabs

A standalone Entries block may offer **Split into tabs** when it is at the root Canvas or inside a regular Section. The command is not offered for Entries directly inside a Row or for Entries already inside a tab.

When executed:

1. The original Entries block is preserved and becomes the content of the first tab.
2. Forge creates Tabs and two Sections.
3. A new Entries Field is created for the second tab, copying the original Field's Entry Part structure.
4. The second tab's Entries block uses that new Field; its Value list is independent.

Forge does not turn one list into two shared lists. The first tab retains existing data; the second is a separate collection.

### Add and remove Ability tabs

When Tabs is recognized as Ability Tabs, the inspector offers **Add Ability tab**. The new tab receives a Section, its own Entries Field, and Part structure cloned from the first tab.

Removing a tab removes its block from the layout tree but keeps its Field and stored data. If only one tab remains, the Tabs wrapper and remaining Section are removed, and the remaining Entries block becomes a direct block again, preserving its Field and list.

If you add other blocks inside an Ability tab's Section, that structure no longer matches the specialized format (each tab must contain exactly one Entries block). Tabs can continue working as a regular Tabs container, but Ability-specific commands no longer apply.

## Choosing a structure

| Content | Suggested structure |
|---|---|
| Several attacks that should appear together. | One Entries block, optionally inside a Section. |
| Melee and ranged attacks in separate panels, each with its own list. | Ability Tabs with one Entries block per Section. |
| Attacks, attack bonus, and reach in one panel. | Tabs with a Section; place Entries and Stat inside the Section. This is not specialized Ability Tabs. |
| Grouped values separated by category. | Generic Tabs with one Section per group, or a Groups block. |

## See also

- [[10 - Containers Overview]] — nesting rules.
- [[11 - Section]] — tab headings and the internal Grid.
- [[12 - Row]] — why Tabs must not be a direct Row child.
- [[15 - Moving and Reordering Blocks]] — drag-and-drop and structural order.
