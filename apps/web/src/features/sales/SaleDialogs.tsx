// The sale dialog (mockup ventaDlg) and the dialogs it opens: edit data, record a payment, give back the sale,
// the sale note document. One dialog at a time; cancelling a child returns to the sale.
import { itemNeed } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { DocumentDialog } from '../../components/DocumentSheet';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, money2d } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { keys, useProducts, useSettings } from '../../lib/queries';
import { CustomerDialog } from '../customers/CustomerDialog';
import { customersApi } from '../customers/api';
import { salesApi, type SaleDetail } from './api';
import { Breakdown, toLineItem } from './Breakdown';
import { rich } from './rich';

const L = es.screens.sales;
const NEW = '__nuevo';
const fmtNum = (x: number) => String(Math.round((x || 0) * 100) / 100);
type Sub = null | 'edit' | 'pay' | 'return' | 'doc';
const TOUCH_ALL = ['sales', 'stock', 'products', 'collections', 'customers', 'orders', 'reports', 'home', 'search'] as const;
const TOUCH_PAY = ['sales', 'customers', 'reports', 'home'] as const;

export function SaleDialogs({ id, startWithPayment = false, onClose }: { id: string; startWithPayment?: boolean; onClose: () => void }) {
  // `?abono=1` (the "Debe" chip of the row, "Registrar abono" of Inicio): the payment opens on top of the sale and
  // Cancelar returns to the sale (ronda-2 §12, D5). A sale that owes nothing, or was given back, shows the sale.
  const [sub, setSub] = useState<Sub>(startWithPayment ? 'pay' : null);
  const { data: s } = useQuery({ queryKey: [...keys.sales, 'detail', id], queryFn: async () => (await salesApi.get(id)).data });
  if (!s) return null;
  if (sub === 'pay' && (s.return || s.totals.owedCents <= 0)) return <SaleDialog s={s} onClose={onClose} open={setSub} />;
  if (sub === 'edit') return <EditDialog s={s} onBack={() => setSub(null)} onDone={onClose} />;
  if (sub === 'pay') return <PaymentDialog s={s} onBack={() => setSub(null)} onDone={onClose} />;
  if (sub === 'return') return <ReturnDialog s={s} onBack={() => setSub(null)} onDone={onClose} />;
  if (sub === 'doc') return <DocumentDialog kind="sale_note" id={s.id} onClose={() => setSub(null)} />;
  return <SaleDialog s={s} onClose={onClose} open={setSub} />;
}

function SaleDialog({ s, onClose, open }: { s: SaleDetail; onClose: () => void; open: (x: Sub) => void }) {
  const T = s.totals;
  const dv = s.return;
  const gross = T.grossCents / 100, income = T.incomeCents / 100, list = s.return ? 0 : s.items.reduce((a, it) => a + it.qty * it.listCents, 0) / 100;
  const paid = Math.min(T.paidCents, T.grossCents) / 100, owed = T.owedCents / 100, profit = T.profitCents / 100;
  const ratio = gross > 0 ? Math.min(100, ((T.paidCents / 100) / gross) * 100) : 0;
  const removePay = useWrite((pid: string) => salesApi.removePayment(s.id, pid), { touches: [...TOUCH_PAY], ok: () => es.toast['sale.paymentRemoved'] });
  const del = useWrite(() => salesApi.remove(s.id), {
    touches: [...TOUCH_ALL], ok: () => es.toast['sale.deleted'], undo: () => () => salesApi.restore(s.id), onDone: onClose,
  });
  return (
    <Dialog open wide title={t('screens.sales.detailTitle', { date: date(s.on) })} onClose={onClose} cancelLabel={es.common.close}>
      <p className="mut">
        {s.channel}
        {s.customerId ? <>{' · '}<button type="button" className="link" onClick={() => go(`/clientes/cliente?id=${s.customerId}`)}>{s.customer}</button></> : null}
        {s.note ? ` · ${s.note}` : null}
        {s.orderId && s.orderNumber !== null ? <>{' · '}<button type="button" className="link" onClick={() => go(`/pedidos/pedido?id=${s.orderId}`)}>{t('screens.sales.orderRef', { folio: s.orderNumber })}</button></> : null}
      </p>
      {dv ? (
        <p className="status bad"><Icon name="warn" size={16} /><span>{[t('screens.sales.returnedOn', { date: date(dv.on) }), dv.restock ? L.returnedRestock : L.returnedLost, dv.refundCents > 0 ? t('screens.sales.returnedRefund', { amount: centsTotal(dv.refundCents) }) : '', dv.note, L.returnedNoReports].filter(Boolean).join(' ')}</span></p>
      ) : null}
      <Breakdown items={s.items} commissionPct={s.commissionPct} orderNumber={s.orderId ? s.orderNumber : null} returned={!!dv} />
      <dl className="kv">
        <div><dt>{L.kTotal}</dt><dd>{dv ? <s className="mut">{money2d(gross)}</s> : money2d(income)}{!dv && list - income > 0.5 ? <small>{t('screens.sales.kDiscount', { amount: centsTotal((list - income) * 100), list: centsTotal(list * 100) })}</small> : !dv && income - list > 0.5 ? <small>{t('screens.sales.kSurcharge', { amount: centsTotal((income - list) * 100), list: centsTotal(list * 100) })}</small> : null}</dd></div>
        <div><dt>{L.kCost}</dt><dd>{money2d(T.costCents / 100)}</dd></div>
        {T.commissionCents > 0 ? <div><dt>{t('screens.sales.kCommission', { channel: s.channel })}</dt><dd>{money2d(T.commissionCents / 100)}</dd></div> : null}
        <div className={`gan${profit < 0 ? ' neg' : ''}`}><dt>{L.kProfit}</dt><dd>{money2d(profit)}<small>{income > 0 ? t('screens.sales.kMargin', { pct: (profit / income) * 100 }) : ''}</small></dd></div>
      </dl>
      {dv ? null : (
        <fieldset className="blk">
          <legend>{L.payLegend}</legend>
          <div className="cobro"><div><span className="k">{L.payTotal}</span><b className="v num">{centsTotal(T.grossCents)}</b></div><div><span className="k">{L.payPaid}</span><b className="v num">{centsTotal(paid * 100)}</b></div><div><span className="k">{L.payOwed}</span><b className={`v num ${owed > 0 ? 'neg' : 'pos'}`}>{centsTotal(T.owedCents)}</b></div></div>
          <div className="prog thick" role="img" aria-label={t('screens.sales.payProgress', { value: Math.round(ratio) })}><i style={{ width: `${ratio}%` }} /></div>
          {s.payments.length ? (
            <ul className="pagos">
              {s.payments.map((x) => <li key={x.id}><span className="mut">{date(x.on)}</span><span>{x.note || L.payDefault}</span><b className="num">{centsTotal(x.amountCents)}</b><button type="button" className="link quitar" aria-label={t('screens.sales.payRemoveAria', { amount: centsTotal(x.amountCents) })} onClick={() => removePay.mutate(x.id)}>{L.payRemove}</button></li>)}
            </ul>
          ) : <p className="hint">{L.paidAtSale}</p>}
          {owed > 0 ? <div className="btnrow"><Button size="sm" onClick={() => open('pay')}>{L.recordPayment}</Button></div> : null}
        </fieldset>
      )}
      <div className="btnrow">
        <Button onClick={() => open('doc')}><Icon name="copy" size={14} />{L.saleNote}</Button>
        <Button onClick={() => open('edit')}>{L.editData}</Button>
        {dv ? null : <Button onClick={() => open('return')}>{L.giveBack}</Button>}
        <ConfirmButton variant="ghost" danger confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deleteSale}</ConfirmButton>
      </div>
    </Dialog>
  );
}

function EditDialog({ s, onBack, onDone }: { s: SaleDetail; onBack: () => void; onDone: () => void }) {
  const channels = useSettings().data?.channels ?? [];
  const { data: customers } = useQuery({ queryKey: [...keys.customers, 'list'], queryFn: async () => (await customersApi.list()).data });
  const [on, setOn] = useState(s.on);
  const [channelId, setChannelId] = useState(s.channelId);
  const [customerId, setCustomerId] = useState(s.customerId ?? '');
  const [note, setNote] = useState(s.note);
  const [creating, setCreating] = useState(false);
  const save = useWrite(() => salesApi.update(s.id, { on, channelId, note: note.trim(), ...(s.orderId ? {} : { customerId: customerId || null }) }), { touches: ['sales', 'customers', 'reports', 'home', 'stock'], ok: () => es.toast['sale.updated'], onDone });
  if (creating) return <CustomerDialog onClose={() => setCreating(false)} onSaved={(c) => { setCustomerId(c.id); setCreating(false); }} />;
  const list = [...(customers ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  return (
    <Dialog open title={t('screens.sales.editTitle', { date: date(s.on) })} onClose={onBack} submitLabel={L.saveChanges} busy={save.isPending}
      onSubmit={() => { if (!on) { toast(es.fields['sale.on.required']); return; } save.mutate(undefined); }}>
      <div className="grid2">
        <Field label={L.fDate}><input type="date" name="fecha" value={on} max={todayLocal()} required onChange={(e) => setOn(e.target.value)} /></Field>
        <Field label={L.fChannel}><select name="canal" value={channelId} onChange={(e) => setChannelId(e.target.value)}>{channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}{channels.some((c) => c.id === s.channelId) ? null : <option value={s.channelId}>{s.channel}</option>}</select></Field>
      </div>
      <div className="mt">
        {s.orderId ? (
          <Field label={L.fCustomer} hint={t('screens.sales.fromOrder', { folio: s.orderNumber ?? '' })}><input value={s.customer} disabled /></Field>
        ) : (
          <Field label={L.fCustomer}>
            <select name="cliente" value={customerId} onChange={(e) => { if (e.target.value === NEW) setCreating(true); else setCustomerId(e.target.value); }}>
              <option value="">{L.walkIn}</option>
              {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW}>{L.newCustomer}</option>
            </select>
          </Field>
        )}
      </div>
      <div className="mt"><Field label={L.fNote}><input name="nota" value={note} placeholder={L.notePlaceholder} onChange={(e) => setNote(e.target.value)} /></Field></div>
      <p className="note">{L.editNote}</p>
    </Dialog>
  );
}

function PaymentDialog({ s, onBack, onDone }: { s: SaleDetail; onBack: () => void; onDone: () => void }) {
  const owed = s.totals.owedCents / 100;
  const [amount, setAmount] = useState(fmtNum(owed));
  const [on, setOn] = useState(todayLocal());
  const [note, setNote] = useState('');
  const pay = useWrite((cents: number) => salesApi.pay(s.id, { on, amountCents: cents, ...(note.trim() ? { note: note.trim() } : {}) }), {
    touches: [...TOUCH_PAY], ok: (out) => (out.totals.owedCents > 0 ? t('screens.sales.payDone', { amount: centsTotal(out.totals.owedCents) }) : L.payDoneFull), onDone,
  });
  return (
    <Dialog open title={L.payTitle} onClose={onBack} submitLabel={L.recordPayment} busy={pay.isPending}
      onSubmit={() => { const m = parseNumber(amount); if (m <= 0) { toast(es.fields['salePayment.amount.required']); return; } pay.mutate(Math.round(m * 100)); }}>
      <p>{rich(L.paySummary, {}, { total: <b>{centsTotal(s.totals.grossCents)}</b>, paid: <b>{centsTotal(s.totals.paidCents)}</b>, owed: <b>{centsTotal(s.totals.owedCents)}</b> })}</p>
      <div className="grid3">
        <Field label={L.fAmount}><UnitInput unit="$" name="monto" inputMode="decimal" value={amount} required onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label={L.fDate}><input name="fecha" type="date" value={on} max={todayLocal()} onChange={(e) => setOn(e.target.value)} /></Field>
        <Field label={L.fNote}><input name="nota" value={note} placeholder={L.payNotePlaceholder} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}

function ReturnDialog({ s, onBack, onDone }: { s: SaleDetail; onBack: () => void; onDone: () => void }) {
  const products = useProducts().data?.items ?? [];
  const tracks = new Map(products.map((p) => [p.id, p.tracksStock]));
  const pieces = s.items.reduce((a, it) => a + Object.entries(itemNeed(toLineItem(it))).reduce((x, [pid, n]) => x + (tracks.get(pid) ? n : 0), 0), 0);
  const [on, setOn] = useState(todayLocal());
  const [refund, setRefund] = useState(fmtNum(Math.min(s.totals.paidCents, s.totals.grossCents) / 100));
  const [restock, setRestock] = useState('1');
  const [note, setNote] = useState('');
  const giveBack = useWrite(() => salesApi.giveBack(s.id, { on, restock: restock === '1', refundCents: Math.max(0, Math.round(parseNumber(refund) * 100)), ...(note.trim() ? { note: note.trim() } : {}) }), {
    touches: [...TOUCH_ALL],
    ok: () => [es.toast['sale.returned'], restock === '1' && pieces ? t('toast.sale.returned.restocked', { count: pieces }) : ''].filter(Boolean).join(' '),
    onDone,
  });
  return (
    <Dialog open title={L.returnTitle} onClose={onBack} submitLabel={L.giveBack} busy={giveBack.isPending} onSubmit={() => giveBack.mutate(undefined)}>
      <p>{rich(L.returnIntro, { customer: s.customer ? ` · ${s.customer}` : '' }, { date: <b>{date(s.on)}</b>, total: <b>{centsTotal(s.totals.grossCents)}</b> })}</p>
      <div className="grid2 mt">
        <Field label={L.fDate}><input name="fecha" type="date" value={on} max={todayLocal()} onChange={(e) => setOn(e.target.value)} /></Field>
        <Field label={L.fRefund} hint={L.refundHint}><UnitInput unit="$" name="reembolso" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} /></Field>
      </div>
      <div className="mt">
        <Field label={L.fPieces} hint={L.piecesHint}>
          <select name="repone" value={restock} onChange={(e) => setRestock(e.target.value)}>
            <option value="1">{pieces ? t('screens.sales.restockYesN', { count: pieces }) : L.restockYes}</option>
            <option value="0">{L.restockNo}</option>
          </select>
        </Field>
      </div>
      <div className="mt"><Field label={L.fReason}><input name="nota" value={note} placeholder={L.reasonPlaceholder} onChange={(e) => setNote(e.target.value)} /></Field></div>
    </Dialog>
  );
}
