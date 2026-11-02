import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

/** Starts the local runner (PGlite on disk + built web) and resolves when it listens. */
export function startLocalServer(o: { dataDir: string; port: number; seed?: 'quick-robot' | 'none' }): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'packages/server/dev/local.ts'], {
      cwd: root,
      env: { ...process.env, DATA_DIR: o.dataDir, PORT: String(o.port), SEED: o.seed ?? 'quick-robot' },
    });
    const timer = setTimeout(() => reject(new Error('local server did not start')), 60_000);
    child.stdout.on('data', (d: Buffer) => {
      if (d.toString().includes('API on')) {
        clearTimeout(timer);
        resolve(child);
      }
    });
    child.stderr.on('data', (d: Buffer) => process.stderr.write(d));
    child.on('exit', (code) => code && reject(new Error(`local server exited ${code}`)));
  });
}

export function stopLocalServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });
}
