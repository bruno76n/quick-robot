// pnpm size (docs/15 §2): initial JavaScript of the interface, gzip-compressed, must be ≤ 350 KB.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT_KB = 350;
const dist = 'apps/web/dist';
if (!existsSync('apps/web')) { console.log('size: apps/web does not exist yet'); process.exit(0); }
execFileSync('pnpm', ['--filter', '@app/web', 'build'], { stdio: 'inherit' });
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const initial = [...html.matchAll(/<(?:script[^>]+src|link[^>]+rel="modulepreload"[^>]+href)="\/?([^"]+\.js)"/g)].map((m) => m[1]);
let total = 0;
for (const f of new Set(initial)) {
  const kb = gzipSync(readFileSync(join(dist, f))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${f}`);
}
console.log(`initial JS (gzip): ${total.toFixed(1)} KB / ${LIMIT_KB} KB`);
process.exit(total <= LIMIT_KB ? 0 : 1);
