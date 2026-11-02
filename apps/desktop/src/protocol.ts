// Messages between the main process and the server's utility process (src/server-entry.ts).
export type FatalKind = 'down' | 'migration' | 'data';

export interface StartMessage {
  type: 'start';
  /** Per-launch secret (256 bits, base64url). Sent as a message, never as an argument or environment variable. */
  secret: string;
  dataDir: string;
  webRoot: string;
  migrationsFolder: string;
  /** 0 = random port; on the automatic restart the previous port is asked again so the window keeps its origin. */
  port: number;
  version: string;
  /** A backup file to apply on a fresh data file before listening (restore after "No se pudo abrir el archivo de datos"). */
  restoreFrom?: string;
}

export type ServerMessage =
  | { type: 'listening'; port: number }
  | { type: 'fatal'; kind: 'data' | 'migration'; message: string; restored?: boolean; restoreFailed?: boolean };

export function isServerMessage(m: unknown): m is ServerMessage {
  if (!m || typeof m !== 'object') return false;
  const x = m as { type?: unknown; port?: unknown; kind?: unknown };
  return (x.type === 'listening' && typeof x.port === 'number') || (x.type === 'fatal' && (x.kind === 'data' || x.kind === 'migration'));
}

export function isStartMessage(m: unknown): m is StartMessage {
  if (!m || typeof m !== 'object') return false;
  const x = m as Partial<StartMessage>;
  return x.type === 'start' && typeof x.secret === 'string' && typeof x.dataDir === 'string' && typeof x.webRoot === 'string'
    && typeof x.migrationsFolder === 'string' && typeof x.port === 'number' && typeof x.version === 'string'
    && (x.restoreFrom === undefined || typeof x.restoreFrom === 'string');
}
