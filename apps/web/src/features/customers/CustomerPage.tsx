// Ficha del cliente (docs/06 §12, mockup vCliente): who they are, what they bought and their history.
import type { OrderStatusValue } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Pill, type Tone } from '../../components/Pill';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date } from '../../lib/format';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { keys } from '../../lib/queries';
import { rich } from '../sales/rich';
import { customersApi, type CustomerDetail } from './api';
import { CustomerDialog } from './CustomerDialog';
import { Avatar } from './CustomersPage';
import './customers.css';

const L = es.screens.customers;
export const ORDER_TONE: Record<OrderStatusValue, Tone> = { quoted: '', accepted: 'info', in_production: 'warn', ready: 'good', delivered: '', cancelled: 'bad' };

export function CustomerPage() {
  const { id } = useSearch({ strict: false }) as { id?: string };
  const { data: c, isError } = useQuery({ queryKey: [...keys.customers, 'detail', id], queryFn: async () => (await customersApi.get(id!)).data, enabled: Boolean(id) });
  const [editing, setEditing] = useState(false);
  const del = useWrite((x: CustomerDetail) => customersApi.remove(x.id), {
    touches: ['customers', 'search'], ok: (_o, x) => t('toast.customer.deleted', { name: x.name }), undo: (_o, x) => () => customersApi.restore(x.id),
    onDone: () => go('/clientes'),
  });
  const gone = !id || isError;
  useEffect(() => { if (gone) go('/clientes', true); }, [gone]);
  if (gone) return null;
  if (!c) return <div className="skel" />;
  const st = c.totals;
  const noHistory = !st.orders && !st.sales;
  const phrase = noHistory ? L.noHistory : (
    <>
      {rich(L.phrase, { sales: st.sales, orders: st.orders }, { income: <b>{centsTotal(st.incomeCents)}</b>, profit: <b className={st.profitCents >= 0 ? 'g' : 'r'}>{centsTotal(st.profitCents)}</b> })}{' '}
      {st.activeOrders ? <>{rich(L.phraseActive, { count: st.activeOrders }, { count: <b>{st.activeOrders}</b> })}{' '}</> : null}
      {st.owedCents > 0 ? rich(L.phraseOwes, {}, { amount: <b className="r">{centsTotal(st.owedCents)}</b> }) : L.phraseClear}
    </>
  );
  const logo = c.logoFileId ? <Pill tone="good">{L.logoImage}</Pill> : c.hasLogo ? <Pill tone="good">{L.logoFile}</Pill> : <Pill tone="plain">{L.logoNone}</Pill>;
  const copy = () => void navigator.clipboard?.writeText(c.phone).then(() => toast(t('toast.copy.done', { what: L.contactWhat })), () => toast(es.toast['copy.failed']));
  // Sales that came from an order are already in the order's row (mockup cliHistorial).
  const rows = c.history.filter((h) => h.kind === 'order' || !h.orderId);
  return (
    <>
      <nav className="crumbs"><a href="/clientes" onClick={(e) => { e.preventDefault(); go('/clientes'); }}>{L.title}</a><span>/</span><span>{c.name}</span></nav>
      <header className="ph">
        <div className="cli-id"><Avatar c={c} /><div><h1>{c.name}</h1><p className="sub">{t('screens.customers.since', { type: c.type, date: date(c.createdOn) })}</p></div></div>
        <div className="ph-a">
          <Button variant="primary" onClick={() => go(`/armar?modo=pedido&cliente=${c.id}`)}>{L.newOrder}</Button>
          <Button onClick={() => go(`/armar?modo=venta&cliente=${c.id}`)}>{L.newSale}</Button>
          <Button variant="ghost" onClick={() => setEditing(true)}>{L.edit}</Button>
        </div>
      </header>
      <section className="brf one sm"><div><p className="brf-l">{phrase}</p></div></section>
      <div className="cli-g">
        <aside className="cli-s">
          <dl className="dl one">
            <div><dt>{L.contact}</dt><dd>{c.phone ? <>{c.phone}{' '}<button type="button" className="link" onClick={copy}>{L.copy}</button></> : <span className="mut">{L.noContact}</span>}</dd></div>
            <div><dt>{L.logo}</dt><dd>{logo}</dd></div>
          </dl>
          {c.note ? <p className="note">{c.note}</p> : null}
          <div className="det-z">
            {noHistory
              ? <ConfirmButton variant="ghost" danger size="sm" confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(c)}>{L.deleteCustomer}</ConfirmButton>
              : <p className="hint">{t('screens.customers.cantDelete', { orders: st.orders, sales: st.sales })}</p>}
          </div>
        </aside>
        <section>
          <h2>{L.history}</h2>
          {rows.length ? (
            <>
              <div className="tw">
                <table className="tbl sm hist">
                  <thead><tr><th>{L.hDate}</th><th>{L.hDetail}</th><th>{L.hStatus}</th><th className="r">{L.hTotal}</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 12).map((h) => h.kind === 'order' ? (
                      <tr key={h.id} className="click" tabIndex={0} onClick={() => go(`/pedidos/pedido?id=${h.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') go(`/pedidos/pedido?id=${h.id}`); }}>
                        <td>{date(h.on)}</td><td><b>{t('screens.customers.hOrder', { folio: h.number })}</b><small className="blk">{h.itemsText}</small></td>
                        <td><Pill tone={ORDER_TONE[h.status]}>{es.status.order[h.status]}</Pill></td><td className="r num">{centsTotal(h.totalCents)}</td>
                      </tr>
                    ) : (
                      <tr key={h.id} className="click" tabIndex={0} onClick={() => go(`/ventas?v=${h.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') go(`/ventas?v=${h.id}`); }}>
                        <td>{date(h.on)}</td><td><b>{L.hSale}</b><small className="blk">{h.itemsText}</small></td>
                        <td>{h.returned ? <Pill tone="bad">{L.hReturned}</Pill> : h.owedCents > 0 ? <Pill tone="warn">{t('screens.customers.hOwes', { amount: centsTotal(h.owedCents) })}</Pill> : <Pill tone="good">{L.hPaid}</Pill>}</td>
                        <td className="r num">{centsTotal(h.grossCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 12 ? <p className="hint">{t('screens.customers.hShowing', { count: rows.length })}</p> : null}
            </>
          ) : <p className="muted">{L.noHistory}</p>}
        </section>
      </div>
      {editing ? <CustomerDialog customer={c} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} /> : null}
    </>
  );
}
