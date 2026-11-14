// Buckets of a report (week, day or month) as columns of the ronda-3 chart (components/charts › WeekColumns).
// Shared by Inicio and Reportes.
import type { WeekColumn } from '../../components/charts';
import { t } from '../../i18n/t';
import { es } from '../../i18n/es';
import { centsTotal, date } from '../../lib/format';
import type { Bucket, Report } from './api';

const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' });
export const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const clean = (s: string) => s.replace('.', '');
export const rangeText = (from: string, to: string) => t('screens.reports.range', { from: date(from), to: date(to) });

/** Column label and tooltip title of a bucket (mockup repBuckets). */
export function bucketLabel(b: Bucket, unit: Report['range']['unit']): [string, string] {
  if (unit === 'day') { const w = clean(weekday.format(at(b.from))); return [`${w} ${at(b.from).getUTCDate()}`, `${w} ${date(b.from)}`]; }
  if (unit === 'week') return [date(b.from), t('screens.reports.weekOf', { range: rangeText(b.from, b.to) })];
  const m = monthLong.format(at(b.from));
  return [clean(monthShort.format(at(b.from))), `${m[0]!.toUpperCase()}${m.slice(1)} ${at(b.from).getUTCFullYear()}`];
}

/** Columns of "Ventas por semana": sales in light grey, gross profit in green; the amount on top unless crowded. */
export function bucketColumns(R: Pick<Report, 'buckets' | 'range'>): WeekColumn[] {
  const many = R.buckets.length > 8;
  return R.buckets.map((x) => {
    const [label, title] = bucketLabel(x, R.range.unit);
    return {
      key: x.from, label, sales: x.incomeCents, profit: Math.max(0, x.profitCents),
      ...(many || x.incomeCents <= 0 ? {} : { display: centsTotal(x.incomeCents) }),
      title: t('screens.reports.colTip', { label: title, partial: x.partial ? es.screens.reports.inProgressTip : '', count: x.count, income: centsTotal(x.incomeCents), cost: centsTotal(x.costCents), commission: centsTotal(x.commissionCents), profit: centsTotal(x.profitCents) }),
    };
  });
}

/** Change against the previous period in % (null without a previous value). */
export const deltaPct = (cur: number, prev: number | null | undefined) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : null);
