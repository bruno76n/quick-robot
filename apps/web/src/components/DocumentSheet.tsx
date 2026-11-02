// Documents for customers (docs/06 §14, mockup docDatos/docHTML/docTxt): quote, order note and sale note.
// The business data (name, trade, phone, email, city, validity, footer) comes from Ajustes, never from the code.
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { es } from '../i18n/es';
import { t } from '../i18n/t';
import { request } from '../lib/api';
import { date, money } from '../lib/format';
import { keys, useSettings } from '../lib/queries';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { toast } from './Toast';

export type DocumentKind = 'quote' | 'order_note' | 'sale_note';

interface DocItem { kind: 'piece' | 'set'; name: string; qty: number; priceCents: number; parts: { name: string; qty: number }[] }
interface DocSource { number: number | null; on: string; customerId: string | null; customerName: string; items: DocItem[]; totalCents: number; paidCents: number; owedCents: number; dueOn: string | null; note: string }
interface Business { name: string; trade: string; phone: string; email: string; city: string; quoteValidDays: number; footer: string }

const L = es.screens.documents;
const enc = encodeURIComponent;

async function load(kind: DocumentKind, id: string): Promise<DocSource> {
  if (kind === 'sale_note') {
    const s = (await request<{ on: string; customerId: string | null; customer: string; orderNumber: number | null; note: string; items: DocItem[]; totals: { grossCents: number; paidCents: number; owedCents: number } }>('GET', `/sales/${enc(id)}`)).data;
    return { number: s.orderNumber, on: s.on, customerId: s.customerId, customerName: s.customer, items: s.items, totalCents: s.totals.grossCents, paidCents: Math.min(s.totals.paidCents, s.totals.grossCents), owedCents: s.totals.owedCents, dueOn: null, note: s.note };
  }
  const o = (await request<{ number: number; createdOn: string; dueOn: string; note: string; customer: { id: string; name: string } | null; items: DocItem[]; totals: { totalCents: number; paidCents: number; owedCents: number } }>('GET', `/orders/${enc(id)}`)).data;
  return { number: o.number, on: o.createdOn, customerId: o.customer?.id ?? null, customerName: o.customer?.name ?? '', items: o.items, totalCents: o.totals.totalCents, paidCents: o.totals.paidCents, owedCents: o.totals.owedCents, dueOn: o.dueOn, note: o.note };
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const includes = (it: DocItem) => (it.kind === 'set' && it.parts.length ? t('screens.documents.includes', { parts: it.parts.map((p) => (p.qty * it.qty > 1 ? `${p.qty * it.qty} × ` : '') + p.name).join(', ') }) : '');
const pesos = (c: number) => money(c / 100);

function Sheet({ kind, d, b, phone }: { kind: DocumentKind; d: DocSource; b: Business; phone: string }) {
  const quote = kind === 'quote';
  const contact = [b.phone, b.email].filter(Boolean).join(' · ');
  const valid = quote && b.quoteValidDays > 0 ? longDate(addDays(d.on, b.quoteValidDays)) : '';
  return (
    <article className="doc" data-testid="document">
      <header className="doc-h">
        <div className="doc-b"><b>{b.name || L.myBusiness}</b>{b.trade ? <small>{b.trade}</small> : null}{b.city ? <small>{b.city}</small> : null}{contact ? <small>{contact}</small> : null}</div>
        <div className="doc-t"><b>{quote ? L.quote : L.saleNote}</b>{d.number ? <small>{t('screens.documents.orderRef', { folio: d.number })}</small> : null}<small>{longDate(d.on)}</small></div>
      </header>
      <div className="doc-m">
        <div><small>{L.customer}</small><b>{d.customerName || L.publicCustomer}</b>{phone ? <small>{phone}</small> : null}</div>
        {d.dueOn ? <div><small>{quote ? L.dueEstimated : L.due}</small><b>{longDate(d.dueOn)}</b></div> : null}
        {valid ? <div><small>{L.validUntil}</small><b>{valid}</b></div> : null}
      </div>
      <table className="doc-tb">
        <thead><tr><th>{L.colDescription}</th><th className="r">{L.colQty}</th><th className="r">{L.colPrice}</th><th className="r">{L.colAmount}</th></tr></thead>
        <tbody>{d.items.map((it, i) => <tr key={i}><td><b>{it.name}</b>{includes(it) ? <small>{includes(it)}</small> : null}</td><td className="r">{it.qty}</td><td className="r">{pesos(it.priceCents)}</td><td className="r">{pesos(it.qty * it.priceCents)}</td></tr>)}</tbody>
      </table>
      <div className="doc-s">
        <div className="doc-tot"><span>{L.total}</span><b>{pesos(d.totalCents)}</b></div>
        {d.paidCents > 0 ? <><div><span>{quote ? L.deposit : L.paid}</span><b>{pesos(d.paidCents)}</b></div><div><span>{d.owedCents > 0 ? L.owedToPay : L.owed}</span><b>{pesos(d.owedCents)}</b></div></> : null}
      </div>
      {d.note ? <p className="doc-n"><b>{L.notes}</b> {d.note}</p> : null}
      {quote && b.footer ? <p className="doc-n">{b.footer}</p> : null}
      <p className="doc-g">{L.thanks}</p>
    </article>
  );
}

/** Plain text version (mockup docTxt). */
export function documentText(kind: DocumentKind, d: DocSource, b: Business): string {
  const quote = kind === 'quote';
  const business = b.name || L.myBusiness;
  const k = quote ? L.quote : L.saleNote;
  const lines = d.items.map((it) => t(it.kind === 'set' ? 'screens.documents.txtLineSet' : 'screens.documents.txtLine', { qty: it.qty, name: it.name, price: pesos(it.priceCents), amount: pesos(it.qty * it.priceCents) }) + (includes(it) ? `\n    ${includes(it)}` : ''));
  const out = [d.number ? t('screens.documents.txtFolio', { business, kind: k, folio: d.number }) : t('screens.documents.txtHead', { business, kind: k })];
  if (d.customerName) out.push(t('screens.documents.txtCustomer', { name: d.customerName }));
  out.push('', ...lines, '', t('screens.documents.txtTotal', { amount: pesos(d.totalCents) }));
  if (d.dueOn) out.push(t('screens.documents.txtDue', { date: date(d.dueOn) }));
  if (d.paidCents > 0) out.push(t(quote ? 'screens.documents.txtPaidQuote' : 'screens.documents.txtPaid', { amount: pesos(d.paidCents) }), t('screens.documents.txtOwed', { amount: pesos(d.owedCents) }));
  if (quote && b.quoteValidDays > 0) out.push(t('screens.documents.txtValid', { days: b.quoteValidDays }));
  if (quote && b.footer) out.push(b.footer);
  out.push('', L.thanks);
  return out.join('\n');
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); toast(t('toast.copy.done', { what: L.copied })); } catch { toast(es.toast['copy.failed']); }
}

/** Opens the document of an order (quote / order note) or a sale (sale note), with print and copy as text. */
export function DocumentDialog({ kind, id, onClose }: { kind: DocumentKind; id: string; onClose: () => void }) {
  const src = useQuery({ queryKey: [...(kind === 'sale_note' ? keys.sales : keys.orders), 'document', id], queryFn: () => load(kind, id) });
  const custId = src.data?.customerId ?? null;
  const cust = useQuery({ queryKey: [...keys.customers, 'detail', custId], queryFn: async () => (await request<{ phone: string }>('GET', `/customers/${enc(custId!)}`)).data, enabled: !!custId, retry: false });
  const b = useSettings().data?.settings.business;
  // The sheet is also rendered in #printdoc, the only thing the print stylesheet shows (mockup imprimirDoc).
  const [host] = useState(() => Object.assign(document.createElement('div'), { id: 'printdoc' }));
  useEffect(() => {
    document.body.appendChild(host);
    return () => { document.body.classList.remove('printing'); host.remove(); };
  }, [host]);
  const print = () => {
    const done = () => { document.body.classList.remove('printing'); window.removeEventListener('afterprint', done); };
    document.body.classList.add('printing');
    window.addEventListener('afterprint', done);
    toast(es.toast['print.hint']);
    try { window.print(); } catch { done(); }
  };
  const ready = src.data && b;
  const sheet = ready ? <Sheet kind={kind} d={src.data} b={b} phone={cust.data?.phone ?? ''} /> : null;
  return (
    <Dialog open wide title={kind === 'quote' ? L.quote : L.saleNote} cancelLabel={es.common.close} onClose={onClose}>
      {sheet ?? <p className="muted">{L.loading}</p>}
      {ready ? <div className="btnrow doc-a">
        <Button icon="copy" onClick={() => void copy(documentText(kind, src.data, b))}>{L.copyText}</Button>
        <Button variant="primary" onClick={print}>{L.print}</Button>
      </div> : null}
      <p className="hint">{L.hint}</p>
      {sheet ? createPortal(sheet, host) : null}
    </Dialog>
  );
}
