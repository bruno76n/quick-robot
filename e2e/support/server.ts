// Starts the local server (same composition as `pnpm start`) on a free port with a data folder.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => resolve(p)); });
  });
}

export interface LocalServer { url: string; dataDir: string; stop(o?: { keepData?: boolean }): Promise<void> }

// `cleanup` (default: only when this helper created the folder) removes the data folder on stop.
export async function startServer(opts: { dataDir?: string; seed?: boolean; cleanup?: boolean } = {}): Promise<LocalServer> {
  const cleanup = opts.cleanup ?? !opts.dataDir;
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), 'e2e-data-'));
  const port = await freePort();
  const child: ChildProcess = spawn('pnpm', ['exec', 'tsx', 'scripts/local-server.ts', '--data', dataDir, '--port', String(port), '--web', process.env.E2E_WEB_DIST ?? 'apps/web/dist', ...(opts.seed === false ? [] : ['--seed'])], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, E2E_FIXED_CLOCK: '1' } });
  const url = `http://127.0.0.1:${port}`;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 60_000);
    child.stdout!.on('data', (d: Buffer) => { if (d.toString().includes('"listening"')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  return {
    url, dataDir,
    // The data folder is removed on stop unless kept for a restart (each run used to leave ~40 MB behind in the temp folder).
    stop: (o = {}) => new Promise<void>((resolve) => {
      child.once('exit', () => { if (cleanup && !o.keepData) rmSync(dataDir, { recursive: true, force: true }); resolve(); });
      child.kill('SIGTERM');
    }),
  };
}
