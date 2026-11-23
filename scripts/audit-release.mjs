import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEGACY_RUNTIME_MARKERS = [
  /forked-atlas-vtt-compatibility-for-statblock-forge/i,
  /LEGACY_ATLAS_FORK_PLUGIN_ID/,
  /getForgeAtlasPublicAPI/,
  /registerForgeAtlasSheetProvider/,
  /sheets\.registerProvider/,
  /provider-registration-requested/,
  /atlasSheetProvider/i,
  /dice\.statblock-(?:rolls|history)/,
  /rollStatblock\s*\(/,
  /rollingDiceForStatblock/,
  /getStatblockRollHistory/,
  /repeatStatblockRoll/,
];

function walkFiles(directory, predicate) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walkFiles(absolute, predicate));
    else if (entry.isFile() && predicate(absolute)) result.push(absolute);
  }
  return result;
}

function resolveRelativeImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.css'].map((extension) => `${base}${extension}`),
    ...['index.ts', 'index.tsx', 'index.js', 'index.mjs'].map((name) => path.join(base, name)),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/** Run deterministic release-readiness checks without external dependencies. */
export function auditForgeRelease(root = ROOT) {
  const errors = [];
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

  if (packageJson.name !== 'statblock-forge') errors.push(`Unexpected package name: ${packageJson.name}`);
  if (manifest.id !== 'statblock-forge') errors.push(`Unexpected manifest ID: ${manifest.id}`);
  if (packageJson.version !== '0.5.6' || manifest.version !== '0.5.6' || lock.version !== '0.5.6'
    || lock.packages?.['']?.version !== '0.5.6') {
    errors.push('package.json, manifest.json, and package-lock.json must all be at version 0.5.6.');
  }

  const productionFiles = [
    path.join(root, 'main.ts'),
    ...walkFiles(path.join(root, 'src'), (file) => /\.(?:ts|tsx|js|mjs)$/.test(file)),
  ];
  const legacyMatches = [];
  for (const file of productionFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const marker of LEGACY_RUNTIME_MARKERS) {
      if (marker.test(source)) legacyMatches.push(`${path.relative(root, file)}: ${marker}`);
    }
  }
  if (legacyMatches.length) errors.push(`Legacy fork integration markers found in production source:\n${legacyMatches.join('\n')}`);

  const dependencyNames = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(lock.packages ?? {}).filter((entry) => entry.startsWith('node_modules/')).map((entry) => entry.slice('node_modules/'.length)),
  ];
  const forkDependencies = dependencyNames.filter((name) => /forked.?atlas|atlas.?compatibility.?fork/i.test(name));
  if (forkDependencies.length) errors.push(`Compatibility fork dependencies found: ${forkDependencies.join(', ')}`);

  const sourceFiles = [path.join(root, 'main.ts'), ...walkFiles(path.join(root, 'src'), (file) => /\.(?:ts|tsx|js|mjs)$/.test(file))];
  const missingImports = [];
  let relativeImportCount = 0;
  const importPattern = /(?:\bfrom\s*|\bimport\s*\()\s*['"](\.[^'"]+)['"]/g;
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = importPattern.exec(source)) !== null) {
      relativeImportCount += 1;
      if (!resolveRelativeImport(file, match[1])) missingImports.push(`${path.relative(root, file)} -> ${match[1]}`);
    }
  }
  if (missingImports.length) errors.push(`Unresolved relative imports:\n${missingImports.join('\n')}`);

  const main = fs.readFileSync(path.join(root, 'main.ts'), 'utf8');
  const requiredWiring = [
    ['Atlas Ctrl-hover preview bridge', /startForgeAtlasPreviewBridge\(this\.app, this\)/],
    ['Atlas Resource synchronization', /new AtlasForgeResourceTokenSync\(this\.app\)/],
    ['Template link maintenance', /new ForgeTemplateLinkMaintenance\(/],
  ];
  for (const [label, pattern] of requiredWiring) {
    if (!pattern.test(main)) errors.push(`Missing startup wiring: ${label}`);
  }

  const runtime = fs.readFileSync(path.join(root, 'src/atlas/atlasRuntime.ts'), 'utf8');
  if (!/ATLAS_PLUGIN_ID\s*=\s*'atlas-vtt'/.test(runtime)) errors.push('Runtime does not identify the original Atlas plugin ID.');
  const versionAdapter = fs.readFileSync(path.join(root, 'src/atlas/atlasVersionAdapter.ts'), 'utf8');
  if (!/ATLAS_VERIFIED_SNAPSHOT\s*=\s*'0\.18\.0'/.test(versionAdapter)
    || !/atlas-0\.17\.0-internal-runtime/.test(versionAdapter)
    || !/atlas-0\.18\.0-internal-runtime/.test(versionAdapter)) {
    errors.push('Verified Atlas runtime profiles must include exact versions 0.17.0 and 0.18.0, with 0.18.0 as the latest snapshot.');
  }

  const previewBridge = fs.readFileSync(path.join(root, 'src/atlas/forgeAtlasPreviewBridge.ts'), 'utf8');
  if (!/plugin\.register\(cleanup\)/.test(previewBridge) || !/app\.workspace\.offref\(ref\)/.test(previewBridge)) {
    errors.push('Atlas preview bridge does not register lifecycle cleanup for its patches and workspace listeners.');
  }

  const buildConfig = fs.readFileSync(path.join(root, 'esbuild.config.mjs'), 'utf8');
  if (!/entryPoints:\s*\['main\.ts'\]/.test(buildConfig) || !/outfile:\s*'main\.js'/.test(buildConfig) || !/external:\s*\['obsidian'\]/.test(buildConfig)) {
    errors.push('esbuild configuration does not bundle main.ts to main.js with Obsidian externalized.');
  }
  if (!fs.existsSync(path.join(root, 'styles.css')) || !fs.existsSync(path.join(root, 'src/styles/border-presets.scss'))) {
    errors.push('Required stylesheet source or output is missing.');
  }
  if (manifest.isDesktopOnly !== true || !manifest.minAppVersion) errors.push('Manifest platform/minAppVersion metadata is incomplete.');

  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  if (!/separate compatibility-fork plugin is not required/i.test(readme)) errors.push('README does not state that the compatibility fork is unnecessary.');
  if (!/original Atlas VTT 0\.17\.0 and newer versions/i.test(readme)
    || !/exact 0\.17\.0 and 0\.18\.0 source snapshots are inspected baselines/i.test(readme)) {
    errors.push('README must identify the inspected Atlas baselines and state that newer versions are attempted.');
  }
  if (!/forward-compatible-version/.test(versionAdapter)
    || !/ATLAS_RUNTIME_MINIMUM_VERSION\s*=\s*'0\.17\.0'/.test(versionAdapter)) {
    errors.push('Atlas runtime adapter must keep the forward-compatible capability mode and minimum runtime version.');
  }

  return {
    ok: errors.length === 0,
    pluginId: manifest.id,
    version: manifest.version,
    productionFiles: productionFiles.length,
    relativeImports: relativeImportCount,
    forkDependencies: forkDependencies.length,
    legacyRuntimeMatches: legacyMatches.length,
    missingImports: missingImports.length,
    lifecycleCleanupRegistered: /plugin\.register\(cleanup\)/.test(previewBridge),
    buildEntryPoint: /entryPoints:\s*\['main\.ts'\]/.test(buildConfig),
    errors,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditForgeRelease();
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}
