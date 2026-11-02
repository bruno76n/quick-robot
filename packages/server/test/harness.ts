// Test harness: real app + PGlite copy, two workspaces with their own tokens, fixed clock (docs/14 §2–3).
import { ensureWorkspace, type Ctx, type Db } from '@app/db';
import { openTestDb } from '@app/db/testing';
import { createApp } from '../src/app';
import { fixedClock, uuidV7Ids } from '../src/clock';
import type { AuthProvider, Deps, Session } from '../src/deps';
import { memoryLogger } from '../src/logger';
import { memoryBackupStore } from '../src/providers/local/backups';
import { unlimitedEntitlements } from '../src/providers/local/entitlements';
import { memoryFileStore } from '../src/providers/local/files';
import { nullMailer } from '../src/providers/local/mailer';
import { ensureWorkspaceDefaults } from '../src/usecases/settings';

export const A_TOKEN = 'token-a';
export const B_TOKEN = 'token-b';

let n = 0;
const wsId = (tag: string) => `0190aaaa-0000-7000-8${tag}-${(++n).toString(16).padStart(12, '0')}`;

export function tokenAuth(sessions: Record<string, Session>): AuthProvider {
  return { resolve: async (req) => sessions[(req.headers.get('authorization') ?? '').replace(/^Bearer /, '')] ?? null };
}

export async function makeHarness(over: Partial<Deps> = {}, given?: Awaited<ReturnType<typeof openTestDb>>) {
  const conn = given ?? await openTestDb();
  const A: Ctx = { workspaceId: wsId('00a'), userId: wsId('00a') };
  const B: Ctx = { workspaceId: wsId('00b'), userId: wsId('00b') };
  await ensureWorkspace(conn.db, A, { name: 'Negocio A', email: 'a@example.test', userName: 'A' });
  await ensureWorkspace(conn.db, B, { name: 'Negocio B', email: 'b@example.test', userName: 'B' });
  const logger = memoryLogger();
  const clock = fixedClock();
  const sessions: Record<string, Session> = {
    [A_TOKEN]: { ...A, role: 'owner' }, [B_TOKEN]: { ...B, role: 'owner' },
    'token-operator': { ...A, role: 'operator' }, 'token-nobody': { ...A, role: 'stranger' },
  };
  const deps: Deps = {
    db: conn.db, auth: tokenAuth(sessions), files: memoryFileStore(), entitlements: unlimitedEntitlements, mailer: nullMailer,
    backups: memoryBackupStore(clock), clock, ids: uuidV7Ids, logger, mode: 'local', version: 'test', importLimitMb: 100, ...over,
  };
  await ensureWorkspaceDefaults(deps, A);
  await ensureWorkspaceDefaults(deps, B);
  const app = createApp(deps);
  const call = async (method: string, path: string, opts: { token?: string | null; body?: unknown; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...(opts.token === null ? {} : { authorization: `Bearer ${opts.token ?? A_TOKEN}` }), ...opts.headers };
    let reqBody: string | undefined;
    if (opts.body !== undefined) { headers['content-type'] ??= 'application/json'; reqBody = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body); }
    const res = await app.request(`http://127.0.0.1${path}`, { method, headers, ...(reqBody !== undefined ? { body: reqBody } : {}) });
    const text = await res.text();
    let json: unknown;
    try { json = text ? JSON.parse(text) : undefined; } catch { json = text; }
    return { status: res.status, headers: res.headers, json: json as { data?: unknown; code?: string; details?: Record<string, unknown>; errorId?: string; message?: string; warnings?: unknown[] } };
  };
  return { conn, db: conn.db, deps, app, call, A, B, logger, close: () => conn.close() };
}
export type Harness = Awaited<ReturnType<typeof makeHarness>>;

/**
 * Make the Nth write (insert/update/delete) inside a transaction throw, to prove a use case leaves nothing
 * half-written (docs/11 A10). Returns a db that behaves like the original otherwise.
 */
export function failOnWrite(db: Db, n: number): Db {
  let count = 0;
  const wrapTx = (tx: object): object => new Proxy(tx, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if ((prop === 'insert' || prop === 'update' || prop === 'delete') && typeof v === 'function') {
        return (...args: unknown[]) => {
          count += 1;
          if (count === n) throw new Error(`injected failure on write #${n}`);
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        };
      }
      if (prop === 'transaction' && typeof v === 'function') {
        return (fn: (t: object) => Promise<unknown>) => (v as (f: (t: object) => Promise<unknown>) => Promise<unknown>).call(target, (t: object) => fn(wrapTx(t)));
      }
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return wrapTx(db) as Db;
}

export const validSpool = (over: Record<string, unknown> = {}) => ({
  filament: { material: 'PLA', color: 'Blanco' }, brand: 'Bambu', costCents: 45000, shippingCents: 5000, grams: 1000, purchasedOn: '2026-11-01', ...over,
});
