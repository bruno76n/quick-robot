// Reports (docs/04 §13): same totals as sales, per period, per channel and per piece.
import { daysBetween } from './dates';
import { rankProducts, salesTotals, type SaleData } from './sales';

export type Period = 7 | 30 | 90 | 'all';

/** Sales in the last `days` days counting today (mockup: daysTo(fecha) > −days). */
export const inPeriod = (on: string, today: string, period: Period) => period === 'all' || daysBetween(today, on) > -period;

export function report(sales: readonly (SaleData & { on: string; channelId: string })[], today: string, period: Period, nameOf?: (id: string) => string | undefined) {
  const list = sales.filter((s) => inPeriod(s.on, today, period) && !s.returned);
  const channels = new Map<string, (SaleData & { on: string; channelId: string })[]>();
  for (const s of list) channels.set(s.channelId, [...(channels.get(s.channelId) ?? []), s]);
  return {
    totals: salesTotals(list),
    byChannel: [...channels.entries()].map(([channelId, ss]) => ({ channelId, ...salesTotals(ss), count: ss.length })).sort((a, b) => b.income - a.income),
    ranking: rankProducts(list, nameOf),
  };
}
