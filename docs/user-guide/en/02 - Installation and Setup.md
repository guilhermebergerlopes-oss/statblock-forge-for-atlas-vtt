---
title: Statblock Forge — Installation and Setup
aliases:
  - Configure Statblock Forge
tags:
  - statblock-forge
  - documentation/installation
part: 1
---

# Installation and Setup

This note covers requirements, manual installation, plugin preferences, and an initial setup checklist.

## Requirements

- Obsidian **1.8.7 or later** (`minAppVersion` in the manifest).
- Obsidian Desktop: Forge declares `isDesktopOnly: true` in its manifest.
- To build a source package: Node.js **22 or later** and npm.

A source ZIP requires a build. An installable release package must include the compiled files, especially `main.js`, along with `manifest.json` and `styles.css`.

## Manual installation

1. Close Obsidian or disable the plugin before replacing an existing installation.
2. Create `<vault>/.obsidian/plugins/statblock-forge/`.
3. Put `main.js`, `manifest.json`, and `styles.css` directly in that folder (not inside an additional nested directory).
4. Open Obsidian and enable **Statblock Forge for Atlas VTT** under **Settings → Community plugins**.
5. If installing an update manually and the new version does not load, reload Obsidian or disable and re-enable the plugin.

> [!warning] A source ZIP is not necessarily installable
> Packages identified as `source` contain TypeScript and development files. They need `npm install` and `npm run build` before installation. Do not rename a TypeScript file to `main.js`.

## Installation from an Obsidian Community Plugins release

When a release is distributed through Obsidian's Community Plugins directory, use Obsidian's built-in installation workflow. Availability depends on the version actually being published; a source package or test release is not automatically listed in the community directory.

## Open plugin settings

Go to **Settings → Community plugins → Statblock Forge**. The settings page contains the following preferences.

| Setting | Controls | Default/behavior |
|---|---|---|
| **Language** | Interface language and language of downloaded documentation | `English`; also offers `Português (Brasil)`. |
| **Statblock Mode shortcut** | Key combination for switching the Template editor preview mode | `Mod+Shift+S`. Requires at least one modifier. |
| **Template folder** | Default folder for saving Templates and copies | `atlas-vtt/statblock-templates`. |
| **Statblock notes folder** | Default folder for creating statblock notes | `atlas-vtt/statblocks`. |
| **Documentation folder** | Destination for the documentation download action | `Statblock Forge/Documentation` in English or `Statblock Forge/Documentação` in Portuguese when using the language-specific default. |
| **Style library** | Import/export custom themes and frames | Empty until custom styles are imported or created. |

Folders are paths relative to the Vault root. Forge normalizes path separators and trims leading/trailing separators. Do not use `..` to try to write outside the Vault.

## Language

The **Language** setting offers:

- `English`
- `Português (Brasil)`

The choice is saved in plugin settings. Open views are refreshed after the change. **Download documentation** selects the matching English or Brazilian Portuguese note collection.

Changing the interface language does not translate internal Field names, keys, or identifiers already stored in Templates. Those identifiers must remain stable so blocks, formulas, and links continue to resolve.

## Statblock Mode shortcut

The default is `Mod+Shift+S`:

- `Mod` means **Ctrl** on Windows/Linux.
- `Mod` means **Cmd** on macOS.
- Explicit `Ctrl`, `Alt`, or `Shift` modifiers are also supported.

To change it:

1. Click **Statblock Mode shortcut**.
2. Press the desired combination.
3. Use **Reset to default** to restore the default.

The shortcut works while the Forge Template editor is active and focus is outside `input`, `textarea`, `select`, CodeMirror, or editable content. A shortcut without a modifier is rejected so ordinary typing is not intercepted.

**Statblock Mode** switches the editor area between the construction Canvas and the statblock preview. It does not create a statblock note and does not replace the command used to render an existing note.

## Ribbon and Command Palette

The **Statblock Forge** ribbon icon opens a contextual menu. Depending on the active file, it may offer:

- **Create new template** — open a new Template in the editor.
- **Open template** — select an existing Template.
- **Create statblock** — choose a Template and start creating a note.
- **Render current note** — choose a Template to render a compatible Markdown or JSON note.
- **Edit linked template** — open the Template related to the active note when its Forge link is recognized.
- **Create Atlas token** — appears when the active note meets Atlas workflow requirements and integration is available.

The Command Palette includes these main commands:

| Command | When to use it |
|---|---|
| **Create new Forge template** | Start a Template. |
| **Toggle Statblock mode** | Switch Canvas/preview while a Forge Template is open. |
| **Recover unsaved Forge template drafts** | Open the draft recovery workflow. |
| **Open template in Forge…** | Find and open a Template. |
| **Create statblock from Forge template…** | Create a note from a Template. |
| **Delete template…** | Move a Template to the Obsidian trash after confirmation. |
| **Render current note with a Forge template** | Render the active note with a selected Template. |
| **Edit Forge template linked to current statblock note** | Edit the Template linked to the active note. |
| **Create Atlas token from current Forge statblock note** | Create an Atlas Token when the context is compatible. |

Some commands use a `checkCallback` and are available only when the active view or file meets their conditions.

## Style library

The **Style library** section provides:

- **Import .forgestyle:** select a JSON style package with the `.forgestyle` extension.
- **Export style library:** export the custom themes and frames currently stored in plugin settings.

The export button is disabled when there are no custom themes or frames. The package transfers styles; it is not a Template or statblock.

See [[24 - .forgestyle Style Library]] for the format and import/export guidance.

## Download documentation

1. Select the desired language.
2. Set **Documentation folder** if you want a different destination.
3. Click **Download documentation**.
4. Open `00 - Index.md` inside the created folder.

> [!important] Existing notes are preserved
> The download routine creates only missing files. It does not overwrite existing notes. To receive a revised edition, use a new folder or back up and move the old notes before downloading again.

## Recommended initial checklist

- [ ] Confirm the plugin is enabled and loads without errors.
- [ ] Choose the interface language.
- [ ] Set the Template and statblock folders.
- [ ] Choose a Statblock Mode shortcut that does not conflict with other plugins.
- [ ] Download the documentation into a dedicated folder.
- [ ] Create a test Template and sample sheet before migrating important content.
- [ ] Back up existing Templates and notes before conversions or overwrites.

## Quick troubleshooting

| Symptom | First check |
|---|---|
| Forge does not appear in the plugin list | Check `.obsidian/plugins/statblock-forge/` and confirm `main.js` is in the plugin folder root. |
| The plugin fails to load | Check the minimum Obsidian version and developer console; a source ZIP must be built. |
| A Template is not in the expected folder | Check **Template folder**; compatible Templates may also be discoverable outside the default folder through Vault pickers. |
| The shortcut does not work | Confirm the Template editor is active, a modifier is included, and focus is not in a text field. |
| Documentation does not update | The download does not overwrite existing files; use a new folder or move old notes after backup. |

## Next step

Read [[03 - Core Concepts]] before creating Fields and blocks. Then continue to [[04 - Creating and Editing Templates]].
