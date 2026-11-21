import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createForgeStatblockTemplateLink,
  FORGE_STATBLOCK_LINK_KEY,
} from '../src/statblocks/forgeTemplateLink.ts';
import {
  countForgeTemplateBacklinks,
  ForgeTemplateLinkMaintenance,
  repairForgeTemplateLinks,
} from '../src/statblocks/forgeTemplateLinkMaintenance.ts';

function note(path, link, extra = {}) {
  return { path, frontmatter: { ...extra, [FORGE_STATBLOCK_LINK_KEY]: link } };
}

function link(templatePath, templateId = 'ash-drake-abc123', atlasTemplateId = null) {
  return createForgeStatblockTemplateLink({ templatePath, templateId, atlasTemplateId });
}

function memoryHost({ templates = [], notes = [], beforeUpdate = null } = {}) {
  const currentNotes = new Map(notes.map((row) => [row.path, structuredClone(row.frontmatter)]));
  const calls = [];
  return {
    calls,
    currentNotes,
    async listTemplates() { return templates; },
    async listStatblockNotes() { return [...currentNotes].map(([path, frontmatter]) => ({ path, frontmatter: structuredClone(frontmatter) })); },
    async updateNoteLink(path, update) {
      calls.push(path);
      if (beforeUpdate) await beforeUpdate(path, currentNotes);
      const frontmatter = currentNotes.get(path);
      if (!frontmatter) return false;
      const changed = update(frontmatter);
      if (changed) currentNotes.set(path, frontmatter);
      return changed;
    },
  };
}

test('repairs renamed Forge template backlinks for native v2 notes', async () => {
  const original = link('Templates/Ash Drake.forgetemplate');
  const host = memoryHost({
    templates: [{ path: 'Bestiary/Templates/Ash Drake.forgetemplate', templateId: 'ash-drake-abc123' }],
    notes: [note('Bestiary/Ash Drake.md', original, { hp: 18, title: 'Ash Drake' })],
  });

  const result = await repairForgeTemplateLinks(host);
  const updated = host.currentNotes.get('Bestiary/Ash Drake.md');
  assert.equal(result.notesUpdated, 1);
  assert.equal(updated[FORGE_STATBLOCK_LINK_KEY].templatePath, 'Bestiary/Templates/Ash Drake.forgetemplate');
  assert.equal(updated[FORGE_STATBLOCK_LINK_KEY].templateId, 'ash-drake-abc123');
  assert.equal(updated.hp, 18);
  assert.equal(updated.title, 'Ash Drake');
});

test('repairs Atlas-published v1 links without changing the Atlas template ID', async () => {
  const original = link('Templates/Ash Drake.forgetemplate', 'ash-drake-abc123', 'atlas-ash-drake-789012');
  const host = memoryHost({
    templates: [{ path: 'Archive/Ash Drake.forgetemplate', templateId: 'ash-drake-abc123' }],
    notes: [note('Bestiary/Ash Drake.md', original, { 'atlas-template': 'atlas-ash-drake-789012', name: 'Ash Drake' })],
  });

  const result = await repairForgeTemplateLinks(host);
  const updated = host.currentNotes.get('Bestiary/Ash Drake.md');
  assert.equal(result.notesUpdated, 1);
  assert.equal(updated[FORGE_STATBLOCK_LINK_KEY].version, 1);
  assert.equal(updated[FORGE_STATBLOCK_LINK_KEY].templatePath, 'Archive/Ash Drake.forgetemplate');
  assert.equal(updated[FORGE_STATBLOCK_LINK_KEY].atlasTemplateId, 'atlas-ash-drake-789012');
  assert.equal(updated['atlas-template'], 'atlas-ash-drake-789012');
});

test('does not rewrite links that already resolve to the exact template identity', async () => {
  const host = memoryHost({
    templates: [{ path: 'Templates/Ash Drake.forgetemplate', templateId: 'ash-drake-abc123' }],
    notes: [note('Bestiary/Ash Drake.md', link('Templates/Ash Drake.forgetemplate'))],
  });
  const result = await repairForgeTemplateLinks(host);
  assert.equal(result.notesUpdated, 0);
  assert.equal(host.calls.length, 0);
});

test('keeps stale links unchanged when the stable template ID is missing or ambiguous', async () => {
  const host = memoryHost({
    templates: [
      { path: 'Templates/Copy One.forgetemplate', templateId: 'duplicate-abc123' },
      { path: 'Templates/Copy Two.forgetemplate', templateId: 'duplicate-abc123' },
    ],
    notes: [
      note('Bestiary/Missing.md', link('Old/Missing.forgetemplate', 'missing-abc123')),
      note('Bestiary/Ambiguous.md', link('Old/Copy.forgetemplate', 'duplicate-abc123')),
    ],
  });
  const result = await repairForgeTemplateLinks(host);
  assert.equal(result.missingTemplates, 1);
  assert.equal(result.ambiguousTemplates, 1);
  assert.equal(result.notesUpdated, 0);
  assert.equal(host.calls.length, 0);
});

test('uses an expected-path and expected-ID guard against a concurrent relink', async () => {
  const initial = note('Bestiary/Ash Drake.md', link('Old/Ash Drake.forgetemplate'));
  const host = memoryHost({
    templates: [{ path: 'New/Ash Drake.forgetemplate', templateId: 'ash-drake-abc123' }],
    notes: [initial],
    beforeUpdate: async (path, notes) => {
      notes.set(path, { [FORGE_STATBLOCK_LINK_KEY]: link('Other/Chosen.forgetemplate', 'other-abc123') });
    },
  });
  const result = await repairForgeTemplateLinks(host);
  assert.equal(result.notesUpdated, 0);
  assert.equal(host.currentNotes.get('Bestiary/Ash Drake.md')[FORGE_STATBLOCK_LINK_KEY].templatePath, 'Other/Chosen.forgetemplate');
});

test('counts only exact Forge path-and-ID links and exact published Atlas IDs', () => {
  const rows = [
    note('One.md', link('Templates/Ash Drake.forgetemplate'), { 'atlas-template': 'atlas-a' }),
    note('Two.md', link('Templates/Ash Drake.forgetemplate', 'ash-drake-abc123', 'atlas-a'), { 'atlas-template': 'atlas-a' }),
    note('Three.md', link('Templates/Moved.forgetemplate'), { 'atlas-template': 'atlas-b' }),
    { path: 'Four.md', frontmatter: { 'atlas-template': 'atlas-a' } },
  ];
  assert.equal(countForgeTemplateBacklinks(rows, { kind: 'forge', path: 'Templates/Ash Drake.forgetemplate', templateId: 'ash-drake-abc123' }), 2);
  assert.equal(countForgeTemplateBacklinks(rows, { kind: 'atlas', path: 'Templates/Ash Drake.atlastemplate', templateId: 'atlas-a' }), 3);
});

test('maintenance serializes startup and template-tree scans and stops future work', async () => {
  let ready;
  let changed;
  let stopCalled = false;
  let scans = 0;
  const host = {
    async listTemplates() { scans += 1; return []; },
    async listStatblockNotes() { return []; },
    async updateNoteLink() { return false; },
    onTemplateTreeChanged(callback) { changed = callback; return () => { stopCalled = true; }; },
    onReady(callback) { ready = callback; },
  };
  const maintenance = new ForgeTemplateLinkMaintenance(host);
  maintenance.start();
  ready();
  changed();
  await maintenance.flush();
  assert.equal(scans, 2);
  maintenance.stop();
  assert.equal(stopCalled, true);
  changed();
  await maintenance.flush();
  assert.equal(scans, 2);
});
