// Everything the server receives already built (docs/02 §3, docs/08 › Interfaces que se inyectan).
// What changes between local and cloud is which implementation is passed here, never an `if`.
import type { Ctx, Db } from '@app/db';
import type { Logger } from './logger';

export type Role = 'owner' | 'admin' | 'operator';
export interface Session { userId: string; workspaceId: string; role: Role | string }

export interface AuthProvider {
  resolve(req: Request): Promise<Session | null>;
}

export interface Upload { kind: 'product_photo' | 'customer_logo' | 'print_photo'; mime: string; bytes: Uint8Array; name?: string }
export interface FileRef { key: string }
export interface FileStore {
  put(ctx: Ctx, file: Upload): Promise<FileRef>;
  read(ctx: Ctx, ref: FileRef): Promise<Uint8Array>;
  url(ctx: Ctx, ref: FileRef): Promise<string>;
  delete(ctx: Ctx, ref: FileRef): Promise<void>;
}

export interface Entitlements {
  /** Throws BusinessError('PLAN_LIMIT') when the plan does not allow it. */
  assert(ctx: Ctx, capability: string, delta?: number): Promise<void>;
}

export interface Mailer {
  send(to: string, template: string, data: unknown): Promise<void>;
}

export interface BackupInfo { id: string; on: string; sizeKb: number }
export interface BackupStore {
  list(ctx: Ctx): Promise<BackupInfo[]>;
  create(ctx: Ctx, data: Uint8Array): Promise<BackupInfo>;
  read(ctx: Ctx, id: string): Promise<Uint8Array>;
}

export interface Clock {
  now(): Date;
  /** Calendar date of "today" in the business time zone, YYYY-MM-DD. */
  today(): string;
}

export interface Ids {
  next(): string;
}

export interface Deps {
  db: Db;
  /** Largest backup file that can be imported (docs/15 §4: 100 MB local, 50 MB in the cloud). */
  importLimitMb: number;
  auth: AuthProvider;
  files: FileStore;
  entitlements: Entitlements;
  mailer: Mailer;
  backups: BackupStore;
  clock: Clock;
  ids: Ids;
  logger: Logger;
  /** Diagnostics only; never used to decide a rule (CLAUDE.md rule 7). */
  mode: 'local' | 'cloud';
  version: string;
  /** Allowed origins for writes, e.g. http://127.0.0.1:5173. Same-origin is always allowed. */
  allowedOrigins?: readonly string[];
  /** Send HSTS (only behind HTTPS, in the cloud root). */
  hsts?: boolean;
}
