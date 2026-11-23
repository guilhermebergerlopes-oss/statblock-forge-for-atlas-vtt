## 0.5.6 — Configurable line spacing

- Adds line-spacing controls to **Block appearance → Text** and **Template → Appearance → Field typography**. All text, labels, and values can use independent unitless line-height multipliers from 0.8× to 3×; disabled overrides continue to inherit the selected theme or enclosing block. Values persist in the Forge sidecar and are included when copying block appearance. Adds regression coverage for normalization, rendering, Field overrides, and save/reload.

## 0.5.6 — Keep text customization open after confirmations and full rerenders

- Fixes the missed full-render path: before rebuilding the Template Editor, `render()` now captures the live open/closed state of every keyed disclosure. The prior fix only captured during selection-only sidebar refreshes, so confirmation actions that called the full renderer could still collapse the Text customization panels.
- Tracks each keyed disclosure's `toggle` event immediately, so its last explicit open/closed state remains current even when no rerender occurs before the next confirmation or action. Restores that state when the sidebar is rebuilt.
- Preserves the Field typography panel and its **All text**, **Labels**, and **Values** subsections, as well as per-block Text typography subsections. The state remains transient editor UI state and is never written to the Template.
- Adds regression tests for immediate toggle tracking, close/reopen state, full-render capture ordering, and sidebar restoration after a rebuild.

## 0.5.6 — Copy and paste block appearance

- Adds **Copy appearance** and **Paste appearance** actions to the Block appearance inspector. The in-session clipboard copies the block's Theme/Custom mode and all normalized visual overrides, including surface, border, text, typography, indicator, padding, and image-frame settings. It does not copy block content, Field links, formulas, dimensions, placement, visibility, or other structural metadata. The action is available across blocks and Templates during the active plugin session.
- Uses explicit inspector actions instead of overriding `Ctrl+C`/`Ctrl+V`, preserving normal text selection, input editing, and Obsidian shortcuts. Adds regression tests for complete appearance transfer, detached clipboard snapshots, Theme mode, empty clipboard, and preservation of target structure.

## 0.5.6 — Statblock opening crash guard for Table references

- Removes the runtime import cycle between `previewValueModel` and `tableFormulaModel` by moving the shared Row Formula resolver into a dependency-free module. The preview evaluator now imports the resolver directly and keeps the `TableCellReferenceIndex` import type-only.
- Limits a Table-cell lookup to the child Fields in that Table. External Number/Rating Fields are resolved lazily only when a Table Row Formula actually references them, avoiding unnecessary recalculation of unrelated statblock formulas and cross-Table dependencies while opening/rendering a statblock.
- Keeps displayed-value precedence intact: child Field formulas feed Row Formulas, Table Row Formulas override the displayed cells, and inputs remain unchanged. Adds a regression test for module dependency direction and external/child formula resolution.

## 0.5.6 — Block padding on all sides and maintained release identity

- Fixes formula references to Table cells (`{tableKey.rowN.columnKey}`) so they return the displayed cell value. Table-level Row Formula has the same precedence as the renderer; otherwise, a Number/Rating Field Formula is used, then the stored input. Row-specific values and `rowNumber` are preserved, dependent Table Row Formulas are resolved, cyclic dependencies fail closed, and source inputs remain unchanged. Keeps version **0.5.6**.
- Keeps the plugin version at **0.5.6**, as requested. The package, lockfile, manifest, bundled documentation, and release audit use the same version.
- Fixes custom block padding so the configured value applies equally to the top, right, bottom, and left sides. The legacy right-inset reset remains limited to theme-following value blocks and no longer overrides custom appearance.

- Assigns a unique Atlas template ID to every generated `.atlastemplate` Role mirror instead of copying the source `.forgetemplate` ID. The mirror's Atlas ID is stored in its native JSON `id`, while the Forge source ID/path remain separate in the internal Role-note resolver. Existing managed mirrors that still reuse the Forge ID are migrated in place; subsequent syncs preserve the newly assigned Atlas ID. ID generation checks the current Atlas-native template library for collisions. Adds coverage for independent IDs, migration, reuse, Role-note resolution, and collision handling.

### Atlas collection Roles and mirror identity

- Fixes Forge template discovery in Atlas collection Roles. The existing native `.atlastemplate` mirror helper was not connected to plugin startup or the Template Editor save lifecycle, so Forge templates never entered Atlas' TemplateLibrary. Forge now mirrors all existing `.forgetemplate` files after workspace layout is ready and updates/creates the mirror on each subsequent create, modify, or rename event and immediately after a successful editor save. Atlas' own TemplateLibrary observes the native Vault file events and exposes the mirror in the Role template selector. Notes created by Atlas from those Roles are resolved back to the source `.forgetemplate` through the registered `atlas-template` ID, without rewriting Atlas-owned YAML or replacing Atlas' native card. Mirrors retain native Atlas Field IDs, carry a Forge ownership marker, and are excluded from Forge template duplicate-ID checks so saving the source does not conflict with its mirror. Adds startup/save/event/serialization/duplicate-ID/Role-note resolution regression tests.

- Adds per-Field typography in **Template → Appearance → Field typography**. Choose a Field and configure general text, labels, and values independently with font size, weight, normal/italic style, text decoration, and letter spacing. The override follows the stable Field ID across key renames and applies anywhere that Field is rendered, including inline text, numeric values, Lists, Tags, Pairs, Checkboxes, Spells, Metrics, Tables, Tracks, and header Fields. Field typography overrides block-level typography for that Field while retaining the block/theme colors. Reset removes only the selected Field's typography. Adds sidecar persistence, orphan cleanup, and renderer-coverage regression tests. Focused typography suite: 13/13 passing.

- Adds per-block typography controls to **Properties → Block appearance → Text**. General text, labels, and values can each use independent font size (8–48 px), weight (normal through bold), normal/italic style, text decoration (none, underline, strikethrough), and letter spacing (-1–8 px). Unset options continue to inherit the selected theme, and the controls are saved with the Forge layout sidecar without changing Atlas Template JSON. Adds normalization and renderer/CSS regression coverage.

- Aligns the final Atlas Resource data boundary with the current Atlas 0.19.0 source: legacy scene detection now reads additional token Resources from `statblockResources`, validates values against Atlas' token-file conversion shape, resolves nested Field paths with Atlas' exact-first normalized-key lookup, and replaces non-finite stored current values with the Resource's calculated starting current when updating maxima. Adds regression coverage for closed scenes, malformed legacy values, normalized paths, and invalid token currents. Focused Resource/REST/write-access suite: 85/85 passing; full repository suite: 906/921, with 15 failures in unrelated legacy integration audits, statblock-format, CSS-shape, and Pairs checks. Dependency installation could not finish because `registry.npmjs.org` returned `EAI_AGAIN`, so typecheck and bundle compilation remain unverified.

- Keeps Atlas as the single owner of Resource presentation and viewer permissions. Forge preserves each Resource's `visibleToPlayers` metadata but does not duplicate Atlas' `visibleResources()` filtering, token bars, owner resolution, or scene-level `hiddenResources` behavior. This preserves Atlas' distinct DM, player, and token-owner views without introducing a second or conflicting visibility policy in Forge.
- Adds a write-access boundary for Forge's automatic Resource synchronization and Rest/PartySync persistence. The service re-checks the live Atlas store immediately before writing and refuses token updates when the map is no longer loaded, is loading, has switched to the player view, or has changed from the map that supplied the Resource rules. PartySync writes use the same player-view/loading/map-identity guard while remaining available for GM stores whose scene is still loading.
- Adds regression coverage for asynchronous GM-to-player view changes, scene replacement during Resource-rule resolution, stale Rest contexts, PartySync view changes, and scene identity checks. Existing Atlas visibility flags and UI remain Atlas-owned; Resource values are still changed only through Atlas `updateTokens()` / PartySync store paths.

- Completes the Forge-to-Atlas Resource maximum synchronization for formula-backed Number/Rating Fields. Before writing token Resources through Atlas `updateTokens()`, Forge now resolves the displayed formula value using the full Template Field list, including formula dependencies on other Fields. An invalid formula never falls back to stale raw frontmatter data. Existing token current values remain independent from the statblock maximum, are clamped to changed maxima, follow `drains`/`fills`/`static` initialization rules, and respect Atlas `overriddenMax`. `defeatedWhenSpent`, visibility and socket metadata remain Atlas-owned; defeat is still derived by Atlas rather than duplicated in Forge.
- Fixes Field drag-and-drop into **Metric** and **Table** Containers. Field drops now target the entire visible data-Container surface instead of only its central insertion zone, and drop-target lookup resolves the Forge block wrapper rather than nested Atlas elements that may also carry `data-block-id`. Empty Metrics and Tables now show an editor-only drop hint. The Canvas tree and Add Container pickers display **Metric** and **Table** without the redundant `container` suffix; Forge remains at 0.5.0.
- Removes the exact Atlas-version allowlist for runtime integration. Atlas 0.17.0 and later versions can be used: exact 0.17.0/0.18.0 snapshots retain their inspected profiles, while later versions use the closest forward-compatible baseline (0.17.0 or 0.18.0) and must expose the methods/services required by each feature. Atlas 0.18.0+ saved rolls are enabled by minimum-version comparison and AssetService capability checks. Versions below 0.17.0 remain Vault/file-only. Forge stays at 0.5.0.
- Adds optional **Dice Lab looks** when saving statblock/Dice Field rolls to Atlas 0.18.0 or newer. For simple additive formulas, Forge stores the dice as a preset `look` and keeps only the numeric bonus in `formula`; matching active Dice Sets are copied with their names, colours, critical, explosion, advantage, and disadvantage rules. Other simple dice formulas become an independent natural-critical look that can be customized in Atlas' native saved-roll editor. Written `adv`/`dis` and formulas with unsupported modifiers remain formula presets without conversion. Pin/unpin matching now recognizes the converted look formula even if the collection's default Dice Set later changes.
- Adds **Pin to Atlas dice row** / **Unpin from Atlas dice row** to Forge statblock roll-link context menus when the formula matches a saved roll in the owning collection. Uses the collection `diceRow` through `AssetService.updateCollectionSettings()`, preserves custom dice and existing order, starts from Atlas’ seven standard dice when the row is unset, and respects the ten-position limit. Reordering remains in Atlas’ native row editor.
- Adds **Save roll to Atlas collection** to Forge statblock/Dice Field roll-link context menus. The action stores a named formula in the owning Atlas collection through `AssetService.updateCollectionSettings()` (`dicePresets`), follows Atlas saved-roll limits (40 rolls, 40-character names, 100-character formulas) on Atlas 0.18.0 or newer, preserves `adv`/`dis`, and leaves other collection settings untouched.
- Adds typed `adv`/`dis` suffixes to statblock roll links and Dice Fields (for example, `1d20+5 adv`, `1d20+5 dis`, and `Stealth +5 adv`). The suffix is preserved when sending a roll to Atlas and applied by Forge’s off-map roller; an opposing Shift/Alt request cancels the written side. Dice Fields with a written side no longer show a misleading simple `avg` hint.
- Verifies the existing direct Atlas runtime integration against the original Atlas 0.18.0 source and enables its exact adapter alongside the already verified 0.17.0 profile. Later versions use the forward-compatible capability mode described in the first Unreleased entry.
- Keeps Forge Ctrl-hover preview interception enabled for verified runtime profiles rather than hard-coding 0.17.0; updates runtime, TokenAsset, DiceTool, Resource, and user-guide compatibility notes. Forge version remains 0.5.0.

- Removes Atlas Template export and Atlas statblock publishing from Forge. `.atlastemplate` is now import-only: Forge reads the original as a read-only source and saves an editable `.forgetemplate` copy. Existing Atlas sidecars are read during import when valid, but no new Atlas sidecars are written.
- Forge-owned Template JSON now stores the reorganized Field type IDs (`inline`, `selection`, `counter`, `groups`). Older IDs remain readable, and native Atlas IDs are normalized when importing `.atlastemplate` files.

- Allows **Selection** options to be used as boolean formula references. Each configured option evaluates to `1` when selected and `0` otherwise; the Selection Field itself evaluates to `1` when any value is selected. Works in Number/Rating, Metric, and derived Scores formulas without changing Atlas-native Choice values.
- Adds a per-Field **Multiple choices** setting to Checkboxes. New Checkbox Fields default to a single selected option; enabling the setting allows multiple selections within that Field only. Other Checkbox Fields remain independent, and older templates without the setting retain their previous multi-select behavior.
- Reorganizes the Field picker into **Values** (Number, Rating, Dice, Counter), **Text** (In-line, Markdown), **Choice** (Checkboxes, Selection), **Image**, and **Collections** (List, Entries, Pairs, Groups). Forge-owned Template JSON now writes the reorganized Field type IDs (`inline`, `selection`, `counter`, `groups`); older IDs are normalized on load, while native Atlas IDs are normalized when `.atlastemplate` files are imported. Legacy category metadata is normalized on load, and Atlas `scores` storage remains internal to Table Containers.
- Replaced the Counters-per-row preset selector with an unbounded positive-integer input; the renderer now applies the grid columns directly to the rendered Counter grid in both Canvas and live statblocks.
- Renamed the Template Editor's **Structure** tab to **Data** in English and **Dados** in Portuguese, while retaining the internal draft key for compatibility.

## Final transition audit — independent Atlas integration (Stage 7.4, Forge 0.5.0)

- Adds `npm run audit:release` to verify plugin/package/lockfile identity, reject legacy compatibility-fork integration markers in production source, resolve all relative imports, and confirm the original Atlas runtime entry points are wired into plugin startup.
- Confirms that the active integration targets only the original Atlas VTT `atlas-vtt` plugin and the inspected 0.17.0 internal-runtime profile. No compatibility-fork plugin, provider API, handshake, or dice/history API is required.
- Confirms the complete relative-import graph resolves and that preview, token/Resource synchronization, and native map DiceTool integration are part of the current plugin startup.
- Clarifies the historical Stage 5.5 changelog entry: its temporary migration marker was removed in Stage 7.1. Historical transition reports remain as records of intermediate implementation states.
- Keeps the Forge version at 0.5.0. No Atlas source files or Vault data are modified by this audit.

## Runtime consolidation — single Atlas discovery path (Stage 7.3, Forge 0.5.0)

- Removes `atlasRuntimeDetection.ts`, a manifest-file detector that had no production callers; the live plugin registry and per-map discovery in `atlasRuntime.ts` remain the single runtime source of truth.
- Moves renderer, TokenRenderer, and TokenStatblockLinkService resolution into `inspectAtlasMapLeaf()` so the central runtime resolves each per-map service once.
- Refactors `atlasTokenAdapter.ts` into a typed token-focused projection of the central runtime context; it no longer walks Workspace leaves or calls ServiceManager getters independently.
- Removes the redundant `ATLAS_TOKEN_VIEW_TYPE` alias; all internal consumers and tests use `ATLAS_VIEW_TYPE` from `atlasRuntime.ts`.
- Keeps Atlas capability documentation, token state readers, link storage, public command dispatch, and feature-specific action services because they still have active consumers or serve as tested integration contracts.
- Adds regression tests proving that runtime and token adapters share the same live context and that removed discovery/alias paths are not reintroduced.

## Runtime cleanup — retired Atlas diagnostics (Stage 7.2, Forge 0.5.0)

- Removes `atlasStatus.ts`, an unused template-folder status helper with no production or test consumers.
- Removes `atlasTokenIntegrationDiagnostics.ts` and `atlasTokenViewportAccess.ts`; the viewport hit-test path was used only by an unmounted diagnostic report and was not part of token linking, Resource sync, preview, or roll execution.
- Removes the unused `AtlasTokenAdapterDiagnostic` snapshot API from `atlasTokenAdapter.ts`; keeps the runtime context/status checks required by active token, AssetService, and statblock-link operations.
- Keeps `atlasCapabilities.ts` as a tested record of Atlas documented/public capabilities and keeps `atlasTokenAdapter.ts` as the live internal-runtime adapter.
- Updates current Portuguese/English overview documentation and README to state the verified Atlas 0.17.0 internal-runtime dependency accurately. Historical stage reports remain as historical records.
- The former external sheet provider and registration handshake had already been removed in Stage 2; this stage verifies no provider/handshake implementation remains in active source rather than deleting a nonexistent implementation.

## Fork identity cleanup (Stage 7.1, Forge 0.5.0)

- Removes the final legacy fork plugin-ID constant from the then-current manifest detector; runtime integration exposes only the original Atlas plugin ID (`atlas-vtt`). The unused file-based detector itself is retired in Stage 7.3.
- Updates the runtime test to reject an unrelated plugin manifest without importing or exporting any legacy fork identifier.
- Keeps negative dependency-audit assertions in tests so future changes cannot silently reintroduce the former ID or fork roll API into active modules.
- Updates the Stage 1 and Stage 5.1/5.5 integration notes to mark temporary bridge references as historical and document the completed migration.

## Template compatibility — final lifecycle verification (Stage 6.4, Forge 0.5.0)

- Adds end-to-end lifecycle coverage for legacy grid Templates, repeated Atlas imports with Forge sidecars, Forge copy creation, backup restoration after a Template move, and automatic repair of v1/v2 statblock backlinks.
- Verifies that legacy grid migration is deterministic across repeated imports, that already-migrated Atlas data is idempotent when reopened, and that the original legacy source bytes are not rewritten during inspection or copy creation.
- Fixes legacy grid migration to retain the complete original grid-block payload in `fsExtras.atlasLegacyGrid.originalPayload`, including unknown extension properties that were previously not represented by the normalized geometry and field settings. The payload is preserved as data and is never executed.
- Verifies that a legacy file carrying the `.forgetemplate` extension but lacking the namespaced Forge metadata is protected from in-place overwrite.
- Verifies repeated `.atlastemplate` imports read the sidecar associated with the source Atlas Template ID, produce independent Forge copies with fresh IDs, and leave both the native Atlas file and sidecar unchanged.
- Verifies that restoring a moved Template from a validated backup targets the unique stable Template ID, creates a safety backup, restores the exact Forge file, and repairs both Forge-native v2 and Atlas-published v1 backlinks without changing the Atlas Template ID or unrelated note frontmatter.
- Adds `TEMPLATE-COMPATIBILITY-MATRIX-0.5.0.md` documenting the tested file contracts, projections, warnings, backup behavior, and migration boundaries. No Vault files are migrated automatically.

## Template backup recovery (Stage 6.3.2, Forge 0.5.0)

- Adds versioned `.forgetemplate.bak` envelopes containing the exact original path, stable Template ID, source text, byte length, timestamp, and CRC-32 corruption check. CRC-32 detects accidental damage; it is not an authenticity or security signature.
- Keeps legacy raw `.forgetemplate.bak` files readable. The recovery tool resolves their destination by stable Template ID when unambiguous, otherwise restores as a new copy without replacing an unrelated file.
- Adds **Recover Forge template backup…** to the Command Palette with a listing of verified, damaged, legacy, and unavailable backups.
- Requires a second explicit confirmation before replacing an existing destination. A safety backup is created before restoration; compare-and-swap refuses to overwrite edits made after confirmation.
- Protects a destination whose current valid Template ID differs from the backup ID, and prevents duplicate Template IDs when recreating a missing file.
- Changes confirmed template replacement to store a versioned backup envelope and to use compare-and-swap for the replacement write. If a concurrent edit wins, the current file is preserved and the backup remains available.
- Adds tests for checksum corruption, missing-file recovery, overwrite safety backups, stale backup/target snapshots, ID conflicts, legacy backup inference, and interrupted replacement.

## Template import/export consolidation (Stage 6.2, Forge 0.5.0)

- Consolidates native Atlas template creation and reuse through `writeAtlasTemplateExport()`, shared by direct export and Atlas statblock publishing.
- Native `.atlastemplate` exports now write a matching Forge layout sidecar under `<templateFolder>/.statblock-forge/layouts/<templateId>.json`, preserving the source Forge layout for later re-import.
- Normalizes the sidecar `templateId` to the exported Atlas template ID, preventing a sidecar from pointing at the source Forge template ID after export.
- Uses compare-and-swap when updating an existing valid sidecar; malformed, unsupported, mismatched, orphaned, or concurrently changed sidecars are preserved and reported instead of silently overwritten.
- Requires the exact inspected native template text before reusing a prior Atlas export. A concurrent modification aborts reuse without changing the native template or its sidecar.
- Atlas statblock publishing now uses the same repository writer; on later publication failure it removes only a sidecar created by the attempt or conditionally restores an updated sidecar, preserving subsequent concurrent edits.
- Adds repository tests for export/import sidecar round trips, stale-source conflicts, damaged/orphan sidecars, compare-and-swap conflicts, and publisher reuse/rollback routing.

## Template formats — audit and sidecar preservation (Stage 6.1, Forge 0.5.0)

- Documents the Atlas 0.17.0 native template schema and the distinction between `.atlastemplate`, `.forgetemplate`, and Forge layout sidecars.
- Fixes Atlas-to-Forge copy creation to load the external `.statblock-forge/layouts/<templateId>.json` sidecar before creating a `.forgetemplate`, preserving custom Grid, width, theme, and block layout settings.
- Adds explicit sidecar inspection for invalid JSON, unsupported format/version, mismatched Template IDs, and invalid block maps; invalid sidecars fall back to the default layout with a warning and are not rewritten.
- Preserves unknown future per-block Forge layout properties during sidecar read/write cycles, matching the existing preservation of unknown root and appearance properties.
- Adds contract tests for native Atlas fields/blocks, Forge metadata, export projection, overwrite protection, sidecar import, and forward-compatible properties.

## Atlas integration — roll migration regression and final audit (Stage 5.5, Forge 0.5.0)

- Adds end-to-end coverage for rolls from multiple statblocks across multiple Atlas maps, then serializes Forge history through the `data.json` boundary and replays the saved recipes after a simulated plugin reload with both maps closed.
- Verifies that Atlas persisted `diceLog`, transient DiceTool history, and Forge-owned history merge without duplicate IDs or cross-statblock leakage; unrelated native toolbar rolls stay outside Forge statblock histories.
- Removes test dependence on mock fork dice APIs. In-map and off-map roll fixtures now exercise only Atlas 0.17.0's native `DiceTool` and Forge's local roller, with no compatibility-fork plugin installed.
- At the Stage 5.5 checkpoint, the legacy plugin ID constant was still retained as a migration marker; Stage 7.1 subsequently removed it. The current runtime, roll, history, and repeat modules no longer reference the compatibility fork or its API.
- Corrects the README's outdated Rest integration note and documents the completed direct Atlas/Forge integration.

## 0.5.0 — Integração direta com o runtime do Atlas (Etapas 0–5.4)

### Changed
- Estabelece e preserva a linha de base do Forge 0.4.4, do Atlas VTT original 0.17.0 e do fork 0.17.2 para a transição.
- Substitui a identificação principal do fork pela identificação original `atlas-vtt` e passa a procurar o manifesto do Atlas original.
- Adiciona um runtime centralizado para descobrir a instância carregada do Atlas, suas visualizações de mapa, `ServiceManager`, stores e serviços por mapa sem manter referências em cache.
- Centraliza a descoberta das visualizações usadas por tokens, Resources e DiceTool.
- Mapeia diretamente o DiceTool, o EventEmitter e o histórico por mapa do Atlas original 0.17.0; adiciona `src/atlas/atlasDiceRuntime.ts` para descoberta dinâmica de views visíveis, direcionamento por `viewId` e leitura separada do histórico transitório e do `diceLog` persistido.
- Registra que `OffMapRollsContext` e `rollStatblockDice()` são estruturas internas da árvore React/bundle do Atlas, não serviços globais públicos; define a migração de rolagens sem mapa e histórico sem presumir APIs que o Atlas original não expõe.
- Direciona rolagens de prévias Forge abertas pelo Ctrl-hover ao `DiceTool` do mapa Atlas que originou a prévia, sem consultar a API de rolagem do fork quando há um mapa válido.
- Encaminha `tokenId`, nome, imagem e habilidade como metadados da origem do statblock; encaminha o `DiceRollOrigin` transitório apenas quando o Atlas confirma o mesmo `viewId`, `mapPath` e token ainda colocado na cena.
- Reutiliza o conjunto de dados do Template e as regras de vantagem/desvantagem do DiceTool do mapa de origem.
- Quando não há `viewId` explícito, escolhe um único mapa visível ou a folha Atlas ativa; recusa direcionamento ambíguo em vez de registrar a rolagem em um mapa arbitrário.
- Cria um perfil interno verificado exclusivamente para Atlas 0.17.0; versões não verificadas continuam sem ativar hooks internos automaticamente.
- Substitui o provider externo de Ctrl-hover por uma janela própria do Forge integrada diretamente ao `NotePreviewUIManager` original do Atlas 0.17.0.
- Lê vínculos de tokens do Atlas com prioridade para `TokenEntity.statblockPath` e fallback para `TokenAsset.statblockPath`, resolvendo Assets por ID e depois por caminho de imagem.
- Adiciona um catálogo de leitura fiel aos `ResourceDefinition` do Atlas 0.17.0, preservando chave estável, caminho de Field, direção, cor, regra de derrota, visibilidade de jogador e slot.
- Identifica Resources efetivos de coleções explícitas e legadas, aplicando fallbacks de presets, exceções de Cairn/Daggerheart/Draw Steel e a antiga opção de Stress bar.
- Adiciona ações para vincular ou desvincular os tokens Character selecionados no mapa à ficha Forge atual, usando o `TokenStatblockLinkService` singleton do Atlas para atualizar Assets, arquivos de mapas e todos os stores abertos. Tokens genéricos são ignorados porque o Ctrl-hover original do Atlas só emite prévias para Characters.
- Quando o resolver nativo do Atlas não reconhece a nota Forge v2, atualiza explicitamente `statblockPath` nos Characters de mapas abertos após o serviço nativo atualizar Assets e arquivos de mapas.
- Mantém os registros legados `forgeTokenLinks` intactos durante esta subetapa; a revisão, migração ou remoção desses dados será tratada separadamente para evitar perda de vínculos anteriores.
- Sincroniza os máximos dos Resources de Characters vinculados a notas Forge v2 com os valores dos Fields da ficha, usando `updateTokens()` e o histórico não rastreável do Atlas; o PartySync nativo continua observando as mudanças.
- Resolve as definições com a prioridade de regras do Atlas: sistema da campanha em jogo antes das regras da coleção; campanhas e coleções legadas herdam os Resources do preset, enquanto `resources: []` explícito permanece vazio.
- Preserva os valores atuais dentro dos novos máximos, respeita `overriddenMax`, inicializa Resources novos conforme `drains`/`fills`, remove apenas valores explicitamente esvaziados e ignora Fields ausentes ou não numéricos.
- Acompanha alterações de Templates, notas, coleções, arquivos de campanha, presets e abertura de cenas nos mapas GM carregados; aplica novamente os máximos quando as definições de Resource mudam de Field e reinicia apenas tokens que ainda estavam no valor inicial.
- Endurece a transação de Rest para Resources do Atlas: valida todos os stores e snapshots antes da primeira escrita, prepara um recibo completo por token/Resource e reverte commits parciais quando uma gravação posterior falha.
- Coordena o commit dos Resources do Atlas com a gravação da nota Markdown/frontmatter ou JSON por meio de `runRestNotePersistenceWithAtlasRollback()`, registrando o recibo do Atlas antes de a operação Vault terminar.
- Se a gravação da nota falhar após o commit do Atlas, executa a compensação registrada; falhas no próprio commit continuam sendo compensadas pela camada de Resources, sem um segundo rollback externo.
- Mantém a validação de escolhas e gastos e o cálculo dentro da fila serializada e do callback que lê a versão mais recente da nota; os rótulos de gastos passam a usar os dados calculados a partir desse conteúdo atual.
- Uma falha de `refresh()` depois de uma persistência concluída passa a ser um aviso visual, sem comunicar incorretamente que a gravação falhou ou tentar reverter valores já salvos.
- Faz o rollback reconhecer entradas ainda intactas, restaurar somente valores efetivamente gravados e recusar sobrescrever edições que não correspondam aos snapshots anteriores ou posteriores da operação.
- Endurece o rollback de Rest para continuar a compensação em mapas e stores PartySync independentes mesmo quando uma restauração falha; verifica o estado efetivo após chamadas que podem lançar depois de mutar e mantém o recibo reutilizável para nova tentativa.
- Agrupa múltiplos Resources de token em uma única atualização por mapa e múltiplos Resources PartySync em uma única atualização por store; valida todos os snapshots antes da primeira gravação e preserva valores não relacionados, máximos por forma, `overriddenMax` e `maxByHand`.
- Corrige a tipagem do snapshot de Resources para declarar `overriddenMax`, que já era capturado e usado pelo fluxo de sincronização.
- Permite escolher uma imagem local para o Field reservado Token art de fichas Forge v2 e criar diretamente um `TokenAsset` do Atlas sem passar pelo importador de statblocks nativos.
- Copia a arte para `atlas-vtt/assets`, registra o token na coleção padrão do Atlas com vínculo para a nota Forge, preserva a imagem original e solicita a atualização da biblioteca do Atlas.
- Evita duplicar TokenAssets já associados à mesma ficha e mantém a cópia de imagem quando o resultado do registro não pode ser confirmado, evitando deixar um registro salvo sem seu arquivo.

### Fixed
- Intercepts `NotePreviewUIManager.showOrCreatePreview()` only for Forge-native v2 token notes; Atlas-native statblocks, scene links, encounter folders, and ordinary note previews continue through Atlas' original method.
- Reuses the existing Forge `renderStatblock()` renderer inside an Atlas-styled floating window with pin/close controls, drag positioning, map visibility handling, token-update subscription, and cleanup on Atlas map or Forge plugin unload.
- Preserves the effective Template/statblock width and constrains tall previews to a scrollable Forge body; Ctrl+wheel is handled within the preview rather than changing the application zoom.

### Compatibility
- The Forge version remains **0.5.0** throughout the transition, until an explicit request to advance it.
- Ctrl-hover no longer requires the fork or its sheet-provider API on the verified Atlas 0.17.0 runtime.
- Scene-independent rolls and per-statblock roll history now use Forge-owned code and persistence. In-map rolls continue to use the originating Atlas DiceTool; the fork history/repeat bridge is no longer required.
- No Atlas source file is modified. Forge patches only the live `NotePreviewUIManager` methods for the lifetime of the plugin and restores them on unload.
- Creating or linking TokenAssets requires an initialized Atlas map so Forge can reach the internal `AssetService` and `TokenStatblockLinkService` instances; Atlas remains responsible for asset persistence and cross-map synchronization.
- Forge token linking passes `updateStatblockAvatar: false`, preserving the Forge statblock's own serialization and image-field data.


### Atlas integration — scene-independent rolls

- Added a Forge-owned off-map dice roller using the local Atlas-compatible formula engine.
- Resolved the collection Dice Set using the original Atlas 0.17.0 precedence: collection pick, legacy collection dice rules, system preset, then d20. Template Dice Set selections still take precedence.
- Preserved Atlas advantage/disadvantage, keep direction for roll-under sets, d100 tens-only shared units, explosion rules, critical-result rules, dice names/colours, and roll source metadata.
- Added a Forge result dialog for rolls made without an Atlas map. These local rolls are not written to Atlas map history.
- Removed the fork's off-map roll, roll-rules, and statblock-history API requirements. Forge now persists statblock roll recipes and merges open Atlas map histories directly.

### Atlas integration — statblock roll history and repetition (Stage 5.4)

- Adds Forge-owned roll history to plugin `data.json`, retaining up to 20 entries per statblock and 500 entries globally; writes share the serialized plugin-data queue and use a revision guard so a roll recorded during an in-flight save is included in the next queued snapshot.
- Combines the Atlas `diceLog` persisted history and DiceTool's transient `rollHistory` from open maps, filters by `source.statblockPath`, and deduplicates by roll ID without combining the underlying map stores.
- Saves replay recipes for Forge statblock rolls, including original formula, source metadata, Dice Set, advantage/disadvantage, and originating map/view when applicable.
- Repeats a roll through its originating visible Atlas map when available. If a Forge-owned Atlas roll's map is closed or hidden, Forge repeats it locally using the stored Dice Set and modifiers.
- Keeps Atlas map records that were not produced by Forge live and repeatable only while their source map is available; viewing them does not silently copy them into Forge persistence.
- Removes the functional dependency on the fork's `dice.statblock-history` API.

## 0.4.4 — Largura da pré-visualização Ctrl

### Fixed
- Ctrl-hover previews now inherit the effective statblock width: the Template width by default, or the per-statblock override when present.
- Exposes the effective width to the Atlas fork preview window while preserving the existing scrollable-body behavior.
- Updates package, manifest, provider and bundled documentation versions to 0.4.4.


### Atlas provider integration
- Register and refresh the Forge sheet renderer when the Forked Atlas requests it during Ctrl-hover, including when the fork becomes available after Forge has loaded.

## 0.4.3 — Metadados de publicação

### Changed
- Updates the Forge package, manifest, Atlas sheet-provider, and bundled documentation version to 0.4.3.
- Replaces the public package description with a concise, platform-neutral summary of the statblock authoring features.

## 0.4.2 — Conformidade de estilos do editor inline

### Fixed
- Move static sizing, border, wrapping, and interaction styles for inline input/Markdown editors into CSS classes, leaving only measured input dimensions as runtime styles.
- Keeps Ctrl+wheel Canvas zoom dynamic through Obsidian's `setCssStyles` helper.
- Bumps package, manifest, Atlas sheet-provider, and bundled documentation versions to 0.4.2.

## 0.4.1 — API do Obsidian e metadados de publicação

### Obsidian API and source-safety cleanup
- Replaces SVG icon fragment parsing through `innerHTML` with explicit SVG DOM-node construction.
- Routes dynamic inline CSS changes through Obsidian's `setCssProps` and `setCssStyles` helpers.
- Awaits workspace leaf reveals, removes the plugin startup console message, and uses `getActiveViewOfType` instead of the deprecated `activeLeaf` property.
- Uses Obsidian's configured trash behavior when rolling back a newly created Atlas template file; tightens file guards and simplifies redundant `unknown | null` unions.
- Makes intentionally unawaited microtask scheduling explicit and updates browser timers/animation frames to use the correct `window`.

### Publication metadata
- Bumps the plugin version to 0.4.1 and shortens the package/manifest description.
- Points `authorUrl` directly to the creator's GitHub profile.

## 0.4.0 — Busca no JSON, proteção de rascunhos e estabilidade de Sections


### Fixed
- Restaura a cadeia flex da prévia Forge aberta com Ctrl sobre Tokens do Atlas: o contêiner do provider e o cartão respeitam o limite de altura da janela, enquanto o corpo do statblock ganha rolagem vertical/horizontal real. Isso permite ao manipulador Ctrl+roda do Atlas mover fichas longas em vez de interceptar a rolagem sem um scrollport disponível.
- Fixes Ctrl-hover scrolling for large Forge statblocks by constraining the provider mount and card to Atlas' preview height and making the statblock body the actual scroll viewport.

### Added
- Adiciona busca por palavras no editor JSON, agora alinhada ao lado do título **Edit JSON** para reduzir a altura ocupada pela barra de busca.
- Exige confirmação explícita antes de descartar alterações não aplicadas com Reset draft.
- Adds word search and previous/next match navigation to the JSON editor; Reset draft now requires confirmation.

### Fixed
- Corrige a interface da busca no JSON: o campo agora usa o estilo padrão dos inputs do Forge e os controles de anterior/próximo têm largura compacta, sem expandir para ocupar toda a linha.
- Exibe a quantidade real de ocorrências e a posição atual entre elas, em vez de comparar deslocamento de caractere com o tamanho total do JSON; a navegação mantém o foco na caixa de busca.
- A busca revela a primeira ocorrência em tempo real enquanto o usuário digita, sem transferir o foco para o textarea; Enter e os botões anterior/próximo percorrem as ocorrências seguintes. A seleção é aplicada sem ativar o editor e a rolagem vertical e horizontal leva a palavra à área visível.
- Calcula as posições a partir do texto JSON original com correspondência Unicode sem diferenciar maiúsculas, evitando deslocamentos de seleção causados por conversões de caixa que alteram o comprimento de caracteres.
- Fixes JSON search navigation by scrolling the textarea viewport to the selected occurrence while keeping focus in the search field; match offsets are calculated against the original Unicode text.
- Fixes JSON search presentation with Forge-native input styling and compact previous/next controls; reports actual match counts and keeps keyboard focus in the search field after navigation.
- Resolves the latest Canvas selection when **Add block** or **Add container** is activated, so insertion is anchored beside the most recently selected block whenever the selected node cannot accept the new item as a child.
- Mantém **When Empty** como configuração única de estado vazio no Block Inspector; remove do editor de Field o controle duplicado e deixa de usar `Field.prompt` como placeholder de estado vazio no Forge. Dados legados `Field.prompt` continuam preservados no JSON, mas não controlam mais a interface.
- Corrige a avaliação do fallback: `rollFrom` não conta como conteúdo exibido; quando há Pattern, somente os Fields referenciados por ele determinam se está vazio.
- Fórmulas numéricas e slots de Metric consideram referências `@field` e `{field}`, inclusive keys com hífen, ao avaliar o estado vazio.
- Keeps a single **When Empty** setting on the block Inspector; legacy `Field.prompt` data is preserved but no longer acts as an empty-state placeholder in Forge.
- Fixes fallback visibility when the bound Field renders no content: the empty source is removed from layout and the fallback participates in normal layout flow instead of being absolutely positioned over a zero-height source.
- Treats a lone `-`, `–`, `—`, or `−` as an empty-value placeholder for **When Empty**, including nested collection values, without changing the general Atlas empty-value semantics.
- Ao recolher/mostrar uma Section com o mouse, guarda a coordenada e o ponto clicado por botão (sem depender de um snapshot global limpo no `pointerup`). Depois da mudança, redescobre os scrollports vivos a partir do botão e compensa primeiro o contêiner mais próximo, transferindo o delta restante aos ancestrais. A compensação continua até a posição do botão estabilizar; o acionamento por teclado mantém a restauração de foco sem rolagem.
- Mouse toggling of folded Sections now keeps a per-button pointer anchor through the click, re-discovers the live scrollports after the layout changes, and applies the remaining movement from the nearest scrollport outward until the button position is stable. Keyboard activation retains focus restoration with `preventScroll`.
- Disables browser scroll anchoring on the published, stacked-note, and Canvas scrollports used by folded Sections.

- Creator and maintainer: Guilherme Berger Lopes. Support and issue reporting: https://github.com/guilhermebergerlopes-oss/statblock-forge-for-atlas-vtt/issues.

### Added
- Completed the language-aware documentation download workflow, including nested-folder creation and preservation of existing Vault notes.
- Dice Fields can use dynamic Dice Formula expressions with `@fieldKey` and `{fieldKey}` references to Number/Rating Values; roll links recalculate when source Values change.
- Formula references now accept both `@field` and `{field}` syntax across Number/Rating, Metric, Scores, Dice Formula, Rest, and Counter-row `regain`; existing bare-key Number/Rating references remain supported and saved formulas are not rewritten during evaluation.
- Dice Formula dependencies are validated and updated when source Field keys are renamed; dependency discovery and renaming also recognize both explicit reference forms.
- Added Atlas public history API integration and a per-statblock contextual roll-history menu with repetition by Atlas roll ID.

### Improved
- Updated Sass border preset map lookups to the module API, removing deprecated global `map-get` calls.
- Dice Field editor validation now uses the same bounded parser used by actual rolls, enabling rerolls, explosions, keep/drop, success counting, labels, percentile/Fate dice, arithmetic operators, and parentheses.
- Running text recognizes complete parenthesized arithmetic dice expressions, preserving adjacent multipliers/divisors and surrounding prose while avoiding false links.
- Average hints are shown only for formulas with a reliable expected value.
- Forge Rest now operates on compatible Resources and Counters only. Token Conditions are owned by Atlas and no longer have a duplicate Forge catalog, panel, or Rest operations.
- The documentation is expanded to 34 notes per language and describes Atlas-native Conditions and the separation of formula families.

### Compatibility and data preservation
- Legacy `forgeConditionDefinitions`, `__forgeConditions`, `__forgeConditionValues`, and Rest `step`/`clear` records are retained as unrecognized JSON for manual review; Forge does not interpret, execute, or migrate them automatically.
- Older Atlas builds without `dice.statblock-history` retain the previous Forge roll route.
- Scene-independent statblock rolls remain Atlas-owned; Forge does not fabricate a scene or token origin.

### Changed

- Standardized the Canvas More options panel into a consistent responsive layout for grid, sheet, density, background-grid, and selection controls. Removed the Atlas-native column selector from the Forge toolbar; Forge retains the existing Atlas layout metadata without exposing a second Atlas setting.

## 0.3.0 — Rolagens Atlas sem cena aberta
- Mantém o Dice Tool de uma visualização Atlas visível como primeira opção; usa a capacidade pública `dice.statblock-rolls` quando não há view visível, inclusive quando só restam abas ocultas.
- Fórmulas de Fields, menus de vantagem/desvantagem, bônus padrão e rolagens de Rest usam o mesmo conjunto e as regras de coleção/Template do Atlas.
- Atualiza a mensagem de indisponibilidade para orientar a ativação/atualização do Atlas, em vez de exigir que uma cena seja aberta.
- Keeps statblock and Rest rolls available without an open Atlas scene through the versioned Atlas public dice API.

## 0.3.0 — Aparência inicial consistente e novas geometrias de borda
- Faz o modo Custom aplicar desde o primeiro render os mesmos padrões que o Inspector exibe: Rounded, borda Solid de 1 px, alinhamento esquerdo/central e padding zero. Ao ativar Custom, preserva os valores existentes em vez de remover configurações que coincidem com padrões antigos.
- Adiciona formatos de borda Oval, Losango, Hexágono regular e triângulos orientados para cima, direita, baixo e esquerda.
- Disponibiliza as novas geometrias tanto na aparência individual dos blocos quanto na moldura do Token e preserva os identificadores no JSON/layout.
- Remove uma colisão entre o parâmetro e a variável local do cabeçalho que impedia o carregamento do módulo do renderer.
- Aligns first-render Custom appearance with the Inspector defaults and adds oval, diamond, regular hexagon, and four directional triangle border presets for blocks and Token frames.

## 0.3.0 — Number Values com Tracking e erros de salvamento localizados
- Faz blocos **Stat / Number** reconhecerem o tracking do próprio Field, de um bloco **Track** sem Resource vinculado ou do tracking de HP definido no Header, conforme as regras nativas do Atlas.
- Exibe Number tracked como valor atual sobre máximo e usa o valor atual ao expandir Patterns; o Field continua sendo `number` e o bloco continua sendo `stat`.
- Mantém a precedência de `field.tracks` sobre um bloco Track externo e respeita o Field numérico escolhido como máximo.
- Centraliza a tradução de erros retornados ou lançados pelo salvamento do template, incluindo detalhes de validação, conflitos, arquivos/pastas e cópias de recuperação. A interface em português permanece em português.
- Makes Number Stat Values honor Atlas tracking definitions and localizes save errors in the selected interface language.

## 0.3.0 — Estabilidade da tela ao editar Fields e atualização reativa de Patterns
- Evita a reconstrução completa do statblock quando o próprio Forge salva um Field no frontmatter. O evento correspondente de `metadataCache.changed` é reconhecido e consumido antes da resolução assíncrona do vínculo, preservando a rolagem e o DOM atual.
- Mantém a atualização completa para alterações externas na nota; marcadores de gravação próprios expiram após dois segundos e são cancelados quando a gravação falha.
- Faz Patterns de Title, Stat e Line assinarem mudanças do runtime e recalcularem seus placeholders imediatamente. Patterns de Stat também atualizam novamente o link de rolagem quando o texto resultante muda.
- Adds self-write metadata event suppression to prevent full statblock rebuilds and viewport jumps after inline Field edits; Title, Stat and Line Patterns now refresh from live Field values.

## 0.3.0 — Zero em Values Number/Boxes e token no Statblock Mode
- Preserva o máximo e o valor atual explícitos em zero nos Tracks; não força o máximo para um e não cria uma caixa fantasma. Tracks com máximo zero exibem `0` de forma explícita.
- Usa a mesma normalização zero-preservante no primeiro render, nas atualizações reativas e depois de cliques nas caixas; o Gauge também evita divisão por zero.
- Mantém o espaço reservado do token visível no Statblock Mode mesmo quando a amostra não tem arte. A imagem real continua vinculada pelo Atlas, sem criar uma cópia do vínculo no Forge.
- Recognizes zero values in Number/Boxes tracks and keeps the reserved token socket visible in Statblock Mode while Atlas remains responsible for actual token art.

## 0.3.0 — Popover de Rest compacto e com rolagem interna corrigida
- Remove textos explicativos redundantes do seletor de Rest; mínimo e máximo permanecem visíveis junto ao contador de escolhas.
- Dá ao painel uma altura explícita e ao corpo uma área flexível com rolagem própria, permitindo percorrer listas longas sem mover o popover.
- Ignora eventos de rolagem originados dentro do popover ao reposicioná-lo; somente a rolagem externa reposiciona o painel em relação ao botão de origem.
- Simplifies the Rest chooser and fixes its inner scroll area; scrolling the list no longer repositions the anchored popover.

## 0.3.0 — Estabilidade da tela ao abrir Sections recolhidas
- Evita que o botão do rodapé mantenha o foco enquanto a Section é recolocada no layout; o foco é restaurado com `preventScroll` depois do reflow.
- Preserva as posições de rolagem dos contêineres ancestrais durante quatro frames de layout, incluindo a rolagem horizontal.
- Desativa a ancoragem automática do navegador nos scrollports dos statblocks publicados e no modo empilhado, evitando saltos quando o conteúdo expandido altera a altura da ficha.
- Prevents viewport jumps when expanding folded Sections by releasing the moving footer button during reflow, restoring focus without scrolling, preserving ancestor scroll offsets, and disabling browser scroll anchoring on published scrollports.

## 0.3.0 — Limites de escolhas e cartões Rest recolhíveis
- Corrige a edição de **Minimum picks** e **Maximum picks**: aumentar o mínimo eleva o máximo quando necessário; reduzir o máximo reduz o mínimo. Ambos respeitam a capacidade de ações distintas ou o limite de seis quando repetição está habilitada.
- Ao remover ações ou desabilitar repetição, os limites são normalizados para que a etapa continue válida e não desapareça do editor.
- Adiciona um controle individual para recolher/expandir cada cartão Rest no painel. O estado de recolhimento é apenas visual, permanece durante as atualizações do editor e não é gravado no JSON do template.
- Fixes Rest choice minimum/maximum editing and adds per-card collapse controls to the Rest editor without changing template JSON.

## 0.3.0 — Rótulos de Lists e hierarquia visual de Title
- Corrige a exibição do Label nos blocos Tags em todos os estilos (Comma, Chips, Bullets e Numbered), respeitando a opção **Show Label / No Label**.
- Mantém o mesmo rótulo no overlay de **When Empty: Fallback**, evitando que o texto alternativo perca o descritor do bloco.
- Diferencia visualmente **Title H2** e **Title H3** no statblock: H2 usa o tamanho médio da interface e H3 o tamanho pequeno, sem alterar seus níveis semânticos.
- Fixes Field labels for every List presentation and gives Title H2/H3 distinct rendered sizes.

## 0.3.0 — When Empty: Fallback
- Adiciona ao Inspector a opção **Fallback** em `When Empty`, com texto configurável e exibição somente quando todos os Fields lidos pelo bloco estiverem vazios.
- Mantém o bloco original montado na prévia do Canvas; o fallback funciona como sobreposição visual e não substitui os dados nem a superfície editável.
- Não adiciona nem converte opções `Hide` ou `Fold`: **Total Hidden** e o recolhimento de Sections continuam sendo comportamentos independentes do Forge.
- Adds the `When Empty` Fallback option to the block Inspector. It appears only while every source Field is empty; Forge's existing Total Hidden and collapsible Section behaviors remain separate.

## 0.3.0 — Edição JSON sem atualização automática durante a digitação
- Remove a aplicação automática do JSON após uma pausa de digitação; o texto permanece no editor até o usuário aplicar ou concluir a edição.
- A digitação altera apenas o rascunho em memória e continua elegível à recuperação automática, sem reconstruir a prévia nem substituir o conteúdo do textarea.
- Adiciona ação explícita **Apply JSON** e atualiza as instruções em português e inglês.
- Keeps the JSON textarea stable while typing; preview parsing/rendering no longer runs on a debounce and occurs only after an explicit editor action.

# Changelog

## 0.3.0 — Inserção ao lado do último bloco selecionado
- Ao adicionar um bloco, o Forge verifica se o último bloco selecionado aceita aquele tipo como filho. Se aceitar, insere dentro do container; caso contrário, insere imediatamente depois da seleção no nível ancestral mais próximo compatível.
- Aplica a mesma resolução a **Add block** e **Add container**, respeitando as regras: Tabs recebe somente Sections e Row não recebe Row ou Tabs.
- Em seleções múltiplas, usa como referência o último bloco selecionado. A inserção adjacente preserva a ordem dos irmãos e os limites dos containers.
- Inserts new blocks inside a compatible selected container, or immediately after the last selected block at the nearest compatible ancestor level; Add Block and Add Container both follow Tabs and Row child restrictions.

## 0.3.0 — Persistência de rascunhos sem gravações por interação visual
- Evita regravar o `data.json` do plugin quando o usuário apenas seleciona blocos, troca abas do inspector ou abre/fecha disclosures no Template Editor.
- A recuperação automática compara snapshots apenas do conteúdo do template, layout e rascunho JSON; alterações reais continuam sendo persistidas com debounce.
- Cancela gravações pendentes quando o conteúdo retorna ao último snapshot persistido e remove registros de recuperação obsoletos sem criar escritas desnecessárias.
- Prevents plugin `data.json` writes for presentation-only interactions in the Template Editor; recovery drafts are persisted only when template, layout or pending JSON content changes.

## 0.3.0 — Links de rolagem em Dice Fields após edição
- Corrige o redesenho de Fields do tipo Dice após a edição inline: o valor volta a passar pelo renderizador compartilhado de links de rolagem, em vez de ser inserido como texto simples.
- Mantém o tratamento de fórmulas e links delegado ao cartão do statblock, permitindo que os links recriados continuem clicáveis sem reinstalar listeners por elemento.
- Adiciona testes de regressão para fórmulas Dice, expressões em texto misto e o caminho de redesenho do Field.


## 0.3.0 — Sincronização do Compendium e espaçamento dos Counters
- Corrige o retorno de um Field para uma de suas próprias Former Keys, removendo o alias histórico sem diferenciar maiúsculas/minúsculas e evitando templates com key atual duplicada.
- Preserves the full Former Key history across repeated renames and safely restores a Field to one of its own previous keys, regardless of letter case.
- Corrige a atualização imediata da disponibilidade no Compendium: após o salvamento de uma edição ou exclusão, o statblock notifica o seletor aberto e ele consulta novamente a binding persistida, sem depender de fechar e reabrir a ficha.
- Restaura a leitura dos dados atuais da view como fonte de verdade do seletor; a cópia usada para renderização fica apenas como fallback.
- Padroniza o espaço entre marcadores no Template Editor e no statblock: cada marcador usa uma célula de 0,74 rem com o círculo de 0,66 rem centralizado, e ambas as superfícies recebem as mesmas regras de CSS.
- Corrige o escopo das regras visuais dos Counters para que também se apliquem às prévias do Template Editor, que não possuem o wrapper externo da view do statblock.
- Fixes live Compendium availability refresh after inline edits and deletions without closing the statblock; unifies Counter pip cell sizing and CSS scope between Template Editor previews and rendered statblocks.

## 0.3.0 — Atalhos configuráveis e localização do Atlas export
- Corrige a atualização em tempo real da disponibilidade do Compendium: o seletor agora consulta o vínculo de dados atual da view depois que uma edição é persistida, em vez de depender da cópia de dados usada na renderização inicial.
- Released Compendium abilities now become available again while the Statblock view remains open; closing and reopening the view is no longer required.
- Reforça a disponibilidade do Compendium: cada habilidade inserida passa a guardar uma impressão digital compacta do conteúdo original; se a cópia for alterada por qualquer caminho de edição, ela deixa de consumir o item mesmo que um fluxo não remova explicitamente o vínculo.
- Cópias antigas sem impressão digital são verificadas contra o conteúdo atual da biblioteca; excluir a habilidade libera o item, enquanto mover uma cópia intacta entre Fields que compartilham o Compendium mantém o item indisponível.
- Strengthens Compendium availability: inserted abilities store a compact fingerprint of their original content, so any edit releases the item even if an edit path fails to explicitly detach its source marker. Legacy copies are checked against the current library value; deleting releases the item while moving an unchanged copy between linked Fields keeps it unavailable.
- Centraliza os grupos de marcadores de cada Counter abaixo do respectivo nome; o grupo mantém largura natural com poucos marcadores e usa a largura da coluna quando precisa quebrar em várias linhas, centralizando cada linha.
- Centers each Counter's marker group beneath its own name; groups retain their natural width for small marker counts and use the available column width when wrapping, centering every wrapped line.
- Adiciona captura de combinações de teclas nas configurações do Forge para **Statblock Mode**, com restauração do atalho padrão.
- `Mod` representa Ctrl em Windows/Linux e Cmd em macOS; atalhos só atuam com o editor Forge ativo e fora de campos de texto.
- Corrige os textos das configurações do Forge para acompanhar o idioma selecionado, sem manter descrições novas fixas em português.
- Corrige os avisos, resumos e erros da exportação para Atlas para usar o idioma selecionado (English ou Português do Brasil).
- Mantém os rótulos e conteúdos definidos pelo usuário intactos durante a exportação; somente as mensagens geradas pelo Forge são localizadas.
- Adds a configurable key-capture control for Statblock Mode, restores the default shortcut, and localizes Forge settings and Atlas export notices to the selected interface language.

## 0.2.1 — Organização visual dos Counters
- Organiza os nomes dos Counters lado a lado na grade configurada por Block, com os respectivos indicadores logo abaixo de cada nome.
- Aplica a mesma estrutura na prévia de ajuda do editor, mantendo a experiência consistente entre o statblock e a documentação visual.
- Places Counter names side by side in each configured Block grid, with each Counter's indicators directly beneath its own name; applies the same arrangement to the editor help preview.

## 0.2.1 — Compendium compartilhado entre Collections e transferência entre Abilities Tabs
- Permite vincular uma Collection ao Compendium de outra Collection compatível do mesmo tipo (Entries, List, Pairs ou Spells), sem copiar os itens.
- Adiciona **Compendium source** ao painel Compendium do Template Editor, com opção de voltar ao Compendium próprio da Field.
- Adições, edições e exclusões feitas por uma Collection vinculada operam na biblioteca de origem; desvincular restaura a biblioteca independente que já pertencia à Field.
- Armazena referências por IDs estáveis de Fields, preservando vínculos ao renomear Fields e removendo referências inválidas, incompatíveis ou cíclicas ao normalizar o layout.
- Faz o seletor do statblock considerar todas as Fields que compartilham a biblioteca para decidir se uma habilidade já foi usada.
- Corrige o drop entre Abilities Tabs para recalcular o destino a partir da posição real do ponteiro no `pointerup`, inclusive ao soltar diretamente sobre outra aba ou seu painel.
- Mantém o identificador interno da habilidade durante a transferência entre Fields; habilidades movidas entre abas que compartilham o Compendium continuam marcadas como usadas.
- Adds optional same-type Collection Compendium sharing, stable Field-ID references, cross-Field availability tracking, and a pointerup-based cross-tab drop target resolution for Abilities Tabs.

## 0.2.1 — Layout e configuração de Counters
- Corrige a disposição dos Counters para manter o nome ao lado dos marcadores, em vez de empilhá-los verticalmente.
- Adiciona a configuração **Counters per row** nas propriedades do Block, permitindo de 1 a 6 Counters por linha; blocos antigos usam 2 por linha como padrão.
- Remove do inspector do Block a cópia das configurações de linhas e valores numéricos, mantendo essas opções apenas no Field que possui os dados.
- Adds configurable Counter columns per block and keeps Counter definitions exclusively in the linked Field, removing their duplicate from the Block inspector.

## 0.2.1 — Disponibilidade de habilidades do Compendium
- Faz com que habilidades de Entries inseridas pelo Compendium fiquem indisponíveis enquanto a cópia original vinculada existir no statblock.
- Editar ou apagar a cópia libera novamente o item da biblioteca; mover a habilidade dentro do mesmo Field mantém seu vínculo.
- Mantém o rastreamento interno fora do editor JSON e preserva o vínculo de habilidades não alteradas ao reordenar ou salvar o Field completo.
- Reconhece cópias antigas ainda idênticas ao Compendium e marca habilidades customizadas/editadas para que não sejam confundidas com itens da biblioteca.
- Adds per-entry Compendium source tracking for Entries, releasing an item when its statblock copy is edited or deleted while preserving unchanged copies across reordering and full-field JSON edits.

## 0.2.1 — Popover do Compendium e prévias completas de Abilities
- Substitui a lista expansível inline de **Add from...** por um popover flutuante com cabeçalho do Field, busca, filtros por categoria, itens agrupados e ações de inserção.
- Abre o popover sobre o restante da ficha, reposiciona ao redimensionar ou rolar a janela, fecha ao clicar fora ou pressionar Escape e devolve o foco ao botão ao fechar pelo controle de fechamento.
- Mantém o popover disponível mesmo quando a biblioteca está vazia, explicando onde cadastrar conteúdos no Template Editor.
- Exibe todas as Ability Parts configuradas em cada item de Entries, tanto nos cartões da biblioteca do Template Editor quanto nas opções do popover, incluindo valores vazios e contadores com marcas/limite.
- Usa a mesma função de pré-visualização de Ability nos dois contextos para evitar divergências de conteúdo.
- Padroniza **+ Custom ability** e **+ Add from...** com os mesmos tamanhos, bordas, fundo, tipografia e estados de interação.
- Mantém a versão `0.2.1` e não altera arquivos do Atlas.
- Adds full Ability Part preview coverage and a shared renderer for both the template library and statblock picker; adds an anchored, searchable, category-filtered Compendium popover; unifies Custom and Add from button styling.

## 0.2.1 — Busca, filtros e categorias no Compendium
- Adiciona categorias livres por item, armazenadas dentro da biblioteca do Field correspondente; as categorias nunca são compartilhadas entre IDs de Fields.
- Agrupa visualmente os conteúdos por categoria no painel Compendium do Template Editor, mantendo itens antigos sem categoria em **Sem categoria / Uncategorized**.
- Adiciona busca por nome, categoria e conteúdo serializado, incluindo descrições, Parts e dados estruturados.
- Adiciona filtros por categoria tanto no Template Editor quanto no seletor de conteúdos dentro do statblock.
- Sugere categorias já existentes no Field ao cadastrar ou editar um item; novas categorias podem ser criadas digitando um nome.
- Mantém compatibilidade com itens existentes sem o campo `category`; a normalização preserva esses itens sem migração destrutiva.
- Mantém a versão `0.2.1`; nenhum arquivo do Atlas foi modificado.
- Adds per-item freeform categories scoped to each stable Field ID, category grouping, search across names and serialized values, and category filters in both template and statblock pickers.
- Adds automated category isolation, search/filter, category editing, save/reopen, and legacy uncategorized-item coverage; all 10 Compendium tests pass.
## 0.2.1 — Compendium por Field
- Adiciona a aba **Compendium** em uma segunda linha de navegação, separada de Structure, Properties e Appearance.
- Cria bibliotecas independentes por ID interno estável de cada Field da Category Collections; renomear a Key do Field preserva a biblioteca, e excluir o Field remove apenas sua biblioteca.
- Permite cadastrar, editar e excluir entradas de Entries/Abilities, List, Pairs e Spells no template, com editores alinhados às estruturas nativas do Atlas.
- Nos statblocks, permite adicionar cópias dos conteúdos pré-configurados; alterações posteriores são locais e não modificam a biblioteca do template.
- Mantém a criação de **Custom ability** diretamente no statblock; essas habilidades são salvas somente na ficha e nunca são adicionadas ao Compendium.
- Armazena o Compendium nos metadados/sidecar exclusivos do Forge, sem exportar dados de biblioteca para o JSON nativo do Atlas.
- Mantém `manifest.json` e `package.json` na versão `0.2.1`; nenhum arquivo do Atlas foi modificado.
- Disambiguates Compendium selectors with the Field key when multiple Collections Fields share the same visible label and type.
- Extracts statblock insertion into a pure model helper that deep-copies Entries, List, Pairs, and Spells values before adding them to a note.
- Adds an automated Node test suite for two independent Entries Fields, same-label separation, per-Field update/delete, key rename, save/reopen persistence, duplicate-ID normalization, deep-copy isolation, and statblock-only custom abilities.
- Adds the `npm run test:compendium` command; all 8 automated Compendium tests pass.

## 0.2.1

- Distinguishes the primary Canvas Grid from nested block Grids: the main coordinate grid uses continuous, softly accented guides, while Section and Tab grids use lower-contrast dashed guides.
- Keeps both guide layers aligned to the resolved Grid tracks and updates nested row guides when the Canvas resizes or row geometry changes.
- Fixes the extra reserved row for Sections rendered as Tabs panels by using the same `sectionInsideTabs` sizing rule for both row calculation and placement.
- Replaces the `Alt + R` command with an `N + click` gesture: hold `N` and click a roll link to add or remove its formula from the next-roll queue without rolling it.
- Redraws Background grid guides as single shared boundaries centered in the gaps, removing doubled vertical edges and making row guides lighter and more consistent.
- Keeps the plugin version at `0.2.1`; no Atlas files are modified.

- Added a context-menu action to queue any clickable statblock roll for the next successful roll in the same statblock.
- Queued formulas combine with the next roll once; failed or unavailable rolls leave the queue intact.
- Removed the old per-Value and Metric “Add to next roll” switches from Forge properties and stopped exporting the legacy Atlas switch flag.
- Kept the “Roll as a bonus” setting for plain numeric Values and Metrics.

## 0.2.1 — Add Block com menos opções duplicadas
- Consolida **Heading** e **Title** em uma única opção: sem Field cria um título fixo; com um Field Text cria o título formatado nativo.
- Consolida **Divider** e **Vertical divider** em uma única opção com seletor de orientação.
- Agrupa **Tags**, **Entries**, **Pairs** e **Spells** em **Collections**; o Field selecionado determina automaticamente o renderizador correspondente.
- Agrupa **Counters** e **Checkboxes** em **Resources**, também resolvidos automaticamente pelo Type do Field.
- Oculta opções que não possuem Fields compatíveis no template e filtra o seletor para impedir vínculos incompatíveis.
- Mantém todos os renderizadores internos e a estrutura dos templates existentes. A versão permanece em `0.2.1`; nenhum arquivo do Atlas foi modificado.

## 0.2.1 — Colunas configuráveis, barra recolhível e atalho do Statblock Mode
- Adiciona a configuração **Grid columns** por template, ajustável entre 4 e 24 colunas físicas, com 12 como padrão; o valor é persistido no sidecar de layout e aplicado à Grid principal, Sections aninhadas e painéis de Tabs.
- Mantém a escala lógica Span de 1–12 para preservar larguras dos templates anteriores; âncoras salvas são redimensionadas proporcionalmente quando a quantidade física de colunas muda.
- Recolhe por padrão as opções secundárias da barra do Canvas em **More options**; **Statblock Mode**, **Add block** e **Add container** permanecem visíveis.
- Registra o comando **Toggle Statblock mode** com atalho padrão `Mod + Shift + S`; a combinação pode ser alterada em Configurações do Obsidian → Atalhos.
- Atualiza a documentação em português e inglês. Mantém `manifest.json` e `package.json` na versão `0.2.1`; nenhum arquivo do Atlas foi modificado.

## 0.2.1 — Alinhamento exato do Background grid
- Faz as guias do Canvas usarem as dimensões resolvidas pelo próprio CSS Grid (largura de cada coluna, altura da linha e gaps), em vez de recalcular uma grade paralela.
- Alinha o início das guias ao content box real, respeitando padding e bordas do Grid.
- Exibe guias em cada Grid independente de Section, incluindo Sections aninhadas e o conteúdo das abas; Rows continuam usando sua distribuição flexível.
- Atualiza as guias quando o Canvas redimensiona, quando Dense altera os gaps e quando a altura-base das linhas é recalculada.

## 0.2.1 — Correção de mensagens de ID duplicado
- Corrige a tradução para inglês do aviso exibido quando vários templates Atlas compartilham o mesmo ID vinculado.
- Traduz o aviso do editor quando um arquivo `.forgetemplate` compartilha seu ID com outro arquivo e também os avisos de ID de bloco duplicado.
- Garante que cada aviso da publicação para Atlas seja traduzido individualmente antes de compor a mensagem final.
- Mantém a versão do plugin em `0.2.1`, conforme solicitado.

## 0.2.10 — Exemplos dinâmicos para Fields
- Adiciona vários exemplos visuais para cada Category e Type de Field, usando os mesmos componentes e classes de apresentação dos respectivos renderizadores do statblock.
- Faz os exemplos alternarem automaticamente enquanto o cursor permanece sobre uma opção; a alternância também funciona ao navegar com foco pelo teclado.
- Exibe indicadores discretos de quantidade e posição dos exemplos e interrompe a rotação ao sair do item, trocar de opção ou fechar o editor.
- Atualiza descrições e prévias para refletir o funcionamento real: Metric aparece como grade de valores, Spells mostra grupos/níveis/abas, e fórmulas são representadas como rolagens clicáveis.
- Atualiza as amostras de imagens, listas, tabelas, Entries/Abilities, Pairs, Counters e Checkboxes para demonstrar variantes reais sem inserir conteúdo nos Fields do template.
- Respeita a configuração de movimento reduzido do sistema. Nenhum arquivo do Atlas foi modificado.

## 0.2.9 — Coleções mais compactas e rolagens nos Fields
- Reorganiza as Parts exibidas nas Abilities em grupos compactos, com espaçamento menor e destaque visual consistente; o editor de cada habilidade também agrupa seus controles em uma grade responsiva.
- Reformula o Field Pairs com um editor visual de linhas Nome/Valor, permitindo adicionar, remover e editar pares individualmente.
- Mantém valores numéricos como números e fórmulas de dados como strings dentro dos pares, sem permitir texto livre no campo de valor.
- Torna fórmulas explícitas clicáveis em Pairs, incluindo fórmulas de dano e expressões com dados; a opção Roll as a bonus também continua habilitando bônus inteiros com sinal.
- Adiciona links de rolagem aos itens de List e Spells, inclusive depois de editar e redesenhar os respectivos Fields.
- Exibe magias individuais como itens compactos, mantendo o agrupamento por conjuração e os níveis/uso, e separando corretamente vírgulas dentro de parênteses, colchetes ou chaves.
- Mantém Abilities, Spells, Pairs e List no formato de dados que o Atlas já utiliza; nenhum arquivo do Atlas foi modificado.

## 0.2.8 — Editor estruturado de Spells e texto contido em containers
- Reformula a edição de Fields Spells com grupos de conjuração, linhas de nível/uso e nomes de magias, mantendo a estrutura de dados nativa do Atlas.
- Permite adicionar e remover grupos e linhas de nível/uso diretamente no editor da ficha.
- Adiciona a opção de exibir grupos de Spells como lista em linhas ou como abas por nível/uso.
- Fields Spells vazios agora mostram uma orientação acionável, sem inserir exemplos artificiais nos dados de prévia ou no template.
- Mantém blocos Text/Markdown de nível raiz com altura intrínseca, mas limita textos aninhados em Section, Row e Tabs à altura do bloco, com rolagem interna quando o conteúdo excede o espaço disponível.
- Atualiza a documentação do editor estruturado de Spells.

## 0.2.7 — Altura livre para blocos de texto
- Remove o limite máximo de altura dos editores Markdown e dos Fields de texto multilinha.
- Faz o conteúdo dos blocos Text/Markdown deixar de usar uma área interna com altura limitada e rolagem própria; o conteúdo pode se expandir livremente.
- Mantém as áreas de Entries, Scores e Spells com seu comportamento de rolagem por linhas, sem alterar outros tipos de bloco.

## 0.2.6 — Formulário de criação de Fields
- Reorganiza a criação de Fields: o nome fica no topo e as configurações principais aparecem logo abaixo.
- Permite definir Category e Type antes de criar o Field, sem precisar abrir Properties depois.
- Expõe **Empty value text** e **Meaning** na criação, além de propriedades específicas: unidade/fórmula para Number, fórmula para Rating e opções iniciais para Choice.
- Mantém a Category e o Type escolhidos após criar um Field, facilitando a criação de vários Fields do mesmo tipo.

## 0.2.5 — Categories agrupadas
- Reduz de 11 para 7 as opções de Category na criação de Fields.
- Agrupa Abilities, Tags, Pairs e Spells em **Collections**, mantendo os respectivos Types disponíveis em Properties.
- Agrupa Counters e Checkboxes em **Resources**, mantendo os dois Types disponíveis em Properties.
- Mantém Value e Metric separados porque definem blocos iniciais diferentes no Canvas.
- Migra automaticamente as Categories antigas para os novos grupos ao abrir Fields existentes, sem alterar seus Types ou conteúdo.
- Ao arrastar um Field de Collections ou Resources para o Canvas, cria o bloco correspondente ao Type real do Field.

## 0.2.4 — Types compatíveis com Category
- Restaura o nome **Category** na criação de Fields em Structure.
- Filtra o seletor **Type** em Properties para exibir somente os tipos compatíveis com a Category do Field.
- Value e Metric permitem apenas variantes escalares compatíveis (`Text`, `Number`, `Rating`, `Dice` e `Choice`); categorias especializadas mostram apenas seu tipo correspondente, sem um seletor redundante de opção única.
- Adiciona categorias Tags, Pairs e Spells para manter todos os tipos de Field existentes acessíveis sem misturá-los a categorias incompatíveis.
- Reclassifica metadados antigos quando o Type salvo não combina com a Category, preservando o tipo real do Field.

## 0.2.3 — Menos redundância na criação e edição de Fields
- Renomeia a categoria de criação em Structure para **Default block**, deixando claro que ela escolhe a apresentação inicial no Canvas, não o tipo de dado armazenado.
- Atualiza as descrições dos presets para explicitar qual Field e qual bloco padrão são criados.
- Remove o rótulo duplicado do seletor de tipo em Properties; o resumo do controle continua mostrando o tipo atual.
- Remove a repetição da Key no título da seção de propriedades do Field, mantendo a Key editável no formulário.

## 0.2.2 — Exportação de Total Hidden para Atlas
- Mantém os blocos **Total Hidden** no layout ao exportar ou publicar um template para Atlas.
- Converte os Fields do bloco e de seus descendentes para a permissão nativa `hidden` do Atlas, preservando a visualização do mestre e ocultando o conteúdo dos jogadores.
- Mantém o comportamento **Total Hidden** no Forge: o bloco continua fora do statblock final do Forge e editável no `.forgetemplate` original.

## 0.2.1 — Total Hidden e permissões de jogadores
- Mantém blocos com permissão **Hidden from players** no statblock final do Forge; o Atlas continua aplicando a permissão nativa na visualização dos jogadores.
- Adiciona **Total Hidden**, que também remove o bloco do statblock final e das exportações `.atlastemplate`, sem apagar o bloco do template `.forgetemplate` de origem.
- Persiste a categoria nos metadados de layout do Forge.

## 0.2.0 — Alinhamento do grid de background no Canvas
- Faz a sobreposição do background usar a mesma quantidade de colunas e os mesmos espaçamentos do Grid dos blocos.
- Alinha as bordas horizontais e verticais às bordas reais das células, incluindo o espaçamento entre linhas e colunas.

## 0.2.0 — Negative bonus roll links
- Fixes clickable roll links for negative whole-number bonuses in blocks configured with **Roll as a bonus**.
- Keeps explicit dice formulas on the normal text-roll parsing path, without creating duplicate links.

## 0.2.0 — Nova versão principal de desenvolvimento
- Atualiza a versão do plugin e os metadados do pacote para `0.2.0`.
- Consolida as funcionalidades e correções registradas nas entradas anteriores de `0.1.4`.

## 0.1.4 — Redimensionamento em Tabs e seletor de Row
- Corrige o acesso às alças de redimensionamento em blocos dentro de Tabs, removendo o recorte dos painéis apenas no Canvas do template e resolvendo o contêiner de layout responsável pela geometria.
- Adiciona um ícone de seleção diretamente às Rows, seguindo o padrão dos seletores de Section, com suporte a teclado, seleção múltipla e Alt+clique para navegar à Section ancestral.
- Localiza os rótulos acessíveis e tooltips dos seletores de Section e Row em português e inglês.

## 0.1.4 — Avisos totalmente localizados
- Completa as traduções em inglês de avisos, mensagens de validação e erros do fluxo de templates, layout, statblocks, publicação Atlas, vínculo de tokens, Resources e documentação.
- Traduz também detalhes de erros dentro de mensagens compostas, evitando prefixos em inglês seguidos por detalhes em português.
- Faz os avisos de sucesso ao salvar templates passarem pelo sistema de localização, em vez de criar Notices diretamente em português.
- Aplica a tradução aos detalhes de erro em modais de recuperação, exclusão de templates e importação de pacotes de estilo.

## 0.1.4 — Redimensionamento em Rows e Tabs
- Habilita alças de redimensionamento para filhos diretos de Rows, reconhecendo os wrappers de linha usados pelo layout.
- Faz os painéis de Tabs funcionarem como Grids independentes e permite redimensionar as Sections que representam cada aba.
- Mantém a prévia de redimensionamento, o cálculo de colisões e a persistência de largura/altura consistentes com Sections.

## 0.1.4 — Aumento do limite de Player Choices em Rest
- Aumenta de 4 para 8 o máximo de Choice Steps por botão Rest.
- Aplica o novo limite à leitura, edição, merge e validação, incluindo o contador e o botão Add Choice Step.
- Atualiza a documentação em português e inglês para refletir o limite de 8 etapas.

## 0.1.4 — Correção de recuperação e Repeating Actions
- Importa explicitamente o modal de recuperação de rascunhos no ponto de entrada do plugin, evitando `UnsavedTemplateChangesModal is not defined`.
- Corrige a persistência de flags opcionais `repeat` e `forOthers`: desmarcar os controles agora remove os valores antigos preservados no JSON original.

## 0.1.4 — Confirmação ao restaurar aparência
- Solicita confirmação antes de restaurar a aparência global do tema, a aparência personalizada de um bloco ou o enquadramento de uma imagem.
- A confirmação distingue restauração de exclusão, com ações “Restaurar” e “Cancelar”. Fechar a janela, pressionar Escape ou clicar fora cancela a operação.
- A mensagem esclarece que somente configurações visuais serão restauradas; conteúdo e valores permanecem inalterados.

## 0.1.4 — Hierarquia visual de Properties/Rest e confirmação de exclusão
- Reorganiza os tamanhos das ações: criação de Field e Rest usam botões primários maiores; ações de estrutura e Add Choice Step usam tamanho intermediário; inclusão de ações/colunas/opções e controles de reordenação ficam compactos.
- Ajusta tamanhos de fonte e espaçamento nos painéis Properties e Rest para reforçar a hierarquia entre títulos, controles, ações e dicas.
- Solicita confirmação antes de excluir Fields, blocos, abas, colunas, opções, Ability Parts, Counters, valores de Line/Metric, regras, Choice Steps, ações, botões Rest, condições, temas, bordas e imagem de amostra.
- Fechar a confirmação, pressionar Escape ou clicar fora cancela a exclusão; apenas o botão de confirmação executa a ação.

## 0.1.4 — Correção da criação de Choice Steps em Rest
- Faz novos Choice Steps nascerem com uma ação editável inicial, evitando que a etapa seja descartada no primeiro refresh do editor.
- Adiciona um leitor específico para edição que mantém visíveis etapas antigas vazias ou incompletas, permitindo adicionar ações e recuperá-las.
- Faz o merge reconhecer Choice Steps incompletos já armazenados, atualizando o registro existente em vez de duplicá-lo ou preservá-lo como JSON desconhecido.
- Exibe um diagnóstico claro quando uma etapa ainda não tem ações e bloqueia o salvamento até que tenha pelo menos uma ação válida.
- Mantém o leitor de execução estrito: etapas incompletas não aparecem no seletor dos jogadores.

## 0.1.4 — Integridade de chaves e IDs
- Valida `nameKey` e `textKey` de Entries/Abilities para impedir que nome, descrição e Ability Parts compartilhem identificadores.
- Trata keys e aliases de Checkboxes como um único espaço de identificadores; conflitos pausam a normalização para preservar valores, e o editor oferece reparo explícito.
- Detecta `slotKeys` inválidas, ausentes ou duplicadas nas tabelas e permite corrigir cada coluna sem apagar os valores da amostra.
- Bloqueia referências duplicadas de Fields em Metric e Line, inclusive em templates importados.
- Exibe diagnósticos não destrutivos ao importar templates com Field Keys/formerKeys, Entries, Checkboxes, tabelas ou referências repetidas; salvamento bloqueia conflitos ainda não resolvidos.
- Verifica IDs contra todos os templates `.forgetemplate` e `.atlastemplate` do Vault ao criar cópias, exportar ou publicar; bloqueia atualizações ambíguas e confere novamente antes da gravação.
- Mantém templates e valores originais intactos durante o diagnóstico; reparos de chaves de Checkboxes e tabelas exigem ação explícita do usuário.

## 0.1.4 — Sections recolhíveis e visibilidade de jogadores
- Faz Sections configuradas para iniciar recolhidas saírem do fluxo do statblock e ficarem acessíveis por botões abaixo do cartão, seguindo o padrão de conteúdo dobrável do Atlas.
- Ao abrir/recolher uma Section, reposiciona apenas blocos abaixo que compartilham sua faixa de colunas; blocos laterais mantêm suas coordenadas.
- Fields ocultos para jogadores deixam de ocupar espaço no statblock publicado e no modo de visualização da ficha, sem gerar botões no rodapé.
- Mantém o agrupamento e a largura de itens dentro de Rows quando Sections ou Fields são ocultados, recalculando apenas a altura das linhas.

## 0.1.4 — Arrastar Abilities entre abas
- Permite manter uma Ability sobre outra aba do grupo Abilities para abrir essa aba automaticamente após um pequeno atraso. A ativação sintética não dispara a seleção do Canvas nem reconstrói o card durante o arraste.
- Permite soltar a Ability em uma posição específica da lista de destino ou no final da lista quando solta sobre a própria aba.
- Move o registro entre os Fields de origem e destino, preservando descrição e Ability Parts; em caso de falha ao salvar o destino, tenta restaurar a lista de origem.
- Adiciona realce visual na aba em espera e na lista que receberá a Ability.

## 0.1.4 — Divisores horizontais e verticais
- Deixa o Divider como uma linha horizontal fina e visível, com contraste alinhado ao tema.
- Adiciona o bloco Vertical divider para separar visualmente colunas e conteúdo lado a lado.
- Mantém o Vertical divider como extensão do Forge; o Atlas nativo não possui um tipo de bloco vertical equivalente.

## 0.1.4 — Correção de No Label em blocos e Sections
- Faz No Label suprimir tanto rótulos de Fields quanto títulos opcionais de blocos, incluindo o título fixo e o título dinâmico de Sections.
- Preserva heading/headingField no template Forge; ao reativar Show Label, o título original volta sem perda de conteúdo.
- Mantém o nome das Sections usadas como abas, pois nesse contexto o título é o identificador de navegação da aba.
- Atualiza a projeção de exportação Atlas para representar No Label também nos blocos cujo rótulo vem de heading, sem remover o título das Sections que funcionam como abas.

## 0.1.4 — Limite de pips dos Counters aumentado
- Exibe pips para Counters com máximo de até 10; acima de 10, utiliza o stepper numérico.
- Ativa automaticamente a opção de mostrar valores numéricos quando qualquer Counter configurado ultrapassa 10.
- Counters grandes também exibem o valor restante/máximo na visualização, mesmo quando o Field ainda não tinha a opção marcada.

## 0.1.4 — Controles de tabela visíveis e layout consistente
- Remove o agrupamento Advanced Options e deixa as opções de apresentação junto das demais Properties.
- Torna explícitas as ações Adicionar linha e Adicionar coluna no statblock editável, visíveis acima da tabela e respeitando as permissões do Field.
- Move os controles de cada coluna para acima do nome no editor do template e dá mais largura ao nome em relação ao alinhamento.
- Faz o layout Um valor por linha funcionar também com múltiplas linhas de dados.

## 0.1.4 — Advanced Options nas tabelas
- Renomeia “Additional Forge options” para “Advanced Options” nas propriedades de blocos Scores.
- Preserva o estado expandido da seção entre atualizações do Canvas e alterações nas opções, evitando que ela feche após selecionar ou modificar um controle.

## 0.1.4 — Propriedades completas para tabelas
- Consolida as opções de Tabular Data/ Scores nas Properties do Field: colunas, alinhamento individual, cabeçalho e permissões para adicionar/remover linhas e colunas.
- Mantém os valores iniciais editáveis diretamente na tabela do Canvas, como no fluxo do Atlas.
- Remove opções duplicadas do inspetor do bloco; propriedades do Field e propriedades específicas de apresentação do bloco ficam separadas.
- Preserva `slotKeys` neutras e os dados existentes ao adicionar ou remover colunas.

## 0.1.4 — Ajustes na UI de Tabelas
- Reorganiza o editor de tabelas no template com larguras consistentes, área horizontal rolável e uma coluna reservada para ações, mantendo cabeçalhos e células alinhados.
- Melhora contraste, espaçamento, foco dos campos e alinhamento dos controles de linha/coluna.
- Adiciona espaço superior real ao editor de tabela em statblocks para que os controles de coluna não fiquem fora da área visível nem cortem o cabeçalho.
- Melhora a borda superior, o fundo do cabeçalho e o espaçamento das tabelas na visualização final, incluindo o modo compacto.

## 0.1.4 — Rótulos neutros nas colunas iniciais
- Novos Fields Scores começam com `Column 1`, `Column 2` e `Column 3`, em vez de `STR`, `DEX` e `CON`.
- A mesma configuração padrão é usada ao converter um Field existente para Scores sem colunas definidas.
- O placeholder das configurações de colunas agora mostra os nomes genéricos, com tradução para português.
- Colunas e rótulos personalizados de templates existentes são preservados.

## 0.1.4 — Correção do bloco Text/Markdown no Canvas e no statblock
- Corrige a abertura de Properties do bloco Text/Markdown: a seleção já era disparada, mas o painel falhava por falta do import de `textareaInput` no editor do Field.
- Mantém as opções do bloco Text no topo de Properties e os controles do Field Markdown logo abaixo.
- Renderiza o conteúdo do bloco Text e dos Fields Markdown com o MarkdownRenderer nativo do Obsidian, usando o App, o Component e o caminho da nota corretos.
- Usa diretamente o MarkdownRenderer nativo do Obsidian para Paragraphs, sem adiar a renderização para um frame que poderia ser perdido durante atualizações do Canvas.
- No statblock, mantém o Markdown formatado como visualização e abre a textarea multilinha apenas durante a edição contextual.

## 0.1.4 — Correção do renderizador Markdown
- Corrige a inicialização do Markdown nativo usando a instância `App` recebida pelo plugin, em vez de `getApp()`, que não está disponível na API carregada.
- Restaura a abertura de statblocks e templates com blocos Markdown.

## 0.1.4 — Seleção de blocos Markdown no Canvas do template
- Seleciona blocos Text/Markdown já no `pointerdown`, antes que handlers de links ou elementos renderizados pelo Markdown consumam o evento `click`.
- Mantém o comportamento normal dos links Markdown e dos controles internos; a seleção por teclado continua disponível com Enter ou Espaço.
- Evita alternar a seleção duas vezes em cliques com Ctrl/Cmd/Shift e mantém o inspetor do bloco Text no topo de Properties, seguido das configurações do Field vinculado.

## 0.1.4 — Editor Markdown compacto e renderização nativa
- Reduz a altura mínima das caixas Markdown e limita seu crescimento, mantendo largura máxima dentro do bloco.
- Renderiza o conteúdo dos blocos Text com o MarkdownRenderer do Obsidian, incluindo parágrafos, listas, links, títulos e demais recursos Markdown suportados pelo Obsidian.

## 0.1.4 — Modo Statblock interativo

- Ativa no modo Statblock os controles do renderizador final: edição contextual de Fields, Value Boxes, Tracks, Counters, Ability Counters, checkboxes, tabelas, abas e edição/reordenação de habilidades.
- Habilita links de rolagem no modo de prévia, usando o Dice Tool do Atlas quando um mapa compatível estiver aberto.
- Mantém os testes em uma cópia isolada e profunda dos valores de exemplo; cliques e edições não modificam `template.sample` nem são salvos no Vault.
- Preserva os valores temporários durante atualizações do editor enquanto os valores de exemplo originais não forem alterados; recarregar ou modificar os exemplos reinicia a prévia.
- Remove os listeners de rolagem ao reconstruir ou fechar o editor para evitar eventos duplicados.

## 0.1.4 — Editor de Fields Markdown em statblocks publicados para Atlas

- Corrige a ausência do campo de escrita em statblocks publicados como notas Atlas-v1: como o Atlas usa seu renderizador nativo e não expõe uma API pública para injetar controles no card, o Forge acrescenta um painel complementar, dedicado apenas aos Fields Markdown, na mesma visualização da nota. O editor não é injetado dentro do card nativo.
- Cada Field Markdown recebe uma textarea multilinha identificada pelo Label; alterações são gravadas no YAML da própria nota e passam a ser refletidas no card Atlas.
- O editor complementar aparece somente quando o template Forge vinculado contém Fields Markdown e não duplica o statblock inteiro.
- O editor permanece sincronizado com atualizações externas quando não há texto em edição e preserva rascunhos em foco ou com salvamento pendente.

## 0.1.4 — Edição de conteúdo Markdown no Field e no statblock
- Adiciona em **Properties** uma caixa multilinha **Example content** para escrever o valor de exemplo dos Fields Markdown diretamente no template; o texto aparece na prévia e é salvo junto do template.
- Garante que um bloco **Text** vinculado a um Field use sempre o valor do Field, mesmo que um `block.text` antigo tenha ficado salvo; isso evita que o bloco vire texto estático e oculte a área editável.
- Em blocos Text vinculados, a propriedade **Heading** agora edita o cabeçalho (`block.heading`) em vez de sobrescrever o conteúdo do Field.
- Mantém o textarea multilinha visível nos statblocks publicados, com salvamento no Vault ao sair do campo e preservação de quebras de linha.

## 0.1.4 — Modo Statblock no editor de templates

- Adiciona o toggle **Statblock mode** para alternar entre o Canvas de construção e uma prévia limpa usando o renderizador final do Forge.
- A prévia usa os valores de exemplo do template, mantém o tema, a largura da ficha, as imagens resolvidas do Vault e a aba selecionada em containers Tabs.
- Oculta grade, seleção, alças, controles de arrastar e edição de amostras enquanto o modo Statblock está ativo; alternar de volta restaura o Canvas sem alterar o layout salvo.

## 0.1.4 — Zoom do Canvas de templates com Ctrl + scroll
- Adiciona zoom in/out no Canvas do editor de templates ao usar Ctrl + roda do mouse.
- Mantém o ponto sob o cursor como referência durante o zoom e preserva a escala ao atualizar a prévia e as propriedades.
- Mantém a rolagem normal quando Ctrl não está pressionado e não intercepta a roda sobre controles de formulário.
- Limita a escala entre 40% e 250%; o zoom é uma preferência temporária do editor e não altera os dados do template.

## 0.1.4 — Rótulos de Tabular Data e Table separados na interface
- Na lista de Fields exibida na aba **Structure**, o Field tabular agora aparece como **Table**, identificando sua representação no Canvas.
- O menu **Add Field** dentro da aba **Structure** também usa **Table**; a descrição esclarece que ele cria um Field do tipo Tabular Data.
- Em **Properties**, o tipo do mesmo Field continua como **Tabular Data**, identificando os dados armazenados.
- O bloco de apresentação e os identificadores internos permanecem inalterados; não é necessária migração dos templates.

## 0.1.4 — Edição de Markdown no statblock corrigida
## 0.1.4 — Editor Markdown visível no statblock
- Fields do tipo Markdown agora exibem uma área de texto multilinha diretamente no statblock editável, sem depender de clique para revelar o controle.
- O conteúdo é salvo ao sair da área; Ctrl/Cmd+Enter também salva sem remover o comportamento de Enter para criar novas linhas.
- Mensagens de erro de salvamento permanecem junto ao campo, e ocorrências do mesmo Field são sincronizadas sem sobrescrever o texto enquanto a área está em foco.

- Dá aos Fields Markdown um caminho de ativação próprio no slot, em fase de captura, evitando que handlers de superfície do Atlas/Obsidian consumam o clique antes de abrir o editor.
- Mantém o slot como uma área de grid real durante a edição e garante que o textarea ocupe a largura disponível, receba foco e aceite digitação.
- Ao abrir um Markdown existente, posiciona o cursor no final do conteúdo em vez de selecionar o texto inteiro automaticamente.
- Preserva quebras de linha, salvamento inline e o atalho Ctrl/Cmd+A para selecionar todo o conteúdo manualmente.

## 0.1.4 — Alça de reorganização das Abilities à direita
- Move o controle **Drag to Reorganize** das entradas de Ability para o lado direito.
- Reserva o espaço do controle à direita e devolve a margem esquerda ao conteúdo, evitando sobreposição com o texto.
- Mantém o mesmo botão, feedback visual, acessibilidade e comportamento de arrastar/reordenar.

## 0.1.4 — Ability Part roll links and click behavior

- Ability Part values across Text, Number, Dice, List and Choice are scanned for explicit dice formulas and signed bonuses, including after an Ability is edited and saved; plain unsigned numbers remain non-rollable.
- Clicking a dice link inside an Ability no longer opens the Ability inline editor. The click is left for the statblock Dice Tool handler, while normal clicks on names, descriptions and Part values still open editing.

## 0.1.4 — Tabular Data separado de Table
- Renomeia o Field tabular de **Table** para **Tabular Data** em Properties, nos seletores e na lista de Fields.
- Mantém **Table** como nome do bloco de apresentação em Structure.
- Explica na ajuda e na documentação que Tabular Data armazena as linhas e os valores, enquanto Table apenas apresenta os dados.
- Preserva os identificadores internos e o formato dos dados Atlas existentes.

## 0.1.4 — Rótulo Table consistente
- Padroniza o nome visível do tipo de Field/Bloco de tabela como **Table** no Structure, no seletor de tipos e em Properties.
- Reconhece tanto o tipo interno `table` quanto o tipo de dados `scores` como **Table** na lista de Fields.
- Mantém `scores` como identificador interno e preserva os dados e fórmulas existentes.

## 0.1.4 — Links de rolagem em Abilities
- Gera links clicáveis para fórmulas de dados nas descrições e nos valores das Ability Parts.
- Associa cada rolagem ao nome da habilidade correspondente, para que o Atlas registre a origem correta.
- Reaplica os links sempre que uma habilidade é redesenhada após a edição inline.

## 0.1.4 — Edição do Field Markdown corrigida
- Corrige a área de edição de Fields Markdown para permitir digitação em múltiplas linhas.
- Aumenta a altura inicial do editor e mantém a caixa de texto na largura disponível do bloco, sem restringi-la à largura do texto atual.
- Reforça os estilos de foco, contraste e interação do textarea para evitar que os estilos compactos dos controles Atlas escondam ou bloqueiem a área de edição.

## 0.1.4 — Seletor de Section compacto e reposicionado

- Move o botão de seleção de Section do canto superior esquerdo para o canto superior direito do bloco.
- Reduz o controle a um botão compacto apenas com ícone; o nome continua disponível no tooltip e no rótulo acessível.
- Preserva o clique para selecionar a Section e o Alt-clique para navegar até a Section externa.

## 0.1.4 — Espaçamento dos pips no Canvas do template
- Aumenta apenas na visualização do template a distância vertical entre o nome do Counter e seus pips; o espaçamento do statblock final permanece inalterado.

## 0.1.4 — Máximo visível apenas quando definido pelo próprio Value
- Em Values no modo Boxes, exibe o número `/máximo` no final das caixas somente quando o próprio Field define seu máximo.
- Quando o máximo vem de outro Field Number selecionado em `Maximum`, oculta o número adicional sem alterar a quantidade de caixas nem a edição dos valores.

## 0.1.4 — Revisão de textos da interface em inglês
- Corrige os cabeçalhos de colunas sem nome na visualização de tabelas: `Column 1`, `Column 2` etc. na interface em inglês.
- Traduz os exemplos do Field Checkboxes para inglês, sem modificar os exemplos em português.
- Atualiza a ajuda de configuração de colunas para explicar que os nomes são apenas rótulos de exibição e que as chaves internas (`slot_1`, `slot_2` etc.) são geradas automaticamente.
- Completa traduções de avisos e rótulos de acessibilidade relacionados a Counters e opções de Checkboxes.

## 0.1.4 — Chaves neutras para colunas de tabelas
- Gera `slotKeys` como `slot_1`, `slot_2`, `slot_3` etc., sem transformar cabeçalhos como STR/DEX em chaves internas.
- Preserva chaves já existentes nos templates e continua aceitando registros legados que usam os próprios rótulos das colunas.

## 0.1.4 — Nome do primeiro Counter e máximo editável em Boxes
- Associa o antigo rótulo genérico `Counter 1` ao nome personalizado do primeiro preset, preservando a mesma ordem nas interações e nas regras de Rest.
- Exibe o máximo de Value/Track em modo Boxes ao final da fileira (`/máximo`); clicar no número permite editar diretamente o Field que define esse máximo.

## 0.1.4 — Counters compactos e Value Boxes compatíveis com Atlas
- A primeira linha de Counters sempre recebe um rótulo visível “Counter” quando estiver sem nome ou usar o antigo padrão “Counter 1”; nomes personalizados continuam intactos e o rótulo padrão não exibe numeração.
- Reduz a altura dos botões dos pips e aproxima visualmente os marcadores do nome.
- Em blocos Value/Track importados sem `counts`, assume o padrão Atlas `down` e mantém disponível a seleção de `Maximum`.
- Explica que a quantidade de boxes acompanha o valor de um Field Number escolhido em `Maximum`, como no Atlas.

## 0.1.4 — Value Boxes tracked apenas com boxes

- Em Value no modo Boxes, o ajuste de recursos rastreados é feito exclusivamente clicando nos próprios boxes; os controles `−` e `+` não são exibidos.
- A escolha explícita entre Boxes e Gauge passa a ser respeitada, sem converter automaticamente Boxes em Gauge por causa do máximo.

## 0.1.4 — Value Boxes sem números e Counters alinhados
- Na visualização do statblock final, oculta os valores numéricos auxiliares em Tracks no modo Boxes; as caixas continuam interativas para edição.
- Mantém a leitura numérica nos Gauges, inclusive quando a trilha muda automaticamente para Gauge por exceder 36 caixas.
- Agrupa o nome e os pips de cada Counter em uma linha flexível única, com espaçamento reduzido, também na visualização final.

## 0.1.4 — Ícone de Section menor
- Reduz o tamanho do ícone no controle de seleção de Section sem diminuir o texto, a área clicável ou os recursos de seleção.

# Changelog

## 0.1.4 — Edição por nome e Counters compactos
- Permite abrir o editor de um Field clicando em seu nome, mesmo quando o valor exibido é um link de rolagem. O atalho também funciona por teclado com Enter ou Espaço.
- Alinha os pips dos Counters horizontalmente ao lado do nome, com espaçamento menor.

## 0.1.4 — Ajustes visuais de Values e Counters
- No modo **Boxes** dos blocos Value, remove os textos `Current` e `Maximum`, mantendo os valores editáveis e as caixas interativas.
- Remove o botão visual de recarga (`↻`) dos Counters. Os dados de recuperação já gravados continuam preservados.

## 0.1.4 — Labels universais e Value Boxes interativos
- Adicionada opção Show Label / No Label para todos os tipos de bloco no inspetor.
- Blocos Track no modo Boxes agora usam caixas clicáveis quando a edição numérica está disponível, seguindo a interação nativa do Atlas: clicar define a quantidade até a caixa; clicar novamente na última caixa marcada a desmarca.
- Adicionados estados de foco, hover e pressionado aos boxes interativos.

## 0.1.4 — Label placement e alinhamento interno

- Canvas: easier selection of nested Sections using a visible Section edge handle, clearer Section boundaries, and Alt-click on a child to select its nearest parent Section. Alt-click on a Section handle navigates to the outer Section.

- Adiciona **Above label** em **Label Placement**: o valor é apresentado acima do rótulo, sem alterar a ordem dos dados do Field.
- Amplia o alinhamento horizontal individual para os elementos internos dos blocos de conteúdo, incluindo Values, métricas, tabelas, tags, counters, listas, entradas, trilhas e imagens.
- Preserva o alinhamento independente dos blocos filhos dentro de Sections, Rows e Tabs.
- Na projeção nativa para Atlas, **Above label** usa o formato vertical empilhado mais próximo disponível; a ordem invertida permanece no renderizador do Forge.

## 0.1.4 — Values: No Label

- Adiciona a opção **No Label** em **Label Placement** para blocos Value/Stat.
- O modo No Label oculta o rótulo no statblock final, mesmo quando o Field ou o bloco possui um rótulo configurado. Blocos nativos Atlas com `label: ""` também são reconhecidos como No Label no inspetor.
- Preserva a posição anterior (Beside label / Below label) ao alternar temporariamente para No Label e restaura o label do Field quando a exibição é reativada.
- Ao publicar o template para o Atlas, projeta a opção como `label: ""`, formato nativo que o Atlas usa para suprimir o rótulo; a propriedade exclusiva do Forge não é exportada.

## 0.1.4 — Atualização de versão

- Atualiza a versão do plugin e os metadados do pacote para `0.1.4`.
- Consolida as correções acumuladas desde `0.1.3`: grade global de 12 colunas para blocos aninhados, cálculo de altura dos containers, Rows, padding padrão, Values sem label, seleção dos controles de redimensionamento, Counters/Metric e persistência dos vínculos do Atlas.
- Não altera a estrutura de dados dos templates nem remove configurações personalizadas existentes.

## 0.1.3 — Grade global para blocos aninhados

- Sections, Rows e Tabs mantêm o mesmo sistema global de 12 colunas em todos os níveis; a largura do bloco pai não reduz nem redefine as colunas internas.
- O cálculo de altura usa essa mesma grade global e reserva no bloco pai todas as linhas ocupadas pelos descendentes, incluindo Rows com quebras de linha e Tabs.
- O Canvas, o redimensionamento, o drag-and-drop e as âncoras de posicionamento usam a mesma geometria global; âncoras antigas são convertidas para 12 colunas.
- Filhos de Rows expõem a quantidade de linhas calculada para que o redimensionamento não reduza sua altura inicial abaixo do conteúdo aninhado.

## 0.1.3 — Values sem label

- Respeita `label: ""` explícito em blocos Value, ocultando o rótulo do Field sem ocultar o valor.
- Mantém a ocultação de rótulos antigos copiados quando o próprio Field está sem label.
- Marca as saídas value-only de Stat, Track, Pairs, Tags e Counters de forma consistente.


## 0.1.3 — Correções de Rows e padding padrão

- Corrige o redimensionamento horizontal dos filhos de Rows: cada bloco agora calcula a largura usando o span de sua própria linha visual, sem considerar blocos que já foram quebrados para outras linhas.
- A prévia durante o arraste usa a mesma fórmula de largura do renderizador e respeita o espaço e o gap reais da linha.
- Permite redimensionar um filho que esteja sozinho em uma linha e limita o crescimento ao espaço disponível sem forçar uma quebra inesperada.
- Define o valor padrão de Padding como `0 px` no inspetor de aparência; valores explicitamente salvos em templates existentes são preservados.

## 0.1.3 — Canvas: seleção do redimensionador e altura dos containers

- O controle de redimensionamento é criado somente para o bloco primariamente selecionado e removido dos demais durante mudanças de seleção; passar o cursor ou selecionar vários blocos não revela controles extras.
- O gesto de redimensionamento também confirma que o bloco continua sendo o selecionado antes de iniciar.
- O cálculo de posicionamento reserva a altura mínima necessária para Sections, Rows e Tabs, incluindo placeholders vazios, títulos e abas.
- Rows agora contabilizam todas as linhas flexíveis criadas quando seus filhos ultrapassam 12 partes; o renderizador usa o mesmo agrupamento e distribui os espaços de cada linha separadamente.
- Containers não deixam blocos filhos ultrapassarem sua área e ficarem visualmente atrás dos próximos irmãos no Canvas.

## 0.1.3 — Integração Atlas: persistência dos vínculos

- Persiste vínculos compartilhados por Asset ID e exceções por mapa/instância nos dados próprios do Statblock Forge (`forgeTokenLinks`).
- Expõe API para consultar, resolver, criar e remover vínculos sem escrever no estado do Atlas.
- Serializa gravações com configurações e rascunhos para evitar sobrescritas concorrentes por snapshots antigos.
- Preserva dados inválidos ou de versões futuras e não normaliza registros recuperáveis durante gravações não relacionadas.

## 0.1.3 — Metric e Counters

- Adiciona configuração por Metric para limitar a quantidade máxima de itens em cada linha (1–12), com padrão de 6.
- Corrige o nome automático `Counter 1`: novas linhas Counters começam sem nome e o rótulo passa a ser opcional.
- Adiciona a opção **Show numeric values (remaining / maximum)** nos presets de Counters; fica desativada por padrão e pode ser ativada por Field.
- Quando a opção está desativada, oculta a apresentação numérica visual sem remover os valores internos nem a informação acessível dos controles.

## 0.1.3 — Correção de conteúdo e Fields sem rótulo

- Corrige a distribuição vertical dos itens em blocos Entries e Spells com rolagem interna: as linhas permanecem na altura natural e alinhadas ao início, mesmo quando o bloco fica mais alto.
- Conteúdo comum dos blocos mantém altura intrínseca ao aumentar a altura do bloco; o espaço adicional permanece vazio, sem esticar linhas ou distribuir elementos verticalmente.
- Blocos com rolagem interna e containers estruturais (Sections, Rows e Tabs) continuam ocupando a área disponível.
- Fields aceitam rótulo vazio para renderizar somente o valor, mantendo a chave como identificador interno e fallback nos controles do editor.
- Rótulos vazios também são omitidos nas saídas Stat, Metric, Line e nos campos Level/HP do cabeçalho.

## 0.1.3 — Ajustes de controles de redimensionamento e Value Boxes

- Evita a sobreposição de controles de redimensionamento em Sections e layouts aninhados: somente o bloco mais interno sob o cursor ou selecionado exibe seu controle.
- Alinha os Value Tracks do tipo Boxes ao Atlas: caixas de 12×12 px, espaçamento de 4 px, até 12 caixas por linha, borda/cor marcada do tema e raio de 4 px.
- Acima de 36 pontos, o tipo Boxes passa automaticamente à representação Gauge, como no Atlas, incluindo a barra de 96×6 px e o valor atual/máximo.
- Mantém cores personalizadas do Forge quando configuradas no bloco.

## 0.1.3 (2026-11-13)

- Define a versioned Forge-owned token-link data model with shared Asset ID links and map/token instance overrides.
- Add deterministic resolution precedence: instance override, then Asset ID inheritance; an explicit null override can suppress an inherited link without deleting it.
- Add defensive parsing, path/ID validation, collision-safe instance keys, and non-mutating model operations. This is the data-model foundation only; persistence remains in the next integration step.
- Corrige a largura das colunas em Sections: cada trilha interna usa a mesma largura física da grade principal, preservando as proporções relativas de largura já salvas nos templates.
- Mantém renderização, redimensionamento, posicionamento por drag-and-drop e âncoras de layout usando a mesma geometria de grade aninhada; âncoras antigas de 12 colunas são convertidas com segurança.
- Restaura a rolagem do Canvas de templates em uma área dedicada abaixo da barra de ferramentas fixa; a ficha mantém sua altura natural e pode rolar vertical e horizontalmente.
- Padroniza a altura das linhas entre a grade raiz e as Sections; o espaço vertical não utilizado permanece abaixo do conteúdo.
- Preserva as correções 0.1.2 de alinhamento vertical de Fields, dimensionamento de Sections e rolagem das fichas renderizadas.
- Preserva a posição vertical e horizontal do Canvas ao atualizar Fields, propriedades, seleções, JSON ou layout; a restauração agora atua no scrollport real (`.statblock-forge__canvas-dropzone`) e ocorre após a atualização do layout.
- Corrige o autoscroll durante o redimensionamento para usar o próprio scrollport do Canvas, em vez da coluna externa recortada.

## 0.1.2

- Fixed per-block vertical alignment for Field content by aligning the content item inside its allocated Grid track instead of aligning the already full-height Grid track.
- Fixed Section content sizing: Section headings now use their intrinsic height while the nested block Grid receives the remaining space; collapsible Sections use the same two-row structure.
- Preserved full-height behavior for Tabs, Images, and row-count-editable scroll areas.
- Fixed the template editor header taking unnecessary vertical space by placing the template name beside the editor title when space allows.
- Made the Canvas panel and dropzone stretch through the full available preview-column height instead of sizing only to their contents.
- Moved the Canvas title inline with its toolbar to reduce the stacked control area above the preview; the sheet remains top-aligned and scrollable.
- Fixed creation of new template drafts using a true file-less `TemplateEditorView` (`allowNoFile = true`), matching Atlas's own template editor approach. New drafts stay in memory until explicitly saved; no placeholder `.forgetemplate` is written to the Vault.
- Fixed closed-draft recovery to wait for deferred editor views before accessing the view instance, including recovery of drafts that have no source file.
- Removed temporary draft file creation and cleanup, preventing incomplete temporary files from appearing in template pickers or remaining in the Vault after an interrupted session.
- Retained the 0.1.1 wheel scrolling, block stacking, and Choice-field theme contrast fixes, plus the 0.1.2 Canvas sizing and Save/Tools header layout adjustments.


## 0.1.1

- Added native mouse-wheel scrolling for the statblock viewport; no mouse button needs to be held.
- Kept multiline, row-editable blocks independently scrollable. When an inner scroll area reaches its top or bottom, normal wheel scrolling can continue through the statblock.
- Fixed non-editable/fixed-height block content so it does not create its own vertical scroll area.
- Preserved horizontal scrolling and the existing image-wheel zoom behavior.
- Fixed new template drafts and draft recovery when Obsidian defers creation of the editor view.
- Matched Choice-field controls and native dropdown colors to the active Forge theme, including dark themes.


## Correção de rolagem vertical da ficha

- O host de renderização agora estabelece um contexto flexível com altura e limites explícitos.
- Na visualização independente e no painel lado a lado, a superfície da ficha recebe o espaço restante e mantém `overflow-y: auto` funcional.
- No modo empilhado, a ficha conserva sua altura natural e a rolagem permanece no contêiner da nota do Obsidian, incluindo o conteúdo Markdown abaixo dela.
- O host recebe e remove a classe estrutural junto ao ciclo de vida de `StatblockRenderSurface`.

## 0.5.0 — Transition Stage 6.3.1

- Added automatic repair of Forge statblock backlinks after a `.forgetemplate` is renamed, moved with a folder, or restored from trash. Repairs use the stable template ID and update YAML only when the current path and ID still match the inspected link.
- Added startup reconciliation for stale template paths and a metadata-cache retry path for notes whose frontmatter becomes available after startup.
- Ambiguous duplicate template IDs and missing templates remain unchanged; the service reports those states instead of guessing.
- Template deletion confirmation now counts exact Forge backlinks or Atlas-published statblock references and makes clear that linked Markdown notes are never deleted with a Template.
- Added serialized lifecycle management and teardown for template-link maintenance listeners.