# Statblock Forge 0.5.4 — source package status

This archive contains the 0.5.4 source snapshot with Atlas Link Statblock badge/preview support and the native Atlas DM Screen presentation. It is **not an installable Obsidian plugin package**.

## Changes in this source revision

- Reverted the custom Forge DM Screen feed and its full-sheet renderer override.
- The Atlas DM Screen now keeps its own compact native `LinkedStatblock` cards, sizing, filters, initiative ordering, navigation, menus, and resource controls. Forge no longer hides Atlas' native sheet, mounts a second feed, or injects a full Forge sheet into the GM/DM Screen.
- Full Forge sheets remain available in Forge notes and through the Forge/Atlas Ctrl-hover preview where Atlas exposes that interaction. The Link Statblock dialog continues to use the full Forge renderer for Forge entries.
- Removed the obsolete DM Screen bridge/model, feed-only renderer variant, DM Screen SCSS source, and generated CSS block. The style compiler no longer references that SCSS file.
- Kept Forge Token linking, Forge note registration, the FORGE badge in Atlas' Link Statblock picker, and the full Forge preview for the link dialog unchanged.
- Updated the README and downloadable documentation in Portuguese and English to describe the native Atlas DM Screen presentation.

## Latest UI adjustment — compact Boxes Value labels

- Reduced the vertical gap between the label and indicators for `Value` blocks rendered in Boxes mode from `0.3rem` to `0.2rem`, matching the label-to-indicator gap used by Counter rows.
- Set the Boxes Value heading line-height to `1`, matching the compact Counter label line-height.
- Applied the compact spacing only to Boxes mode; Gauge mode retains its existing spacing.
- Added a regression test covering the mode-specific class and spacing rules.

## Validation

- Focused Boxes Value label-spacing test: **1/1 passed**.
- Full automated suite: **766/777 passed**. The 11 remaining failures are blocked by files absent from the supplied source archive: root `main.ts` and `docs/user-guide/en/01 - Overview.md`.
- `tsc --noEmit` and `npm run build` could not run because dependencies are not installed; the source archive also lacks the root `main.ts` entry point.
- No in-app Obsidian/Atlas runtime verification was possible in this environment.

## Build/install limitation

The supplied source snapshot does not contain the root `main.ts` entry point (nor a built `main.js`). `esbuild.config.mjs` expects `main.ts` and writes `main.js`. To produce an installable plugin, merge these source changes into the complete Forge repository (including its root `main.ts`), install dependencies with `npm install`, then run `npm run build`. The resulting plugin folder must contain `main.js`, `manifest.json`, and `styles.css`.

## Latest UI adjustment — compact Gauge controls

- Reduced the Gauge label-to-meter vertical gap to `0.2rem`, matching Boxes and Counter rows.
- Removed the visible `Current` / `Maximum` labels and the duplicated `current / maximum` text beside the Gauge.
- Added one decrement button before the meter and one increment button after it. They update the tracked current value and are limited by zero and the configured maximum.
- When a tracked Number uses its own Value as the maximum, clicking the Gauge opens that Number's inline editor. The Gauge nodes remain mounted while the maximum is saved, so the editor is not detached during its update.
- Kept the existing Boxes presentation and interactions unchanged.
- Added Gauge interaction and layout regression tests.

## Validation after Gauge adjustment

- Focused Gauge, Number editor, track spacing, and zero-value tests: **21/21 passed**.
- Broad test run excluding 10 test files that depend on the omitted root `main.ts` / documentation sources: **731/731 passed**.
- `npm ci` timed out in this environment, so `tsc --noEmit` and `npm run build` could not be completed. The archive still omits the root `main.ts` entry point and is not an installable plugin package.
- No in-app Obsidian/Atlas runtime verification was possible in this environment.

## Latest UI correction — repeated Gauge controls and full-width meter

- Fixed the save-state notification sequence: after a value finishes saving (or rolls back after an error), the numeric runtime now notifies subscribers after `isSaving` returns to `false`. This re-enables the Gauge decrement/increment buttons, so they remain usable across repeated clicks.
- Made the Gauge decrement and increment buttons smaller (0.9rem), circular, and centered.
- Expanded the Gauge row and its meter to the available block width. The meter now flexes to occupy the remaining width between the two compact buttons.
- Kept the changes scoped to Gauge layout; Boxes presentation is unchanged.
- Added regression tests for the save completion notification, circular button dimensions, and full-width Gauge layout.

## Validation after repeated-control correction

- Focused Gauge, track layout, tracked Number, Table renderer, and Compendium presentation tests: **46/46 passed**.
- Full automated suite: **772/783 passed**. The 11 remaining failures are the same source-archive limitations: the omitted root `main.ts` and `docs/user-guide/en/01 - Overview.md`; failures reference those missing files.
- Build/typecheck remain unavailable in this source snapshot because dependencies are absent and the root `main.ts` entry point is omitted.
- No in-app Obsidian/Atlas runtime verification was possible in this environment.

## Regression fix — Field reordering with Table storage

- Fixed `reorderTemplateField()` so it reorders only user-editable Fields. Fixed Header Fields and private Table/Scores storage adapters keep their original positions and are no longer replaced by an out-of-range array lookup.
- Added defensive Field-record checks to the Field palette and Container normalization paths so an empty entry cannot trigger `.key` access errors in `isHeaderField()`, `ensureForgeContainers()`, or Canvas selection.
- Added recovery for `null` Field-array slots serialized by the previous bug. Empty slots are removed with a warning; all valid Field records, their sample values, and Table storage references are preserved.
- Added regression tests covering reordering with a Table adapter between regular Fields, runtime repair of empty slots, and recovery when reopening a template containing serialized `null` entries.

## Validation after Field reordering fix

- Focused Container, Table, Field reordering, and recovery tests: **22/22 passed**.
- Broad test run excluding 10 test files that require the omitted root `main.ts` and/or `docs/user-guide/en/01 - Overview.md`: **736/736 passed**.
- Full test run: **775/786 passed**. All 11 remaining failures are the same incomplete-archive limitations involving missing `main.ts` or the referenced overview document; none are failures in the new Field/Container regression tests.
- `tsc --noEmit` remains blocked because the source archive does not include the `obsidian` type dependency. The archive also still omits root `main.ts`, so it cannot be built into an installable plugin in isolation.
- Targeted strict TypeScript check for `forgeTemplate.ts`, `fieldEditorModel.ts`, and `containerEditorModel.ts`: **passed**. The full project `tsc --noEmit` still cannot start because `@types/obsidian` is absent from this source archive.


## Formula references to specific Table cells

- Added explicit cell paths for formulas outside a Table: `{table_1.row2.value}` and `@table_1.row2.value`. The root key is the private `forgeInternal: table-storage` Field key; `rowN` is one-based; the final segment is a child column Field key declared by the Table's Scores block.
- `row1` resolves to the base Value of the child Field. Rows `row2` and later resolve to the corresponding `extraRows` cell in the Table's Forge-owned row data. Missing rows, missing columns, empty cells, or invalid table paths return an unavailable result rather than zero.
- Wired the shared numeric formula runtime so Number/Rating formulas, Metric formulas, and Table Row/Column formulas can read the same Table cell references. The original statblock data is kept separate from temporary row overlays, so `row1` still resolves to the first stored row while a Row Formula is calculating a later row.
- Added dependency tracking so renaming or deleting the Table storage Field or a referenced child column does not silently leave stale references.
- Updated the Portuguese and English Formula and Table Formula documentation. Clarified that references read stored source-cell Values, not the rendered result of a Row Formula in that cell.
- Focused formula, reference-syntax, documentation, dependency, and rename tests: **34/34 passed**.
- Full test suite: **784/795 passed**. The 11 remaining failures depend on files omitted from the supplied source archive: root `main.ts` and `docs/user-guide/en/01 - Overview.md`.
- `tsc --noEmit` remains blocked because `@types/obsidian` is not present in this source archive. The omitted root `main.ts` also prevents building an installable plugin from this archive alone. No in-app Obsidian/Atlas runtime test was possible here.

## Formula references now use displayed Number/Rating values

- Changed the shared numeric reference resolver so references to Number and Rating Fields evaluate the referenced Field's own Formula before returning its value. Dependent formulas therefore consume the number displayed by the referenced Field rather than its stored input.
- Kept source inputs unchanged; the calculation is performed on the evaluation sample and does not overwrite data used by the editor.
- Applied this behavior to direct Number/Rating formulas, chained formula references, Metric formulas, Table Row Formula and Column Formula references, explicit Table cell paths, Dice Field numeric placeholders, and Rest/Recovery numeric lookups.
- Added shared recursion tracking for formula-backed references. Circular dependencies or unavailable formula results now fail closed; they do not fall back to an unrelated raw input.
- Updated the Portuguese and English Field, Number/Rating, and Table Formula documentation to explain displayed-value semantics and the distinction between a Field Formula and a Table-level Row Formula.
- Added regression tests for direct and chained formulas, Rating fractions, circular formulas, Table Row/Column formulas, Table cell references, Rest lookups, and documentation.

## Validation after displayed-value reference correction

- Focused formula, Table, Dice, Rest, and documentation tests: **64/64 passed**.
- Full test suite: **792/803 passed**. The 11 remaining failures are caused by files omitted from the supplied source archive: root `main.ts` and `docs/user-guide/en/01 - Overview.md`.
- `tsc --noEmit` remains blocked because the archive has no `node_modules` and the `obsidian` type definition is unavailable (`TS2688`). The omitted root `main.ts` also prevents building an installable plugin from this archive alone.
- No in-app Obsidian/Atlas runtime verification was possible in this environment.

## Table row-label heading cleanup

- Removed the visible `Row` / `Linha` heading from the row-label column. The column remains structurally present so row labels continue to align with the Table data columns.
- Kept an accessible column name (`Row` / `Linha`) for assistive technology without displaying it visually.
- Removed the redundant `Row` / `Linha` prefix from unlabeled row placeholders and displayed fallback labels. Unnamed rows now show only their position (`1`, `2`, `3`, ...); user-defined row labels and Counter-provided row names remain unchanged.
- Added regression coverage for the blank visual heading, accessible name, and numeric-only fallback labels.

## Validation after Table row-label heading cleanup

- Focused Table renderer, Table row model, and Table editor tests: **30/30 passed**.
- Full test suite: **796/807 passed**. The 11 remaining failures are source-archive limitations caused by the omitted root `main.ts` and `docs/user-guide/en/01 - Overview.md`; the Table-focused tests all passed.
- No build/typecheck or in-app Obsidian/Atlas runtime verification was performed for this presentation-only change.


## Documentation update — Table row labels

- Updated the Portuguese and English downloadable documentation to describe the current Table row-label behavior: **Show Labels in rows** adds a separate left-hand row-label column; that column has no visible `Row` / `Linha` heading; rows without a custom label or Counter-provided name show only their position number (`1`, `2`, `3`, ...), without a `Row` / `Linha` prefix.
- Corrected the English Field and Container guides, which previously described this option as switching each Field to one row. The option controls the row-label column; Table Fields remain columns.
- Updated the README's Table description to match the actual behavior.
- Added a documentation regression test for both language bundles and the hidden heading / numeric fallback behavior.
- Documentation package test: **14/14 passed**.

## Table row controls in Template construction mode

- Made the Add row control and per-row Delete controls always visible in the Template Builder preview, independent of the Table's `allowRowAdd` setting.
- Kept `Allow adding rows in statblocks` scoped to saved/rendered statblocks: the controls remain opt-in there and do not become enabled merely by changing the Template sample.
- Kept the original/base first row protected from deletion because its cell values are the underlying child Fields; manually added rows display their Delete control continuously.
- Removed the `allowRowAdd` gate from the Template Builder's sample-edit model and added validation so attempts to delete nonexistent rows remain no-ops.
- Updated Portuguese and English Table documentation and the README to distinguish Template construction from row editing in rendered statblocks.
- Focused Table editor, renderer, and documentation tests: **38/38 passed**.
- Full test suite: **798/809 passed**. The 11 failures are caused by files missing from the provided source archive (`main.ts` and `docs/user-guide/en/01 - Overview.md`); none are in the focused Table or documentation tests.
- Build/typecheck and in-app Obsidian/Atlas verification were not run: this source archive does not include `node_modules` or the root `main.ts` entry point.


## Previous release packaging — 0.5.3

- Updated `package.json`, `manifest.json`, and both root package versions in `package-lock.json` to `0.5.3`.
- Updated the release audit and version regression tests to require the `0.5.3` identity.
- Updated the Portuguese and English downloadable documentation indexes and their frontmatter to identify edition `0.5.3`.
- Added a 0.5.3 release summary to the README. The 0.5.2 Atlas integration notes remain explicitly identified as the previous release.
- The version bump does not change the plugin ID, minimum Obsidian version, dependency versions, or runtime behavior.
- This remains a source archive, not an installable plugin build. The supplied source snapshot omits root `main.ts` and `docs/user-guide/en/01 - Overview.md`; `node_modules` is also not included. A complete plugin build and the full release audit therefore cannot be performed from this archive alone.

## Latest UI adjustment — scrollable List and Pairs collection editors

- Kept the existing `Custom` and `Compendium` actions available for editable List and Pairs Fields.
- Bounded the List chip editor to `min(16rem, 45vh)` and enabled vertical scrolling with contained overscroll, so long lists do not expand the entire statblock editor.
- Bounded the Pairs row editor to the same viewport height. Only the rows region scrolls; the helper text, Add pair button, and validation message remain accessible outside the scroll area.
- After adding a List item, the chip viewport scrolls to the latest item and input.
- Confirmed the Compendium picker already uses a viewport-aware popover with a separately scrollable item list; its existing behavior is preserved.
- Added regression coverage for the List, Pairs, and Compendium scroll regions.

## Validation after List and Pairs collection-editor scrolling

- Added a bounded vertical scroll viewport to the editable List chip collection (`min(16rem, 45vh)`). The newest item remains visible after a successful add.
- Added a bounded vertical scroll viewport to Pairs rows (`min(16rem, 45vh)`) while keeping the helper text, Add pair action, and validation feedback outside the scroll area.
- Preserved the Custom and Compendium actions. The Compendium picker already uses a viewport-aware popover and an independently scrollable result list; that behavior remains unchanged.
- Focused List, Pairs, Compendium picker, and inline-editor style tests: **17/17 passed**.
- Full automated suite: **802/813 passed**. The 11 remaining failures are the source-archive omissions already present in the supplied 0.5.3 snapshot (root `main.ts` and `docs/user-guide/en/01 - Overview.md`).
- No in-app Obsidian/Atlas runtime verification was possible in this environment. This archive still does not include the root `main.ts` entry point and cannot be built into an installable plugin by itself.

## Follow-up: Pairs editor scroll behavior

- Moved the `Add pair` button into the scrollable rows viewport so it scrolls with the list instead of remaining visible outside the viewport.
- Kept helper text and validation feedback outside the scrolling region.
- Updated `collectionEditorScrolling.test.mjs` to assert the button is part of the scrollable content.
- Focused scrolling tests: 4/4 passed.
- Full suite: 802/813 passed; 11 existing checks require `main.ts` or external documentation files absent from this source package.


## Follow-up: List and Pairs editor flow, themed remove controls

- The List editor now uses the same item structure and flow as its selected display mode: Comma remains inline, Chips retains wrapped chips, Bullets retains bullet markers, and Numbered retains ordered markers.
- The List add input and all per-item Remove buttons are inside the bounded scroll viewport. The viewport still scrolls to the newest item after a successful add.
- Pairs now edits each entry as an inline chip in the same wrapping sequence as the read-only Pairs presentation, instead of changing to a full-width two-column form while editing.
- The Pairs Add pair action and per-entry Remove buttons remain inside the scroll viewport. Helper text and validation feedback remain outside it.
- List and Pairs Remove buttons now use theme-aware muted text and hover background colors rather than a hard-coded error-red treatment.
- Added regression coverage for the preserved List display modes, scroll-contained controls, Pairs inline flow, theme-aware buttons, and List auto-scroll after adding an item.
- Focused collection editor scrolling tests: **4/4 passed**. TypeScript source syntax check passed.
- Full automated suite: **802/813 passed**. The 11 remaining failures are the same source-package omissions recorded above (root `main.ts` and `docs/user-guide/en/01 - Overview.md`); no failures came from the focused collection-editor tests.
- No complete plugin build or in-app Obsidian/Atlas visual verification was possible because this source package omits the root `main.ts` and installed build dependencies.

## Latest UI refinement — List / Pairs editor surfaces and Table row-delete theming

- Added a bordered, theme-aware surface behind the complete inline List editor so its contents, input, and collection actions no longer visually blend with fields underneath.
- Added the same theme-aware surface to the Pairs editor, including its scrollable rows, Add pair action, helper text, and validation feedback.
- Kept the List and Pairs editor surfaces opaque across the built-in themes. The Modern Blue theme now supplies a dedicated solid editor-surface color while retaining its translucent card appearance elsewhere.
- Gave per-row Table delete buttons a dedicated class and themed border, background, text, and hover colors using Forge theme variables. The Add row button keeps its existing styling.
- Added regression assertions for the List / Pairs surfaces and Table row-delete styling.
- Focused List / Pairs and Table renderer tests: **22/22 passed**.
- Full automated suite: **804/815 passed**. The same 11 failures remain due to source-package omissions recorded above (`main.ts` and `docs/user-guide/en/01 - Overview.md`); no focused regression test failed.
- TypeScript source syntax check passed. No installable plugin build or in-app Obsidian / Atlas visual verification was possible from this incomplete source archive.

## Groups Custom editor activation fix

- Fixed the Groups (`groups` / runtime `spells`) inline editor so its generated editing layer is mounted into the Field slot when the editor opens.
- The Custom button already dispatched the correct `forge:edit-field` event and the card-level handler resolved the owning inline-edit region. The Groups editor callback, however, created its controls and returned an edit session without calling `slot.open(layer, display)`. As a result, the event path succeeded but no visible editor was inserted.
- Added the missing slot mount call, matching the established List, Pairs, and other inline editor lifecycle. The existing close callback continues to restore the display with `slot.close(layer, display)`.
- Added a regression test asserting that Groups mounts and closes its editor layer through the slot lifecycle.

## Validation after Groups Custom activation fix

- Focused Groups, Compendium, and Collection scrolling tests: **23/23 passed**.
- Full automated suite: **805/816 passed**. The same 11 failures are caused by missing files in the source snapshot: root `main.ts` and `docs/user-guide/en/01 - Overview.md`.
- No in-app Obsidian/Atlas runtime verification was possible in this environment. The archive is still a source package, not an installable plugin build.


## Release packaging — 0.5.4

- Updated `package.json`, `manifest.json`, and the root package versions in `package-lock.json` to `0.5.4`; dependency versions were left unchanged.
- Updated the release audit, version regression tests, and bundled Portuguese/English documentation indexes to identify `0.5.4`.
- Added a README release summary for the Groups Custom editor activation fix and the light/dark theme compatibility improvements for buttons.
- Carried forward the 0.5.3 source changes, including List/Pairs editor layout and surfaces, Table row-delete theming, Groups editor mounting, and the Forge button theme rules.
- The source package still omits root `main.ts` and `docs/user-guide/en/01 - Overview.md`; it is not independently buildable as an installable plugin.


## Validation for 0.5.4

- Focused Groups editor, button theme compatibility, and package/documentation version tests: **11/11 passed**.
- Full automated suite (`node --experimental-strip-types --test tests/*.test.mjs`): **808/819 passed**. The 11 remaining failures are caused by files omitted from this supplied source archive: root `main.ts` (10 failures) and `docs/user-guide/en/01 - Overview.md` (1 failure). No failure was caused by the 0.5.4 version metadata or the focused tests.
- Parsed `package.json`, `manifest.json`, and `package-lock.json` successfully; confirmed all four root version entries are `0.5.4`.
- The source archive does not contain the root plugin entry point `main.ts`, and build dependencies are not installed in this environment. No installable plugin build or in-app Obsidian/Atlas verification is claimed.
