import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { listBackups, moveDataAside } from '../src/data-folder';

describe('data folder (fatal screens)', () => {
  it('lists the automatic copies newest first, at most 7, ignoring copies before an update and other files', async () => {
    const d = mkdtempSync(join(tmpdir(), 'desk-'));
    const ws = join(d, 'backups', '00000000-0000-7000-8000-000000000001');
    mkdirSync(ws, { recursive: true });
    mkdirSync(join(d, 'backups', 'before-update-2026-11-01'), { recursive: true });
    for (let i = 1; i <= 9; i++) writeFileSync(join(ws, `backup-2026-10-0${i}.json`), 'x'.repeat(1500));
    writeFileSync(join(ws, 'notes.txt'), 'x');
    const list = await listBackups(d);
    expect(list.map((b) => b.id)).toEqual(['2026-10-09', '2026-10-08', '2026-10-07', '2026-10-06', '2026-10-05', '2026-10-04', '2026-10-03']);
    expect(list[0]).toMatchObject({ on: '2026-10-09', sizeKb: 2, path: join(ws, 'backup-2026-10-09.json') });
    expect(await listBackups(join(d, 'missing'))).toEqual([]);
  });

  it('moves an unreadable data file aside instead of deleting it', async () => {
    const d = mkdtempSync(join(tmpdir(), 'desk-'));
    mkdirSync(join(d, 'pgdata'));
    writeFileSync(join(d, 'pgdata', 'PG_VERSION'), '17');
    const moved = await moveDataAside(d, 'unreadable', new Date('2026-11-02T10:00:00.000Z'));
    expect(moved).toBe(join(d, 'pgdata-unreadable-2026-11-02T10-00-00-000Z'));
    expect(existsSync(join(moved!, 'PG_VERSION'))).toBe(true);
    expect(existsSync(join(d, 'pgdata'))).toBe(false);
    expect(await moveDataAside(d, 'unreadable', new Date())).toBeNull();
  });
});
