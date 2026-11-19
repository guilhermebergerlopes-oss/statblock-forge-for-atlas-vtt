# Statblock Forge 0.4.0 — Ctrl-hover preview scrolling

## Root cause

The Forked Atlas floating statblock preview already captures `Ctrl+wheel` and forwards the delta to the nearest scrollable ancestor. The Forge provider preview did not satisfy the layout contract required by that mechanism: Forge's `.statblock-forge__preview-card.atlas-statblock` style forced `display: block`, overriding the flex-column card layout expected by the Atlas preview surface. The Forge preview body consequently expanded to its full content height instead of shrinking into an overflow viewport. Atlas intercepted the wheel event, but there was no actual vertical scroll range to move.

## Change

- The Forge sheet provider now marks only Atlas `preview` variant containers with `statblock-forge__atlas-preview-mount`.
- The marked Atlas-owned render container becomes a constrained flex column (`min-height: 0`, `max-height: 100%`, clipped overflow).
- The Forge statblock card is restored to a flex column within that container.
- The statblock body becomes the real scrollport with vertical and horizontal overflow, thin scrollbars, and contained overscroll.
- Full and feed variants are not modified. Atlas-reserved classes and data attributes are left untouched.
- Added a regression test asserting the variant-specific mount marker and the complete flex/scroll CSS chain.

## Validation

- `npm test`: 326 passed, 0 failed.
- TypeScript syntax/transpilation check for `src/atlas/atlasSheetProvider.ts`: passed.
- Patch whitespace check (`git diff --check`): passed.
- `package.json` and `manifest.json` remain at version `0.4.0`.
- Full build and in-Obsidian visual test were not run: this environment does not have the `sass`, `esbuild`, or `obsidian` packages installed.

The ZIP contains source files. It is not an installable compiled plugin package.
