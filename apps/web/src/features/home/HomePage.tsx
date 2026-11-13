// Inicio (docs/06 §2; mockup vInicio): the brief of the last 30 days, top pieces, filament, attentions and printers.
import type { FilamentListItem } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties, ReactNode } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { centsTotal, date, grams, money, number1, queueDuration } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys, usePrinters } from '../../lib/queries';
import { Piece3d, shapeOf } from '../products/Piece3d';
import { useHome, useReport, type Attention } from '../reports/api';
import { Brief } from '../reports/Brief';
import { allBold, rt } from '../reports/text';

const L = es.screens.home;
const A = 'screens.home.att.';

/** Text, button and destination of each attention (server kinds: reports.ts › home). */
export function attentionView(a: Attention): { text: ReactNode; button: string; href: string } {
  const p = a.params as Record<string, string | number | null>;
  const id = a.target.id ?? '';
  switch (a.kind) {
    case 'order_filament_short':
      return { text: rt(`${A}order_filament_short`, { number: `#${p.number}`, customer: p.customer ?? '', missing: grams(Number(p.missingGrams)), filament: p.filament ?? '', available: grams(Number(p.availableGrams ?? 0)) }, allBold('number', 'customer', 'missing')), button: L.btn.addSpool, href: p.filamentId ? `/filamentos?f=${p.filamentId}` : `/pedidos/pedido?id=${id}` };
    case 'filament_low':
      return { text: rt(`${A}filament_low`, { name: p.name ?? '', grams: grams(Number(p.grams)) }, allBold('name')), button: L.btn.seeFilament, href: `/filamentos?f=${id}` };
    case 'order_due': {
      const d = Number(p.days);
      const when = d < 0 ? t(`${A}dueLate`, { days: -d }) : d === 0 ? L.att.dueToday : d === 1 ? L.att.dueTomorrow : t(`${A}dueIn`, { days: d });
      return { text: rt(`${A}order_due`, { number: `#${p.number}`, customer: p.customer ?? '', when, ready: p.status === 'ready' ? L.att.readySuffix : '' }, allBold('number', 'customer')), button: L.btn.openOrder, href: `/pedidos/pedido?id=${id}` };
    }
    case 'sale_owed':
      return { text: rt(p.customer ? `${A}sale_owed_to` : `${A}sale_owed`, { date: p.on ? date(String(p.on)) : '', customer: p.customer ?? '', owed: centsTotal(Number(p.owedCents)) }, allBold('date', 'customer', 'owed')), button: L.btn.addPayment, href: `/ventas?v=${id}` };
    case 'price_below_floor': {
      const col = a.target.type === 'collection';
      return { text: rt(col ? `${A}price_below_floor_collection` : `${A}price_below_floor_product`, { name: p.name ?? '', price: centsTotal(Number(p.priceCents)), cost: money(Number(p.costCents ?? p.floorCents) / 100) }, allBold('name')), button: col ? L.btn.seeCollection : L.btn.seeProducts, href: col ? `/productos/coleccion?id=${id}` : `/productos/pieza?id=${id}` };
    }
    case 'maintenance': {
      const h = Number(p.remainingHours);
      const status = h <= 0 ? t(`${A}maintenancePast`, { hours: number1(-h) }) : t(`${A}maintenanceLeft`, { hours: number1(h) });
      return { text: rt(`${A}maintenance`, { printer: p.printer ?? '', task: String(p.task ?? '').toLocaleLowerCase('es'), status }, allBold('printer')), button: L.btn.seePrinters, href: '/impresoras' };
    }
    case 'supply_low': {
      const stock = Number(p.stock);
      const state = stock <= 0 ? L.att.supplyOut : t(`${A}supplyLeft`, { qty: number1(stock), unit: p.unit || es.screens.supplies.pza });
      return { text: rt(`${A}supply_low`, { name: p.name ?? '', state }, allBold('name')), button: L.btn.seeSupply, href: `/insumos?i=${id}` };
    }
    case 'backup':
    default:
      return { text: p.days === null || p.days === undefined ? L.att.backupNever : rt(`${A}backupDays`, { days: Number(p.days) }, allBold('days')), button: L.btn.backup, href: '/ajustes' };
  }
}

export function HomePage() {
  const home = useHome().data;
  const R = useReport('30').data;
  const printers = usePrinters().data?.items;
  const fils = useQuery({ queryKey: [...keys.filaments, 'list', 'all'], queryFn: async () => (await api.filaments.list({ pageSize: 200 })).data }).data?.items;
  const rank = (R?.topProducts ?? []).slice(0, 5);
  const max = Math.max(1, ...rank.map((r) => r.profitCents));
  const att = home?.attentions ?? [];
  return (
    <>
      <PageHead title={L.title} actions={<>
        <Button onClick={() => go('/armar?modo=pedido')}>{L.newOrder}</Button>
        <Button onClick={() => go('/armar?modo=venta')}>{L.newSale}</Button>
        <Button variant="green" icon="plus" onClick={() => go('/productos/pieza')}>{L.newPiece}</Button>
      </>} />
      {R ? <Brief compact T={R.totals} K={R.costConcepts} gA={R.hasExpenses ? R.expensesCents : null} A={R.previous} gP={R.hasExpenses ? R.previousExpensesCents : null} when={L.when} empty={L.briefEmpty} /> : <div className="skel" />}
      <div className="cols2 soft">
        <section>
          <h2>{L.top}</h2>
          {R && !rank.length ? <div className="empty-card"><p>{L.topEmpty}</p><Button variant="green" onClick={() => go('/armar?modo=venta')}>{L.newSale}</Button></div> : null}
          {rank.length ? (
            <ul className="rk">{rank.map((r) => (
              <li key={r.productId}>
                <Piece3d hexes={r.hexes} id={r.productId} cls="sm" />
                <div className="rk-m">
                  <div className="rk-t"><b>{r.name}</b><span className="num">{centsTotal(r.profitCents)}</span></div>
                  <div className="rk-b"><i style={{ width: `${Math.max(3, (r.profitCents / max) * 100)}%` }} title={t('screens.home.topTip', { name: r.name, profit: centsTotal(r.profitCents), count: r.qty })} tabIndex={0} /></div>
                  <small>{t('screens.home.topLine', { count: r.qty, times: number1(r.times) })}</small>
                </div>
              </li>
            ))}</ul>
          ) : null}
          {fils?.length ? <Spools fils={fils} /> : null}
        </section>
        <section>
          <h2>{L.attention}</h2>
          {home && !att.length ? <div className="allok"><span className="allok-ic"><Icon name="check" size={26} /></span><div><b>{L.allOk}</b><p>{L.allOkText}</p></div></div> : null}
          {att.length ? (
            <ul className="att2" data-testid="attentions">{att.slice(0, 6).map((a, i) => {
              const v = attentionView(a);
              return <li key={i}><span className="ai"><Icon name="warn" size={16} /></span><span className="at">{v.text}</span><a className="btn sm" href={v.href} onClick={(e) => { e.preventDefault(); go(v.href); }}>{v.button}</a></li>;
            })}</ul>
          ) : null}
          {att.length > 6 ? <p className="more">{t('screens.home.more', { count: att.length - 6 })}</p> : null}
          <h2 className="gap">{L.printers}</h2>
          {printers && !printers.length ? <div className="empty-card"><p>{L.printersEmpty}</p><Button onClick={() => go('/impresoras')}>{L.goPrinters}</Button></div> : null}
          {printers?.length ? (
            <div className="bays">{printers.map((p) => {
              const e = p.queue[0];
              if (!e) return <div key={p.id} className="bay2 idle"><span className="lay sm s0 empty" /><div><b>{p.name}</b><small>{L.bayFree}</small></div></div>;
              return (
                <div key={p.id} className="bay2">
                  <span className={`lay sm s${shapeOf(e.id)} printing`} style={{ '--p': `${e.progress}%` } as CSSProperties} />
                  <div className="bay-m">
                    <div className="bay-t"><b>{e.text}</b><span className="num">{e.progress}%</span></div>
                    <small>{t('screens.home.bayLine', { printer: p.name, time: queueDuration(e.remainingMinutes) })}{e.orderNumber ? t('screens.home.bayOrder', { number: e.orderNumber }) : ''}{p.queue.length > 1 ? t('screens.home.bayQueue', { count: p.queue.length - 1 }) : ''}</small>
                    <div className="prog soft"><i style={{ width: `${e.progress}%` }} /></div>
                  </div>
                </div>
              );
            })}</div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Spools({ fils }: { fils: readonly FilamentListItem[] }) {
  const list = fils.map((f) => {
    const pct = f.capacityGrams ? Math.max(0, Math.min(100, Math.round((f.remainingGrams / f.capacityGrams) * 100))) : 0;
    return { f, pct, low: f.spools > 0 && f.remainingGrams <= 150 };
  }).sort((x, y) => Number(y.low) - Number(x.low) || x.pct - y.pct);
  return (
    <>
      <h2 className="gap">{L.filament}</h2>
      <div className="spools">{list.slice(0, 8).map(({ f, pct, low }) => {
        const name = `${f.material} ${f.color}`;
        return (
          <button key={f.id} type="button" className={`spool${low ? ' low' : ''}${f.spools ? '' : ' none'}`} onClick={() => go(`/filamentos?f=${f.id}`)} title={f.spools ? t('screens.home.spoolTitle', { name, grams: grams(f.remainingGrams) }) : t('screens.home.spoolTitleNone', { name })}>
            <span className="sp" style={{ '--c': f.hex, '--p': `${pct}%` } as CSSProperties} /><b>{f.color}</b><small>{f.material} · {f.spools ? grams(f.remainingGrams) : L.noSpools}</small>
          </button>
        );
      })}</div>
      {list.length > 8 ? <p className="more"><a href="/filamentos" onClick={(e) => { e.preventDefault(); go('/filamentos'); }}>{t('screens.home.filamentAll', { count: list.length })}</a></p> : null}
    </>
  );
}
