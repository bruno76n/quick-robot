// Structured logging (docs/11 · A09): JSON lines with requestId, workspaceId, operation and duration.
// Sensitive values are redacted before anything is written.

export type LogLevel = 'info' | 'warn' | 'error';
export interface LogEntry {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}
export interface Logger {
  log(entry: LogEntry): void;
}

const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|api[-_]?key|x-app-secret|session/i;
export const REDACTED = '[redacted]';

/** Deep copy with sensitive keys replaced and long strings cut. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = SENSITIVE_KEY.test(k) ? REDACTED : redact(v, depth + 1);
    return out;
  }
  return value;
}

export function formatEntry(entry: LogEntry, now = new Date()): string {
  return JSON.stringify({ time: now.toISOString(), ...(redact(entry) as LogEntry) });
}

/** Writes to stdout/stderr. */
export const consoleLogger: Logger = {
  log(entry) {
    const line = formatEntry(entry);
    if (entry.level === 'error') console.error(line);
    else console.log(line);
  },
};

/** Keeps entries in memory (tests). */
export function memoryLogger(): Logger & { lines: string[]; entries: () => LogEntry[] } {
  const lines: string[] = [];
  return { lines, log: (e) => void lines.push(formatEntry(e)), entries: () => lines.map((l) => JSON.parse(l) as LogEntry) };
}

export const teeLogger = (...loggers: Logger[]): Logger => ({ log: (e) => loggers.forEach((l) => l.log(e)) });
