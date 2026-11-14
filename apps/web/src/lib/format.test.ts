// The examples of docs/13 §2.1.
import { describe, expect, it } from 'vitest';
import { centsTotal, date, folio, grams, hours, money, money3d, moneyTotal, overdue, pct, queueDuration, relativeDay } from './format';

describe('formats (docs/13 §2.1)', () => {
  it('money', () => {
    expect(moneyTotal(1250)).toBe('$1,250');
    expect(centsTotal(125000)).toBe('$1,250');
    expect(money(35.95)).toBe('$35.95');
    expect(money(35)).toBe('$35');
    expect(money3d(0.25)).toBe('$0.250');
    expect(money3d(0.276667)).toBe('$0.277');
  });
  it('grams, hours, percent', () => {
    expect(grams(1234.5)).toBe('1,234.5 g');
    expect(grams(1000)).toBe('1,000 g');
    expect(hours(2)).toBe('2 h');
    expect(hours(7.25)).toBe('7 h 15 min');
    expect(pct(14.6)).toBe('14.6%');
  });
  it('dates', () => {
    expect(date('2026-10-31')).toBe('31 oct');
    expect(relativeDay('2026-11-01', '2026-11-01')).toBe('hoy');
    expect(relativeDay('2026-11-02', '2026-11-01')).toBe('mañana');
    expect(relativeDay('2026-11-04', '2026-11-01')).toBe('en 3 días');
    expect(relativeDay('2026-10-29', '2026-11-01')).toBe('hace 3 d');
    expect(overdue('2026-10-29', '2026-11-01')).toBe('Retrasado 3 d');
  });
  it('queue durations and folio', () => {
    expect(queueDuration(0.5)).toBe('ya');
    expect(queueDuration(45)).toBe('45 min');
    expect(queueDuration(150)).toBe('2 h 30 min');
    expect(queueDuration(76 * 60)).toBe('3 d 4 h');
    expect(folio(12)).toBe('#12');
  });
});
