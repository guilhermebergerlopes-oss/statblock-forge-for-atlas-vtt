import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const options = {
  entryPoints: ['main.ts'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  outfile: 'main.js',
  sourcemap: watch ? 'inline' : false,
  logLevel: 'info',
};

if (watch) {
  const context = await esbuild.context(options);
  await context.watch();
  console.info('Statblock Forge: watching for changes.');
} else {
  await esbuild.build(options);
}
