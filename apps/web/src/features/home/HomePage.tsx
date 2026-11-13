// Inicio (docs/06 §2; mockup vInicio): the brief of the last 30 days, top pieces, filament, attentions and printers.
import type { FilamentListItem } from '@app/contract';
import { useQuery } from '@tanstack/react-query';
import type { CSSProperties } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { centsTotal, grams, number1, queueDuration } from '../../lib/format';
import { go } from '../../lib/nav';
import { keys, usePrinters } from '../../lib/queries';
import { Piece3d, shapeOf } from '../products/Piece3d';
import { useHome, useReport } from '../reports/api';
import { Brief } from '../reports/Brief';
import { Attentions } from './Attentions';
import './home.css';

const L = es.screens.home;

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
          {home && !att.length ? <><h2>{L.attention.title}</h2><div className="allok"><span className="allok-ic"><Icon name="check" size={26} /></span><div><b>{L.allOk}</b><p>{L.allOkText}</p></div></div></> : null}
          {att.length ? <Attentions items={att} /> : null}
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
