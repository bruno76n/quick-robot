// Ventas (docs/06 §4; ronda-3 §6, reference/ronda-3/ventas.html): last 60 days, the strip of figures, the channel
// filter (segmented switch as before, exception 1) and the table with Saldo or Devuelta next to the total.
import { addDays } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Kpis } from '../../components/Kpis';
import { Panel } from '../../components/Panel';
import { Pill } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { todayLocal } from '../../lib/input';
import { centsTotal, date } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys, useSettings } from '../../lib/queries';
import { salesApi, type SaleListItem } from './api';
import { VsList } from './Breakdown';
import { SaleDialogs } from './SaleDialogs';
import './sales.css';

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

/** "Saldo $X" opens the sale with its payment dialog already open (ronda-2 §12, D5). */
function OwesChip({ id, owedCents }: { id: string; owedCents: number }) {
  const text = t('screens.sales.owes', { amount: centsTotal(owedCents) });
  return (
    <button type="button" className="chip bad chip-btn" aria-label={t('screens.sales.owesPay', { owes: text })} onClick={(e) => { e.stopPropagation(); go(`/ventas?v=${id}&abono=1`); }} onKeyDown={(e) => e.stopPropagation()}>{text}</button>
  );
}

export function SalesPage() {
  const search = useSearch({ strict: false }) as { v?: string; abono?: string };
  const today = todayLocal();
  const from = addDays(today, -59);
  const [channel, setChannel] = useState(ALL);
  const channels = useSettings().data?.channels ?? [];
  const { data } = useQuery({ queryKey: [...keys.sales, 'list', from, today], queryFn: async () => (await salesApi.list({ from, to: today, pageSize: 200 })).data });
  const all = data?.items ?? [];
  const shown = all.filter((s) => channel === ALL || s.channelId === channel);
  const live = shown.filter((s) => !s.returned);
  const sum = (f: (s: SaleListItem) => number) => live.reduce((a, s) => a + f(s), 0);
  const owing = shown.filter((s) => s.owedCents > 0);
  const owed = owing.reduce((a, s) => a + s.owedCents, 0);
  const profit = sum((s) => s.profitCents);
  const open = (id: string) => go(`/ventas?v=${id}`);
  const newSale = () => go('/armar?modo=venta');
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={<Button variant="primary" icon="plus" onClick={newSale}>{L.register}</Button>} />
      {data ? (
        <div data-testid="sales-figures"><Kpis label={L.figures} items={[
          { label: L.kSales, value: centsTotal(sum((s) => s.incomeCents)), sub: t('screens.sales.kCount', { count: live.length }) },
          { label: L.kGross, value: centsTotal(profit), tone: profit < 0 ? 'bad' : 'net' },
          { label: L.kCommissions, value: centsTotal(sum((s) => s.commissionCents)) },
          { label: L.kOwed, value: centsTotal(owed), tone: owed > 0 ? 'bad' : '', sub: t('screens.sales.kCount', { count: owing.length }) },
        ]} /></div>
      ) : <div className="skel" />}
      <div className="toolbar">
        <div className="seg" role="group" aria-label={L.channelGroup}>
          {[{ id: ALL, name: L.allChannels }, ...channels].map((x) => <button key={x.id} type="button" className={channel === x.id ? 'on' : undefined} aria-pressed={channel === x.id} onClick={() => setChannel(x.id)}>{x.name}</button>)}
        </div>
      </div>
      <Panel flush className="sales-p">
        <Table fit className="big" head={<><Th>{L.colDate}</Th><Th>{L.colItems}</Th><Th hideSm>{L.colChannel}</Th><Th r>{L.colTotal}</Th><Th r>{L.colProfit}</Th></>}>
          {shown.map((s) => {
            const det = [s.customer, s.orderNumber !== null ? t('screens.sales.orderRef', { folio: s.orderNumber }) : '', s.note].filter(Boolean).join(' · ');
            return (
              <tr key={s.id} className="click" tabIndex={0} data-testid="sale-row" onClick={() => open(s.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(s.id); }}>
                <Td className="nw num">{date(s.on)}</Td>
                <Td>
                  {s.items ? <ItemsList items={s.items} /> : <ul className="itl"><li><b>{s.itemsText}</b></li></ul>}
                  {det ? <span className="meta">{det}</span> : null}
                  <span className="meta sale-ch">{s.channel}</span>
                </Td>
                <Td hideSm>{s.channel}</Td>
                <Td r className="sale-tot">
                  <span className="sale-amt">
                    {s.returned ? <s className="mut num">{centsTotal(s.totalCents)}</s> : <span className="num">{centsTotal(s.incomeCents)}</span>}
                    {s.returned ? <Pill>{L.returned}</Pill> : s.owedCents > 0 ? <OwesChip id={s.id} owedCents={s.owedCents} /> : null}
                  </span>
                  {!s.returned && s.listCents ? <VsList list={s.listCents} price={s.incomeCents} /> : null}
                </Td>
                <Td r className={`num sale-g ${s.returned ? 'mut' : s.profitCents >= 0 ? 'pos' : 'neg'}`}>{s.returned ? '—' : centsTotal(s.profitCents)}</Td>
              </tr>
            );
          })}
          {data && !shown.length ? <tr><td colSpan={5} className="empty-td"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={newSale}>{L.registerFirst}</Button></td></tr> : null}
        </Table>
      </Panel>
      {search.v ? <SaleDialogs key={search.v} id={search.v} startWithPayment={search.abono === '1'} onClose={() => go('/ventas', true)} /> : null}
    </>
  );
}
