// pnpm start: build the web and serve it from the local server with the data in .data/ → http://127.0.0.1:8787
import { execFileSync, spawn } from 'node:child_process';

execFileSync('pnpm', ['--filter', '@app/web', 'build'], { stdio: 'inherit' });
const child = spawn('pnpm', ['exec', 'tsx', 'scripts/local-server.ts', '--data', '.data', '--web', 'apps/web/dist', ...process.argv.slice(2)], { stdio: 'inherit' });
process.on('SIGINT', () => child.kill('SIGTERM'));
child.on('exit', (c) => { process.exitCode = c ?? 0; });
