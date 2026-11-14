// Pedido (docs/06 §5.1): header with the next step, progress, money band and tabs Piezas · Cobro · Producción · Datos.
import { itemHours, itemLines } from '@app/core';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { DocumentDialog, type DocumentKind } from '../../components/DocumentSheet';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Pill } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, daysBetween, hours, money, queueDuration, relativeDay } from '../../lib/format';
import { todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { useProducts, useSettings } from '../../lib/queries';
import { isActive, ordersApi, ORDER_TOUCHES, STEPS, useOrder, type OrderDetail } from './api';
import { MatRows, Shortfall, useMaterial } from './Material';
import { fromStockOf, lineData, piecesOf } from './OrderDialogs';
import { NextStepButton, StepDialogs, useStepRunner, type StepRunner } from './OrderSteps';
import { dueText } from './OrdersPage';
import { countTags, countText, itemRows, sumCounts, type PieceRow } from './origins';
import { Capas, CapasLegend, StatusChip, Where } from './parts';
import './orders.css';

const L = es.screens.order;
type Tab = 'articulos' | 'pagos' | 'produccion' | 'datos';

export function OrderPage() {
  const search = useSearch({ strict: false }) as { id?: string; tab?: string };
  const q = useOrder(search.id);
  const runner = useStepRunner();
  if (q.isError || !search.id) return <><Crumbs folio={null} /><div className="empty-box"><p>{L.notFound}</p></div></>;
  if (!q.data) return null;
  return <Order o={q.data} runner={runner} tab={(search.tab ?? 'articulos') as Tab} />;
}

function Crumbs({ folio }: { folio: number | null }) {
  return <nav className="crumbs"><a href="/pedidos" onClick={(e) => { e.preventDefault(); go('/pedidos'); }}>{es.screens.orders.title}</a><span>/</span>{folio !== null ? <span>{t('screens.order.crumb', { folio })}</span> : null}</nav>;
}

function Order({ o, runner, tab: asked }: { o: OrderDetail; runner: StepRunner; tab: Tab }) {
  const [doc, setDoc] = useState<DocumentKind | null>(null);
  const today = todayLocal();
  const fin = o.status === 'delivered';
  const canc = o.status === 'cancelled';
  const T = o.totals;
  const pieces = o.items.reduce((a, it) => a + piecesOf(it), 0);
  const prodHay = o.status === 'in_production' || (!fin && (o.material.needs.some((n) => n.grams > 0) || (fromStockOf(o) > 0 && (o.status === 'quoted' || o.status === 'accepted'))));
  const tab: Tab = asked === 'produccion' && !prodHay ? 'articulos' : asked;
  const setTab = (k: Tab) => go(`/pedidos/pedido?id=${o.id}${k === 'articulos' ? '' : `&tab=${k}`}`, true);
  const n = daysBetween(today, o.dueOn);
  const k = STEPS.indexOf(o.status);
  const tabs: [Tab, string][] = [['articulos', L.tabPieces], ['pagos', T.owedCents > 0 ? t('screens.order.tabPaymentsOwed', { amount: centsTotal(T.owedCents) }) : L.tabPayments], ...(prodHay ? [['produccion', L.tabProduction] as [Tab, string]] : []), ['datos', L.tabData]];
  const customer = o.customer?.name ?? es.screens.orders.noCustomer;
  const sub = fin ? t('screens.order.subDelivered', { folio: o.number, created: date(o.createdOn), delivered: date(o.deliveredOn ?? o.dueOn) }) : t('screens.order.sub', { folio: o.number, created: date(o.createdOn) });
  const c = o.cancellation;
  return (
    <>
      <Crumbs folio={o.number} />
      <PageHead title={<><span>{customer}</span><StatusChip status={o.status} /></>} sub={sub} actions={<>
        <NextStepButton order={o} runner={runner} primary />
        {o.status === 'quoted' || o.status === 'accepted' ? <Button icon="edit" onClick={() => go(`/armar?modo=pedido&id=${o.id}`)}>{L.edit}</Button> : null}
        {canc ? null : <Button icon="copy" onClick={() => setDoc(fin ? 'order_note' : 'quote')} data-testid="doc-open">{fin ? L.saleNote : L.quote}</Button>}
      </>} />
      {canc && c ? (
        <p className="status bad"><Icon name="warn" size={16} /><span>{[
          c.reason ? t('screens.order.cancelledReason', { date: date(c.on), reason: c.reason }) : t('screens.order.cancelledOn', { date: date(c.on) }),
          c.refundCents > 0 ? t('screens.order.refunded', { amount: centsTotal(c.refundCents) }) : '',
          T.paidCents > 0 ? t('screens.order.kept', { amount: centsTotal(T.paidCents) }) : '', L.notSale].filter(Boolean).join(' ')}</span></p>
      ) : (
        <ol className="stp" aria-label={L.stepperAria}>{STEPS.map((s, i) => <li key={s} className={i < k ? 'done' : i === k ? 'now' : ''} aria-current={i === k ? 'step' : undefined}><i className="stp-b" /><span>{es.status.order[s]}</span></li>)}</ol>
      )}
      <section className="strip band slim" aria-label={L.bandAria}>
        <div><span className="k">{L.total}</span><b className="v num">{centsTotal(T.totalCents)}</b><span className="s">{t('screens.order.piecesIn', { pieces, items: o.items.length })}</span></div>
        <div><span className="k">{T.owedCents > 0 ? L.owed : canc ? L.collectedK : L.paid}</span><b className={`v num ${T.owedCents > 0 ? 'neg' : 'pos'}`}>{centsTotal(T.owedCents > 0 ? T.owedCents : canc ? T.paidCents : T.totalCents)}</b>
          <span className="s">{T.owedCents > 0 ? t('screens.order.paidAmount', { amount: centsTotal(T.paidCents) }) : canc ? L.afterRefund : L.fullyPaid}</span>
          {/* Ronda-2 §12, D7: the payment at hand from any tab (Cobro keeps its own button, so it is not repeated there). */}
          {T.owedCents > 0 && isActive(o.status) && tab !== 'pagos' ? <Button size="sm" className="band-pay" onClick={() => runner.setDlg({ kind: 'pay', id: o.id })}>{L.recordPayment}</Button> : null}</div>
        <div><span className="k">{fin ? L.deliveredK : L.dueK}</span><b className={`v num ${!fin && !canc && n <= 1 ? 'neg' : ''}`}>{date(fin ? o.deliveredOn ?? o.dueOn : o.dueOn)}</b><span className="s">{fin ? L.saleInSales : canc ? '' : relativeDay(o.dueOn, today)}</span></div>
      </section>
      <details className="more"><summary>{L.costProfit}</summary><div className="more-b">
        <div><span className="k">{L.cost}</span><b className="num">{centsTotal(T.costCents)}</b><small>{T.commissionCents > 0 ? t('screens.order.plusCommission', { amount: centsTotal(T.commissionCents), channel: o.channel }) : L.costParts}</small></div>
        <div><span className="k">{L.profit}</span><b className={`num ${T.profitCents >= 0 ? 'pos' : 'neg'}`}>{centsTotal(T.profitCents)}</b><small>{t('screens.order.marginOf', { pct: T.totalCents > 0 ? (T.profitCents / T.totalCents) * 100 : 0 })}</small></div>
      </div></details>
      <div className="seg tabs" role="tablist" aria-label={L.tabsAria}>
        {tabs.map(([key, label]) => <button key={key} type="button" role="tab" className={tab === key ? 'on' : ''} aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}
      </div>
      <div className="ped-t">
        {tab === 'articulos' ? <Pieces o={o} /> : tab === 'pagos' ? <Payments o={o} runner={runner} /> : tab === 'produccion' ? <div className="ed-form"><Production o={o} runner={runner} /><Material o={o} /></div> : <Data o={o} runner={runner} />}
      </div>
      <StepDialogs runner={runner} />
      {doc ? <DocumentDialog kind={doc} id={o.id} onClose={() => setDoc(null)} /> : null}
    </>
  );
}

// ---------- Piezas ----------
function rowsOf(o: OrderDetail) {
  const jobs = o.queue.map((q) => ({ printerId: q.printerId, printerName: q.printerName, progress: q.progress, waitMinutes: q.waitMinutes, position: q.position }));
  return o.items.map((it) => itemRows(it, o.status, jobs));
}

function Pieces({ o }: { o: OrderDetail }) {
  const rows = rowsOf(o);
  const count = sumCounts(rows.map(countTags));
  const de = fromStockOf(o);
  const stk = Object.values(o.stockReserved ?? {}).reduce((a, x) => a + x, 0);
  const note = o.status === 'quoted' && de ? t('screens.order.apartQuoted', { count: de })
    : (o.status === 'accepted' || o.status === 'in_production') && de ? t('screens.order.apartActive', { count: de })
      : o.status === 'ready' && stk ? t('screens.order.apartReady', { count: stk }) : '';
  return (
    <fieldset className="blk dsg-blk"><legend>{L.breakdown}</legend>
      <div className="dsg-sum"><Capas count={count} /><CapasLegend count={count} /></div>
      <Breakdown o={o} rows={rows} />
      {note ? <p className="hint">{note}</p> : null}
    </fieldset>
  );
}

function vsList(list: number, price: number) {
  const d = list > 0 ? (1 - price / list) * 100 : 0;
  return Math.abs(d) >= 1 ? <small className="blk">{t(d > 0 ? 'screens.order.belowList' : 'screens.order.aboveList', { n: Math.round(Math.abs(d)) })}</small> : null;
}

function Breakdown({ o, rows }: { o: OrderDetail; rows: PieceRow[][] }) {
  const cm = o.commissionPct / 100;
  const sum = { total: 0, cost: 0, gain: 0 };
  const hasSet = o.items.some((it) => it.kind === 'set' && it.parts.length > 0);
  const bodies = o.items.map((it, i) => {
    const total = (it.qty * it.priceCents) / 100;
    const cost = (it.qty * it.costCents) / 100;
    const gain = total * (1 - cm) - cost;
    sum.total += total; sum.cost += cost; sum.gain += gain;
    const r = rows[i]!;
    const cls = (g: number) => `r num c-gan ${g >= 0 ? 'pos' : 'neg'}`;
    if (!(it.kind === 'set' && it.parts.length)) {
      return <tbody className="dg" key={it.id}><tr>
        <td className="pz-n"><b>{it.name}</b></td><td className="r num">{r[0]?.qty ?? it.qty}</td>
        <td className="r num c-pre">{money(it.priceCents / 100)}{vsList(it.listCents, it.priceCents)}</td><td className="r num c-tot">{money(total)}</td>
        <td className="r num c-cos">{centsTotal(cost * 100)}</td><td className={cls(gain)}>{centsTotal(gain * 100)}</td><td className="c-ori"><Where tags={r[0]?.tags ?? []} /></td>
      </tr></tbody>;
    }
    const lines = itemLines(lineData(it));
    const np = r.reduce((a, x) => a + x.qty, 0);
    const cnt = countTags(r);
    return (
      <tbody className="dg abre" key={it.id}>
        <tr className="gh">
          <td className="pz-n"><b>{it.name}</b> <span className="tg-set">{L.setTag}</span><small className="blk">{t('screens.order.setPieces', { count: np })}</small></td>
          <td className="r num">{it.qty}<small className="blk">{t('screens.order.sets', { count: it.qty })}</small></td>
          <td className="r num c-pre">{money(it.priceCents / 100)}{vsList(it.listCents, it.priceCents)}</td><td className="r num c-tot">{money(total)}</td>
          <td className="r num c-cos">{centsTotal(cost * 100)}</td><td className={cls(gain)}>{centsTotal(gain * 100)}</td>
          <td className="c-ori"><Capas count={cnt} sm /><small className="blk">{countText(cnt)}</small></td>
        </tr>
        {r.map((row, j) => {
          const ln = lines[j];
          const inc = ln?.income ?? 0;
          const g = inc * (1 - cm) - (ln?.cost ?? 0);
          return <tr className="pz" key={j}>
            <td className="pz-n"><span className="tree" aria-hidden="true" /><b>{row.name}</b></td><td className="r num">{row.qty}</td>
            <td className="r num c-pre">{money(row.qty ? inc / row.qty : 0)}</td><td className="r num c-tot">{money(inc)}</td>
            <td className="r num c-cos">{centsTotal((ln?.cost ?? 0) * 100)}</td><td className={cls(g)}>{centsTotal(g * 100)}</td><td className="c-ori"><Where tags={row.tags} /></td>
          </tr>;
        })}
      </tbody>
    );
  });
  const pieces = o.items.reduce((a, it) => a + piecesOf(it), 0);
  return (
    <>
      <div className="tw"><table className="tbl dsg">
        <thead><tr><th>{L.colPiece}</th><th className="r">{L.colQty}</th><th className="r c-pre">{L.colUnit}</th><th className="r c-tot">{L.colTotal}</th><th className="r c-cos">{L.colCost}</th><th className="r c-gan">{L.colProfit}</th><th className="c-ori">{L.colWhere}</th></tr></thead>
        {bodies}
        <tfoot><tr className="tot">
          <td>{L.totalRow}</td><td className="r num">{pieces}<small className="blk">{t('screens.order.pieces', { count: pieces })}</small></td><td className="c-pre" />
          <td className="r num c-tot">{centsTotal(sum.total * 100)}</td><td className="r num c-cos">{centsTotal(sum.cost * 100)}</td>
          <td className={`r num c-gan ${sum.gain >= 0 ? 'pos' : 'neg'}`}>{centsTotal(sum.gain * 100)}</td><td className="c-ori" />
        </tr></tfoot>
      </table></div>
      {hasSet ? <p className="hint">{L.setHint}</p> : null}
    </>
  );
}

// ---------- Cobro ----------
function Payments({ o, runner }: { o: OrderDetail; runner: StepRunner }) {
  const T = o.totals;
  const remove = useWrite((pid: string) => ordersApi.removePayment(o.id, pid), {
    touches: [...ORDER_TOUCHES],
    ok: (out, pid) => t('toast.order.paymentRemoved', { amount: centsTotal(o.payments.find((p) => p.id === pid)?.amountCents ?? 0), balance: centsTotal(out.totals.owedCents) }),
  });
  const paidPct = T.totalCents > 0 ? Math.min(100, (T.paidCents / T.totalCents) * 100) : 0;
  return (
    <fieldset className="blk"><legend>{L.payments}</legend>
      <div className="cobro">
        <div><span className="k">{L.total}</span><b className="v num">{centsTotal(T.totalCents)}</b></div>
        <div><span className="k">{L.paid}</span><b className="v num">{centsTotal(T.paidCents)}</b></div>
        <div><span className="k">{L.owed}</span><b className={`v num ${T.owedCents > 0 ? 'neg' : 'pos'}`}>{centsTotal(T.owedCents)}</b></div>
      </div>
      <div className="prog thick" role="img" aria-label={t('screens.order.paidAria', { n: Math.round(paidPct) })}><i style={{ width: `${paidPct}%` }} /></div>
      {o.payments.length ? (
        <ul className="pagos">{o.payments.map((p) => (
          <li key={p.id}><span className="mut">{date(p.on)}</span><span>{p.note}</span><b className="num">{centsTotal(p.amountCents)}</b>
            {isActive(o.status) ? <RemoveLink label={t('screens.order.removeAria', { amount: centsTotal(p.amountCents) })} onConfirm={() => remove.mutate(p.id)} /> : <span />}</li>
        ))}</ul>
      ) : <p className="hint">{L.noPayments}</p>}
      {T.owedCents > 0 && isActive(o.status) ? <div className="btnrow"><Button size="sm" onClick={() => runner.setDlg({ kind: 'pay', id: o.id })}>{L.recordPayment}</Button></div> : null}
    </fieldset>
  );
}

/** "Quitar" → "¿Quitar?" → removes (two taps, docs/13 §7), with the small link style of the mockup. */
function RemoveLink({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return <button type="button" className="link quitar" aria-label={label} onBlur={() => setArmed(false)} onClick={() => { if (armed) { setArmed(false); onConfirm(); } else setArmed(true); }}>{armed ? es.confirm.removeQuestion : L.remove}</button>;
}

// ---------- Producción ----------
function Production({ o, runner }: { o: OrderDetail; runner: StepRunner }) {
  if (o.status !== 'in_production') return null;
  const jobs = [...o.queue].sort((a, b) => a.printerName.localeCompare(b.printerName));
  return (
    <fieldset className="blk"><legend>{L.inProduction}</legend>
      {jobs.length ? jobs.map((j) => (
        <div className="pj" key={j.id}>
          <div className="pj-h"><b>{j.printerName}</b><Pill tone={j.position === 0 ? 'info' : ''}>{j.position === 0 ? L.printingChip : L.queuedChip}</Pill></div>
          <p>{j.text}</p>
          {j.position === 0 ? <><div className="prog noz"><i style={{ width: `${j.progress}%` }} /></div><small>{t('screens.order.jobLeft', { n: j.progress, time: queueDuration(j.remainingMinutes) })} <span className="mut">{L.estimated}</span></small></>
            : <small>{t('screens.order.waitLine', { time: queueDuration(j.waitMinutes), count: j.position })}</small>}
        </div>
      )) : <p className="note warn">{L.noPrinter}</p>}
      <div className="btnrow"><Button size="sm" onClick={() => runner.setDlg({ kind: 'reassign', id: o.id })}>{L.changePrinters}</Button></div>
      <p className="hint">{L.finishHint}</p>
    </fieldset>
  );
}

function Material({ o }: { o: OrderDetail }) {
  const fin = o.status === 'delivered';
  const products = useProducts().data?.items ?? [];
  const hoursOf = new Map(products.map((p) => [p.id, p.hours]));
  const mat = useMaterial(o.material.needs);
  const purge = useSettings().data?.settings.purgePct ?? 0;
  const de = fromStockOf(o);
  if (fin) return null;
  if (!mat.lines.length && de > 0 && (o.status === 'quoted' || o.status === 'accepted')) {
    return <fieldset className="blk"><legend>{L.material}</legend><p className="status good"><Icon name="check" size={16} /><span>{L.allStock} {o.status === 'accepted' ? L.allStockAccepted : L.allStockQuoted}</span></p></fieldset>;
  }
  if (!mat.lines.length) return null;
  const h = o.items.reduce((a, it) => a + itemHours(lineData(it), (pid) => hoursOf.get(pid) ?? 0), 0);
  return (
    <fieldset className="blk"><legend>{L.material}</legend><div className="calc">
      <div className="mats"><span className="k">{t(de ? 'screens.order.materialLabelPrinted' : 'screens.order.materialLabel', { pct: purge })}</span><MatRows lines={mat.lines} stock={!o.filamentDeducted} /></div>
      <dl className="kv"><div><dt>{L.printTime}</dt><dd>{hours(h)}</dd></div></dl>
      {o.filamentDeducted ? <p className="status good"><Icon name="check" size={16} /><span>{L.deducted}</span></p>
        : mat.short.length ? <Shortfall lines={mat.short} /> : <p className="note">{L.enough}</p>}
    </div></fieldset>
  );
}

// ---------- Datos ----------
function Data({ o, runner }: { o: OrderDetail; runner: StepRunner }) {
  const today = todayLocal();
  const channels = useSettings().data?.channels ?? [];
  const del = useWrite(() => ordersApi.remove(o.id), {
    touches: [...ORDER_TOUCHES],
    ok: () => [t('toast.order.deleted', { folio: o.number }), o.filamentDeducted ? L.filamentKeptToast : ''].filter(Boolean).join(' '),
    undo: () => () => ordersApi.restore(o.id),
    onDone: () => go('/pedidos'),
  });
  const closed = !isActive(o.status);
  const c = o.customer;
  return (
    <>
      <div className="cols2 soft">
        <fieldset className="blk"><legend>{L.deliveryChannel}</legend><div className="grid2">
          <Field label={L.due} hint={closed ? undefined : dueText(o, today)}><input type="date" value={o.dueOn} disabled readOnly /></Field>
          <Field label={L.channel}><select value={o.channelId} disabled>{(channels.some((x) => x.id === o.channelId) ? channels : [{ id: o.channelId, name: o.channel }]).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></Field>
        </div></fieldset>
        <fieldset className="blk"><legend>{L.customer}</legend>
          {c ? <>
            <div className="cli-card">{c.logoUrl ? <span className="av logo"><img src={c.logoUrl} alt="" /></span> : <span className="av">{initials(c.name)}</span>}<div><b>{c.name}</b><small className="blk">{c.type} · {c.phone ? c.phone : <span className="neg">{L.noContact}</span>}{c.hasLogo ? L.withLogo : ''}</small></div></div>
            <div className="btnrow"><Button size="sm" onClick={() => go(`/clientes/cliente?id=${c.id}`)}>{L.seeCustomer}</Button><Button size="sm" variant="ghost" onClick={() => go(`/clientes/cliente?id=${c.id}`)}>{L.editCustomer}</Button></div>
          </> : <p className="note warn">{L.noCustomer}{o.status === 'quoted' || o.status === 'accepted' ? <> <button type="button" className="link" onClick={() => go(`/armar?modo=pedido&id=${o.id}`)}>{L.chooseCustomer}</button></> : null}</p>}
        </fieldset>
      </div>
      <fieldset className="blk"><legend>{L.notes}</legend><label className="fld"><span className="sr">{L.notesLabel}</span><textarea rows={2} value={o.note} readOnly disabled={closed} placeholder={L.noNotes} /></label>
        {closed ? null : <p className="hint">{L.dataHint}</p>}</fieldset>
      <div className="det-z btnrow">
        {isActive(o.status) ? <Button onClick={() => runner.setDlg({ kind: 'cancel', id: o.id })} data-testid="cancel-order">{L.cancelOrder}</Button> : null}
        <ConfirmButton variant="ghost" danger confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deleteOrder}</ConfirmButton>
      </div>
    </>
  );
}
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
