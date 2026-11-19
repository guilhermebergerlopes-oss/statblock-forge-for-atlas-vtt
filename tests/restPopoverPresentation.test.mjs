import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const chooserUrl = new URL('../src/views/ForgeRestChooser.ts', import.meta.url);
const stylesUrl = new URL('../styles.css', import.meta.url);

test('Rest chooser removes redundant introductory and confirmation explanations', async () => {
  const source = await readFile(chooserUrl, 'utf8');

  assert.doesNotMatch(source, /rest-choice-intro|rest-choice-footnote/);
  assert.doesNotMatch(source, /Choose the options and any resources to spend/);
  assert.doesNotMatch(source, /Confirming applies the supported Counter/);
  assert.doesNotMatch(source, /This action can be taken for this character or another/);
  assert.match(source, /label\('Spend', 'Gastar'\)/);
  assert.match(source, /label\('Confirm', 'Confirmar'\)/);
  assert.match(source, /per unit/);
  assert.match(source, /por unidade/);
});

test('choice minimum is shown compactly beside the live selection count', async () => {
  const source = await readFile(chooserUrl, 'utf8');

  assert.match(source, /total\} \/ \$\{choice\.max\}.*mín\. \$\{choice\.min\}/s);
  assert.match(source, /total\} \/ \$\{choice\.max\}.*min \$\{choice\.min\}/s);
  assert.doesNotMatch(source, /Choose at least \$\{choice\.min\} and at most/);
});

test('scrolling inside the Rest popover does not reposition it against its anchor', async () => {
  const source = await readFile(chooserUrl, 'utf8');
  const handlerStart = source.indexOf('const onScroll = (event: Event): void => {');
  const handlerEnd = source.indexOf('\n  };', handlerStart);
  assert.notEqual(handlerStart, -1, 'popover scroll handler should exist');
  assert.notEqual(handlerEnd, -1, 'popover scroll handler should close');
  const handler = source.slice(handlerStart, handlerEnd);

  assert.match(handler, /target instanceof Node && popover\.contains\(target\)/);
  assert.ok(handler.indexOf('popover.contains(target)') < handler.indexOf('place()'));
  assert.match(source, /document\.addEventListener\('scroll', onScroll, true\)/);
  assert.match(source, /document\.removeEventListener\('scroll', onScroll, true\)/);
});

test('Rest chooser measures and constrains the panel to create a bounded inner scrollport', async () => {
  const source = await readFile(chooserUrl, 'utf8');
  const styles = await readFile(stylesUrl, 'utf8');

  assert.match(source, /panel\.setCssStyles\(\{ height: 'auto' \}\)/);
  assert.match(source, /const naturalHeight = panel\.getBoundingClientRect\(\)\.height/);
  assert.match(source, /panel\.setCssStyles\(\{ height: `\$\{Math\.min\(naturalHeight, maxPanelHeight\)\}px` \}\)/);

  const bodyRule = styles.match(/\.statblock-forge__rest-panel-body\s*\{([^}]*)\}/s)?.[1];
  assert.ok(bodyRule, 'Rest panel body styles should exist');
  assert.match(bodyRule, /flex:\s*1 1 0%/);
  assert.match(bodyRule, /height:\s*0/);
  assert.match(bodyRule, /min-height:\s*0/);
  assert.match(bodyRule, /overflow-y:\s*auto/);
  assert.match(bodyRule, /overscroll-behavior-y:\s*contain/);
});
