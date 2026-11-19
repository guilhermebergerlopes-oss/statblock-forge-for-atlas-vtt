import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const editorUrl = new URL('../src/views/TemplateEditorView.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

test('each Rest configuration card has an accessible collapse control', async () => {
  const source = await readFile(editorUrl, 'utf8');
  assert.match(source, /collapsedRecoveryButtonIds = new Set<string>\(\)/);
  assert.match(source, /const collapseRest = button\(collapsed \? '▸' : '▾'/);
  assert.match(source, /collapseRest\.setAttribute\('aria-expanded', String\(!nextCollapsed\)\)/);
  assert.match(source, /cardBody\.hidden = nextCollapsed/);
  assert.match(source, /card\.classList\.toggle\('is-collapsed', nextCollapsed\)/);
  assert.match(source, /cardBody\.append\(this\.renderRecoveryRules/);
  assert.match(source, /cardBody\.append\(this\.renderRecoveryChoices/);
});

test('collapsing a Rest card is presentation-only and does not update template recovery JSON', async () => {
  const source = await readFile(editorUrl, 'utf8');
  const toggle = source.slice(source.indexOf("const collapseRest = button"), source.indexOf("titleRow.append(moveUp, moveDown, collapseRest"));
  assert.match(toggle, /collapsedRecoveryButtonIds\.add\(rest\.id\)/);
  assert.match(toggle, /collapsedRecoveryButtonIds\.delete\(rest\.id\)/);
  assert.doesNotMatch(toggle, /updateRecoveryButtons|setRecoveryButtons|this\.render\(\)/);
});

test('collapsed Rest cards hide only their settings body', async () => {
  const styles = await readFile(stylesUrl, 'utf8');
  assert.match(styles, /\.statblock-forge__recovery-card-content\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.match(styles, /\.statblock-forge__recovery-card\.is-collapsed/);
});
