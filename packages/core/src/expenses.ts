// Expenses (docs/04 §10): one-off in its date; recurring (monthly) prorated by days in the range.

export const DAYS_PER_MONTH = 30.4375;
export interface ExpenseData { on: string; amount: number; recurring: boolean; endsOn: string | null }

const day = (iso: string) => Math.round(Date.parse(`${iso}T12:00:00Z`) / 864e5);

/** Amount that falls in [from, to] (calendar dates, inclusive) (case 10.1). */
export function expenseInRange(e: ExpenseData, from: string, to: string): number {
  const a = day(from);
  const b = day(to);
  const d0 = day(e.on);
  if (!e.recurring) return d0 >= a && d0 <= b ? e.amount : 0;
  const lo = Math.max(a, d0);
  const hi = Math.min(b, e.endsOn ? day(e.endsOn) : b);
  return hi >= lo ? (e.amount * (hi - lo + 1)) / DAYS_PER_MONTH : 0;
}

export const expensesInRange = (list: readonly ExpenseData[], from: string, to: string) => list.reduce((t, e) => t + expenseInRange(e, from, to), 0);

/** Fixed per month: recurring amounts still in force today. */
export const fixedPerMonth = (list: readonly ExpenseData[], today: string) => list.filter((e) => e.recurring && (!e.endsOn || day(e.endsOn) >= day(today))).reduce((t, e) => t + e.amount, 0);

/** "Desde siempre": from a very old date to today, like the mockup. */
export const ALL_TIME_FROM = '1900-01-01';
