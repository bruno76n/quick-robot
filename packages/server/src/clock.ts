import { uuidv7 } from 'uuidv7';
import type { Clock, Ids } from './deps';

export function systemClock(timeZone = 'America/Mexico_City'): Clock {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
  return { now: () => new Date(), today: () => fmt.format(new Date()) };
}

/** Fixed clock for tests: today is 2026-11-01 (docs/14 §2 rule 4). */
export function fixedClock(iso = '2026-11-01T18:00:00Z', today = '2026-11-01'): Clock {
  return { now: () => new Date(iso), today: () => today };
}

export const uuidV7Ids: Ids = { next: () => uuidv7() };
