// pnpm dev: local server (PGlite in memory + development seed) and the web with Vite → http://127.0.0.1:5173
// pnpm dev -- --file: same, with the data in .data/ (survives restarts). WEB_PORT and API_PORT change the ports.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const file = process.argv.includes('--file');
const secret = randomBytes(32).toString('base64url');
const webPort = process.env.WEB_PORT ?? '5173';
const apiPort = process.env.API_PORT ?? '8787';
const env = { ...process.env, APP_SECRET: secret, WEB_ORIGIN: `http://127.0.0.1:${webPort}`, WEB_PORT: webPort };
const run = (cmd, args, extra = {}) => spawn(cmd, args, { stdio: 'inherit', env: { ...env, ...extra } });
const api = run('pnpm', ['exec', 'tsx', 'scripts/local-server.ts', '--seed', '--port', apiPort, ...(file ? ['--data', '.data'] : [])]);
const web = run('pnpm', ['--filter', '@app/web', 'dev'], { API_URL: `http://127.0.0.1:${apiPort}` });
const stop = () => { api.kill('SIGTERM'); web.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
api.on('exit', (c) => { web.kill('SIGTERM'); process.exitCode = c ?? 0; });
