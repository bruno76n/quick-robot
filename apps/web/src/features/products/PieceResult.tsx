// Right side of the calculator (ronda-3 pieza.html): cost breakdown with bar and %, the price block (method, list
// price, profit, margin, times the cost, status against the minimum price), price shortcuts, profit by channel,
// by quantity and on another printer.
import type { ChannelView } from '@app/contract';
import { floorPrice, nicePrice, profitAt, suggestedPrice } from '@app/core';
import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { Meter } from '../../components/Meter';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { grams, hours as fmtHours, money, moneyTotal, number1, pct } from '../../lib/format';
import { costSourceLong } from '../filament/spools';
import { draftHours, isTechnical, marginOf, num, previewCost, priceOf, type Catalog, type Draft } from './costing';

const L = es.screens.calculator;

/**
 * - method: the Por valor | Por fórmula switch (owned by the form), full width above the breakdown and the price block.
 * - price: the list price field and the margin (owned by the form), shown in the price block.
 * - channels: the business's sales channels; profit per channel is core's profitAt at the list price.
 */
export function PieceResult({ d, c, parent, channels, method, price, onPrice, onFormula }: { d: Draft; c: Catalog; parent: Draft | null; channels: ChannelView[]; method: ReactNode; price: ReactNode; onPrice: (v: number) => void; onFormula: () => void }) {
  const k = previewCost(d, c);
  const pr = priceOf(d, c, k.total);
  const tot = k.total;
  const gain = pr - tot;
  const rows: [string, number][] = [[L.material, k.M], [L.machine, k.Q], [L.failures, k.F], [L.power, k.L], [L.extras, k.E]];
  rows.sort((a, b) => b[1] - a[1]);
  const loss = pr < tot;
  const floor = floorPrice(tot, c.settings.minMarginPct);
  const status: ['info' | 'bad' | 'warn' | 'good', string] = pr <= 0 ? ['info', L.needPrice]
    : loss ? ['bad', t('screens.calculator.loss', { amount: money(tot - pr) })]
    : pr < floor ? ['warn', t('screens.calculator.belowFloor', { floor: moneyTotal(floor) })]
    : ['good', t('screens.calculator.aboveFloor', { floor: money(floor), minPct: c.settings.minMarginPct })];
  const mg = Math.min(95, marginOf(d, c));
  const refs: [string, number, string][] = [[L.floor, Math.ceil(floor), t('screens.calculator.costPlus', { pct: c.settings.minMarginPct })], [L.formula, Math.ceil(suggestedPrice(tot, mg)), t('screens.calculator.marginOf', { pct: mg })], ['×3', nicePrice(tot * 3), ''], ['×5', nicePrice(tot * 5), ''], ['×10', nicePrice(tot * 10), '']];
  const grTot = d.filaments.reduce((a, f) => a + num(f.grams), 0);
  const perPlate = Math.max(1, Math.round(num(d.batch, 1)) || 1);
  const pTot = parent ? previewCost(parent, c).total : 0;
  const pPrice = parent ? priceOf(parent, c, pTot) : 0;
  const dc = tot - pTot;
  // Ronda 4: a filament without any way to cost it (no purchases, no material, no reference) counts at $0: say so.
  const noReference = c.filaments.filter((f) => f.costSource === 'none' && d.filaments.some((x) => x.filamentId === f.id && num(x.grams) > 0));
  const ids = [...(d.printerId === '' ? [''] : []), ...c.printers.map((p) => p.id)];
  return (
    <>
      {method}
      <div className="res-top">
        <section className="pz-bd" aria-label={L.breakdown}>
          <span className="k">{L.breakdown}</span>
          <ul className="pz-rows">
            {rows.map(([label, v]) => <li key={label}><b>{label}</b><Meter value={tot > 0 ? (v / tot) * 100 : 0} /><span className="num mut">{tot > 0 ? pct((v / tot) * 100) : '—'}</span><span className="num">{money(v)}</span></li>)}
          </ul>
          <div className="pz-cost"><span>{L.cost}</span><b className="big num">{money(tot)}</b></div>
        </section>
        <div className="pz-price">
          {price}
          <dl className="pz-k">
            <div className="g"><dt>{L.gain}</dt><dd className={`num ${gain >= 0 ? 'pos' : 'neg'}`}>{pr > 0 ? money(gain) : '—'}</dd></div>
            <div><dt>{L.margin}</dt><dd className="num">{pr > 0 ? pct((gain / pr) * 100) : '—'}</dd></div>
            <div><dt>{L.timesCost}</dt><dd className="num">{pr > 0 && tot > 0 ? `${number1(pr / tot)}×` : '—'}</dd></div>
          </dl>
          <p className={`pz-st ${status[0]}`}><Icon name={status[0] === 'good' ? 'check' : 'warn'} size={14} /><span>{status[1]}</span></p>
        </div>
      </div>
      {parent && d.mode === 'value' ? <p className="note">{t('screens.calculator.vsParent', { name: parent.name })} {Math.abs(dc) < 0.005 ? L.costSame : t(dc > 0 ? 'screens.calculator.costUp' : 'screens.calculator.costDown', { amount: money(Math.abs(dc)) })} {pr === pPrice ? L.priceSame : t('screens.calculator.priceChanges', { price: moneyTotal(pr) })}</p> : null}
      {noReference.map((f) => <p key={f.id} className="note warn" data-testid="no-reference">{costSourceLong(f)}</p>)}
      {isTechnical(d, c) && d.mode === 'value' ? <p className="note warn">{L.technical} <button type="button" className="link" onClick={onFormula}>{L.useFormula}</button></p> : null}
      {d.mode === 'value' ? (
        <div className="refs"><span className="k">{L.shortcuts}</span><div>{refs.map((r) => <button key={r[0]} type="button" className="ref" onClick={() => onPrice(r[1])}><b>{moneyTotal(r[1])}</b><small>{r[0]}{r[2] ? ` · ${r[2]}` : ''}</small></button>)}</div></div>
      ) : <p className="hint">{t('screens.calculator.formulaNote', { pct: mg })}</p>}
      <p className="hint pz-ph">{d.mode === 'value' ? L.valueHint : L.formulaHint} {L.listHint}</p>
      {channels.length ? (
        <section className="pz-sec" aria-label={L.byChannel}>
          <span className="k">{L.byChannel}</span>
          <table className="tbl sm fit"><thead><tr><th>{L.colChannel}</th><th className="r">{L.colCommission}</th><th className="r">{L.gain}</th></tr></thead><tbody>
            {channels.map((ch) => { const g = profitAt(pr, tot, ch.commissionPct).profit; return <tr key={ch.id}><td>{ch.name}</td><td className="r num">{pct(ch.commissionPct)}</td><td className={`r num pz-g ${g >= 0 ? 'pos' : 'neg'}`}>{pr > 0 ? money(g) : '—'}</td></tr>; })}
          </tbody></table>
        </section>
      ) : null}
      <section className="pz-sec" aria-label={L.byQty}>
        <span className="k">{L.byQty}</span>
        <div className="tw"><table className="tbl sm fit"><thead><tr><th>{L.colPieces}</th><th className="r">{L.colPlates}</th><th className="r">{L.colPrint}</th><th className="r">{L.colFilament}</th><th className="r">{L.colCost}</th></tr></thead><tbody>
          {[1, 2, 5, 10, 25, 50].map((n) => <tr key={n}><td>{n}</td><td className="r num">{Math.ceil(n / perPlate)}</td><td className="r num nw">{fmtHours(draftHours(d) * n)}</td><td className="r num">{grams(grTot * n)}</td><td className="r num">{money(tot * n)}</td></tr>)}
        </tbody></table></div>
        <p className="hint">{t('screens.calculator.byQtyHint', { cost: money(tot) })}</p>
      </section>
      {c.printers.length >= 2 ? (
        <section className="pz-sec" aria-label={L.otherPrinter}>
          <span className="k">{L.otherPrinter}</span>
          <table className="tbl sm fit"><tbody>
            {ids.map((id) => { const x = previewCost(d, c, id).total; const ref = d.printerId === id; return <tr key={id || 'avg'}><td>{id ? c.printers.find((p) => p.id === id)?.name : L.averagePrinter}{ref ? <> <small>{L.reference}</small></> : null}</td><td className="r num">{money(x)}</td><td className="r num mut">{ref ? '' : `${x >= tot ? '+' : '−'}${money(Math.abs(x - tot))}`}</td></tr>; })}
          </tbody></table>
          <p className="hint">{L.otherPrinterHint}</p>
        </section>
      ) : null}
    </>
  );
}
