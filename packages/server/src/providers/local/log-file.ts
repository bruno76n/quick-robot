// Local log files: logs/ next to the data, 7 rotating files of up to 5 MB, readable only by the user (docs/15 §6).
import { appendFileSync, chmodSync, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Sink } from '../../logger';

export function rotatingFileSink(dir: string, opts: { maxBytes?: number; files?: number } = {}): Sink {
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024;
  const files = opts.files ?? 7;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = (i: number) => join(dir, i === 0 ? 'app.log' : `app.${i}.log`);
  return (line) => {
    const current = file(0);
    if (existsSync(current) && statSync(current).size + line.length > maxBytes) {
      rmSync(file(files - 1), { force: true });
      for (let i = files - 2; i >= 0; i--) if (existsSync(file(i))) renameSync(file(i), file(i + 1));
    }
    appendFileSync(current, `${line}\n`, { mode: 0o600 });
    try { chmodSync(current, 0o600); } catch { /* best effort */ }
  };
}
