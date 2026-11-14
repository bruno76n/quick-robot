// The brief (mockup briefHTML): a sentence with the period, comparison pills and "de cada $100 vendidos".
import type { CSSProperties, ReactNode } from 'react';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, number1, pct } from '../../lib/format';
import type { CostConcepts, Totals } from './api';
import { rt } from './text';

const L = es.screens.reports;

/** "$43" or "$8.7": what goes to each concept out of every $100. */
export const per100 = (x: number) => `$${x >= 10 ? Math.round(x) : number1(x)}`;

export type Seg = [name: string, cents: number, cssVar: string, cls?: string];

/** Split bar (mockup c100Bar). base = what 100% is worth (0: show amounts instead of shares). */
export function C100Bar({ segs, base, label, cls = '' }: { segs: readonly Seg[]; base: number; label: string; cls?: string }) {
  const tot = segs.reduce((a, s) => a + s[1], 0);
  const scale = Math.max(base, tot, 1);
  return (
    <>
      <div className={`c100 ${cls}`} role="img" aria-label={label}>
        {segs.filter((s) => s[1] > 0).map((s) => {
          const w = (s[1] / scale) * 100;
          const tip = `${s[0]}: ${centsTotal(s[1])}${base ? t('screens.reports.per100Of', { value: per100((s[1] / base) * 100) }) : ''}`;
          return <i key={s[0]} className={s[3] ?? ''} style={{ width: `${w.toFixed(2)}%`, '--s': `var(${s[2]})` } as CSSProperties} title={tip} tabIndex={0}>{w >= 9 && base ? <span>{per100((s[1] / base) * 100)}</span> : null}</i>;
        })}
      </div>
      <ul className="c100-l">
        {segs.map((s) => (
          <li key={s[0]} className={s[3] ?? ''}><span className="lk" style={{ '--s': `var(${s[2]})` } as CSSProperties} /><span className="nm">{s[0]}{base ? <> <small>{centsTotal(s[1])}</small></> : null}</span><b className="num">{base ? per100((s[1] / base) * 100) : centsTotal(s[1])}</b></li>
        ))}
      </ul>
    </>
  );
}

/** Comparison pill (mockup cmpPill): green when it moves the good way, red otherwise. */
export function CmpPill({ label, cur, prev, good }: { label: string; cur: number; prev: number | null; good: boolean }) {
  if (!prev) return null;
  const p = ((cur - prev) / Math.abs(prev)) * 100;
  const title = t('screens.reports.prevTip', { value: centsTotal(prev) });
  if (Math.abs(p) < 0.5) return <span className="pill" title={title}>{t('screens.reports.pillSame', { label })}</span>;
  return <span className={`pill ${(p > 0) === good ? 'good' : 'bad'}`} title={title}>{t(p > 0 ? 'screens.reports.pillUp' : 'screens.reports.pillDown', { label, pct: pct(Math.abs(p)) })}</span>;
}

export interface BriefProps {
  T: Totals; K: CostConcepts; gA: number | null; A: Totals | null; gP: number | null;
  when?: string; compact?: boolean; empty?: string; extra?: ReactNode[];
}

export function Brief({ T, K, gA, A, gP, when = '', compact = false, empty = L.briefEmpty, extra = [] }: BriefProps) {
  if (!T.count) return <section className="brf one"><p className="brf-l mut">{empty}</p></section>;
  const real = T.profitCents - (gA ?? 0);
  const params = { income: centsTotal(T.incomeCents), count: T.count, when: when ? ` ${when}` : '', profit: centsTotal(T.profitCents), real: centsTotal(real) };
  const sentence = rt(gA !== null ? 'screens.reports.briefLineExpenses' : 'screens.reports.briefLine', params, { income: '', profit: T.profitCents < 0 ? 'r' : 'g', real: real < 0 ? 'r' : 'g' });
  const pills = A && A.count ? [
    <CmpPill key="s" label={L.pillSales} cur={T.incomeCents} prev={A.incomeCents} good />,
    <CmpPill key="p" label={L.pillProfit} cur={T.profitCents} prev={A.profitCents} good />,
    gA !== null ? <CmpPill key="g" label={L.pillExpenses} cur={gA} prev={gP} good={false} /> : null,
  ] : null;
  const facts: ReactNode[] = [
    rt('screens.reports.avgSale', { avg: centsTotal(T.incomeCents / T.count) }, { avg: '' }),
    rt('screens.reports.pieces', { pieces: number1(T.pieces), count: T.pieces, perSale: number1(T.pieces / T.count) }, { pieces: '' }),
  ];
  if (T.discountCents > 0) facts.push(rt('screens.reports.discounts', { discount: centsTotal(T.discountCents) }, { discount: '' }));
  facts.push(...extra);
  const segs: Seg[] = [
    [L.seg.material, K.materialCents, '--c-m'], [L.seg.power, K.powerCents, '--c-l'], [L.seg.machine, K.machineCents, '--c-q'], [L.seg.extras, K.extrasCents, '--c-e', 'dk'],
    [L.seg.failures, K.failureReserveCents, '--c-f', 'hatch'], [L.seg.commissions, T.commissionCents, '--c-t'],
  ];
  if (gA !== null) segs.push([L.seg.expenses, gA, '--sand', 'dk']);
  segs.push([gA !== null ? L.seg.realProfit : L.seg.profit, Math.max(0, T.incomeCents - segs.reduce((a, s) => a + s[1], 0)), '--green', 'gan dk']);
  return (
    <section className="brf" aria-label={L.briefLabel} data-testid="brief">
      <div className="brf-t">
        <p className="brf-l">{sentence}</p>
        {pills ? <div className="brf-c">{pills}<small>{L.vsPrev}</small></div> : null}
        {compact ? null : <p className="brf-f">{facts.map((f, i) => <span key={i}>{f}</span>)}</p>}
      </div>
      <div className="brf-m">
        <h3 className="brf-h">{L.per100}</h3>
        <C100Bar segs={segs} base={T.incomeCents} label={gA !== null ? L.per100LabelExpenses : L.per100Label} />
        {real < 0 ? <p className="note warn mt">{t('screens.reports.expensesOver', { amount: centsTotal(-real) })}</p> : null}
        {compact ? null : <p className="hint">{L.conceptsHint}</p>}
      </div>
    </section>
  );
}
