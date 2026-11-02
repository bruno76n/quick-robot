// Reading what the person typed: "1,250", "$35.95" and " 3 " are numbers (same rule as the mockup).
export function parseNumber(v: string | number | null | undefined, fallback = 0): number {
  const x = Number.parseFloat(String(v ?? '').replace(/[,\s$]/g, ''));
  return Number.isFinite(x) ? x : fallback;
}

/** Today in the browser's time zone, YYYY-MM-DD (default for date fields; the server validates). */
export function todayLocal(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
