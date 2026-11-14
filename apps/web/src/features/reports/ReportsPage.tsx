// Reportes (docs/06 §13; mockup vReportes): period, brief with comparison, chart by buckets, rankings, workshop and current state.
import { useSearch } from '@tanstack/react-router';
import type { CSSProperties, ReactNode } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, grams, money, number1, pct } from '../../lib/format';
import { go } from '../../lib/nav';
import { useSettings } from '../../lib/queries';
import { useReport, type ApiPeriod, type Bucket, type Report } from './api';
import { Brief, C100Bar } from './Brief';
import { allBold, rt } from './text';

const L = es.screens.reports;
export const PERIODS = ['7', '30', '90', 'todo'] as const;
export type Period = (typeof PERIODS)[number];
export const apiPeriod = (p: Period): ApiPeriod => (p === 'todo' ? 'all' : p);

const weekday = new Intl.DateTimeFormat('es-MX', { weekday: 'short', timeZone: 'UTC' });
const monthShort = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' });
const at = (iso: string) => new Date(`${iso}T12:00:00Z`);
const clean = (s: string) => s.replace('.', '');
export const rangeText = (from: string, to: string) => t('screens.reports.range', { from: date(from), to: date(to) });

/** Column label and tooltip title of a bucket (mockup repBuckets). */
function bucketLabel(b: Bucket, unit: Report['range']['unit']): [string, string] {
  if (unit === 'day') { const w = clean(weekday.format(at(b.from))); return [`${w} ${at(b.from).getUTCDate()}`, `${w} ${date(b.from)}`]; }
  if (unit === 'week') return [date(b.from), t('screens.reports.weekOf', { range: rangeText(b.from, b.to) })];
  const m = monthLong.format(at(b.from));
  return [clean(monthShort.format(at(b.from))), `${m[0]!.toUpperCase()}${m.slice(1)} ${at(b.from).getUTCFullYear()}`];
}

export function niceScale(max: number) {
  const m = Math.max(max, 1);
  const e0 = Math.floor(Math.log10(m));
  for (let e = e0 - 2; e <= e0 + 1; e++) for (const f of [1, 2, 2.5, 5]) { const st = f * 10 ** e; if (m / st <= 5 + 1e-9) return { step: st, top: Math.ceil(m / st - 1e-9) * st }; }
  return { step: m / 4, top: m };
}

const pctOf = (x: number, total: number) => pct(total ? (x / total) * 100 : 0);

function RkxRow({ name, sub, w, value, cls = '', vc = '', onOpen }: { name: string; sub: ReactNode; w: number; value: string; cls?: string; vc?: string; onOpen?: (() => void) | undefined }) {
  return (
    <li className={onOpen ? 'click' : undefined} onClick={onOpen} onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(); } : undefined} tabIndex={onOpen ? 0 : undefined}>
      <span className="n"><b>{name}</b><small>{sub}</small></span><span className="rk-b"><i className={cls} style={{ width: `${Math.max(2, w).toFixed(1)}%` }} /></span><b className={`v num ${vc}`}>{value}</b>
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
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={<Button icon="copy" onClick={copy} disabled={!R}>{L.copy}</Button>} />
      <div className="rep-bar">
        <div className="seg" role="group" aria-label={L.periodLabel}>
          {PERIODS.map((p) => <button key={p} type="button" className={p === period ? 'on' : undefined} aria-pressed={p === period} onClick={() => go(`/reportes?periodo=${p}`, true)}>{L.periods[p]}</button>)}
        </div>
        {R ? <p className="cap"><b>{rangeText(R.range.from, R.range.to)}</b>{R.range.period === 'all' ? t('screens.reports.capAll', { range: '' }) : t('screens.reports.capDays', { range: '', days: R.range.days })}{R.previous ? t('screens.reports.capPrev', { range: rangeText(prevRange(R).from, prevRange(R).to) }) : ''}</p> : null}
      </div>
      {R ? <ReportBody R={R} /> : <div className="skel" />}
    </>
  );
}

function prevRange(R: Report) {
  const shift = (iso: string, d: number) => { const x = at(iso); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  return { from: shift(R.range.from, -R.range.days), to: shift(R.range.from, -1) };
}

function ReportBody({ R }: { R: Report }) {
  const T = R.totals;
  const empty = <p className="muted mt">{L.noSales}</p>;
  const gA = R.hasExpenses ? R.expensesCents : null;
  const gP = R.hasExpenses && R.previous ? R.previousExpensesCents : null;
  const unit = L.unit[R.range.unit];
  // Chart
  const tops = Math.max(1, ...R.buckets.map((x) => x.costCents + x.commissionCents + Math.max(0, x.profitCents)));
  const sc = niceScale(tops / 100);
  const yMax = sc.top * 100;
  const many = R.buckets.length > 8;
  const marks: number[] = [];
  for (let v = 0; v <= sc.top + 1e-9; v += sc.step) marks.push(v * 100);
  const chart = !T.count ? (
    <p className="note mt">{L.noSalesChart} <button type="button" className="link" onClick={() => go('/armar?modo=venta')}>{L.newSale}</button></p>
  ) : (
    <>
      <ul className="lg mt" aria-label={L.legend}>
        <li><i style={{ '--c': 'var(--cost)' } as CSSProperties} />{L.cost}</li><li><i style={{ '--c': 'var(--c-t)' } as CSSProperties} />{L.commission}</li><li><i style={{ '--c': 'var(--green)' } as CSSProperties} />{L.profit}</li>
      </ul>
      <div className={`rk-chart${many ? ' many' : ''}`} role="img" aria-label={t('screens.reports.chartLabel', { unit })}>
        <div className="rk-y">{marks.map((v) => <span key={v} style={{ bottom: `${(v / yMax) * 100}%` }}>{centsTotal(v)}</span>)}</div>
        <div className="rk-plot">
          {marks.filter((v) => v > 0).map((v) => <i key={v} className="gl" style={{ bottom: `${(v / yMax) * 100}%` }} />)}
          <div className="rk-cols" data-testid="chart-cols">
            {R.buckets.map((x) => {
              const tot = x.costCents + x.commissionCents + Math.max(0, x.profitCents);
              const part = (v: number, c: string) => (v > 0 ? <i className={c} style={{ height: `${((v / tot) * 100).toFixed(2)}%` }} /> : null);
              const [label, title] = bucketLabel(x, R.range.unit);
              const tip = t('screens.reports.colTip', { label: title, partial: x.partial ? L.inProgressTip : '', count: x.count, income: centsTotal(x.incomeCents), cost: centsTotal(x.costCents), commission: centsTotal(x.commissionCents), profit: centsTotal(x.profitCents) });
              return (
                <div className="tcol" key={x.from} title={tip} tabIndex={0}>
                  {!many && x.incomeCents > 0 ? <span className="cv num">{centsTotal(x.incomeCents)}</span> : null}
                  <div className="stk3" style={{ height: `${((tot / yMax) * 100).toFixed(2)}%` }}>{part(x.costCents, 's-co')}{part(x.commissionCents, 's-cm')}{part(Math.max(0, x.profitCents), 's-ga')}</div>
                  <span className="cl">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
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
  // Pieces, channels, customers, collections
  const rank = R.topProducts.slice(0, 10);
  const rmax = Math.max(1, ...rank.map((r) => r.profitCents));
  const totalParams = { count: R.topProducts.length, pieces: T.pieces, income: centsTotal(T.incomeCents), cost: centsTotal(T.costCents), profit: centsTotal(T.profitCents), margin: pct(T.marginPct) };
  const pieces = !rank.length ? empty : (
    <>
      <ul className="rkx" data-testid="rank">{rank.map((r) => <RkxRow key={r.productId} name={r.name} sub={t('screens.reports.pieceLine', { count: r.qty, income: centsTotal(r.incomeCents), cost: centsTotal(r.costCents), margin: pctOf(r.profitCents, r.incomeCents) })} w={(r.profitCents / rmax) * 100} value={centsTotal(r.profitCents)} vc={r.profitCents < 0 ? 'neg' : 'pos'} />)}</ul>
      <p className="rkx-t">{rt(R.topProducts.length > rank.length ? 'screens.reports.pieceTotalOf' : 'screens.reports.pieceTotal', totalParams, { profit: T.profitCents < 0 ? 'neg' : 'pos' })}</p>
    </>
  );
  const cmax = Math.max(1, ...R.byChannel.map((c) => c.profitCents));
  const channels = !T.count ? empty : <ul className="rkx">{R.byChannel.map((c) => <RkxRow key={c.channelId} name={c.name} sub={t('screens.reports.channelLine', { count: c.count, income: centsTotal(c.incomeCents), commission: centsTotal(c.commissionCents) })} w={(c.profitCents / cmax) * 100} value={centsTotal(c.profitCents)} vc={c.profitCents < 0 ? 'neg' : 'pos'} />)}</ul>;
  const clm = Math.max(1, ...R.byCustomer.map((c) => c.incomeCents));
  const customers = !R.byCustomer.length ? empty : (
    <ul className="rkx">{R.byCustomer.map((c) => (
      <RkxRow key={c.id ?? 'none'} name={c.id ? c.name : L.noCustomer} cls="pu" w={(c.incomeCents / clm) * 100} value={centsTotal(c.incomeCents)} onOpen={c.id ? () => go(`/clientes/cliente?id=${c.id}`) : undefined}
        sub={<>{t('screens.reports.customerLine', { count: c.count, profit: centsTotal(c.profitCents) })}{c.owedCents > 0 ? <span className="neg">{t('screens.reports.customerOwed', { owed: centsTotal(c.owedCents) })}</span> : null}</>} />
    ))}</ul>
  );
  const cgm = Math.max(1, ...R.byCollection.map((c) => c.profitCents));
  const collections = !R.byCollection.length ? <p className="muted mt">{L.noCollections}</p> : <ul className="rkx">{R.byCollection.map((c) => <RkxRow key={c.id} name={c.name} sub={t('screens.reports.collectionLine', { count: c.qty, income: centsTotal(c.incomeCents), margin: pctOf(c.profitCents, c.incomeCents) })} w={(c.profitCents / cgm) * 100} value={centsTotal(c.profitCents)} vc={c.profitCents < 0 ? 'neg' : 'pos'} />)}</ul>;
  // Workshop
  const W = R.workshop;
  const umax = Math.max(1, ...W.filaments.map((x) => x.grams));
  const real = W.usedGrams ? (W.lostGrams / W.usedGrams) * 100 : 0;
  const high = W.usedGrams > 0 && real > W.failurePct;
  const filament = !W.filaments.length ? <p className="muted mt">{L.noFilament}</p> : (
    <>
      <ul className="hb">{W.filaments.map((x) => (
        <li key={x.filamentId}><span className="hb-l"><span className="sw" style={{ '--c': x.hex || '#9a9aa6' } as CSSProperties} />{x.name}</span><span className="hb-t"><i className="pu" style={{ width: `${Math.max(2, (x.grams / umax) * 100)}%`, '--fc': x.hex || '#8b8b97' } as CSSProperties} title={`${x.name}: ${grams(x.grams)}`} tabIndex={0} /></span><span className="hb-v">{grams(x.grams)}</span></li>
      ))}</ul>
      <p className={`note mt ${high ? 'warn' : ''}`}>
        {rt('screens.reports.failNote', { real: pct(real) }, { real: '' })}{W.runs ? t('screens.reports.failNoteRuns', { fails: W.failures, runs: W.runs }) : ''}{t('screens.reports.failNoteReserve', { reserve: pct(W.failurePct) })}
        {high ? <>{L.failNoteHigh}<a href="/ajustes" onClick={(e) => { e.preventDefault(); go('/ajustes'); }}>{L.settingsLink}</a>{L.dot}</> : null}
      </p>
    </>
  );
  const hmax = Math.max(1, ...W.printers.map((m) => m.hours));
  const printers = !W.printers.length ? <p className="muted mt">{L.noPrinters}</p> : (
    <ul className="rkx">{W.printers.map((m) => (
      <RkxRow key={m.id} name={m.name} cls="pu" w={(m.hours / hmax) * 100} value={`${number1(m.hours)} h`}
        sub={<>{t('screens.reports.printerRuns', { count: m.runs })}{m.failures ? <span className="neg">{t('screens.reports.printerFails', { count: m.failures })}{m.runs ? t('screens.reports.printerFailsPct', { pct: pct((m.failures / m.runs) * 100) }) : ''}</span> : null}{t('screens.reports.printerPerHour', { cost: money(m.costPerHourCents / 100) })}</>} />
    ))}</ul>
  );
  // Current state
  const O = R.ordersNow;
  const orders = O.active ? (
    <>
      <p className="lead">{rt('screens.reports.ordersLine', { count: O.active, production: O.inProduction, ready: O.ready, total: centsTotal(O.totalCents), paid: centsTotal(O.paidCents), owed: centsTotal(O.owedCents), profit: centsTotal(O.profitCents) }, { count: '', total: '', paid: 'pos', owed: O.owedCents > 0 ? 'neg' : '' })}</p>
      <div className="rk-b big mt"><i style={{ width: `${O.totalCents ? (O.paidCents / O.totalCents) * 100 : 0}%` }} /></div>
      <p className="hint">{t('screens.reports.ordersPaid', { pct: pctOf(O.paidCents, O.totalCents) })}</p>
    </>
  ) : <p className="lead mut">{L.ordersEmpty}</p>;
  const I = R.inventory;
  const inventory = (
    <>
      <p className="lead">{rt('screens.reports.inventoryLine', { pieces: I.pieces, count: I.pieces, free: I.free, reservedPart: I.reserved ? t('screens.reports.inventoryReserved', { count: I.reserved }) : '', atCost: centsTotal(I.atCostCents), atList: centsTotal(I.atListCents), kg: `${number1(I.grams / 1000)} kg`, spools: I.spools, value: centsTotal(I.valueCents) }, allBold('pieces', 'atCost', 'atList', 'kg'))}</p>
      {I.atCostCents + I.valueCents > 0 ? <C100Bar segs={[[L.inventoryPieces, I.atCostCents, '--c-l'], [L.inventoryFilament, I.valueCents, '--c-q']]} base={0} label={L.inventoryLabel} cls="sm" /> : null}
      <p className="hint">{t('screens.reports.inventoryTotal', { total: centsTotal(I.atCostCents + I.valueCents) })}{O.quotes ? t('screens.reports.inventoryQuotes', { count: O.quotes, total: centsTotal(O.quotesCents) }) : ''}</p>
    </>
  );
  const inv = R.investmentRecovered;
  const nPrinters = W.printers.length;
  return (
    <>
      <Brief T={T} K={R.costConcepts} gA={gA} A={R.previous} gP={gP} />
      <section className="rp"><h2>{t('screens.reports.salesBy', { unit })}</h2>{chart}</section>
      <section className="rp"><h2>{L.byPiece}</h2>{pieces}</section>
      <div className="rp-g">
        <section className="rp"><h2>{L.channels}</h2>{channels}</section>
        <section className="rp"><h2>{L.customers}</h2>{customers}</section>
      </div>
      <div className="rp-g">
        <section className="rp"><h2>{L.collections}</h2>{collections}</section>
        <section className="rp"><h2>{L.printers}</h2>{printers}</section>
      </div>
      <section className="rp"><h2>{L.filament}</h2>{filament}</section>
      <h2 className="rp-h">{L.now} <small>{L.nowSub}</small></h2>
      <div className="rp-g">
        <section className="rp"><h3>{L.orders}</h3>{orders}</section>
        <section className="rp"><h3>{L.inventory}</h3>{inventory}</section>
      </div>
      {nPrinters ? (
        <section className="rp" data-testid="investment">
          <h3>{L.investment}</h3>
          <p className="lead">{rt(nPrinters === 1 ? 'screens.reports.investmentLineOne' : 'screens.reports.investmentLineMany', { count: nPrinters, equipment: centsTotal(inv.equipmentCents), pct: pct(inv.recoveredPct), net: centsTotal(inv.netCents) }, { equipment: '', pct: inv.recoveredPct >= 100 ? 'g' : '', net: '' })}</p>
          <div className="rk-b big mt" role="img" aria-label={t('screens.reports.investmentBar', { pct: pct(inv.recoveredPct) })}><i style={{ width: `${Math.min(100, Math.max(1.5, inv.recoveredPct))}%` }} /></div>
          <p className="hint">{t('screens.reports.investmentHint', { pct: pct(inv.recoveredPct) })}</p>
        </section>
      ) : null}
    </>
  );
}
