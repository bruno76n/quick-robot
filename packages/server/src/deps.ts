import type { Ctx, Database } from '@app/db';

/** Who is calling. Local mode: fixed session. Cloud: cookie sessions (phase 5). */
export interface Session extends Ctx {
  readonly role: 'owner' | 'admin' | 'operator';
}

export interface AuthProvider {
  resolve(req: Request): Promise<Session | null>;
}

export interface Upload {
  name: string;
  mime: string;
  bytes: Uint8Array;
}
export interface FileRef {
  key: string;
}
export interface FileStore {
  put(ctx: Ctx, file: Upload): Promise<FileRef>;
  url(ctx: Ctx, ref: FileRef): Promise<string>;
  delete(ctx: Ctx, ref: FileRef): Promise<void>;
}

/** Plan limits. Throws BusinessError('PLAN_LIMIT') when not allowed. Local: always allows. */
export interface Entitlements {
  assert(ctx: Ctx, capability: string, delta?: number): Promise<void>;
}

export interface Mailer {
  send(to: string, template: string, data: unknown): Promise<void>;
}

/** Calendar "today" for the business (YYYY-MM-DD). Injected so use cases never read the clock directly. */
export interface Clock {
  today(): string;
}

export interface AppDeps {
  database: Database;
  auth: AuthProvider;
  files: FileStore;
  entitlements: Entitlements;
  mailer: Mailer;
  clock: Clock;
  /** Diagnostics only — never used to decide rules (docs/02 §7.6). */
  mode: 'local' | 'cloud';
  /** Folder with the built web app to serve (local mode). */
  webDist?: string;
}
