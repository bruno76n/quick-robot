// Dialogs of an order (mockup pagoDlg, entregarDlg, empezarDlg, cancelarDlg). The server recalculates everything.
import { itemHours, proposeAssignment, type LineItemData } from '@app/core';
import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/Pill';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { tb } from '../../i18n/rich';
import { t } from '../../i18n/t';
import { centsTotal, date, hours, money2d, queueDuration, relativeDay } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { usePrinters, useProducts } from '../../lib/queries';
import { ordersApi, ORDER_TOUCHES, useOrder, type OrderDetail, type OrderItem } from './api';
import { MatRows, Shortfall, useMaterial } from './Material';
import { useStartSpools } from './StartSpools';
import { tbc, warningText } from './parts';

const L = es.screens.order;
const fmt = (c: number) => String(Math.round(c) / 100);
const toCents = (v: string) => Math.round(parseNumber(v) * 100);
const customerName = (o: OrderDetail) => o.customer?.name ?? es.screens.orders.noCustomer;
/** "2 × Llavero + Set" (mockup itemsTxt). */
export const itemsTxt = (its: readonly { qty: number; name: string }[], max: number) =>
  its.slice(0, max).map((it) => (it.qty > 1 ? `${it.qty} × ` : '') + it.name).join(' + ') + (its.length > max ? ` ${t('screens.orders.itemsMore', { count: its.length - max })}` : '');
export const piecesOf = (it: OrderItem) => (it.kind === 'set' ? it.parts.reduce((a, p) => a + p.qty, 0) * it.qty : it.qty);
export const fromStockOf = (o: OrderDetail) => o.items.reduce((a, it) => a + piecesOf(it) - it.toPrint, 0);
export const lineData = (it: OrderItem): LineItemData => ({
  kind: it.kind, productId: it.productId, collectionId: it.collectionId, name: it.name, qty: it.qty, price: it.priceCents / 100, list: it.listCents / 100, cost: it.costCents / 100,
  extras: it.extrasCents / 100, parts: it.parts.map((p) => ({ productId: p.productId, name: p.name, qty: p.qty, list: p.listCents / 100, cost: p.costCents / 100 })), fromStock: it.fromStock,
});

export function PaymentDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const o = useOrder(id).data;
  const [f, setF] = useState<{ amount: string | null; on: string; note: string }>({ amount: null, on: todayLocal(), note: '' });
  const save = useWrite(() => ordersApi.pay(id, { on: f.on, amountCents: toCents(f.amount ?? ''), ...(f.note.trim() ? { note: f.note.trim() } : {}) }), { touches: [...ORDER_TOUCHES], ok: () => es.toast['order.paymentRecorded'], onDone: onClose });
  if (!o) return null;
  const amount = f.amount ?? fmt(o.totals.owedCents);
  return (
    <Dialog open title={t('screens.order.payTitle', { folio: o.number })} submitLabel={L.recordPayment} busy={save.isPending} onClose={onClose}
      onSubmit={() => { if (toCents(amount) <= 0) { toast(es.fields['orderPayment.amount.required']); return; } setF({ ...f, amount }); save.mutate(undefined); }}>
      <p>{tb('screens.order.payIntro', { total: centsTotal(o.totals.totalCents), paid: centsTotal(o.totals.paidCents), owed: centsTotal(o.totals.owedCents) })}</p>
      <div className="grid3">
        <Field label={L.amount}><UnitInput unit="$" name="monto" inputMode="decimal" value={amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label={L.date}><input name="fecha" type="date" value={f.on} onChange={(e) => setF({ ...f, on: e.target.value })} /></Field>
        <Field label={L.note}><input name="nota" placeholder={L.payNotePlaceholder} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}

export function DeliverDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const o = useOrder(id).data;
  const [collect, setCollect] = useState<string | null>(null);
  const owed = o?.totals.owedCents ?? 0;
  const save = useWrite(() => ordersApi.deliver(id, { on: todayLocal(), collectCents: owed > 0 ? Math.min(owed, Math.max(0, toCents(collect ?? fmt(owed)))) : 0 }), {
    touches: [...ORDER_TOUCHES], ok: (out) => t('toast.order.delivered', { folio: out.order.number }), onDone: onClose,
  });
  if (!o) return null;
  return (
    <Dialog open title={t('screens.order.deliverTitle', { folio: o.number })} submitLabel={L.deliverSubmit} busy={save.isPending} onClose={onClose} onSubmit={() => save.mutate(undefined)}>
      <p><b>{customerName(o)}</b> · {itemsTxt(o.items, 4)}</p>
      <dl className="kv">
        <div><dt>{L.orderTotal}</dt><dd>{money2d(o.totals.totalCents / 100)}</dd></div>
        <div><dt>{L.paid}</dt><dd>{money2d(o.totals.paidCents / 100)}</dd></div>
        <div><dt>{L.owed}</dt><dd>{money2d(owed / 100)}</dd></div>
      </dl>
      {owed > 0 ? <Field label={L.collectOnDelivery} hint={L.collectHint}><UnitInput unit="$" name="cobro" inputMode="decimal" value={collect ?? fmt(owed)} onChange={(e) => setCollect(e.target.value)} /></Field> : null}
      <p className="note">{L.deliverNote}</p>
    </Dialog>
  );
}

export function CancelDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const o = useOrder(id).data;
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState<string | null>(null);
  const paid = o?.totals.paidCents ?? 0;
  const save = useWrite(() => ordersApi.cancel(id, { reason: reason.trim(), refundCents: Math.min(paid, Math.max(0, toCents(refund ?? fmt(paid)))) }), {
    touches: [...ORDER_TOUCHES], ok: (out) => t('toast.order.cancelled', { folio: out.number }), onDone: onClose,
  });
  if (!o) return null;
  const frees = o.status === 'ready' ? Object.values(o.stockReserved ?? {}).reduce((a, n) => a + n, 0) : o.status === 'accepted' || o.status === 'in_production' ? fromStockOf(o) : 0;
  return (
    <Dialog open title={t('screens.order.cancelTitle', { folio: o.number })} submitLabel={L.cancelOrder} cancelLabel={L.back} busy={save.isPending} onClose={onClose} onSubmit={() => save.mutate(undefined)}>
      <p><b>{customerName(o)}</b> · {itemsTxt(o.items, 3)} · <b>{centsTotal(o.totals.totalCents)}</b></p>
      <ul className="effects">
        <li>{L.cancelEffect}</li>
        {frees ? <li>{t('screens.order.cancelFrees', { count: frees })}</li> : null}
        {o.status === 'in_production' ? <li>{L.cancelQueue}</li> : null}
        {o.filamentDeducted ? <li>{L.cancelFilament}</li> : null}
      </ul>
      <div className="grid2 mt">
        <Field label={L.reason}><input name="motivo" placeholder={L.reasonPlaceholder} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label={L.refund} hint={paid > 0 ? t('screens.order.refundHint', { amount: centsTotal(paid) }) : L.refundNone}>
          <UnitInput unit="$" name="reembolso" inputMode="decimal" value={refund ?? fmt(paid)} onChange={(e) => setRefund(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Poner en producción / Cambiar impresoras: one printer per item that has something to print, fastest distribution proposed. */
export function ProductionDialog({ id, reassign, onClose }: { id: string; reassign: boolean; onClose: () => void }) {
  const o = useOrder(id).data;
  const printers = usePrinters().data?.items;
  if (!o || !printers) return null;
  if (!printers.length) {
    return (
      <Dialog open title={L.noPrintersTitle} submitLabel={L.goPrinters} onClose={onClose} onSubmit={() => { onClose(); go('/impresoras'); }}>
        <p>{L.noPrintersText}</p>
      </Dialog>
    );
  }
  return <ProductionForm o={o} printers={printers} reassign={reassign} onClose={onClose} />;
}

function ProductionForm({ o, printers, reassign, onClose }: { o: OrderDetail; printers: NonNullable<ReturnType<typeof usePrinters>['data']>['items']; reassign: boolean; onClose: () => void }) {
  const hoursBy = new Map((useProducts().data?.items ?? []).map((p) => [p.id, p.hours]));
  const hoursOf = (pid: string) => hoursBy.get(pid) ?? 0;
  const its = o.items.filter((it) => it.toPrint > 0);
  const itemH = its.map((it) => itemHours(lineData(it), hoursOf));
  // Minutes until each printer is free, without this order's own jobs.
  const base = new Map(printers.map((p) => [p.id, p.queue.filter((q) => q.orderId !== o.id).reduce((a, q, k) => a + (k === 0 ? q.remainingMinutes : q.minutes), 0)]));
  const proposed = proposeAssignment(itemH, base);
  const [pick, setPick] = useState<Record<string, string>>({});
  const chosen = its.map((it, k) => pick[it.id] ?? (reassign && it.printerId && base.has(it.printerId) ? it.printerId : proposed[k]!));
  const mat = useMaterial(o.material.needs);
  const [deduct, setDeduct] = useState(true);
  const g = mat.total;
  const deEx = fromStockOf(o);
  const spools = useStartSpools(its, lineData, mat.purge, !reassign && deduct && g > 0); // ronda 4: «Empezar con el rollo»
  const assignments = its.map((it, k) => ({ lineItemId: it.id, printerId: chosen[k]!, ...spools.startSpools(it.id) }));
  const save = useWrite(async () => ({ data: reassign ? await ordersApi.reassign(o.id, { assignments }) : await ordersApi.start(o.id, { assignments, deductFilament: deduct && g > 0 }) }), {
    touches: [...ORDER_TOUCHES],
    ok: ({ warnings }) => (reassign ? es.toast['order.printersUpdated']
      : [t('screens.order.inProductionToast', { folio: o.number }) + (deduct && g > 0 ? `. ${t('screens.order.deductedToast', { grams: g })}` : ''), ...(deduct && g > 0 ? warnings.map(warningText) : [])].join(' ')),
    onDone: onClose,
  });
  // Plan per printer: when it starts and when it ends, against the end of the delivery day.
  const grp = new Map<string, number>();
  its.forEach((_, k) => grp.set(chosen[k]!, (grp.get(chosen[k]!) ?? 0) + itemH[k]! * 60));
  const name = (pid: string) => printers.find((p) => p.id === pid)?.name ?? '';
  const totalH = itemH.reduce((a, h) => a + h, 0);
  return (
    <Dialog open wide className="sheet r4w" title={t(reassign ? 'screens.order.reassignTitle' : 'screens.order.startTitle', { folio: o.number })} submitLabel={reassign ? L.reassignSubmit : L.startSubmit}
      busy={save.isPending} onClose={onClose} onSubmit={() => save.mutate(undefined)}>
      <p><b>{customerName(o)}</b> · {t('screens.order.startIntro', { date: date(o.dueOn), rel: relativeDay(o.dueOn, todayLocal()) })}</p>
      {deEx ? <p className="status good"><Icon name="store" size={16} /><span>{tb('screens.order.fromStockNote', { count: deEx })}</span></p> : null}
      <fieldset className="blk"><legend>{L.assignment}</legend>
        {its.map((it, k) => {
          const stock = piecesOf(it) - it.toPrint;
          return (
            <div className="jobrow" key={it.id}>
              <div><b>{printText(it)}</b>{it.kind === 'set' ? <> <Pill tone="info">{L.setChip}</Pill></> : null}
                <small className="blk">{t(stock ? 'screens.order.jobRowStock' : 'screens.order.jobRow', { time: hours(itemH[k]!), count: it.toPrint, stock })}</small></div>
              <label className="fld"><span className="sr">{t('screens.order.printerFor', { name: it.name })}</span>
                <select name={`imp${k}`} value={chosen[k]} onChange={(e) => setPick({ ...pick, [it.id]: e.target.value })} data-testid="printer-select">
                  {printers.map((p) => <option key={p.id} value={p.id}>{(base.get(p.id) ?? 0) > 0 ? t('screens.order.printerFreeIn', { name: p.name, time: queueDuration(base.get(p.id)!) }) : t('screens.order.printerFree', { name: p.name })}</option>)}
                </select></label>
              {spools.render(it)}
            </div>
          );
        })}
        <Plan groups={grp} base={base} dueOn={o.dueOn} name={name} />
        <p className="hint">{L.proposeHint}</p>
      </fieldset>
      {reassign ? null : <>
        <div className="calc">
          {mat.lines.length ? <div className="mats"><span className="k">{t('screens.order.materialLabel', { pct: mat.purge })}</span><MatRows lines={mat.lines} /></div> : <p className="muted">{L.noFilament}</p>}
          <dl className="kv"><div><dt>{L.printTime}</dt><dd>{hours(totalH)}</dd></div></dl>
          <Shortfall lines={mat.short} onAdd={onClose} />
        </div>
        <label className="chk"><input type="checkbox" name="fil" checked={deduct && g > 0} disabled={g <= 0} onChange={(e) => setDeduct(e.target.checked)} data-testid="deduct" />
          <span>{L.deductNow}</span><small>{g > 0 ? t('screens.order.deductHint', { grams: g }) : ''}</small></label>
      </>}
    </Dialog>
  );
}

/** Per printer: when it starts and ends, against the end of the delivery day (mockup #e-plan). */
function Plan({ groups, base, dueOn, name }: { groups: Map<string, number>; base: Map<string, number>; dueOn: string; name: (pid: string) => string }) {
  const [now] = useState(() => Date.now());
  const limit = (new Date(`${dueOn}T23:59:59`).getTime() - now) / 60000;
  return (
    <ul className="plan">{[...groups].map(([pid, m]) => {
      const ini = base.get(pid) ?? 0;
      const end = ini + m;
      const late = end > limit;
      const params = { printer: name(pid), time: queueDuration(m), wait: queueDuration(ini), date: date(todayLocal(new Date(now + end * 60000))) };
      return <li key={pid} className={late ? 'late' : ''}><Icon name={late ? 'warn' : 'clock'} size={14} /><span>{tbc(`screens.order.plan${ini > 0 ? 'Wait' : 'Now'}${late ? 'Late' : ''}`, params, {}, ['time', 'wait'])}</span></li>;
    })}</ul>
  );
}

/** What is printed of an item: "3 × Letrero", or "Set (imprime 1 × Hulk)" when part comes from the shelf (mockup itemTxtImpr). */
function printText(it: OrderItem) {
  const pieces = piecesOf(it);
  if (pieces === it.toPrint) return (it.qty > 1 ? `${it.qty} × ` : '') + it.name;
  if (it.kind !== 'set') return (it.toPrint > 1 ? `${it.toPrint} × ` : '') + it.name;
  const pool: Record<string, number> = { ...it.fromStock };
  const left = it.parts.map((p) => { const need = p.qty * it.qty; const ex = Math.min(need, pool[p.productId] ?? 0); pool[p.productId] = (pool[p.productId] ?? 0) - ex; return { name: p.name, n: need - ex }; }).filter((x) => x.n > 0);
  return t('screens.order.printsSome', { name: it.name, parts: left.map((x) => (x.n > 1 ? `${x.n} × ` : '') + x.name).join(', ') });
}
