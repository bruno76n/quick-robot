// pnpm desktop:dev — builds the web, bundles the shell and opens Electron on it (test hooks on, DevTools in the menu).
import { execFileSync, spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.DESKTOP_SKIP_WEB !== '1') execFileSync('pnpm', ['--filter', '@app/web', 'exec', 'vite', 'build'], { stdio: 'inherit', cwd: root });
execFileSync('node', [join(root, 'scripts/bundle.mjs')], { stdio: 'inherit' });
const electron = join(root, 'node_modules/.bin/electron');
const child = spawn(electron, [root, ...process.argv.slice(2)], { stdio: 'inherit', cwd: root });
child.on('exit', (code) => process.exit(code ?? 0));
