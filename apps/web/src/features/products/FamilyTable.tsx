// Productos › Lista by families (mejoras/ronda-2.md §3.3; reference/ronda-2/productos-lista.html).
import type { ProductFamily } from '@app/contract';
import { Fragment } from 'react';
import { Button } from '../../components/Button';
import { Pill, Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, money, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { newVariantPath, sellPath } from './api';
import { Chevron, MemberStock, membersOf, openPiece, printerOf, ratio } from './FamilyTiles';
import { MarginBar } from './Piece3d';

const L = es.screens.products;

export function FamilyTable({ items, anyPieces, open, onToggle }: { items: ProductFamily[]; anyPieces: boolean; open: string | null; onToggle: (id: string) => void }) {
  return (
    <div className="tw fam-tw"><table className="tbl prods fam"><thead><tr><th className="pc">{L.colPiece}</th><th className="r">{L.colInStock}</th><th className="r">{L.colCost}</th><th className="r">{L.colList}</th><th className="bar-th"><span className="sr">{L.costVsPrice}</span></th><th className="r">{L.colProfit}</th><th className="r nw">{L.colTimes}</th><th className="r">{L.colSold}</th><th><span className="sr">{es.common.detail}</span></th></tr></thead>
      <tbody>
        {items.map((p) => {
          const gain = p.listCents - p.costCents;
          const apt = Math.min(p.physical, p.reserved);
          const isOpen = open === p.id && p.variantCount > 0;
          return (
            <Fragment key={p.id}>
            <tr className={`click fam-r${isOpen ? ' open' : ''}`} tabIndex={0} onClick={() => openPiece(p.id)} data-testid="family-row">
              <td className="pc"><div className="pn">{p.variantCount ? <button type="button" className="fam-chev" aria-expanded={isOpen} aria-label={isOpen ? L.variants.hide : L.variants.show} data-testid="variants-arrow" onClick={(e) => { e.stopPropagation(); onToggle(p.id); }}><Chevron dir="right" /></button> : <span className="fam-gap" />}<span className="swstack">{p.hexes.slice(0, 1).map((h, i) => <Swatch key={i} hex={h} />)}</span><div><b>{p.name}</b><small>{printerOf(p)}</small>{p.collections.length || p.technical || p.variantCount ? <span className="pcols">{p.technical ? <Pill>{L.technicalTag}</Pill> : null}{p.collections.slice(0, 2).map((c) => <Pill key={c.id} tone="info">{c.name}</Pill>)}{p.collections.length > 2 ? <Pill>+{p.collections.length - 2}</Pill> : null}{p.variantCount ? <span className="pill vcount">{t('screens.products.variants.count', { count: p.variantCount })}</span> : null}</span> : null}</div></div></td>
              <td className={`r num ex-td${p.tracksStock && !p.free ? ' neg' : ''}`} data-k={L.colInStock}>{p.tracksStock ? <><b>{p.free}</b><small className="blk">{t('screens.products.reserved', { count: apt })}</small></> : <><span className="mut">—</span><small className="blk">{L.onlyToOrderLower}</small></>}</td>
              <td className="r num cost" data-k={L.colCost}>{money(p.costCents / 100)}</td>
              <td className="r num" data-k={L.colList}><b>{centsTotal(p.listCents)}</b>{p.mode === 'formula' ? <small className="blk">{L.costPlusMargin}</small> : null}</td>
              <td className="bar-td hide-m"><MarginBar cost={p.costCents} price={p.listCents} /></td>
              <td className={`r num ${gain >= 0 ? 'pos' : 'neg'}`} data-k={L.colProfit}>{centsTotal(gain)}</td>
              <td className="r num hide-m">{ratio(p.listCents, p.costCents)}</td>
              <td className="r num" data-k={L.colSold}>{number1(p.sold)}</td>
              <td className="r acts" onClick={(e) => e.stopPropagation()}><span className="rowa"><Button size="sm" onClick={() => go(sellPath(p.id, p.free))}>{p.free > 0 ? L.sell : L.order}</Button><Button size="sm" variant="ghost" icon="plus" onClick={() => go(newVariantPath(p.id))}>{L.variants.add}</Button></span></td>
            </tr>
            {isOpen ? <VariantRows f={p} /> : null}
            </Fragment>
          );
        })}
        {!items.length ? <tr><td colSpan={9} className="empty-td"><p>{anyPieces ? L.noPieceMatch : L.emptyPieces}</p><Button variant="green" onClick={() => go('/productos/pieza')}>{L.createPiece}</Button></td></tr> : null}
      </tbody></table></div>
  );
}

/** The variants under their original (not repeated) with a guide line, and "+ Agregar variante de …" at the end. */
function VariantRows({ f }: { f: ProductFamily }) {
  return (
    <>
      {membersOf(f, false).map((m) => {
        const gain = m.listCents - m.costCents;
        return (
          <tr key={m.id} className="click var-r" tabIndex={0} onClick={() => openPiece(m.id)} data-testid="variant-list-row">
            <td className="pc"><div className="pn var-n"><span className="guide" aria-hidden="true" /><Swatch hex={m.hexes[0] ?? 'var(--no-color)'} /><b>{m.label}</b><small>{m.material ?? ''}</small></div></td>
            <td className={`r num ex-td${m.tracksStock && !m.free ? ' neg' : ''}`} data-k={L.colInStock}><MemberStock m={m} unit={false} /></td>
            <td className="r num cost" data-k={L.colCost}>{money(m.costCents / 100)}</td>
            <td className="r num" data-k={L.colList}><b>{centsTotal(m.listCents)}</b></td>
            <td className="bar-td hide-m"><MarginBar cost={m.costCents} price={m.listCents} /></td>
            <td className={`r num ${gain >= 0 ? 'pos' : 'neg'}`} data-k={L.colProfit}>{centsTotal(gain)}</td>
            <td className="r num hide-m">{ratio(m.listCents, m.costCents)}</td>
            <td className="r num" data-k={L.colSold}>{number1(m.sold)}</td>
            <td className="r acts" onClick={(e) => e.stopPropagation()}><span className="rowa"><Button size="sm" onClick={() => go(sellPath(m.id, m.free))}>{m.free > 0 ? L.sell : L.order}</Button><Button size="sm" variant="ghost" onClick={() => openPiece(m.id)}>{es.common.edit}</Button></span></td>
          </tr>
        );
      })}
      <tr className="var-add"><td className="pc" colSpan={9}><div className="var-add-in"><Button size="sm" icon="plus" className="dashed" onClick={() => go(newVariantPath(f.id))}>{t('screens.products.variants.addTo', { name: f.name })}</Button></div></td></tr>
    </>
  );
}
