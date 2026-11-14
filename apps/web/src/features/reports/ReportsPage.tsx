// Reportes (docs/06 §13; ronda-3 §6, reference/ronda-3/reportes.html): period (segmented switch as before, exception 1),
// 5 figures, sales by bucket, of every $100, products with the most profit, by channel; then customers, collections,
// printers, filament and the current state (D-11).
import { useSearch } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { HBarList, Per100Bar, WeekColumns } from '../../components/charts';
import { Kpis } from '../../components/Kpis';
import { Panel } from '../../components/Panel';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, grams, money, money2d, number1, pct } from '../../lib/format';
import { go } from '../../lib/nav';
import { useSettings } from '../../lib/queries';
import { Delta } from './Delta';
import { useReport, type ApiPeriod, type Report } from './api';
import { C100Bar } from './Brief';
import { at, bucketColumns, bucketLabel, deltaPct, rangeText } from './buckets';
import { allBold, rt } from './text';
import './reports.css';

const L = es.screens.reports;
export const PERIODS = ['7', '30', '90', 'todo'] as const;
export type Period = (typeof PERIODS)[number];
export const apiPeriod = (p: Period): ApiPeriod => (p === 'todo' ? 'all' : p);
export { rangeText };

const pctOf = (x: number, total: number) => pct(total ? (x / total) * 100 : 0);

function RkxRow({ name, sub, w, value, cls = '', vc = '', onOpen }: { name: string; sub: ReactNode; w: number; value: string; cls?: string; vc?: string; onOpen?: (() => void) | undefined }) {
  return (
    <li className={onOpen ? 'click' : undefined} onClick={onOpen} onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(); } : undefined} tabIndex={onOpen ? 0 : undefined}>
      <span className="n"><b>{name}</b><small>{sub}</small></span><span className="hb-track"><i className={cls} style={{ width: `${Math.max(2, w).toFixed(1)}%` }} /></span><b className={`v num ${vc}`}>{value}</b>
    </li>
  );
}

/** The text of "Copiar resumen" (mockup repResumen). */
export function summaryText(R: Report, business: string): string {
  const S = 'screens.reports.summary.';
  const T = R.totals; const A = R.previous;
  const delta = (c: number, p: number | undefined) => (!A || !p ? '' : t(`${S}delta`, { sign: c >= p ? '+' : '−', pct: pct(Math.abs(((c - p) / p) * 100)) }));
  const range = rangeText(R.range.from, R.range.to);
  const lines = [
    R.range.period === 'all' ? t(`${S}headAll`, { business, range }) : t(`${S}headDays`, { business, days: R.range.days, range }), '',
    t(`${S}sales`, { income: centsTotal(T.incomeCents), delta: delta(T.incomeCents, A?.incomeCents), count: T.count, pieces: T.pieces }),
    t(`${S}cost`, { cost: centsTotal(T.costCents) }), t(`${S}commissions`, { commission: centsTotal(T.commissionCents) }),
    t(`${S}profit`, { profit: centsTotal(T.profitCents), delta: delta(T.profitCents, A?.profitCents), margin: pct(T.marginPct) }), t(`${S}discounts`, { discount: centsTotal(T.discountCents) }),
  ];
  if (R.hasExpenses) lines.push(t(`${S}expenses`, { expenses: centsTotal(R.expensesCents), real: centsTotal(R.netProfitCents) }));
  if (R.byChannel.length) lines.push('', t(`${S}byChannel`), ...R.byChannel.map((c) => t(`${S}channel`, { name: c.name, income: centsTotal(c.incomeCents), profit: centsTotal(c.profitCents) })));
  if (R.topProducts.length) lines.push('', t(`${S}top`), ...R.topProducts.slice(0, 5).map((r, i) => t(`${S}topLine`, { n: i + 1, name: r.name, profit: centsTotal(r.profitCents), count: r.qty })));
  lines.push('', t(`${S}orders`, { count: R.ordersNow.active, owed: centsTotal(R.ordersNow.owedCents) }));
  return lines.join('\n');
}

export function ReportsPage() {
  const search = useSearch({ strict: false }) as { periodo?: Period };
  const period: Period = search.periodo ?? '30';
  const { data: R } = useReport(apiPeriod(period));
  const business = useSettings().data?.settings.business.name ?? '';
  const copy = () => {
    if (!R) return;
    void navigator.clipboard?.writeText(summaryText(R, business)).then(() => toast(t('toast.copy.done', { what: L.copied })), () => toast(es.toast['copy.failed']));
  };
  const cap = R ? <><b>{rangeText(R.range.from, R.range.to)}</b>{R.range.period === 'all' ? t('screens.reports.capAll', { range: '' }) : t('screens.reports.capDays', { range: '', days: R.range.days })}{R.previous ? t('screens.reports.capPrev', { range: rangeText(prevRange(R).from, prevRange(R).to) }) : ''}</> : L.sub;
  return (
    <>
      <PageHead title={L.title} sub={<span className="cap">{cap}</span>} actions={<Button icon="copy" onClick={copy} disabled={!R}>{L.copy}</Button>} />
      <div className="rep-bar">
        <div className="seg" role="group" aria-label={L.periodLabel}>
          {PERIODS.map((p) => <button key={p} type="button" className={p === period ? 'on' : undefined} aria-pressed={p === period} onClick={() => go(`/reportes?periodo=${p}`, true)}>{L.periods[p]}</button>)}
        </div>
      </div>
      {R ? <ReportBody R={R} /> : <div className="skel" />}
    </>
  );
}

function prevRange(R: Report) {
  const shift = (iso: string, d: number) => { const x = at(iso); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  return { from: shift(R.range.from, -R.range.days), to: shift(R.range.from, -1) };
}

/** Ventas · Ganancia bruta · Gastos · Ganancia neta · Margen neto (D-10: net profit ÷ sales). */
function Figures({ R }: { R: Report }) {
  const T = R.totals;
  const A = R.previous?.count ? R.previous : null;
  return (
    <div className="rep-k" data-testid="brief"><Kpis label={L.briefLabel} items={[
      { label: L.kSales, value: centsTotal(T.incomeCents), sub: A ? <Delta value={deltaPct(T.incomeCents, A.incomeCents)} /> : t('screens.reports.kCount', { count: T.count }) },
      { label: L.kGross, value: centsTotal(T.profitCents), ...(A ? { sub: <Delta value={deltaPct(T.profitCents, A.profitCents)} /> } : {}) },
      { label: L.kExpenses, value: centsTotal(R.expensesCents), ...(R.hasExpenses && A && R.previousExpensesCents ? { sub: <Delta value={deltaPct(R.expensesCents, R.previousExpensesCents)} good={false} /> } : {}) },
      { label: L.kNet, value: centsTotal(R.netProfitCents), tone: R.netProfitCents < 0 ? 'bad' : 'net' },
      { label: L.kMargin, value: T.incomeCents > 0 ? pct((R.netProfitCents / T.incomeCents) * 100) : '—' },
    ]} /></div>
  );
}

/** Of every $100 sold: costs and expenses against net profit, and each concept per $100 (largest first). */
function Per100({ R }: { R: Report }) {
  const T = R.totals;
  const K = R.costConcepts;
  const per = (c: number) => (c / T.incomeCents) * 100;
  const net = Math.max(0, per(R.netProfitCents));
  const parts: [string, string, number][] = [
    ['g', L.seg.expenses, R.expensesCents], ['m', L.seg.material, K.materialCents], ['q', L.seg.machine, K.machineCents], ['e', L.seg.extras, K.extrasCents],
    ['c', L.seg.commissions, T.commissionCents], ['f', L.seg.failures, K.failureReserveCents], ['l', L.seg.power, K.powerCents],
  ];
  return (
    <>
      <Per100Bar label={R.hasExpenses ? L.per100LabelExpenses : L.per100Label}
        cost={{ label: L.costsAndExpenses, value: 100 - net, display: money2d(100 - net) }} net={{ label: L.kNet, value: net, display: money2d(net) }}
        items={parts.filter((x) => x[2] > 0).map(([key, label, c]) => ({ key, label, value: per(c), display: money2d(per(c)) }))} />
      {R.netProfitCents < 0 ? <p className="note warn mt">{t('screens.reports.expensesOver', { amount: centsTotal(-R.netProfitCents) })}</p> : null}
      <p className="meta mt">{L.conceptsHint}</p>
    </>
  );
}

function ChannelTable({ R }: { R: Report }) {
  const T = R.totals;
  return (
    <div className="tw"><table className="tbl fit rp-ch">
      <thead><tr><th>{L.colChannel}</th><th className="r hide-sm">{L.sales}</th><th className="r">{L.colAmount}</th><th className="r hide-sm">{L.commission}</th><th className="r">{L.profit}</th></tr></thead>
      <tbody>{R.byChannel.map((c) => (
        <tr key={c.channelId}><td>{c.name}</td><td className="r num hide-sm">{c.count}</td><td className="r num">{centsTotal(c.incomeCents)}</td><td className="r num hide-sm">{centsTotal(c.commissionCents)}</td><td className={`r num ${c.profitCents < 0 ? 'neg' : 'pos'}`}>{centsTotal(c.profitCents)}</td></tr>
      ))}</tbody>
      <tfoot><tr><td>{L.total}</td><td className="r num hide-sm">{T.count}</td><td className="r num">{centsTotal(T.incomeCents)}</td><td className="r num hide-sm">{centsTotal(T.commissionCents)}</td><td className={`r num ${T.profitCents < 0 ? 'neg' : 'pos'}`}>{centsTotal(T.profitCents)}</td></tr></tfoot>
    </table></div>
  );
}

function ReportBody({ R }: { R: Report }) {
  const T = R.totals;
  const empty = <p className="meta">{L.noSales}</p>;
  const unit = L.unit[R.range.unit];
  const chart = !T.count ? (
    <p className="note">{L.noSalesChart} <button type="button" className="link" onClick={() => go('/armar?modo=venta')}>{L.newSale}</button></p>
  ) : (
    <>
      <WeekColumns columns={bucketColumns(R)} legend={{ sales: L.sales, profit: L.kGross }} label={t('screens.reports.chartLabel', { unit })} testId="chart-cols" />
      <details className="tabview">
        <summary>{L.asTable}</summary>
        <div className="tw"><table className="tbl sm">
          <thead><tr><th>{L.unitHead[R.range.unit]}</th><th className="r">{L.sales}</th><th className="r">{L.total}</th><th className="r">{L.cost}</th><th className="r">{L.commission}</th><th className="r">{L.profit}</th></tr></thead>
          <tbody>
            {R.buckets.map((x) => (
              <tr key={x.from}><td>{bucketLabel(x, R.range.unit)[1]}{x.partial ? <> <small>{L.inProgress}</small></> : null}</td><td className="r num">{x.count}</td><td className="r num">{centsTotal(x.incomeCents)}</td><td className="r num mut">{centsTotal(x.costCents)}</td><td className="r num mut">{centsTotal(x.commissionCents)}</td><td className={`r num ${x.profitCents < 0 ? 'neg' : 'pos'}`}>{centsTotal(x.profitCents)}</td></tr>
            ))}
            <tr className="tot"><td>{L.total}</td><td className="r num">{T.count}</td><td className="r num">{centsTotal(T.incomeCents)}</td><td className="r num">{centsTotal(T.costCents)}</td><td className="r num">{centsTotal(T.commissionCents)}</td><td className="r num">{centsTotal(T.profitCents)}</td></tr>
          </tbody>
        </table></div>
      </details>
    </>
  );
  const totalParams = { count: R.topProducts.length, pieces: T.pieces, income: centsTotal(T.incomeCents), cost: centsTotal(T.costCents), profit: centsTotal(T.profitCents), margin: pct(T.marginPct) };
  const top = R.topProducts.slice(0, 10);
  const pieces = !top.length ? empty : (
    <>
      <div data-testid="rank"><HBarList tone="green" label={L.byPiece} items={top.map((r) => ({ key: r.productId, label: r.name, meta: t('screens.reports.pieceLine', { count: r.qty, income: centsTotal(r.incomeCents), cost: centsTotal(r.costCents), margin: pctOf(r.profitCents, r.incomeCents) }), value: Math.max(0, r.profitCents), display: centsTotal(r.profitCents) }))} /></div>
      <p className="rkx-t">{rt(R.topProducts.length > top.length ? 'screens.reports.pieceTotalOf' : 'screens.reports.pieceTotal', totalParams, { profit: T.profitCents < 0 ? 'neg' : 'pos' })}</p>
    </>
  );
  return (
    <>
      <Figures R={R} />
      <div className="rp-grid">
        <Panel title={t('screens.reports.salesBy', { unit })}>{chart}</Panel>
        <Panel title={L.per100}>{T.count && T.incomeCents > 0 ? <Per100 R={R} /> : empty}</Panel>
        <Panel title={L.byPiece}>{pieces}</Panel>
        <Panel title={L.channels}>{T.count ? <ChannelTable R={R} /> : empty}</Panel>
      </div>
      <More R={R} />
    </>
  );
}

/** What the app has and the mockup does not draw (D-11): customers, collections, printers, filament and the current state. */
function More({ R }: { R: Report }) {
  const empty = <p className="meta">{L.noSales}</p>;
  const clm = Math.max(1, ...R.byCustomer.map((c) => c.incomeCents));
  const customers = !R.byCustomer.length ? empty : (
    <ul className="rkx">{R.byCustomer.map((c) => (
      <RkxRow key={c.id ?? 'none'} name={c.id ? c.name : L.noCustomer} w={(c.incomeCents / clm) * 100} value={centsTotal(c.incomeCents)} onOpen={c.id ? () => go(`/clientes/cliente?id=${c.id}`) : undefined}
        sub={<>{t('screens.reports.customerLine', { count: c.count, profit: centsTotal(c.profitCents) })}{c.owedCents > 0 ? <span className="neg">{t('screens.reports.customerOwed', { owed: centsTotal(c.owedCents) })}</span> : null}</>} />
    ))}</ul>
  );
  const cgm = Math.max(1, ...R.byCollection.map((c) => c.profitCents));
  const collections = !R.byCollection.length ? <p className="meta">{L.noCollections}</p> : <ul className="rkx">{R.byCollection.map((c) => <RkxRow key={c.id} name={c.name} cls="g" sub={t('screens.reports.collectionLine', { count: c.qty, income: centsTotal(c.incomeCents), margin: pctOf(c.profitCents, c.incomeCents) })} w={(c.profitCents / cgm) * 100} value={centsTotal(c.profitCents)} vc={c.profitCents < 0 ? 'neg' : 'pos'} />)}</ul>;
  const W = R.workshop;
  const umax = Math.max(1, ...W.filaments.map((x) => x.grams));
  const real = W.usedGrams ? (W.lostGrams / W.usedGrams) * 100 : 0;
  const high = W.usedGrams > 0 && real > W.failurePct;
  const filament = !W.filaments.length ? <p className="meta">{L.noFilament}</p> : (
    <>
      <ul className="hb">{W.filaments.map((x) => (
        <li key={x.filamentId}><span className="hb-l"><span className="sw" style={{ '--c': x.hex || 'var(--no-color)' } as CSSProperties} />{x.name}</span><span className="hb-t"><i style={{ width: `${Math.max(2, (x.grams / umax) * 100)}%` }} title={`${x.name}: ${grams(x.grams)}`} tabIndex={0} /></span><span className="hb-v">{grams(x.grams)}</span></li>
      ))}</ul>
      <p className={`note mt ${high ? 'warn' : ''}`}>
        {rt('screens.reports.failNote', { real: pct(real) }, { real: '' })}{W.runs ? t('screens.reports.failNoteRuns', { fails: W.failures, runs: W.runs }) : ''}{t('screens.reports.failNoteReserve', { reserve: pct(W.failurePct) })}
        {high ? <>{L.failNoteHigh}<a href="/ajustes" onClick={(e) => { e.preventDefault(); go('/ajustes'); }}>{L.settingsLink}</a>{L.dot}</> : null}
      </p>
    </>
  );
  const hmax = Math.max(1, ...W.printers.map((m) => m.hours));
  const printers = !W.printers.length ? <p className="meta">{L.noPrinters}</p> : (
    <ul className="rkx">{W.printers.map((m) => (
      <RkxRow key={m.id} name={m.name} w={(m.hours / hmax) * 100} value={`${number1(m.hours)} h`}
        sub={<>{t('screens.reports.printerRuns', { count: m.runs })}{m.failures ? <span className="neg">{t('screens.reports.printerFails', { count: m.failures })}{m.runs ? t('screens.reports.printerFailsPct', { pct: pct((m.failures / m.runs) * 100) }) : ''}</span> : null}{t('screens.reports.printerPerHour', { cost: money(m.costPerHourCents / 100) })}</>} />
    ))}</ul>
  );
  const O = R.ordersNow;
  const orders = O.active ? (
    <>
      <p className="lead">{rt('screens.reports.ordersLine', { count: O.active, production: O.inProduction, ready: O.ready, total: centsTotal(O.totalCents), paid: centsTotal(O.paidCents), owed: centsTotal(O.owedCents), profit: centsTotal(O.profitCents) }, { count: '', total: '', paid: 'pos', owed: O.owedCents > 0 ? 'neg' : '' })}</p>
      <span className="meter mt"><i style={{ width: `${O.totalCents ? (O.paidCents / O.totalCents) * 100 : 0}%` }} /></span>
      <p className="meta mt">{t('screens.reports.ordersPaid', { pct: pctOf(O.paidCents, O.totalCents) })}</p>
    </>
  ) : <p className="lead mut">{L.ordersEmpty}</p>;
  const I = R.inventory;
  const inventory = (
    <>
      <p className="lead">{rt('screens.reports.inventoryLine', { pieces: I.pieces, count: I.pieces, free: I.free, reservedPart: I.reserved ? t('screens.reports.inventoryReserved', { count: I.reserved }) : '', atCost: centsTotal(I.atCostCents), atList: centsTotal(I.atListCents), kg: `${number1(I.grams / 1000)} kg`, spools: I.spools, value: centsTotal(I.valueCents) }, allBold('pieces', 'atCost', 'atList', 'kg'))}</p>
      {I.atCostCents + I.valueCents > 0 ? <C100Bar segs={[[L.inventoryPieces, I.atCostCents, '--cost'], [L.inventoryFilament, I.valueCents, '--soft-3']]} base={0} label={L.inventoryLabel} cls="sm" /> : null}
      <p className="meta mt">{t('screens.reports.inventoryTotal', { total: centsTotal(I.atCostCents + I.valueCents) })}{O.quotes ? t('screens.reports.inventoryQuotes', { count: O.quotes, total: centsTotal(O.quotesCents) }) : ''}</p>
    </>
  );
  const inv = R.investmentRecovered;
  const nPrinters = W.printers.length;
  return (
    <>
      <div className="rp-grid">
        <Panel title={L.customers}>{customers}</Panel>
        <Panel title={L.collections}>{collections}</Panel>
        <Panel title={L.printers}>{printers}</Panel>
        <Panel title={L.filament}>{filament}</Panel>
      </div>
      <h2 className="rp-h">{L.now} <small>{L.nowSub}</small></h2>
      <div className="rp-grid">
        <Panel title={L.orders}>{orders}</Panel>
        <Panel title={L.inventory}>{inventory}</Panel>
      </div>
      {nPrinters ? (
        <div data-testid="investment" className="rp-inv"><Panel title={L.investment}>
          <p className="lead">{rt(nPrinters === 1 ? 'screens.reports.investmentLineOne' : 'screens.reports.investmentLineMany', { count: nPrinters, equipment: centsTotal(inv.equipmentCents), pct: pct(inv.recoveredPct), net: centsTotal(inv.netCents) }, { equipment: '', pct: inv.recoveredPct >= 100 ? 'g' : '', net: '' })}</p>
          <span className="meter mt" role="img" aria-label={t('screens.reports.investmentBar', { pct: pct(inv.recoveredPct) })}><i style={{ width: `${Math.min(100, Math.max(1.5, inv.recoveredPct))}%` }} /></span>
          <p className="meta mt">{t('screens.reports.investmentHint', { pct: pct(inv.recoveredPct) })}</p>
        </Panel></div>
      ) : null}
    </>
  );
}
