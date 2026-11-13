// Ajustes › Exportar a Excel (docs/06 §15; mockup datosHTML, EXPORTA, exportarCsv): seven tables, download or copy.
import type { FilamentDetail } from '@app/contract';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api, request } from '../../lib/api';
import { csvFile, csvMoney, csvName, csvText, type CsvCell } from '../../lib/csv';
import { errorText } from '../../lib/errors';
import { todayLocal } from '../../lib/input';
import { saveFile } from '../../lib/platform';
import { useSettings } from '../../lib/queries';
import { allExpenses } from '../expenses/api';

const C = es.screens.csv;
const L = es.screens.settings;
export const CSV_TABLES = ['sales', 'orders', 'customers', 'pieces', 'filaments', 'supplies', 'expenses'] as const;
export type CsvTable = (typeof CSV_TABLES)[number];
type Rows = CsvCell[][];

async function pages<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const r = (await request<{ items: T[]; total: number }>('GET', `${path}${path.includes('?') ? '&' : '?'}page=${page}&pageSize=200`)).data;
    out.push(...r.items);
    if (!r.items.length || out.length >= r.total) return out;
  }
}

interface SaleRow { on: string; customer: string; channel: string; itemsText: string; pieces: number; incomeCents: number; costCents: number; commissionCents: number; profitCents: number }
interface OrderRow { number: number; customer: string; status: keyof typeof es.status.order; dueOn: string; itemsText: string; totalCents: number; paidCents: number }
interface CustomerRow { name: string; type: string; phone: string; note: string; createdOn: string }

/** The rows of each table, read from the server at the moment of exporting. */
export const TABLES: Record<CsvTable, () => Promise<Rows>> = {
  sales: async () => (await pages<SaleRow>('/sales')).sort((a, b) => a.on.localeCompare(b.on))
    .map((s) => [s.on, s.customer, s.channel, s.itemsText, s.pieces, csvMoney(s.incomeCents), csvMoney(s.costCents), csvMoney(s.commissionCents), csvMoney(s.profitCents)]),
  orders: async () => (await pages<OrderRow>('/orders')).sort((a, b) => a.number - b.number)
    .map((o) => [o.number, o.customer, es.status.order[o.status] ?? o.status, o.dueOn, o.itemsText, csvMoney(o.totalCents), csvMoney(o.paidCents)]),
  customers: async () => (await request<CustomerRow[]>('GET', '/customers')).data.map((c) => [c.name, c.type, c.phone, c.note, c.createdOn]),
  pieces: async () => (await api.products.options()).data.items.map((p) => [p.displayName, csvMoney(p.costCents), csvMoney(p.listCents), csvMoney(p.listCents - p.costCents), p.physical, p.tracksStock ? p.free : '']),
  filaments: async () => {
    const fils = (await api.filaments.list({ pageSize: 200 })).data.items;
    const details: FilamentDetail[] = await Promise.all(fils.map(async (f) => (await api.filaments.get(f.id)).data));
    return details.flatMap((f) => f.spools.map((s) => [`${f.material} ${f.color}`, s.brand, s.purchasedOn, s.grams, Math.max(0, s.remainingGrams), csvMoney(s.costCents + s.shippingCents)]));
  },
  supplies: async () => (await api.supplies.list()).data.items.map((i) => [i.name, i.unit, i.stock, csvMoney(i.costCents), i.minimum]),
  expenses: async () => [...(await allExpenses()).items].sort((a, b) => a.on.localeCompare(b.on))
    .map((g) => [g.on, g.concept, g.category, csvMoney(g.amountCents), g.recurring ? C.yes : C.no, g.endsOn ?? '']),
};

export function CsvExport() {
  const business = useSettings().data?.settings.business.name ?? '';
  const [which, setWhich] = useState<CsvTable>('sales');
  const [busy, setBusy] = useState<CsvTable | null>(null);
  const run = async (k: CsvTable, copy: boolean) => {
    setBusy(k);
    try {
      const rows = await TABLES[k]();
      const head = C.head[k] as readonly string[];
      if (copy) {
        await navigator.clipboard.writeText(csvText(head, rows)).then(() => toast(`${t('toast.copy.done', { what: C[k] })} ${C.pasteHint}`), () => toast(es.toast['copy.failed']));
      } else {
        await saveFile(csvName(business, C[k], todayLocal()), new TextEncoder().encode(csvFile(head, rows)), 'text/csv;charset=utf-8');
        toast(t('toast.csv.ready', { entity: C[k] }));
      }
    } catch (e) { toast(errorText(e).text); } finally { setBusy(null); }
  };
  return (
    <section className="dat" data-testid="csv-export">
      <h2>{L.exportTitle}</h2>
      <p className="muted">{L.exportHint}</p>
      <div className="exp-g">
        {CSV_TABLES.map((k) => <button key={k} type="button" className="exp" disabled={busy === k} onClick={() => void run(k, false)}><b>{C[k]}</b><small>{L.exportDownload}</small></button>)}
      </div>
      <div className="btnrow">
        <label className="fld inline"><span className="sr">{L.exportWhich}</span><select value={which} onChange={(e) => setWhich(e.target.value as CsvTable)}>{CSV_TABLES.map((k) => <option key={k} value={k}>{C[k]}</option>)}</select></label>
        <Button size="sm" onClick={() => void run(which, true)} busy={busy === which}>{L.exportCopy}</Button>
      </div>
    </section>
  );
}
