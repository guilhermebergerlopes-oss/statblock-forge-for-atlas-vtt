import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacyTemplate } from '../src/templates/legacyTemplateMigration.ts';

test('legacy Atlas Table imports no longer create block-level Columns or orientation settings', () => {
  const result = migrateLegacyTemplate({
    id: 'legacy-table-template',
    name: 'Legacy Table Template',
    fields: {
      ability_scores: {
        key: 'ability_scores',
        label: 'Ability Scores',
        type: 'scores',
        slots: ['Might', 'Agility'],
        rows: [[12, 14]],
      },
    },
    blocks: [{
      id: 'old-table',
      type: 'table',
      field: 'ability_scores',
      properties: ['ability_scores'],
      headers: ['Might', 'Agility'],
      orientation: 'row',
      perLine: 3,
      columns: [{ label: 'Modifier', formula: 'floor((value - 10) / 2)' }],
      calculate: true,
      modifier: 'floor((value - 10) / 2)',
    }],
  });

  const table = result.template.layout.blocks.find((block) => block.id === 'old-table');
  assert.ok(table);
  assert.equal(table.type, 'scores');
  assert.equal(table.columns, undefined);
  assert.equal(table.orientation, undefined);
  assert.equal(table.perLine, undefined);
  assert.deepEqual(result.template.fields.find((field) => field.key === 'ability_scores').slots, ['Might', 'Agility']);
  assert.ok(result.warnings.some((warning) => warning.includes('legacy calculated Table column')));
  assert.ok(table.fsExtras.atlasLegacyTable);
});
