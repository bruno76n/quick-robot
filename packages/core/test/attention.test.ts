// Home attentions by priority (mejoras/ronda-2.md §5 table): one test per kind and per due-date boundary.
import { describe, expect, it } from 'vitest';
import { classifyAttention } from '../src/attention';

describe('classifyAttention', () => {
  it('accepted order short of filament → urgent', () => expect(classifyAttention('order_filament_short')).toBe('urgent'));
  it.each([
    ['overdue (−3)', -3, 'urgent'],
    ['overdue (−1)', -1, 'urgent'],
    ['today (0)', 0, 'urgent'],
    ['tomorrow (1)', 1, 'urgent'],
    ['in 2 days', 2, 'soon'],
    ['in 3 days (not an attention)', 3, null],
  ] as const)('active order due %s → %s', (_l, days, expected) => expect(classifyAttention('order_due', { days })).toBe(expected));
  it('sale with balance owed → soon', () => expect(classifyAttention('sale_owed')).toBe('soon'));
  it('filament with 150 g or less → soon', () => expect(classifyAttention('filament_low')).toBe('soon'));
  it('supply out or at its minimum → soon', () => expect(classifyAttention('supply_low')).toBe('soon'));
  it('maintenance pending → review', () => expect(classifyAttention('maintenance')).toBe('review'));
  it('fixed price below the floor → review', () => expect(classifyAttention('price_below_floor')).toBe('review'));
  it('backup missing or older than 7 days → review', () => expect(classifyAttention('backup')).toBe('review'));
});
