// Structured log with automatic redaction (docs/11 A09, docs/15 §6).
// Never: passwords, tokens, secrets, cookies, authorization headers or the content of notes.

export type Level = 'debug' | 'info' | 'warn' | 'error';
export interface LogRecord { level: Level; msg: string; at: string; [k: string]: unknown }
export type Sink = (line: string) => void;

export interface Logger {
  log(level: Level, msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
}

const SENSITIVE = /pass(word)?|secret|token|authorization|cookie|session|^note$|notes?$|api[-_]?key|credential/i;
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g;
const MAX_DEPTH = 5;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[depth]';
  if (typeof value === 'string') return value.replace(BEARER, '$1 [redacted]').slice(0, 2000);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value instanceof Error) return { name: value.name, message: redact(value.message, depth + 1), stack: value.stack?.split('\n').slice(0, 8).join('\n') };
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1);
    return out;
  }
  return value;
}

export function createLogger(sink: Sink, opts: { now?: () => Date; minLevel?: Level } = {}): Logger {
  const order: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
  const min = order[opts.minLevel ?? 'info'];
  const now = opts.now ?? (() => new Date());
  const log = (level: Level, msg: string, fields: Record<string, unknown> = {}) => {
    if (order[level] < min) return;
    const rec = { level, msg, at: now().toISOString(), ...(redact(fields) as Record<string, unknown>) };
    try { sink(JSON.stringify(rec)); } catch { /* logging never breaks a request */ }
  };
  return { log, info: (m, f) => log('info', m, f), warn: (m, f) => log('warn', m, f), error: (m, f) => log('error', m, f) };
}

/** A logger that keeps records in memory (tests). */
export function memoryLogger(): Logger & { lines: string[]; records: () => LogRecord[] } {
  const lines: string[] = [];
  const l = createLogger((s) => lines.push(s), { minLevel: 'debug' });
  return Object.assign(l, { lines, records: () => lines.map((s) => JSON.parse(s) as LogRecord) });
}

export const stdoutSink: Sink = (line) => process.stdout.write(`${line}\n`);
