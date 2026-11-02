// Starts the local server (same composition as `pnpm start`) on a free port with a data folder.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => { const p = (s.address() as { port: number }).port; s.close(() => resolve(p)); });
  });
}

export interface LocalServer { url: string; dataDir: string; stop(): Promise<void> }

export async function startServer(opts: { dataDir?: string; seed?: boolean } = {}): Promise<LocalServer> {
  const dataDir = opts.dataDir ?? mkdtempSync(join(tmpdir(), 'e2e-data-'));
  const port = await freePort();
  const child: ChildProcess = spawn('pnpm', ['exec', 'tsx', 'scripts/local-server.ts', '--data', dataDir, '--port', String(port), '--web', 'apps/web/dist', ...(opts.seed === false ? [] : ['--seed'])], { stdio: ['ignore', 'pipe', 'inherit'] });
  const url = `http://127.0.0.1:${port}`;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not start')), 60_000);
    child.stdout!.on('data', (d: Buffer) => { if (d.toString().includes('"listening"')) { clearTimeout(timer); resolve(); } });
    child.on('exit', (c) => reject(new Error(`server exited ${c}`)));
  });
  return {
    url, dataDir,
    stop: () => new Promise<void>((resolve) => { child.once('exit', () => resolve()); child.kill('SIGTERM'); }),
  };
}
