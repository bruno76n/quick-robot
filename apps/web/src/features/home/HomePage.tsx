// Inicio (docs/06 §2; mockup reference/ronda-2/inicio.html): the brief of the last 30 days, the attention by priority
// (main column) and, beside it, the pieces with the most profit and the printers.
import type { CSSProperties } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, number1, queueDuration } from '../../lib/format';
import { go } from '../../lib/nav';
import { usePrinters } from '../../lib/queries';
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
  const rank = (R?.topProducts ?? []).slice(0, 5);
  const max = Math.max(1, ...rank.map((r) => r.profitCents));
  const att = home?.attentions ?? [];
  return (
    <>
      <PageHead title={<><Mascot size={44} /><span>{L.title}</span></>} actions={<>
        <Button onClick={() => go('/armar?modo=pedido')}>{L.newOrder}</Button>
        <Button onClick={() => go('/armar?modo=venta')}>{L.newSale}</Button>
        <Button variant="green" icon="plus" onClick={() => go('/productos/pieza')}>{L.newPiece}</Button>
      </>} />
      {R ? <Brief compact T={R.totals} K={R.costConcepts} gA={R.hasExpenses ? R.expensesCents : null} A={R.previous} gP={R.hasExpenses ? R.previousExpensesCents : null} when={L.when} empty={L.briefEmpty} /> : <div className="skel" />}
      <div className="home-cols">
        {!home ? <section className="home-main" aria-busy="true" /> : null}
        {home && !att.length ? <section className="home-main"><h2>{L.attention.title}</h2><div className="allok"><Mascot size={76} /><div><b>{L.allOk}</b><p>{L.allOkText}</p></div></div></section> : null}
        {att.length ? <Attentions items={att} /> : null}
        <div className="home-side">
          <section>
            <h2>{L.top}</h2>
            {R && !rank.length ? <div className="empty-card"><Mascot size={64} /><p>{L.topEmpty}</p><Button variant="green" onClick={() => go('/armar?modo=venta')}>{L.newSale}</Button></div> : null}
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
          </section>
          <section>
            <h2>{L.printers}</h2>
            {printers && !printers.length ? <div className="empty-card"><Mascot size={64} /><p>{L.printersEmpty}</p><Button onClick={() => go('/impresoras')}>{L.goPrinters}</Button></div> : null}
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
      </div>
    </>
  );
}
