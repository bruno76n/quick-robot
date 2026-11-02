// Right side of the calculator: cost, list price, bar, KPIs, status, legend, price shortcuts and by quantity.
import { floorPrice, nicePrice, suggestedPrice } from '@app/core';
import type { CSSProperties } from 'react';
import { Icon } from '../../components/Icon';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { grams, hours as fmtHours, money, moneyTotal, number1, pct } from '../../lib/format';
import { draftHours, isTechnical, marginOf, num, previewCost, priceOf, type Catalog, type Draft } from './costing';

const L = es.screens.calculator;

export function PieceResult({ d, c, parent, onPrice, onFormula }: { d: Draft; c: Catalog; parent: Draft | null; onPrice: (v: number) => void; onFormula: () => void }) {
  const k = previewCost(d, c);
  const pr = priceOf(d, c, k.total);
  const tot = k.total;
  const gain = pr - tot;
  const segs: [string, number, string, string?][] = [[L.material, k.M, '--c-m'], [L.power, k.L, '--c-l'], [L.machine, k.Q, '--c-q'], [L.extras, k.E, '--c-e'], [L.failures, k.F, '--c-f', 'hatch']];
  const scale = Math.max(pr, tot, 1);
  const loss = pr < tot;
  const floor = floorPrice(tot, c.settings.minMarginPct);
  const status: ['info' | 'bad' | 'warn' | 'good', string] = pr <= 0 ? ['info', L.needPrice]
    : loss ? ['bad', t('screens.calculator.loss', { amount: money(tot - pr) })]
    : pr < floor ? ['warn', t('screens.calculator.belowFloor', { floor: moneyTotal(floor) })]
    : ['good', t('screens.calculator.profit', { amount: moneyTotal(gain), times: number1(pr / tot) })];
  const mg = Math.min(95, marginOf(d, c));
  const refs: [string, number, string][] = [[L.floor, Math.ceil(floor), t('screens.calculator.costPlus', { pct: c.settings.minMarginPct })], [L.formula, Math.ceil(suggestedPrice(tot, mg)), t('screens.calculator.marginOf', { pct: mg })], ['×3', nicePrice(tot * 3), ''], ['×5', nicePrice(tot * 5), ''], ['×10', nicePrice(tot * 10), '']];
  const grTot = d.filaments.reduce((a, f) => a + num(f.grams), 0);
  const perPlate = Math.max(1, Math.round(num(d.batch, 1)) || 1);
  const pTot = parent ? previewCost(parent, c).total : 0;
  const pPrice = parent ? priceOf(parent, c, pTot) : 0;
  const dc = tot - pTot;
  const ids = [...(d.printerId === '' ? [''] : []), ...c.printers.map((p) => p.id)];
  return (
    <>
      <div className={`sbar${loss ? ' loss' : ''}`} role="img" aria-label={L.priceSplit}>
        {segs.filter((s) => s[1] > 0).map((s) => <i key={s[0]} className={s[3] ?? ''} style={{ width: `${(s[1] / scale) * 100}%`, '--s': `var(${s[2]})` } as CSSProperties} title={`${s[0]}: ${money(s[1])}`} />)}
        {gain > 0 ? <i className="gain" style={{ width: `${(gain / scale) * 100}%` }} title={`${L.gain}: ${money(gain)}`} /> : null}
      </div>
      <div className="kpis">
        <div><span className="k">{L.gain}</span><b className={`num ${gain >= 0 ? 'pos' : 'neg'}`}>{pr > 0 ? moneyTotal(gain) : '—'}</b></div>
        <div><span className="k">{L.margin}</span><b className="num">{pr > 0 ? pct((gain / pr) * 100) : '—'}</b></div>
        <div><span className="k">{L.timesCost}</span><b className="num">{pr > 0 && tot > 0 ? `×${number1(pr / tot)}` : '—'}</b></div>
      </div>
      <p className={`status ${status[0]}`}><Icon name={status[0] === 'good' ? 'check' : 'warn'} size={16} /><span>{status[1]}</span></p>
      {parent && d.mode === 'value' ? <p className="note">{t('screens.calculator.vsParent', { name: parent.name })} {Math.abs(dc) < 0.005 ? L.costSame : t(dc > 0 ? 'screens.calculator.costUp' : 'screens.calculator.costDown', { amount: money(Math.abs(dc)) })} {pr === pPrice ? L.priceSame : t('screens.calculator.priceChanges', { price: moneyTotal(pr) })}</p> : null}
      {isTechnical(d, c) && d.mode === 'value' ? <p className="note warn">{L.technical} <button type="button" className="link" onClick={onFormula}>{L.useFormula}</button></p> : null}
      <table className="tbl sm legend"><tbody>
        {segs.map((s) => <tr key={s[0]}><td><span className={`lk ${s[3] ?? ''}`} style={{ '--s': `var(${s[2]})` } as CSSProperties} />{s[0]}</td><td className="r num">{money(s[1])}</td><td className="r num mut">{pr > 0 ? pct((s[1] / pr) * 100) : ''}</td></tr>)}
        <tr className="tot"><td>{L.totalCost}</td><td className="r num">{money(tot)}</td><td /></tr>
        {pr > 0 ? <tr className="gan"><td><span className="lk gain" />{L.gain}</td><td className="r num">{money(gain)}</td><td className="r num mut">{pct((gain / pr) * 100)}</td></tr> : null}
      </tbody></table>
      {d.mode === 'value' ? (
        <><div className="refs"><span className="k">{L.shortcuts}</span><div>{refs.map((r) => <button key={r[0]} type="button" className="ref" onClick={() => onPrice(r[1])}><b>{moneyTotal(r[1])}</b><small>{r[0]}{r[2] ? ` · ${r[2]}` : ''}</small></button>)}</div></div><p className="hint">{L.shortcutsHint}</p></>
      ) : <p className="note">{t('screens.calculator.formulaNote', { pct: mg })}</p>}
      <h3>{L.byQty}</h3>
      <div className="tw"><table className="tbl sm"><thead><tr><th>{L.colPieces}</th><th className="r">{L.colPlates}</th><th className="r">{L.colPrint}</th><th className="r">{L.colFilament}</th><th className="r">{L.colCost}</th></tr></thead><tbody>
        {[1, 2, 5, 10, 25, 50].map((n) => <tr key={n}><td>{n}</td><td className="r num">{Math.ceil(n / perPlate)}</td><td className="r num nw">{fmtHours(draftHours(d) * n)}</td><td className="r num">{grams(grTot * n)}</td><td className="r num">{money(tot * n)}</td></tr>)}
      </tbody></table></div>
      <p className="hint">{t('screens.calculator.byQtyHint', { cost: money(tot) })}</p>
      {c.printers.length >= 2 ? (
        <><h3>{L.otherPrinter}</h3><div className="tw"><table className="tbl sm"><tbody>
          {ids.map((id) => { const x = previewCost(d, c, id).total; const ref = d.printerId === id; return <tr key={id || 'avg'}><td>{id ? c.printers.find((p) => p.id === id)?.name : L.averagePrinter}{ref ? <> <small>{L.reference}</small></> : null}</td><td className="r num">{money(x)}</td><td className="r num mut">{ref ? '' : `${x >= tot ? '+' : '−'}${money(Math.abs(x - tot))}`}</td></tr>; })}
        </tbody></table></div><p className="hint">{L.otherPrinterHint}</p></>
      ) : null}
    </>
  );
}
