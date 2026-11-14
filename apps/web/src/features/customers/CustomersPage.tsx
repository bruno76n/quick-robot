// Clientes (docs/06 §12): list with contact, orders, purchases, what each one owes and last activity.
// Ronda 3: figures strip and table of reference/ronda-3/clientes.html.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { Kpis } from '../../components/Kpis';
import { Mascot } from '../../components/Mascot';
import { Panel } from '../../components/Panel';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys } from '../../lib/queries';
import { customersApi, type CustomerView } from './api';
import { CustomerDialog } from './CustomerDialog';
import './customers.css';

const L = es.screens.customers;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export function Avatar({ c }: { c: Pick<CustomerView, 'name' | 'logoUrl'> }) {
  return c.logoUrl ? <span className="av logo"><img src={c.logoUrl} alt="" /></span> : <span className="av">{initials(c.name)}</span>;
}

export const useCustomers = () => useQuery({ queryKey: [...keys.customers, 'list'], queryFn: async () => (await customersApi.list()).data });

export function CustomersPage() {
  const { data } = useCustomers();
  const [creating, setCreating] = useState(false);
  const list = [...(data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const income = list.reduce((a, c) => a + c.incomeCents, 0), owed = list.reduce((a, c) => a + c.owedCents, 0), active = list.filter((c) => c.activeOrders > 0).length;
  const open = (id: string) => go(`/clientes/cliente?id=${id}`);
  const sub = list.length ? t('screens.customers.sub', { count: list.length }) : L.subEmpty;
  return (
    <>
      <PageHead title={L.title} sub={sub} actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{L.newCustomer}</Button>} />
      {list.length ? (
        <Kpis label={L.kpisAria} className="cli-k" items={[
          { label: L.title, value: list.length },
          { label: L.kActive, value: active },
          { label: L.colPurchases, value: centsTotal(income) },
          { label: L.kOwed, value: centsTotal(owed), tone: owed > 0 ? 'bad' : '' },
        ]} />
      ) : null}
      <Panel flush className="cli-p">
        <Table fit className="cli-t" head={<><Th>{L.colCustomer}</Th><Th hideSm>{L.colContact}</Th><Th r hideSm>{L.colOrders}</Th><Th r>{L.colPurchases}</Th><Th r>{L.colOwes}</Th><Th r hideSm>{L.colLast}</Th></>}>
          {list.map((c) => (
            <tr key={c.id} className="click" tabIndex={0} data-testid="customer-row" onClick={() => open(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(c.id); }}>
              <Td><div className="pn"><Avatar c={c} /><div><b>{c.name}</b><span className="meta">{c.type}</span></div></div></Td>
              <Td hideSm>{c.phone || <span className="meta">{L.noContact}</span>}</Td>
              <Td r hideSm className="num">{c.orders}</Td>
              <Td r className="num">{centsTotal(c.incomeCents)}</Td>
              <Td r className={`num ${c.owedCents > 0 ? 'owe' : 'mut'}`}>{c.owedCents > 0 ? centsTotal(c.owedCents) : '—'}</Td>
              <Td r hideSm className="num nw">{c.lastActivity ? date(c.lastActivity) : '—'}</Td>
            </tr>
          ))}
          {data && !list.length ? <tr><td colSpan={6} className="empty-td"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={() => setCreating(true)}>{L.newCustomer}</Button></td></tr> : null}
        </Table>
      </Panel>
      {creating ? <CustomerDialog onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); open(c.id); }} /> : null}
    </>
  );
}
