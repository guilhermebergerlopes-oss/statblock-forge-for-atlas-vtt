import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [renderer, styles] = await Promise.all([
  readFile(new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url), 'utf8'),
  readFile(new URL('../styles.css', import.meta.url), 'utf8'),
]);

test('List editor preserves each configured look while keeping Add and Remove controls in the scroll viewport', () => {
  assert.match(renderer, /const editorLook = \['comma', 'chips', 'bullets', 'numbered'\]/);
  assert.match(renderer, /const chips = element\(isComma \? 'span' : listTag,[\s\S]*?statblock-forge__inline-list-chips--\$\{editorLook\}/);
  assert.match(renderer, /const inputRow = isComma \? input : element\('li', 'statblock-forge__inline-list-editor-add-row'\)/);
  assert.match(renderer, /chips\.append\(inputRow\)/);
  assert.match(renderer, /chips\.insertBefore\(chip, inputRow\)/);
  assert.match(renderer, /atlas-sb-pane-chip__remove statblock-forge__inline-list-remove/);
  assert.match(renderer, /chips\.addEventListener\('click'/);
  assert.match(renderer, /viewport\.append\(chips\);[\s\S]*?if \(actions\.childElementCount > 0\) viewport\.append\(actions\)/);
  assert.match(renderer, /appendCustomCollectionValueAction\(actions, field, runtime, language\);[\s\S]*?appendFieldCompendiumPicker\(actions, field, layout, sample, runtime, language\)/);
  const viewportRule = styles.match(/\.statblock-forge__statblock \.statblock-forge__inline-list-viewport \{([^}]+)\}/)?.[1];
  assert.ok(viewportRule, 'List viewport includes its item and action controls');
  assert.match(viewportRule, /max-height:\s*min\(16rem,\s*45vh\)/);
  assert.match(viewportRule, /overflow-y:\s*auto/);
  assert.match(viewportRule, /overflow-x:\s*hidden/);
  const rule = styles.match(/\.statblock-forge__statblock \.statblock-forge__inline-list-chips\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'List item collection scroll rule exists');
  assert.match(rule, /max-height:\s*min\(16rem,\s*45vh\)/);
  assert.match(rule, /overflow-y:\s*auto/);
  assert.match(rule, /overflow-x:\s*hidden/);
  assert.match(rule, /overscroll-behavior:\s*contain/);
  assert.match(styles, /\.statblock-forge__inline-list-chips--bullets,[\s\S]*?\.statblock-forge__inline-list-chips--numbered/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__inline-list-remove:hover \{ background: color-mix\(in srgb, var\(--forge-theme-accent/);
});

test('List and Pairs editors use an opaque theme surface while editing', () => {
  const editorRule = styles.match(/\.statblock-forge__statblock \.statblock-forge__inline-list-editor,[\s\S]*?\.statblock-forge__statblock \.statblock-forge__pairs-editor \{([^}]+)\}/)?.[1];
  assert.ok(editorRule, 'Both collection editors have a shared surface rule');
  assert.match(editorRule, /background:\s*var\(--forge-theme-editor-bg, var\(--forge-theme-surface, var\(--background-secondary\)\)\)/);
  assert.match(editorRule, /border:\s*1px solid var\(--forge-theme-border/);
  assert.match(editorRule, /padding:/);
  assert.match(styles, /data-forge-theme=\"modern-blue\"\] \{[\s\S]*?--forge-theme-editor-bg:\s*#1e293b/);
});

test('List editor scrolls to the newly added item after persistence', () => {
  assert.match(renderer, /await runtime\.setBaseValue\(field\.key, snapshot\);[\s\S]*?viewport\.scrollTop = viewport\.scrollHeight/);
});

test('Pairs editor keeps Add and Remove controls in the scroll viewport and preserves inline item flow', () => {
  assert.match(renderer, /const rowsRoot = element\('div', 'statblock-forge__pairs-editor-rows'\)/);
  assert.match(renderer, /layer\.append\(rowsRoot, helper, error\)/);
  assert.match(renderer, /const row = element\('span', 'statblock-forge__preview-pair statblock-forge__pairs-editor-row'\)/);
  assert.match(renderer, /row\.append\(keyInput, separator, valueInput, remove\)/);
  assert.match(renderer, /rowsRoot\.append\(addPair\);[\s\S]*?if \(actions\.childElementCount > 0\) rowsRoot\.append\(actions\)/);
  const rule = styles.match(/\.statblock-forge__pairs-editor-rows\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'Pairs row list scroll rule exists');
  assert.match(rule, /max-height:\s*min\(16rem,\s*45vh\)/);
  assert.match(rule, /overflow-y:\s*auto/);
  assert.match(rule, /overflow-x:\s*hidden/);
  assert.match(rule, /overscroll-behavior:\s*contain/);
  assert.match(rule, /display:\s*flex/);
  assert.match(styles, /\.statblock-forge__pairs-editor-row \{[\s\S]*?display: inline-flex/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__pairs-editor-remove:hover \{ background: color-mix\(in srgb, var\(--forge-theme-accent/);
});

test('Compendium picker keeps its own item list scrollable inside the viewport-aware popover', () => {
  const rule = styles.match(/\.statblock-forge__compendium-picker-popover \.statblock-forge__compendium-picker-list\s*\{([^}]+)\}/)?.[1];
  assert.ok(rule, 'Compendium list scroll rule exists');
  assert.match(rule, /overflow:\s*auto/);
  assert.match(rule, /min-height:\s*0/);
  assert.match(renderer, /const maxHeight = Math\.max\(160, Math\.min\(480,/);
  assert.match(renderer, /popover\.setCssStyles\(\{ maxHeight: `\$\{maxHeight\}px` \}\)/);
});


test('List and Pairs editors replace the hidden display in normal flow instead of overlaying later Fields', () => {
  assert.match(renderer, /statblock-forge__preview-inline-list-field \u0024\{look === 'comma' \? 'is-inline-look' : 'is-block-look'\}/);
  const flowRules = styles.match(/\.statblock-forge__statblock \.statblock-forge__inline-list-field\.atlas-sb-pane-slot--editing,[\s\S]*?display: contents;[\s\S]*?\}/)?.[0];
  assert.ok(flowRules, 'List editor exits the overlay grid');
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__inline-list-field\.atlas-sb-pane-slot--editing > \.atlas-sb-pane-slot__rest,[\s\S]*?display: none !important/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__preview-inline-pairs-field\.atlas-sb-pane-slot--editing > \.atlas-sb-pane-slot__rest/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__preview-inline-pairs-field\.atlas-sb-pane-slot--editing \.statblock-forge__pairs-editor-rows \{[\s\S]*?max-height: min\(16rem, 45vh\)/);
  assert.match(styles, /\.statblock-forge__statblock \.statblock-forge__inline-list-field\.is-block-look\.atlas-sb-pane-slot--editing > \.statblock-forge__inline-list-editor \{[\s\S]*?display: block;[\s\S]*?width: 100%/);
});
