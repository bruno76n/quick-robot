// Ventas (docs/06 §4, mockup vVentas): last 60 days, summary, channel filter and the sale dialog.
import { addDays } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Pill } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { todayLocal } from '../../lib/input';
import { centsTotal, date } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys, useSettings } from '../../lib/queries';
import { salesApi, type SaleListItem } from './api';
import { VsList } from './Breakdown';
import { rich } from './rich';
import { SaleDialogs } from './SaleDialogs';
import { SalesBrief } from './SalesBrief';

const L = es.screens.sales;
const ALL = 'all';

export function ItemsList({ items, max = 3 }: { items: SaleListItem['items']; max?: number }) {
  return (
    <ul className="itl">
      {items.slice(0, max).map((it, i) => (
        <li key={i}>
          {it.qty > 1 ? <><span className="num">{it.qty} ×</span>{' '}</> : null}<b>{it.name}</b>
          {it.kind === 'set' ? <>{' '}<Pill tone="info">{L.collection}</Pill></> : null}
          {it.kind === 'set' && it.parts.length ? <small className="blk">{it.parts.map((p) => (p.qty * it.qty > 1 ? `${p.qty * it.qty} × ` : '') + p.name).join(', ')}</small> : null}
        </li>
      ))}
      {items.length > max ? <li className="mut">{t('screens.sales.more', { count: items.length - max })}</li> : null}
    </ul>
  );
}

/** "Debe $X" opens the sale with its payment dialog already open (ronda-2 §12, D5). */
function OwesChip({ id, owedCents }: { id: string; owedCents: number }) {
  const text = t('screens.sales.owes', { amount: centsTotal(owedCents) });
  return (
    <button type="button" className="chip warn chip-btn" aria-label={t('screens.sales.owesPay', { owes: text })} onClick={(e) => { e.stopPropagation(); go(`/ventas?v=${id}&abono=1`); }} onKeyDown={(e) => e.stopPropagation()}>{text}</button>
  );
}

export function SalesPage() {
  const search = useSearch({ strict: false }) as { v?: string; abono?: string };
  const today = todayLocal();
  const from = addDays(today, -59);
  const [channel, setChannel] = useState(ALL);
  const channels = useSettings().data?.channels ?? [];
  const { data } = useQuery({ queryKey: [...keys.sales, 'list', from, today], queryFn: async () => (await salesApi.list({ from, to: today, pageSize: 200 })).data });
  const { data: rep } = useQuery({ queryKey: [...keys.reports, 'sales-brief', from, today], queryFn: async () => (await salesApi.concepts(from, today)).data });
  const all = data?.items ?? [];
  const shown = all.filter((s) => channel === ALL || s.channelId === channel);
  const live = shown.filter((s) => !s.returned);
  const T = {
    count: live.length, income: live.reduce((a, s) => a + s.incomeCents, 0) / 100, cost: live.reduce((a, s) => a + s.costCents, 0) / 100,
    commission: live.reduce((a, s) => a + s.commissionCents, 0) / 100, profit: live.reduce((a, s) => a + s.profitCents, 0) / 100,
  };
  // Cost by concept comes from the report (all channels); a channel gets its share by cost (estimate, like the mockup).
  const c = rep?.costConcepts;
  const share = rep && rep.totals.costCents > 0 ? (T.cost * 100) / rep.totals.costCents : 0;
  const K = c ? { M: (c.materialCents * share) / 100, L: (c.powerCents * share) / 100, Q: (c.machineCents * share) / 100, E: (c.extrasCents * share) / 100, F: (c.failureReserveCents * share) / 100 } : { M: 0, L: 0, Q: 0, E: T.cost, F: 0 };
  const owing = shown.filter((s) => s.owedCents > 0);
  const chName = channels.find((x) => x.id === channel)?.name ?? '';
  const open = (id: string) => go(`/ventas?v=${id}`);
  const newSale = () => go('/armar?modo=venta');
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={<Button variant="primary" icon="plus" onClick={newSale}>{L.register}</Button>} />
      {data ? <SalesBrief T={T} K={K} when={channel === ALL ? L.when : t('screens.sales.whenChannel', { channel: chName })} /> : <div className="skel" />}
      {owing.length ? <p className="note warn">{rich(L.owedNote, { count: owing.length }, { count: <b>{owing.length}</b>, amount: <b>{centsTotal(owing.reduce((a, s) => a + s.owedCents, 0))}</b> })}</p> : null}
      <div className="toolbar">
        <div className="seg" role="group" aria-label={L.channelGroup}>
          {[{ id: ALL, name: L.allChannels }, ...channels].map((x) => <button key={x.id} type="button" className={channel === x.id ? 'on' : undefined} aria-pressed={channel === x.id} onClick={() => setChannel(x.id)}>{x.name}</button>)}
        </div>
      </div>
      <div className="tw">
        <table className="tbl">
          <thead><tr><th>{L.colDate}</th><th>{L.colItems}</th><th className="r">{L.colTotal}</th><th className="r">{L.colProfit}</th></tr></thead>
          <tbody>
            {shown.map((s) => {
              const det = [s.customer, s.orderNumber !== null ? t('screens.sales.orderRef', { folio: s.orderNumber }) : '', s.channel, s.note].filter(Boolean).join(' · ');
              return (
                <tr key={s.id} className="click" tabIndex={0} data-testid="sale-row" onClick={() => open(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(s.id); }}>
                  <td className="nw">{date(s.on)}</td>
                  <td>{s.items ? <ItemsList items={s.items} /> : <ul className="itl"><li>{s.itemsText}</li></ul>}{det ? <small className="blk">{det}</small> : null}</td>
                  <td className="r num">
                    {s.returned ? <s className="mut">{centsTotal(s.totalCents)}</s> : <>{centsTotal(s.incomeCents)}{s.listCents ? <VsList list={s.listCents} price={s.incomeCents} /> : null}</>}
                    {s.returned ? <small className="blk"><Pill tone="bad">{L.returned}</Pill></small> : s.owedCents > 0 ? <small className="blk"><OwesChip id={s.id} owedCents={s.owedCents} /></small> : null}
                  </td>
                  <td className={`r num ${s.returned ? 'mut' : s.profitCents >= 0 ? 'pos' : 'neg'}`}><b>{s.returned ? '—' : centsTotal(s.profitCents)}</b></td>
                </tr>
              );
            })}
            {data && !shown.length ? <tr><td colSpan={4} className="empty-td"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={newSale}>{L.registerFirst}</Button></td></tr> : null}
          </tbody>
        </table>
      </div>
      {search.v ? <SaleDialogs key={search.v} id={search.v} startWithPayment={search.abono === '1'} onClose={() => go('/ventas', true)} /> : null}
    </>
  );
}
