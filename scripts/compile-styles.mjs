import { readFile, writeFile } from 'node:fs/promises';
import { compile } from 'sass';

const stylesheetPath = 'styles.css';
const scssPath = 'src/styles/border-presets.scss';
const beginMarker = '/* BEGIN GENERATED FORGE BORDER PRESETS */';
const endMarker = '/* END GENERATED FORGE BORDER PRESETS */';

const currentStylesheet = await readFile(stylesheetPath, 'utf8');
const compiled = compile(scssPath, { style: 'expanded' }).css.trim();
const begin = currentStylesheet.indexOf(beginMarker);
const end = currentStylesheet.indexOf(endMarker);

if ((begin === -1) !== (end === -1)) {
  throw new Error('Invalid generated border preset markers in styles.css.');
}
if (begin !== -1 && end < begin) {
  throw new Error('Generated border preset markers are out of order in styles.css.');
}

const generatedBlock = `${beginMarker}\n/* Generated from ${scssPath}. Do not edit this block directly. */\n${compiled}\n${endMarker}`;
let nextStylesheet;
if (begin === -1) {
  nextStylesheet = `${currentStylesheet.trimEnd()}\n\n${generatedBlock}\n`;
} else {
  const afterEnd = end + endMarker.length;
  nextStylesheet = `${currentStylesheet.slice(0, begin)}${generatedBlock}${currentStylesheet.slice(afterEnd)}`;
}

await writeFile(stylesheetPath, nextStylesheet, 'utf8');
console.info(`Compiled ${scssPath} into ${stylesheetPath}.`);
