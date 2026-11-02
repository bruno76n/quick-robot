import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { formatEntry, type Logger } from '../../logging';

/** Local log file that rotates by size (app.log → app.1.log → app.2.log), for diagnosing problems on the Mac. */
export function createFileLogger(dir: string, o: { maxBytes?: number; keep?: number } = {}): Logger {
  const maxBytes = o.maxBytes ?? 5 * 1024 * 1024;
  const keep = o.keep ?? 3;
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, 'app.log');
  const rotate = () => {
    rmSync(join(dir, `app.${keep}.log`), { force: true });
    for (let i = keep - 1; i >= 1; i--) if (existsSync(join(dir, `app.${i}.log`))) renameSync(join(dir, `app.${i}.log`), join(dir, `app.${i + 1}.log`));
    renameSync(file, join(dir, 'app.1.log'));
  };
  return {
    log(entry) {
      try {
        if (existsSync(file) && statSync(file).size > maxBytes) rotate();
        appendFileSync(file, formatEntry(entry) + '\n', { mode: 0o600 });
      } catch {
        // Logging must never break a request.
      }
    },
  };
}
