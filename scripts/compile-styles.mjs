import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'sass';

const stylesheetPath = 'styles.css';
const generatedStyles = [
  {
    sourcePath: 'src/styles/border-presets.scss',
    beginMarker: '/* BEGIN GENERATED FORGE BORDER PRESETS */',
    endMarker: '/* END GENERATED FORGE BORDER PRESETS */',
  },
  {
    sourcePath: 'src/styles/selection.scss',
    beginMarker: '/* BEGIN GENERATED FORGE SELECTION STYLES */',
    endMarker: '/* END GENERATED FORGE SELECTION STYLES */',
  },
  {
    sourcePath: 'src/styles/table-formulas.scss',
    beginMarker: '/* BEGIN GENERATED FORGE TABLE FORMULA STYLES */',
    endMarker: '/* END GENERATED FORGE TABLE FORMULA STYLES */',
  },
  {
    sourcePath: 'src/styles/dm-screen.scss',
    beginMarker: '/* BEGIN GENERATED FORGE DM SCREEN STYLES */',
    endMarker: '/* END GENERATED FORGE DM SCREEN STYLES */',
  },
  {
    sourcePath: 'src/styles/atlas-statblock-link.scss',
    beginMarker: '/* BEGIN GENERATED FORGE ATLAS STATBLOCK LINK STYLES */',
    endMarker: '/* END GENERATED FORGE ATLAS STATBLOCK LINK STYLES */',
  },
];

let stylesheet = await readFile(stylesheetPath, 'utf8');

for (const { sourcePath, beginMarker, endMarker } of generatedStyles) {
  const compiled = compile(sourcePath, { style: 'expanded' }).css.trim();
  const begin = stylesheet.indexOf(beginMarker);
  const end = stylesheet.indexOf(endMarker);

  if ((begin === -1) !== (end === -1)) {
    throw new Error(`Invalid generated style markers for ${sourcePath}.`);
  }
  if (begin !== -1 && end < begin) {
    throw new Error(`Generated style markers are out of order for ${sourcePath}.`);
  }

  const generatedBlock = `${beginMarker}\n/* Generated from ${sourcePath}. Do not edit this block directly. */\n${compiled}\n${endMarker}`;
  if (begin === -1) {
    stylesheet = `${stylesheet.trimEnd()}\n\n${generatedBlock}\n`;
  } else {
    const afterEnd = end + endMarker.length;
    stylesheet = `${stylesheet.slice(0, begin)}${generatedBlock}${stylesheet.slice(afterEnd)}`;
  }
}

await writeFile(stylesheetPath, stylesheet, 'utf8');
console.info(`Compiled ${generatedStyles.map(({ sourcePath }) => sourcePath).join(' and ')} into ${stylesheetPath}.`);
