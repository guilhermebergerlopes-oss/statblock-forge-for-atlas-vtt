import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createForgeStatblockTemplateLink,
  forgeStatblockTemplateLinkFromFrontmatter,
} from '../src/statblocks/forgeTemplateLink.ts';

const TEMPLATE_ID = 'creature-abc123';

test('Forge writes the v2 native-link contract consumed by Atlas', () => {
  const link = createForgeStatblockTemplateLink({
    templatePath: 'Bestiary\\Templates//creature.forgetemplate',
    templateId: TEMPLATE_ID,
  });

  assert.deepEqual(link, {
    format: 'statblock-forge-template-link',
    version: 2,
    templatePath: 'Bestiary/Templates/creature.forgetemplate',
    templateId: TEMPLATE_ID,
  });
  assert.deepEqual(
    forgeStatblockTemplateLinkFromFrontmatter({ 'statblock-forge': link }),
    link,
  );
});

test('Forge does not emit a native v2 link for an Atlas-published v1 note', () => {
  const link = createForgeStatblockTemplateLink({
    templatePath: 'Bestiary/Templates/creature.forgetemplate',
    templateId: TEMPLATE_ID,
    atlasTemplateId: 'atlas-creature-123456',
  });

  assert.equal(link.version, 1);
  assert.equal(link.atlasTemplateId, 'atlas-creature-123456');
  assert.deepEqual(
    forgeStatblockTemplateLinkFromFrontmatter({ 'statblock-forge': link }),
    link,
  );
});

test('Forge rejects a link without a vault-relative .forgetemplate path or stable ID', () => {
  assert.throws(() => createForgeStatblockTemplateLink({
    templatePath: '../Templates/creature.forgetemplate',
    templateId: TEMPLATE_ID,
  }));
  assert.throws(() => createForgeStatblockTemplateLink({
    templatePath: 'Templates/creature.forgetemplate',
    templateId: '   ',
  }));
});
