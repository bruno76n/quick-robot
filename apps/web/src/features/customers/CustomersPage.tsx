// Clientes (docs/06 §12, mockup vClientes): list with contact, purchases and what each one owes.
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys } from '../../lib/queries';
import { rich } from '../sales/rich';
import { customersApi, type CustomerView } from './api';
import { CustomerDialog } from './CustomerDialog';

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
  const sub = list.length ? t('screens.customers.sub', { count: list.length }) + (active ? t('screens.customers.subActive', { count: active }) : '') : L.subEmpty;
  return (
    <>
      <PageHead title={L.title} sub={sub} actions={<Button variant="primary" icon="plus" onClick={() => setCreating(true)}>{L.newCustomer}</Button>} />
      {list.length && owed > 0 ? <section className="brf one sm"><div><p className="brf-l">{rich(L.summary, {}, { income: <b>{centsTotal(income)}</b>, owed: <b className="r">{centsTotal(owed)}</b> })}</p></div></section> : null}
      <div className="tw">
        <table className="tbl cli-t">
          <thead><tr><th>{L.colCustomer}</th><th>{L.colContact}</th><th className="r">{L.colPurchases}</th><th className="r">{L.colOwes}</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="click" tabIndex={0} data-testid="customer-row" onClick={() => open(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') open(c.id); }}>
                <td><div className="pn"><Avatar c={c} /><div><b>{c.name}</b><small>{c.type}</small></div></div></td>
                <td>{c.phone || <span className="mut">{L.noContact}</span>}</td>
                <td className="r num">{centsTotal(c.incomeCents)}</td>
                <td className={`r num ${c.owedCents > 0 ? 'neg' : 'mut'}`}>{c.owedCents > 0 ? centsTotal(c.owedCents) : '—'}</td>
              </tr>
            ))}
            {data && !list.length ? <tr><td colSpan={4} className="empty-td"><Mascot size={48} /><p>{L.empty}</p><Button variant="primary" onClick={() => setCreating(true)}>{L.newCustomer}</Button></td></tr> : null}
          </tbody>
        </table>
      </div>
      {creating ? <CustomerDialog onClose={() => setCreating(false)} onSaved={(c) => { setCreating(false); open(c.id); }} /> : null}
    </>
  );
}
