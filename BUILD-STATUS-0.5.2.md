# Statblock Forge 0.5.2 — source package status

This archive contains the 0.5.2 source snapshot with Atlas Link Statblock badge/preview support and the native Atlas DM Screen presentation. It is **not an installable Obsidian plugin package**.

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
