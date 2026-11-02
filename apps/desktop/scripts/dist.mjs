// pnpm desktop:dist (mac .dmg, release build: no test hooks) · pnpm desktop:dist:linux (unpacked dir, test hooks on).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2];
if (target === 'mac' && process.platform !== 'darwin') {
  process.stderr.write(`desktop:dist builds the macOS .dmg and must run on a Mac (this is ${process.platform}). Use desktop:dist:linux to test here.\n`);
  process.exit(1);
}
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', cwd: root });
if (process.env.DESKTOP_SKIP_WEB !== '1') run('pnpm', ['--filter', '@app/web', 'exec', 'vite', 'build']);
run('node', [join(root, 'scripts/bundle.mjs'), ...(target === 'mac' ? ['--release'] : [])]);
const builder = join(root, 'node_modules/.bin/electron-builder');
run(builder, target === 'mac' ? ['--mac', 'dmg', '--publish', 'never'] : ['--linux', 'dir', '--publish', 'never']);
