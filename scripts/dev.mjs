// pnpm dev: local server (PGlite in memory + development seed) and the web with Vite → http://127.0.0.1:5173
// pnpm dev -- --file: same, with the data in .data/ (survives restarts). WEB_PORT and API_PORT change the ports.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';

const file = process.argv.includes('--file');
const secret = randomBytes(32).toString('base64url');
const webPort = process.env.WEB_PORT ?? '5173';
const apiPort = process.env.API_PORT ?? '8787';
const env = { ...process.env, APP_SECRET: secret, WEB_ORIGIN: `http://127.0.0.1:${webPort}`, WEB_PORT: webPort };
const run = (cmd, args, extra = {}) => spawn(cmd, args, { stdio: 'inherit', env: { ...env, ...extra } });
const api = run('pnpm', ['exec', 'tsx', 'scripts/local-server.ts', '--seed', '--port', apiPort, ...(file ? ['--data', '.data'] : [])]);
// The web starts only once the API listens (after migrations and the seed): before, the proxy would answer 500 and
// the first screen would load without its data (ronda 4 · D).
const listening = () => new Promise((ok) => { const s = connect(Number(apiPort), '127.0.0.1'); s.once('connect', () => { s.end(); ok(true); }); s.once('error', () => ok(false)); });
let web = null;
const stop = () => { api.kill('SIGTERM'); web?.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
let apiExited = false;
api.on('exit', () => { apiExited = true; });
for (let i = 0; i < 600 && !apiExited && !(await listening()); i++) await new Promise((ok) => setTimeout(ok, 100));
if (!apiExited) web = run('pnpm', ['--filter', '@app/web', 'dev'], { API_URL: `http://127.0.0.1:${apiPort}` });
api.on('exit', (c) => { web?.kill('SIGTERM'); process.exitCode = c ?? 0; });
