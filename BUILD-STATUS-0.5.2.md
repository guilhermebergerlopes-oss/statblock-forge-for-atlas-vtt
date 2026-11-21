# Statblock Forge 0.5.2 — source package status

This archive contains the 0.5.2 source snapshot with the Atlas Link Statblock badge/preview and DM Screen TokenAsset-link detection fixes. It is **not an installable Obsidian plugin package**.

## Changes in this source revision

- The Atlas Link Statblock badge resolves list rows by the exact React host-Fiber key used by Atlas (`entry.path`), including React's escaped key form. The visible name/detail comparison remains a fallback for Atlas builds without readable Fiber metadata.
- When Atlas does not expose React Fiber metadata, the currently selected row can still be identified safely from Atlas' own preview-path header; this avoids guessing from duplicate names or row positions.
- Forge DM Screen discovery now reads both a placed Token's own `statblockPath` and its shared `TokenAsset.statblockPath`. The placed-token path takes precedence, matching Atlas' TokenStatblockLinkService behavior.
- The DM Screen now lazily loads Atlas' token asset index with `getTokenAssets()` when `loadedTokenAssets()` is still empty, then schedules a refresh after the index resolves. Previously the read-only accessor could return an empty list before Atlas had loaded the asset index, hiding valid existing links.
- Existing Forge rendering, Atlas filters, linked-token grouping, note paths, and TokenAsset records are unchanged; no conversion or rewriting of TokenAsset data is performed by the feed.

## Validation

- Focused picker, link-dialog bridge, DM Screen model, DM Screen integration, and Token-link regression tests: **33/33 passed**.
- Full automated suite: **772/783 passed**. The 11 remaining failures are blocked by files absent from the supplied source archive: root `main.ts` and `docs/user-guide/en/01 - Overview.md` (including audits that read those files).
- `tsc --noEmit` could not run because the `obsidian` type definitions are not installed.
- `npm run build` could not be run because dependencies are not installed; the source archive also lacks the root `main.ts` entry point.
- No in-app Obsidian/Atlas runtime verification was possible in this environment.

## Build/install limitation

The supplied source snapshot does not contain the root `main.ts` entry point (nor a built `main.js`). `esbuild.config.mjs` expects `main.ts` and writes `main.js`. To produce an installable plugin, merge these source changes into the complete Forge repository (including its root `main.ts`), install dependencies with `npm install`, then run `npm run build`. The resulting plugin folder must contain `main.js`, `manifest.json`, and `styles.css`.

## Latest fix — DM Screen Forge renderer visibility

- Fixed the root cause of the Forge DM Screen reporting no linked Forge statblocks: Atlas exposes its Zustand store as a callable function with `getState`/`subscribe` methods, but the bridge previously accepted only plain objects and returned no map state. The DM Screen model now reads both callable and object-shaped stores safely.
- Native Atlas feed items are matched by the exact statblock note path read from the guarded React Fiber props (`StatblockFeedMenu.path`), with heading/portrait matching retained only as a fallback for Atlas builds where Fiber metadata is unavailable.
- When a matching native Atlas card exists, Forge mounts its renderer in the same feed item and hides the Atlas sheet node without removing the Atlas-owned wrapper. Atlas still owns feed layout, filters, initiative and navigation; the native node is restored when Forge disposes the card. Generic Token/Asset-only links that have no native Atlas card remain in the supplementary Forge section.
- Added regression coverage for callable Zustand stores and exact-path matching. Focused DM Screen model/integration/regression tests: **21/21 passed**.
- Full test suite: **777/788 passed**. The 11 failures are pre-existing source-archive omissions: root `main.ts` (required by ten tests/audits) and `docs/user-guide/en/01 - Overview.md` (required by one documentation test).
- Full TypeScript build/typecheck and in-app Obsidian/Atlas verification remain unavailable because the provided archive omits root `main.ts` and dependencies (`node_modules`).
