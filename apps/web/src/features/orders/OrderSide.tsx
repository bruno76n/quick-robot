// Right column of an order (ronda-3 D-9, mockup pedido.html .det-side): the customer with their orders and balance.
import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import { es } from '../../i18n/es';
import { centsTotal } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys } from '../../lib/queries';
import { customersApi } from '../customers/api';
import type { OrderDetail } from './api';

const L = es.screens.order;
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export function CustomerPanel({ o }: { o: OrderDetail }) {
  const list = useQuery({ queryKey: [...keys.customers, 'list'], queryFn: async () => (await customersApi.list()).data, enabled: !!o.customer }).data;
  const c = o.customer;
  const tot = c ? list?.find((x) => x.id === c.id) : undefined;
  return (
    <Panel title={L.customer}>
      {c ? <>
        <div className="cli-card">{c.logoUrl ? <span className="av logo"><img src={c.logoUrl} alt="" /></span> : <span className="av">{initials(c.name)}</span>}<div><b>{c.name}</b><small className="blk">{c.type} · {c.phone ? c.phone : <span className="neg">{L.noContact}</span>}{c.hasLogo ? L.withLogo : ''}</small></div></div>
        {tot ? <dl className="ped-kv two"><div><dt>{L.customerOrders}</dt><dd className="num">{tot.orders}</dd></div><div><dt>{L.customerOwed}</dt><dd className={`num ${tot.owedCents > 0 ? 'bad' : ''}`}>{centsTotal(tot.owedCents)}</dd></div></dl> : null}
        <div className="btnrow"><Button size="sm" onClick={() => go(`/clientes/cliente?id=${c.id}`)}>{L.seeCustomer}</Button><Button size="sm" variant="ghost" onClick={() => go(`/clientes/cliente?id=${c.id}`)}>{L.editCustomer}</Button></div>
      </> : <p className="note warn">{L.noCustomer}{o.status === 'quoted' || o.status === 'accepted' ? <> <button type="button" className="link" onClick={() => go(`/armar?modo=pedido&id=${o.id}`)}>{L.chooseCustomer}</button></> : null}</p>}
    </Panel>
  );
}
