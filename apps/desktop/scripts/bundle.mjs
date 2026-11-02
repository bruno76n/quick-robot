// Bundles main, preload and the server entry with esbuild into dist/app, and copies the migrations next to them
// (dist/migrations, the folder @app/db resolves as "../migrations" from the bundle). Usage: node scripts/bundle.mjs [--release]
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const release = process.argv.includes('--release');
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'app'), { recursive: true });

const common = {
  bundle: true, platform: 'node', target: 'node22', sourcemap: false, legalComments: 'none', logLevel: 'warning',
  define: { __TEST_HOOKS__: release ? 'false' : 'true' },
  // PGlite ships wasm and data files next to its code: it stays a real dependency in node_modules.
  external: ['electron', '@electric-sql/pglite', '@electric-sql/pglite/*'],
};
// ESM bundles with CommonJS dependencies inside need a require().
const banner = { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" };
await build({ ...common, entryPoints: [join(root, 'src/main.ts')], outfile: join(out, 'app/main.mjs'), format: 'esm', banner });
await build({ ...common, entryPoints: [join(root, 'src/server-entry.ts')], outfile: join(out, 'app/server-entry.mjs'), format: 'esm', banner });
await build({ ...common, entryPoints: [join(root, 'src/preload.ts')], outfile: join(out, 'app/preload.cjs'), format: 'cjs' });
cpSync(join(root, '../../packages/db/migrations'), join(out, 'migrations'), { recursive: true });
process.stdout.write(`bundled ${release ? 'release' : 'test hooks on'} → ${out}\n`);
