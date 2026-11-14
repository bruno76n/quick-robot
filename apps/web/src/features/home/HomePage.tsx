// Inicio (docs/06 §2; ronda-3 §6, reference/ronda-3/inicio.html): sales of the last 30 days with the big figure, the
// strip (gross profit, expenses, net profit, owed) and sales by week; the alerts by priority; what is printing now and
// the next deliveries. The mascot stays in the title (person's exception 3).
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { WeekColumns } from '../../components/charts';
import { Kpis } from '../../components/Kpis';
import { Mascot } from '../../components/Mascot';
import { Meter } from '../../components/Meter';
import { Panel } from '../../components/Panel';
import { Pill } from '../../components/Pill';
import { Icon } from '../../components/Icon';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, pct, queueDuration } from '../../lib/format';
import { go } from '../../lib/nav';
import { todayLocal } from '../../lib/input';
import { STATUS_TONE, type OrderStatus } from '../orders/api';
import { useHome, useReport, type Home, type Report } from '../reports/api';
import { bucketColumns, deltaPct } from '../reports/buckets';
import { Attentions } from './Attentions';
import './home.css';

const L = es.screens.home;
const longDay = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
/** "Viernes 13 de noviembre". */
const today = (iso: string) => { const s = longDay.format(new Date(`${iso}T12:00:00Z`)).replace(',', ''); return `${s[0]!.toUpperCase()}${s.slice(1)}`; };

/** "▲ 14.6%" in green or "▼ 3%" in red (red when it moves the bad way). */
export function Delta({ value, good = true }: { value: number | null; good?: boolean }) {
  if (value === null) return null;
  const up = value >= 0;
  return <span className={up === good ? 'up' : 'down'}>{t(up ? 'screens.home.up' : 'screens.home.down', { pct: pct(Math.abs(value)) })}</span>;
}

function Summary({ R, home }: { R: Report; home: Home | undefined }) {
  const T = R.totals;
  const A = R.previous;
  return (
    <section className="panel home-sum" aria-label={L.salesAria} data-testid="brief">
      <div className="sum-a">
        <span className="lbl">{L.salesLabel}</span>
        <b className="sum-big num">{centsTotal(T.incomeCents)}</b>
        {T.count ? (
          <span className="meta">
            {A?.count ? <><Delta value={deltaPct(T.incomeCents, A.incomeCents)} /> {L.vsPrev} · </> : null}{t('screens.home.salesCount', { count: T.count })}
          </span>
        ) : <span className="meta">{L.briefEmpty}</span>}
        <Kpis inline items={[
          { label: L.grossProfit, value: centsTotal(T.profitCents), tone: T.profitCents < 0 ? 'bad' : 'net', ...(A?.count ? { sub: <Delta value={deltaPct(T.profitCents, A.profitCents)} /> } : {}) },
          { label: L.expenses, value: centsTotal(R.expensesCents) },
          { label: L.netProfit, value: centsTotal(R.netProfitCents), tone: R.netProfitCents < 0 ? 'bad' : 'net' },
          { label: L.owed, value: home ? centsTotal(home.stats.owedCents) : '—' },
        ]} />
      </div>
      <div className="sum-b">
        <span className="lbl">{L.weekly}</span>
        <WeekColumns columns={bucketColumns(R)} legend={{ sales: es.screens.reports.sales, profit: L.grossProfit }} label={L.weeklyAria} testId="chart-cols" />
      </div>
    </section>
  );
}

function Printing({ home }: { home: Home }) {
  const s = home.stats;
  if (!s.printers) {
    return (
      <Panel title={L.printing}>
        <p className="meta">{L.printersEmpty}</p>
        <Button size="sm" className="mt" onClick={() => go('/impresoras')}>{L.goPrinters}</Button>
      </Panel>
    );
  }
  return (
    <Panel title={L.printing} aside={<span className="meta">{t('screens.home.printingOf', { busy: s.printersBusy, count: s.printers })}</span>}>
      {home.printingNow.length ? (
        <ul className="pp">{home.printingNow.map((p) => (
          <li key={p.printerId}>
            <div className="pp-h"><b>{p.printer}</b><span className="num">{pct(p.progress)}</span></div>
            <span className="meta">{p.text}{p.orderNumber ? t('screens.home.printOrder', { number: p.orderNumber }) : ''}</span>
            <Meter value={p.progress} />
            <span className="meta pp-t"><Icon name="clock" size={13} />{t('screens.home.remaining', { time: queueDuration(p.remainingMinutes) })}</span>
          </li>
        ))}</ul>
      ) : <p className="meta">{L.printingNone}</p>}
    </Panel>
  );
}

function Upcoming({ home }: { home: Home }) {
  return (
    <Panel title={L.upcoming}>
      {home.upcoming.length ? (
        <ul className="du">{home.upcoming.map((o) => (
          <li key={o.id} className="click" role="link" tabIndex={0} onClick={() => go(`/pedidos/pedido?id=${o.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') go(`/pedidos/pedido?id=${o.id}`); }}>
            <span className="du-d num">{date(o.dueOn)}</span>
            <span className="du-c"><b>{o.customer || es.screens.orders.noCustomer}</b><span className="meta">{t('screens.home.upcomingOrder', { number: o.number })}</span></span>
            <Pill tone={STATUS_TONE[o.status as OrderStatus] ?? ''}>{es.status.order[o.status as OrderStatus] ?? o.status}</Pill>
          </li>
        ))}</ul>
      ) : <p className="meta">{L.upcomingEmpty}</p>}
    </Panel>
  );
}

export function HomePage() {
  const home = useHome().data;
  const R = useReport('30').data;
  const att = home?.attentions ?? [];
  return (
    <>
      <PageHead title={<><Mascot size={36} /><span>{L.title}</span></>} short={L.title} sub={today(todayLocal())} actions={<>
        <Button onClick={() => go('/armar?modo=venta')}>{L.newSale}</Button>
        <Button onClick={() => go('/armar?modo=pedido')}>{L.newOrder}</Button>
        <Button variant="primary" icon="plus" onClick={() => go('/productos/pieza')}>{L.newPiece}</Button>
      </>} />
      {R ? <Summary R={R} home={home} /> : <div className="skel" />}
      <div className="home-row2">
        {!home ? <section className="panel" aria-busy="true" /> : null}
        {home && !att.length ? <Panel title={L.attention.title}><div className="allok"><Mascot size={64} /><div><b>{L.allOk}</b><p>{L.allOkText}</p></div></div></Panel> : null}
        {att.length ? <Attentions items={att} /> : null}
        {home ? (
          <div className="home-stack">
            <Printing home={home} />
            <Upcoming home={home} />
          </div>
        ) : null}
      </div>
    </>
  );
}
