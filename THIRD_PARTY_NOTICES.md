# Third-party notices

## Atlas VTT dice formula engine

The isolated formula parser and roller in `src/statblocks/atlasDiceEngine/` are adapted from Atlas VTT Beta's dice engine. The statblock text-roll scanner in `src/statblocks/atlasDiceEngine/textRolls.ts` is adapted from Atlas VTT Beta's `src/app/tools/textRolls.ts` to preserve its notation recognition rules. The source Atlas VTT project is distributed under the GNU Affero General Public License, version 3 (AGPL-3.0). These adapted portions remain under that license. The Forge uses the parser for its own validated formulas, reproduces Atlas 0.17.0's formula-completion, advantage/disadvantage and critical-result behavior for scene-independent statblock rolls, and routes rolls owned by an open map through that map's native Dice Tool. Scene-independent results are displayed by Forge and are not written to an Atlas map's history. Forge does not import Atlas UI components or statblock models.


## Atlas VTT recovery formula behavior

`src/statblocks/restFormulaModel.ts` adapts the reference substitution, bounded recovery formula validation, exact deterministic calculation, and multi-unit Spend aggregation from Atlas VTT Beta's `recoveryFormula.ts` and `spendFormula.ts`. It uses the Atlas-adapted dice parser already present in `src/statblocks/atlasDiceEngine/`. These adapted portions remain under AGPL-3.0. Forge supplies its own statblock field lookup and persists results through Forge-owned data APIs.
