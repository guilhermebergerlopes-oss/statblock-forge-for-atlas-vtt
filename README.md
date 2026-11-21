# Statblock Forge

Statblock Forge is a community extension. It is not made, endorsed or supported by Atlas VTT or Atlas Online.

**Statblock Forge** is an independent tool for building reusable tabletop RPG statblocks. Create a Template, define the data it needs, arrange that data in a visual editor, and then use the Template to create individual character, creature, or NPC sheets. Each sheet keeps its own values while sharing the Template's structure and presentation.

Forge can be used on its own and integrates directly with the original Atlas VTT 0.17.0 and newer versions; a separate compatibility-fork plugin is not required. The exact 0.17.0 and 0.18.0 source snapshots are inspected baselines, but newer Atlas versions are not blocked by an exact-version allowlist: Forge attempts forward compatibility and checks the runtime methods and service capabilities required by each feature. Because this integration uses Atlas internal services rather than a stable public plugin API, a changed or removed API can make an individual feature unavailable until Forge is updated. Forge uses the original Atlas Dice Tool for rolls attached to open maps and its own dice engine for rolls made without an Atlas map. It also maintains per-statblock roll history, combining open Atlas map logs with Forge-owned persistent entries, and can repeat rolls without a separate compatibility fork.

**Creator and maintainer:** Guilherme Berger Lopes  
**Support and issue reporting:** [GitHub Issues](https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues)

## What you can do

### Build statblocks your way

- Create reusable Templates and use them for multiple characters, creatures, NPCs, or other game entities.
- Define Fields for Text, Markdown, Number, Rating, Dice, Choice, List, Tabular Data, Entries/Abilities, Pairs, Images, Spells, Counters, and Checkboxes.
- Keep a Template's definitions separate from the values stored by each statblock.

### Arrange the information visually

- Use a configurable **4–24 column Canvas Grid** (12 columns by default).
- Compose layouts with blocks and nested containers, including Sections, Rows, and Tabs.
- Resize and reorder blocks, adjust their placement, and use Dense Layout for more compact arrangements.
- Build Tables from compatible Fields: each Field becomes a column, or a labeled row when **Show Field labels in rows** is enabled. Pairs Fields remain standalone Collections.
- Configure per-Table **Row Formula** calculations for each data row and **Column Formula** summaries in the footer; formulas can reference any Template Field, plus numeric Table-column aggregates.
- Use the **More options** panel for secondary Canvas controls.

### Customize the appearance

- Choose a built-in theme or create a reusable custom theme with an eight-color palette.
- Adjust the outer frame, token-art frame, borders, shapes, and individual block appearance.
- Import and export reusable themes and frames with `.forgestyle` packages.
- Frame and reposition images directly in the statblock.

### Add rules and interactive data

- Calculate Number and Rating values with formulas that reference other Fields.
- Calculate Table cells per row and show per-column summaries with Table-specific formulas.
- Build dynamic Dice Field formulas from the current statblock's values.
- Use clickable dice expressions in statblock text; rolling uses the Atlas dice service when the integration is available.
- Track Resources and Counter uses, including maximums, spending, and recovery.
- Configure Rest buttons with rules, player choices, and actions that affect compatible Resources and Counters.
- Control player access to supported Fields in compatible Atlas workflows.

### Reuse content with the Compendium

The Template editor includes a **Compendium** for reusable Entries/Abilities, Lists, Pairs, and Spells. Each collection Field has its own library by default; compatible Fields can also share a library. Libraries support optional categories and search. Content inserted into a statblock is copied into that sheet, so editing the copy does not change the Template library.

## How a Template becomes a statblock

1. **Create a Template** from the ribbon menu or Command Palette.
2. **Define Fields** for the information your game needs.
3. **Build the Canvas** by connecting Fields to blocks and arranging the layout.
4. **Customize the appearance** with themes and block-level settings.
5. **Save the Template**, then create a statblock note from it.
6. **Fill in the sheet's Values** in the rendered statblock.

A Template defines the reusable structure and presentation. A statblock note stores the Values for one individual. Multiple notes can use the same Template without sharing their sheet data.

## Dice links

With Atlas VTT 0.17.0 or newer active, click a dice link in an Atlas Ctrl-hover preview to roll through that exact map's native DiceTool. Other Forge surfaces use an unambiguous visible Atlas map when one is available. To prepare a roll with additional modifiers:

- Hold **N** and click a dice link to add or remove its formula from that statblock's next-roll queue.
- Alternatively, right-click a dice link and choose **Add to next roll** or **Remove from next roll**.
- Right-click also provides the roll menu and access to that statblock's roll history. With Atlas 0.18.0 or newer, choose **Save roll to Atlas collection** to create a named roll in the collection. When the formula can be represented as a Dice Lab look, the save dialog offers to make it an individual roll with its own dice and rules: a matching active Dice Set is copied (including names, colours, critical, explosion, advantage, and disadvantage), while other simple additive dice formulas start with their written dice and natural criticals. You can further edit the saved roll in Atlas' native Dice Lab saved-roll editor. Written `adv`/`dis` and formulas with unsupported modifiers stay as formula presets to preserve their meaning. Right-click the source formula again to **Pin** or **Unpin** matching saved rolls in Atlas' native dice row. The row holds up to 10 positions (including its standard dice); use Atlas' own row editor to reorder or remove entries. Forge retains up to 20 history entries per statblock (500 total) in plugin data; it also reads Atlas map history while the originating map is open. Repeating an Atlas roll uses its original visible map when available, or the saved Dice Set through Forge's local engine after the map closes.

Queued modifiers are temporary: they apply to the next successful roll for that statblock and are not written into the Template or statblock note.

## Version 0.5.2

- Adds Forge-native v2 statblocks to the Atlas DM Screen when linked to Atlas Tokens or Characters.
- Reuses the Forge renderer and routes dice rolls through the originating Atlas map context.
- Refreshes DM Screen entries when linked notes or Templates change.
- Adds a visible **Statblock options** menu above each rendered sheet, with direct linking and unlinking for selected Atlas Characters and generic Tokens.
- Keeps Forge Template and statblock files in their native format; no Atlas-format conversion is performed.

## Working with Atlas VTT

Atlas integration is optional for creating Templates and editing Forge statblocks. Forge detects the original Atlas plugin (`atlas-vtt`) through the live plugin registry and resolves each map's runtime services in one central runtime context using the inspected Atlas 0.17.0/0.18.0 baselines and forward-compatible capability checks. Token readers and token-link actions consume that same context rather than performing separate Workspace or ServiceManager discovery. These are intentional internal-runtime dependencies; newer versions are allowed, but each feature checks for the methods it needs and may remain unavailable if Atlas changes its internal APIs.

The projects have separate responsibilities:

- **Forge** manages its Template editor, statblock notes, Fields, formulas, appearance settings, Compendium, and Rest rules.
- **Atlas VTT** manages maps, scenes, Tokens, collection Resources, Token Conditions, and its native dice tools.

Forge does not maintain a second Conditions catalog or apply Token Conditions through Rest. Configure and manage Conditions in Atlas.

Forge v2 statblocks are also listed in Atlas' native **Link Statblock** dialog for Tokens. Forge writes Atlas' standard `statblock: true` discovery marker while keeping its own `statblock-forge` Template backlink; it does not create an `atlas-template` or convert the note/Template to an Atlas format. The marker is maintained by the core Markdown note-panel lifecycle: existing Forge v2 notes are scanned when the workspace layout is ready, and newly changed/created Forge notes are registered automatically. This does not depend on the optional Ctrl-hover preview bridge. The Field key `statblock` is reserved for this Atlas discovery marker and cannot be used by a Template Field. A conflicting existing frontmatter value is preserved and reported rather than overwritten. In the **Link Statblock** dialog, Forge entries receive a **FORGE** marker and selecting one replaces Atlas' native preview with the original Forge renderer (including the selected Token's image when its asset is available). The marker comparison uses the same note frontmatter that Atlas reads for its list entries, rather than Forge's normalized runtime snapshot, so custom/normalized values do not cause otherwise valid rows to miss the badge. The marker is applied as soon as the list rows are present and does not wait for the preview renderer to finish. The dialog's existing Atlas selection and link actions remain unchanged. Forge v2 statblocks linked to Atlas **Character** or generic **Token** instances appear in the Atlas **DM Screen** statblocks page using the original Forge renderer. When Atlas has already created a native feed card for a linked Character, Forge replaces only the statblock content inside that same feed item: the Atlas feed position, width, navigation, menu wrapper, initiative ordering, and scope filters remain in place, while the Atlas-rendered sheet is hidden until the Forge card is disposed. This prevents the Atlas and Forge versions of the same statblock from appearing together. Generic Tokens and Asset-inherited links that Atlas does not include in its Character-only feed appear in a supplementary Forge feed. The Forge renderer keeps the Template's theme, layout, configured sheet width, Fields, Metrics, Tables, and Counters, and shows multiple linked Tokens as compact chips below a shared statblock. When Atlas exposes its scope switch, the Forge feed follows **This fight**, **Player characters**, and **All**; if Atlas has no scope switch, Forge provides a matching control. The fight scope follows initiative order. The player scope uses player-character information exposed by Atlas' token and asset records; campaign-given tokens whose player identity is not exposed to Forge may remain visible. Linked dice expressions use the originating Atlas map and token context. Forge cards refresh when the statblock note or linked Template changes, and the hidden native sheet is restored when the link disappears or the DM Screen closes. This initial integration is display-and-roll oriented: Atlas-native per-token resource buttons and locate-token actions are not reproduced inside Forge-rendered cards. The feature uses Atlas' inspected internal DM Screen runtime and DOM rather than a documented public provider API, so a breaking Atlas UI change may temporarily affect the integration.

Forge's reserved **Token art** field can create an Atlas **TokenAsset** directly from a supported local image on a Forge v2 statblock, copying it into Atlas' shared `atlas-vtt/assets` folder and linking the new asset to the Forge note. This operation requires an initialized Atlas map so Forge can obtain Atlas' `AssetService`; changing the note's Token art later does not update an already registered TokenAsset. Existing Atlas **Character** and generic **Token** instances can be linked or unlinked from either the statblock's **Statblock options** menu above the sheet or the reserved **Token art** field actions: select one or more tokens in an Atlas scene, open the menu, and choose **Link selected Atlas tokens** or **Unlink selected Atlas tokens**. The statblock options menu remains available even when the Template has no Token art field. The Atlas Ctrl-hover preview remains Character-only; linking a generic Token still stores the relationship and makes it available in the Forge DM Screen feed. Asset persistence and cross-map synchronization remain Atlas-owned.

For Forge v2 notes linked to Atlas Characters, Forge keeps the matching Atlas **Resources** in step with the statblock Fields. Each map follows the active campaign's Resource rules when one applies, otherwise its collection's rules; legacy campaign and collection definitions inherit their built-in preset Resources. Changes update linked Characters in open GM maps through Atlas' own token store, allowing Atlas' PartySync to observe them. Current values are preserved and clamped, manually overridden maxima remain untouched, and newly added Resources start according to their `drains` or `fills` direction. An explicitly emptied Field removes that Resource; a missing or non-numeric Field does not erase it. Closed maps are synchronized when opened, and player views are not directly modified. Rest rules update Atlas-owned Resources through the original token stores, with compensating rollback when the linked note cannot be saved.

> **Integration:** Ctrl-hover previews, token links, Resources, Rest, in-map rolls, scene-independent rolls, statblock history, and roll repetition use the original Atlas 0.17.0/0.18.0 runtime baselines. Newer Atlas versions are attempted through capability checks rather than blocked by their version number. The Forge renderer is mounted only for Forge-native v2 token notes; all other previews remain native. No roll, history, or repeat operation calls the compatibility fork API.

## Installation

### Requirements

- Obsidian **1.8.7 or later**.
- Obsidian Desktop; Forge is marked as desktop-only.
- For building from source: Node.js **22 or later** and npm.

### Install a built release manually

1. Create the plugin folder in your vault: `.obsidian/plugins/statblock-forge/`.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. Open **Settings → Community plugins** and enable **Statblock Forge for Atlas VTT**.

A source ZIP is not a ready-to-install plugin package. Build it first using the steps below.

## Build from source

```bash
npm install
npm run build
```

The build creates `main.js` and the compiled `styles.css`. Copy those files, together with `manifest.json`, into the plugin folder described above.

### Development and checks

```bash
npm test
npm run test:compendium
npm run test:layout
npm run typecheck
npm run audit:release
```

To build while watching source files:

```bash
npm run dev
```

## Documentation

The full user guide is available in both English and Brazilian Portuguese under `docs/user-guide/`. It covers installation, Templates, Fields, Canvas layout, appearance, formulas, Dice Fields, Counters, Rest, player permissions, and Atlas integration.

You can also download the documentation from **Settings → Community plugins → Statblock Forge → Download documentation**. Choose the language and destination folder in the settings first. Existing documentation files are preserved rather than overwritten.

## Project files

| File or format | Purpose |
|---|---|
| `.forgetemplate` | Forge-owned Template JSON. Uses Forge Field IDs (`inline`, `selection`, `counter`, `groups`) and includes Forge-specific layout and appearance metadata. |
| `.atlastemplate` | Atlas-native Template format accepted as a read-only import source. Forge creates an editable `.forgetemplate` copy and leaves the original unchanged; Forge no longer exports Atlas Templates. |
| Markdown (`.md`) | Individual statblock note with its own Values and a link to its Template. |
| `.forgestyle` | Portable package of reusable custom themes and frames. |
| `.statblock-forge/layouts/` | Legacy sidecar location. Existing valid sidecars can be read when importing `.atlastemplate` files; Forge does not create or update Atlas sidecars. |

Confirmed `.forgetemplate` replacements create versioned backups under `<templateFolder>/.statblock-forge/backups/`. Use **Recover Forge template backup…** in the Command Palette to inspect and restore a validated backup. Replacing an existing Template requires a second confirmation and creates a safety backup; concurrent edits are preserved. Older raw `.forgetemplate.bak` files are still recognized when their contents are valid.

Back up Templates and statblock notes before bulk edits, conversions, or manual changes to their JSON/frontmatter data.

For the tested compatibility boundaries, legacy migration behavior, sidecar rules, backup restoration, and backlink recovery, see [`TEMPLATE-COMPATIBILITY-MATRIX-0.5.0.md`](TEMPLATE-COMPATIBILITY-MATRIX-0.5.0.md).

## Support

For Forge bugs, questions, or feature requests, open an issue in the [project repository](https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues). Include:

- Forge version;
- application version;
- steps to reproduce the issue;
- relevant error messages or console output.

For issues specifically related to Atlas itself, use the support channels of the original Atlas VTT project.

## License

Statblock Forge is distributed under **GNU AGPL-3.0-only**. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).


### Atlas Link Statblock registration (0.5.2)

Forge v2 note discovery in Atlas is owned by the core `StatblockNotePanels` lifecycle. The optional Atlas preview bridge does not start a second migration scan. Concurrent registration requests for the same note are coalesced; only the first caller reports the note as newly registered, avoiding duplicate startup log messages.


### Atlas DM Screen Forge presentation (0.5.2)

Forge cards in the Atlas DM Screen continue to use the native Forge renderer and each Template's own theme. Their feed now follows Atlas' readable statblock column sizing (340–540 px), caps the card width to the available pane, and avoids compressing Forge layouts into narrow 280 px cards. The Forge section uses a small FORGE marker and linked Token chips while remaining inside Atlas' own scrolling statblock pane.

### Atlas Link Statblock badges and Forge preview (0.5.2)

The Forge runtime observes Atlas' existing `.atlas-statblock-link` dialog without replacing its React list or link callbacks. Forge rows are identified first by the exact note-path key used by Atlas' `StatblockList` React elements (including the escaped key form); matching the visible name/detail line remains a fallback for Atlas builds without readable Fiber metadata. When no Fiber key is available, Atlas' own selected preview-path header safely identifies the active row. The bridge adds a small `FORGE` badge before starting the asynchronous preview render, then mounts `renderForgeStatblockPreview` into the right-hand pane for a selected Forge note. Atlas-native preview elements are hidden only while a Forge entry is selected and restored when the selection changes or the dialog closes. Ambiguous text matches are not guessed. Preview sessions are aborted and disposed on selection changes and dialog teardown. This decorates Atlas internal UI selectors rather than a public extension API, so Atlas UI changes may require an adapter update.

### Atlas DM Screen TokenAsset link discovery (0.5.2)

The Forge DM Screen resolves links from the placed Token's own `statblockPath` first, then falls back to its shared `TokenAsset.statblockPath`, matching Atlas' token-link service. If Atlas' `loadedTokenAssets()` has not loaded its index yet, Forge calls `getTokenAssets()` once to initialize it and refreshes the feed when the index becomes available. This prevents existing Asset-level links from being reported as missing simply because the asset index was not loaded by another Atlas UI surface.
