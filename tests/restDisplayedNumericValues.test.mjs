import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDisplayedNumericFieldValues } from '../src/render/previewValueModel.ts';

test('Rest numeric snapshot uses the displayed formula result instead of a stale editable input', () => {
  const fields = [
    { key: 'level', label: 'Level', type: 'rating' },
    { key: 'tier', label: 'Tier', type: 'number', formula: 'ceil((level+2)/3)' },
    { key: 'tier_bonus', label: 'Tier Bonus', type: 'number', formula: 'tier+1' },
  ];
  const data = {
    level: '1',
    // These are deliberately stale editable inputs. Forge displays the formulas instead.
    tier: 10,
    tier_bonus: 99,
  };

  const values = resolveDisplayedNumericFieldValues(fields, data);

  assert.equal(values.level, 1);
  assert.equal(values.tier, 1);
  assert.equal(values.tier_bonus, 2);
});

test('Rest displayed-value resolution does not fall back to stale input when a formula dependency is unavailable', () => {
  const fields = [
    { key: 'level', label: 'Level', type: 'rating' },
    { key: 'tier', label: 'Tier', type: 'number', formula: 'ceil((level+2)/3)' },
  ];
  const data = { tier: 10 };

  const values = resolveDisplayedNumericFieldValues(fields, data);

  assert.equal(values.tier, null);
});
