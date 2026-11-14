// Pedidos (docs/06 §5): summary strip and three views — board by status, list with filters, calendar of deliveries.
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useState, type KeyboardEvent } from 'react';
import { Kpis } from '../../components/Kpis';
import { Meter } from '../../components/Meter';
import { PageHead } from '../../components/PageHead';
import { Count, Panel } from '../../components/Panel';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Mascot } from '../../components/Mascot';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, daysBetween, queueDuration, relativeDay } from '../../lib/format';
import { todayLocal } from '../../lib/input';
import { go } from '../../lib/nav';
import { keys } from '../../lib/queries';
import { isActive, ordersApi, STATUS_CLASS, useOrderList, type OrderListItem, type OrderStatus } from './api';
import { NextStepButton, StepDialogs, useStepRunner } from './OrderSteps';
import { itemRows, originsOf, originLabel } from './origins';
import { StatusChip, tbc } from './parts';
import './orders.css';

const L = es.screens.orders;
type View = 'tablero' | 'lista' | 'calendario';
const open = (id: string) => go(`/pedidos/pedido?id=${id}`);
const onKey = (id: string) => (e: KeyboardEvent) => { if (e.key === 'Enter' && e.target === e.currentTarget) open(id); };

export function OrdersPage() {
  const search = useSearch({ strict: false }) as { vista?: string; mes?: string };
  const view = (search.vista ?? 'tablero') as View;
  const today = todayLocal();
  const board = useOrderList('board');
  const [filter, setFilter] = useState('todos');
  const active = (board.data?.items ?? []).filter((o) => isActive(o.status));
  const nav = (v: View, mes?: string) => go(`/pedidos${v === 'tablero' ? '' : `?vista=${v}`}${mes ? `&mes=${mes}` : ''}`, true);
  const empty = board.data && !board.data.items.length;
  return (
    <>
      <PageHead title={L.title} sub={board.data && active.length ? t('screens.orders.inProgress', { count: active.length }) : undefined} actions={<Button variant="primary" icon="plus" onClick={() => go('/armar?modo=pedido')}>{L.newOrder}</Button>} />
      {empty ? (
        <div className="empty-box"><Mascot size={56} /><p>{L.empty}</p><Button variant="primary" onClick={() => go('/armar?modo=pedido')}>{L.emptyButton}</Button></div>
      ) : board.data ? (
        <>
          <Strip active={active} today={today} />
          <div className="toolbar"><div className="seg" role="group" aria-label={L.view}>
            {(['tablero', 'lista', 'calendario'] as const).map((v) => <button key={v} type="button" className={view === v ? 'on' : ''} onClick={() => nav(v)}>{v === 'tablero' ? L.board : v === 'lista' ? L.list : L.calendar}</button>)}
          </div></div>
          {view === 'lista' ? <ListView filter={filter} setFilter={setFilter} today={today} />
            : view === 'calendario' ? <CalendarView month={search.mes} active={active} today={today} onMonth={(m) => nav('calendario', m)} />
              : <Board items={board.data.items} today={today} onSeeDelivered={() => { setFilter('entregado'); nav('lista'); }} />}
        </>
      ) : null}
    </>
  );
}

function Strip({ active, today }: { active: OrderListItem[]; today: string }) {
  const total = active.reduce((a, o) => a + o.totalCents, 0);
  const owed = active.reduce((a, o) => a + o.owedCents, 0);
  const profit = active.reduce((a, o) => a + o.profitCents, 0);
  const n7 = active.filter((o) => daysBetween(today, o.dueOn) <= 7).length;
  return (
    <Kpis label={L.kpisAria} items={[
      { label: L.kInProgress, value: active.length },
      { label: L.kTotal, value: centsTotal(total) },
      { label: L.kOwed, value: centsTotal(owed), tone: owed > 0 ? 'bad' : '' },
      { label: L.kDue7, value: n7 },
      { label: L.kProfit, value: centsTotal(profit), tone: 'net' },
    ]} />
  );
}

// ---------- Board ----------
const COLS: [string, string, OrderStatus[]][] = [['pend', L.colPending, ['quoted', 'accepted']], ['prod', L.colProduction, ['in_production']], ['listo', L.colReady, ['ready']], ['entregado', L.colDelivered, ['delivered']]];

function Board({ items, today, onSeeDelivered }: { items: OrderListItem[]; today: string; onSeeDelivered: () => void }) {
  const delivered = useQuery({ queryKey: [...keys.orders, 'deliveredCount'], queryFn: async () => (await ordersApi.list({ status: 'delivered', pageSize: 1 })).data.total });
  const runner = useStepRunner();
  return (
    <div className="kan">
      {COLS.map(([k, label, sts]) => {
        let ps = items.filter((o) => sts.includes(o.status));
        ps = k === 'entregado' ? ps.sort((a, b) => (b.deliveredOn ?? b.dueOn).localeCompare(a.deliveredOn ?? a.dueOn)) : ps.sort((a, b) => a.dueOn.localeCompare(b.dueOn));
        const count = k === 'entregado' ? Math.max(delivered.data ?? 0, ps.length) : ps.length;
        return (
          <section key={k} className={`kcol k-${k}`} aria-label={label}>
            <header><h2>{label}</h2><Count n={count} light /></header>
            {ps.length ? ps.map((o) => <Card key={o.id} o={o} today={today} runner={runner} />) : <p className="kempty">{k === 'pend' ? L.emptyPending : L.emptyCol}</p>}
            {count > ps.length ? <button type="button" className="link" onClick={onSeeDelivered}>{t('screens.orders.seeDelivered', { count })}</button> : null}
          </section>
        );
      })}
      <StepDialogs runner={runner} />
    </div>
  );
}

export function dueText(o: { status: OrderStatus; dueOn: string; deliveredOn: string | null }, today: string) {
  const n = daysBetween(today, o.dueOn);
  if (o.status === 'delivered') return o.deliveredOn ? t('screens.orders.deliveredOn', { date: date(o.deliveredOn) }) : L.delivered;
  return n < 0 ? t('screens.orders.late', { days: -n }) : t('screens.orders.due', { rel: relativeDay(o.dueOn, today), date: date(o.dueOn) });
}

function Card({ o, today, runner }: { o: OrderListItem; today: string; runner: ReturnType<typeof useStepRunner> }) {
  const fin = !isActive(o.status);
  const n = daysBetween(today, o.dueOn);
  const all = o.items.flatMap((it) => itemRows(it, o.status, o.jobs));
  const oris = fin ? [] : originsOf(all);
  const mixed = oris.length > 1 || oris.some((x) => x.k === 'stock' || x.k === 'warn');
  const jobs = o.status === 'in_production' ? [...o.jobs].sort((a, b) => a.position - b.position) : [];
  const customer = o.customer || L.noCustomer;
  return (
    <article className={`kcard e-${STATUS_CLASS[o.status]}`} tabIndex={0} aria-label={t('screens.orders.cardAria', { folio: o.number, customer })} onClick={() => open(o.id)} onKeyDown={onKey(o.id)} data-testid="order-card">
      <div className="kc-h"><div><b>{customer}</b><span className="meta">{t('screens.orders.cardSub', { folio: o.number })}</span></div><StatusChip status={o.status} /></div>
      <ul className="kc-l">
        {o.items.slice(0, 4).map((it, i) => (
          <li key={i}><span className="num">{it.qty} ×</span> {it.name}{it.kind === 'set' ? <small> · {t('screens.orders.setPieces', { count: it.parts.reduce((a, p) => a + p.qty, 0) })}</small> : null}</li>
        ))}
        {o.items.length > 4 ? <li className="mut">{t('screens.orders.more', { count: o.items.length - 4 })}</li> : null}
        {mixed ? <li className="kc-s">{oris.map((x) => t('screens.orders.originCount', { label: originLabel(x.k, x.n), n: x.n })).join(' · ')}</li> : null}
      </ul>
      {jobs.length ? (
        <div className="kc-p">{jobs.map((j) => (
          <div key={j.printerId}>
            <span className="meta"><Icon name="printer" size={13} />{j.printerName}<em>{j.position === 0 ? t('screens.orders.jobLeft', { n: j.progress, time: queueDuration(j.remainingMinutes) }) : t('screens.orders.jobQueued', { time: queueDuration(j.waitMinutes) })}</em></span>
            {j.position === 0 ? <Meter value={j.progress} /> : null}
          </div>
        ))}</div>
      ) : null}
      {o.status === 'in_production' && !jobs.length ? <p className="kc-a">{L.noPrinter} <button type="button" className="link" onClick={(e) => { e.stopPropagation(); go(`/pedidos/pedido?id=${o.id}&tab=produccion`); }}>{L.assign}</button></p> : null}
      <p className={`due${!fin && n < 0 ? ' late' : !fin && n <= 2 ? ' warn' : ''}`}><Icon name="clock" size={13} />{dueText(o, today)}</p>
      <dl>
        <div><dt>{L.total}</dt><dd className="num">{centsTotal(o.totalCents)}</dd></div>
        <div><dt>{o.owedCents > 0 ? L.owed : L.paid}</dt><dd className={`num ${o.owedCents > 0 ? 'neg' : ''}`}>{centsTotal(o.owedCents > 0 ? o.owedCents : o.totalCents)}</dd></div>
        <div><dt>{L.profit}</dt><dd className={`num ${o.profitCents >= 0 ? 'pos' : 'neg'}`}>{centsTotal(o.profitCents)}</dd></div>
      </dl>
      {o.nextStep ? <NextStepButton order={o} runner={runner} size="sm" block /> : null}
    </article>
  );
}

// ---------- List ----------
const FILTERS: [string, string, OrderStatus[] | null][] = [['todos', L.fAll, null], ['pend', L.fPending, ['quoted', 'accepted']], ['prod', L.fProduction, ['in_production']], ['listo', L.fReady, ['ready']], ['entregado', L.fDelivered, ['delivered']], ['cancelado', L.fCancelled, ['cancelled']]];

function ListView({ filter, setFilter, today }: { filter: string; setFilter: (f: string) => void; today: string }) {
  const all = useOrderList('list').data?.items ?? [];
  const sel = FILTERS.find((f) => f[0] === filter) ?? FILTERS[0]!;
  const rows = all.filter((o) => !sel[2] || sel[2].includes(o.status)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return (
    <>
      <div className="tags" role="group" aria-label={L.filterAria}>
        {FILTERS.map((f) => <button key={f[0]} type="button" className={`tag${sel[0] === f[0] ? ' on' : ''}`} aria-pressed={sel[0] === f[0]} onClick={() => setFilter(f[0])}>{f[1]} {all.filter((o) => !f[2] || f[2].includes(o.status)).length}</button>)}
      </div>
      <Panel flush><div className="tw"><table className="tbl">
        <thead><tr><th>{L.colOrder}</th><th>{L.colStatus}</th><th>{L.colDue}</th><th className="r">{L.colTotal}</th><th className="r">{L.colOwed}</th></tr></thead>
        <tbody>
          {rows.map((o) => {
            const n = daysBetween(today, o.dueOn);
            const its = o.items.slice(0, 2).map((it) => (it.qty > 1 ? `${it.qty} × ` : '') + it.name).join(' + ') + (o.items.length > 2 ? ` ${t('screens.orders.itemsMore', { count: o.items.length - 2 })}` : '');
            return (
              <tr key={o.id} className="click" tabIndex={0} onClick={() => open(o.id)} onKeyDown={onKey(o.id)} data-testid="order-row">
                <td><b>{t('screens.orders.rowTitle', { folio: o.number, customer: o.customer || L.noCustomer })}</b><small className="blk">{its}</small></td>
                <td><StatusChip status={o.status} /></td>
                <td className={`nw ${isActive(o.status) && n <= 1 ? 'neg' : ''}`}>{o.status === 'delivered' ? date(o.deliveredOn ?? o.dueOn) : o.status === 'cancelled' ? '—' : <>{date(o.dueOn)}<small className="blk">{relativeDay(o.dueOn, today)}</small></>}</td>
                <td className="r num">{centsTotal(o.totalCents)}</td>
                <td className={`r num ${o.owedCents > 0 ? 'neg' : 'mut'}`}>{o.status === 'cancelled' ? '—' : o.owedCents > 0 ? centsTotal(o.owedCents) : L.paid}</td>
              </tr>
            );
          })}
          {!rows.length ? <tr><td colSpan={5} className="empty-td"><p>{L.listEmpty}</p></td></tr> : null}
        </tbody>
      </table></div></Panel>
    </>
  );
}

// ---------- Calendar ----------
const ym = (iso: string) => iso.slice(0, 7);
const addMonths = (m: string, d: number) => { const [y, mo] = m.split('-').map(Number) as [number, number]; const x = new Date(Date.UTC(y, mo - 1 + d, 1)); return x.toISOString().slice(0, 7); };
const isoUTC = (d: Date) => d.toISOString().slice(0, 10);
const WD = [L.weekdays.mon, L.weekdays.tue, L.weekdays.wed, L.weekdays.thu, L.weekdays.fri, L.weekdays.sat, L.weekdays.sun];

/** Opens on the month of the next pending delivery when this month has none (mockup calAuto). */
function autoMonth(active: OrderListItem[], today: string) {
  const dues = active.map((o) => o.dueOn).sort();
  if (!dues.length || dues.some((d) => ym(d) === ym(today))) return ym(today);
  return ym(dues.find((d) => d >= today) ?? dues[0]!);
}

function CalendarView({ month, active, today, onMonth }: { month: string | undefined; active: OrderListItem[]; today: string; onMonth: (m: string) => void }) {
  const all = (useOrderList('list').data?.items ?? []).filter((o) => o.status !== 'cancelled');
  const m = month ?? autoMonth(active, today);
  const [y, mo] = m.split('-').map(Number) as [number, number];
  const base = new Date(Date.UTC(y, mo - 1, 1));
  const lead = (base.getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const weeks = Math.ceil((lead + daysIn) / 7);
  const title = base.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const Title = title.charAt(0).toUpperCase() + title.slice(1);
  const inMonth = all.filter((o) => ym(o.dueOn) === m && isActive(o.status));
  const tot = inMonth.reduce((a, o) => a + o.totalCents, 0);
  const late = active.filter((o) => daysBetween(today, o.dueOn) < 0).length;
  const cells = Array.from({ length: weeks * 7 }, (_, i) => new Date(Date.UTC(y, mo - 1, 1 - lead + i)));
  return (
    <>
      <Panel className="cal-panel"><div className="cal-h">
        <div><h2>{Title}</h2><p className="muted">
          {inMonth.length ? tbc('screens.orders.calPending', { count: inMonth.length, total: centsTotal(tot) }) : L.calNone}
          {late ? <> {tbc('screens.orders.calLate', { count: late }, { count: 'r' })}</> : null}
        </p></div>
        <div className="btnrow">
          <button type="button" className="btn sm" aria-label={L.prevMonth} onClick={() => onMonth(addMonths(m, -1))}><Icon name="back" size={14} /></button>
          <button type="button" className="btn sm" onClick={() => onMonth(ym(today))}>{L.today}</button>
          <button type="button" className="btn sm" aria-label={L.nextMonth} onClick={() => onMonth(addMonths(m, 1))}><span className="flip"><Icon name="back" size={14} /></span></button>
        </div>
      </div>
      <div className="cal" role="group" aria-label={t('screens.orders.calAria', { month: title })}>
        <div className="cal-w" aria-hidden="true">{WD.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="cal-g">{cells.map((d) => {
          const k = isoUTC(d);
          const lp = all.filter((o) => o.dueOn === k).sort((a, b) => Number(a.status === 'delivered') - Number(b.status === 'delivered'));
          const wd = d.toLocaleDateString('es-MX', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');
          return (
            <div key={k} className={`cal-d${d.getUTCMonth() !== mo - 1 ? ' fuera' : ''}${k === today ? ' hoy' : ''}${lp.length ? '' : ' vacio'}`}>
              <span className="cal-n">{d.getUTCDate()}<em>{wd}</em></span>
              {lp.slice(0, 3).map((o) => (
                <button key={o.id} type="button" className={`cal-p e-${STATUS_CLASS[o.status]}${isActive(o.status) && k < today ? ' tarde' : ''}`} onClick={() => open(o.id)}
                  title={t('screens.orders.calTitle', { folio: o.number, customer: o.customer || L.noCustomer, status: es.status.order[o.status] })}><b>#{o.number}</b> {o.customer || L.noCustomer}</button>
              ))}
              {lp.length > 3 ? <small>{t('screens.orders.calMore', { count: lp.length - 3 })}</small> : null}
            </div>
          );
        })}</div>
      </div></Panel>
    </>
  );
}
