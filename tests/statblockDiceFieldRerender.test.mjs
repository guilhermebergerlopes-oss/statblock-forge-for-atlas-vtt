import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appendForgeStatblockDiceText, FORGE_STATBLOCK_DICE_LINK_CLASS } from '../src/render/statblockDiceLinkElement.ts';

const rendererUrl = new URL('../src/render/statblockPreviewRenderer.ts', import.meta.url);

class FakeTextNode {
  constructor(text) {
    this.textContent = String(text);
    this.nodeValue = this.textContent;
  }
}

class FakeClassList {
  values = new Set();
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(ownerDocument, tagName) {
    this.ownerDocument = ownerDocument;
    this.tagName = tagName.toUpperCase();
    this.dataset = {};
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.children = [];
    this._textContent = '';
  }

  append(...nodes) { this.children.push(...nodes); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  set textContent(value) {
    this.children = [];
    this._textContent = String(value);
  }
  get textContent() {
    if (this.children.length > 0) return this.children.map((child) => child.textContent).join('');
    return this._textContent;
  }
}

class FakeDocument {
  createElement(tagName) { return new FakeElement(this, tagName); }
  createTextNode(text) { return new FakeTextNode(text); }
}

function container() {
  const doc = new FakeDocument();
  const root = new FakeElement(doc, 'div');
  return root;
}

test('Dice Field values create roll links when the value is rendered', () => {
  const root = container();
  appendForgeStatblockDiceText(root, '2d6 + 3');

  assert.equal(root.children.length, 1);
  const link = root.children[0];
  assert.equal(link.textContent, '2d6 + 3');
  assert.equal(link.classList.contains(FORGE_STATBLOCK_DICE_LINK_CLASS), true);
  assert.equal(link.dataset.formula, '2d6+3');
  assert.equal(link.attributes.get('role'), 'button');
  assert.equal(link.attributes.get('tabindex'), '0');
});

test('Dice Field values can contain prose and still link the valid dice expression', () => {
  const root = container();
  appendForgeStatblockDiceText(root, 'Damage 2d6+3 fire');

  assert.equal(root.children.length, 3);
  assert.equal(root.children[0].textContent, 'Damage ');
  assert.equal(root.children[1].classList.contains(FORGE_STATBLOCK_DICE_LINK_CLASS), true);
  assert.equal(root.children[1].dataset.formula, '2d6+3');
  assert.equal(root.children[2].textContent, ' fire');
});

test('Dice Field inline redraw uses the roll-link renderer instead of replacing the formula with plain text', async () => {
  const source = await readFile(rendererUrl, 'utf8');
  assert.match(
    source,
    /else\s+if\s*\(field\.type\s*===\s*'dice'\)\s*appendForgeStatblockDiceText\(display,\s*text\s*\|\|\s*'—'\)/,
  );
});
