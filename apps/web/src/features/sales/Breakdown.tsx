// Breakdown per piece of a sale (mockup desgloseHTML + ventaDesglose): a set opens into its pieces, each
// with its share of the set price, its cost, its profit and where it is.
import { itemCost, itemLines, itemPieces, itemTotal, type LineItemData } from '@app/core';
import { Fragment } from 'react';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { money, moneyTotal } from '../../lib/format';
import type { SaleItem } from './api';

const L = es.screens.sales;

export const toLineItem = (it: SaleItem): LineItemData => ({
  kind: it.kind, productId: it.productId, collectionId: it.collectionId, name: it.name, qty: it.qty,
  price: it.priceCents / 100, list: it.listCents / 100, cost: it.costCents / 100, extras: it.extrasCents / 100,
  parts: it.parts.map((p) => ({ productId: p.productId, name: p.name, qty: p.qty, list: p.listCents / 100, cost: p.costCents / 100 })),
});

/** "−4% vs lista" when the price is at least 1% away from the list price. */
export function VsList({ list, price }: { list: number; price: number }) {
  const d = list > 0 ? (1 - price / list) * 100 : 0;
  return Math.abs(d) >= 1 ? <small className="blk">{t('screens.sales.vsList', { sign: d > 0 ? '−' : '+', value: Math.round(Math.abs(d)) })}</small> : null;
}

export function Breakdown({ items, commissionPct, orderNumber, returned }: { items: SaleItem[]; commissionPct: number; orderNumber: number | null; returned: boolean }) {
  const cm = commissionPct / 100;
  const k = orderNumber !== null ? 'ped' : 'sale';
  const origin = (_n: number) => (orderNumber !== null ? t('screens.sales.oOrder', { folio: orderNumber }) : L.oStock);
  const tag = (n: number) => <div className="dn"><span className={`tg ${k}`}><b className="num">{n}</b>{origin(n)}</span></div>;
  const groups = items.map((it) => {
    const d = toLineItem(it);
    const total = itemTotal(d), cost = itemCost(d);
    return { it, d, total, cost, gain: total * (1 - cm) - cost, rows: itemLines(d).map((l) => ({ ...l, gain: l.income * (1 - cm) - l.cost })) };
  });
  const T = groups.reduce((a, g) => ({ total: a.total + g.total, cost: a.cost + g.cost, gain: a.gain + g.gain }), { total: 0, cost: 0, gain: 0 });
  const pieces = returned ? 0 : groups.reduce((a, g) => a + itemPieces(g.d), 0);
  const opens = (g: (typeof groups)[number]) => g.it.kind === 'set' && g.it.parts.length > 0;
  const gainCls = (x: number) => `r num c-gan ${x >= 0 ? 'pos' : 'neg'}`;
  return (
    <>
      <div className="tw">
        <table className="tbl dsg">
          <thead><tr><th>{L.dPiece}</th><th className="r">{L.dQty}</th><th className="r c-pre">{L.dPrice}</th><th className="r c-tot">{L.dTotal}</th><th className="r c-cos">{L.dCost}</th><th className="r c-gan">{L.dProfit}</th><th className="c-ori">{L.dWhere}</th></tr></thead>
          {groups.map((g) => {
            if (!opens(g)) {
              const r = g.rows[0]!;
              return (
                <tbody className="dg" key={g.it.id}>
                  <tr><td className="pz-n"><b>{g.it.name}</b></td><td className="r num">{r.qty}</td><td className="r num c-pre">{money(g.d.price)}<VsList list={g.d.list} price={g.d.price} /></td><td className="r num c-tot">{money(g.total)}</td><td className="r num c-cos">{moneyTotal(g.cost)}</td><td className={gainCls(g.gain)}>{moneyTotal(g.gain)}</td><td className="c-ori">{tag(r.qty)}</td></tr>
                </tbody>
              );
            }
            const np = g.rows.reduce((a, r) => a + r.qty, 0);
            const txt = `${np} ${origin(np).toLocaleLowerCase('es')}`;
            return (
              <tbody className="dg abre" key={g.it.id}>
                <tr className="gh">
                  <td className="pz-n"><b>{g.it.name}</b> <span className="tg-set">{L.collection}</span><small className="blk">{t('screens.sales.dSetPieces', { count: np / Math.max(1, g.it.qty) })}</small></td>
                  <td className="r num">{g.it.qty}<small className="blk">{t('screens.sales.dSets', { count: g.it.qty })}</small></td>
                  <td className="r num c-pre">{money(g.d.price)}<VsList list={g.d.list} price={g.d.price} /></td>
                  <td className="r num c-tot">{money(g.total)}</td><td className="r num c-cos">{moneyTotal(g.cost)}</td><td className={gainCls(g.gain)}>{moneyTotal(g.gain)}</td>
                  <td className="c-ori"><span className="capas sm" role="img" aria-label={txt}><i className={k} style={{ flex: np }} /></span><small className="blk">{txt}</small></td>
                </tr>
                {g.rows.map((r, i) => (
                  <Fragment key={i}>
                    <tr className="pz"><td className="pz-n"><span className="tree" aria-hidden="true" /><b>{r.name}</b></td><td className="r num">{r.qty}</td><td className="r num c-pre">{money(r.qty ? r.income / r.qty : 0)}</td><td className="r num c-tot">{money(r.income)}</td><td className="r num c-cos">{moneyTotal(r.cost)}</td><td className={gainCls(r.gain)}>{moneyTotal(r.gain)}</td><td className="c-ori">{tag(r.qty)}</td></tr>
                  </Fragment>
                ))}
              </tbody>
            );
          })}
          <tfoot><tr className="tot"><td>{L.dTotal}</td><td className="r num">{pieces}<small className="blk">{t('screens.sales.dPieces', { count: pieces })}</small></td><td className="c-pre" /><td className="r num c-tot">{moneyTotal(T.total)}</td><td className="r num c-cos">{moneyTotal(T.cost)}</td><td className={gainCls(T.gain)}>{moneyTotal(T.gain)}</td><td className="c-ori" /></tr></tfoot>
        </table>
      </div>
      {groups.some(opens) ? <p className="hint">{L.dSetHint}</p> : null}
    </>
  );
}
