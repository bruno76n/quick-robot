// Productos › Lista by families (mejoras/ronda-2.md §3.3; reference/ronda-2/productos-lista.html).
import type { ProductFamily } from '@app/contract';
import { Button } from '../../components/Button';
import { Pill, Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, money, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { newVariantPath, sellPath } from './api';
import { openPiece, printerOf, ratio } from './FamilyTiles';
import { MarginBar } from './Piece3d';

const L = es.screens.products;

export function FamilyTable({ items, anyPieces }: { items: ProductFamily[]; anyPieces: boolean; open: string | null; onToggle: (id: string) => void }) {
  return (
    <div className="tw fam-tw"><table className="tbl prods fam"><thead><tr><th className="pc">{L.colPiece}</th><th className="r">{L.colInStock}</th><th className="r">{L.colCost}</th><th className="r">{L.colList}</th><th className="bar-th"><span className="sr">{L.costVsPrice}</span></th><th className="r">{L.colProfit}</th><th className="r nw">{L.colTimes}</th><th className="r">{L.colSold}</th><th><span className="sr">{es.common.detail}</span></th></tr></thead>
      <tbody>
        {items.map((p) => {
          const gain = p.listCents - p.costCents;
          const apt = Math.min(p.physical, p.reserved);
          return (
            <tr key={p.id} className="click fam-r" tabIndex={0} onClick={() => openPiece(p.id)} data-testid="family-row">
              <td className="pc"><div className="pn"><span className="fam-gap" /><span className="swstack">{p.hexes.slice(0, 1).map((h, i) => <Swatch key={i} hex={h} />)}</span><div><b>{p.name}</b><small>{printerOf(p)}</small>{p.collections.length || p.technical ? <span className="pcols">{p.technical ? <Pill>{L.technicalTag}</Pill> : null}{p.collections.slice(0, 2).map((c) => <Pill key={c.id} tone="info">{c.name}</Pill>)}{p.collections.length > 2 ? <Pill>+{p.collections.length - 2}</Pill> : null}</span> : null}</div></div></td>
              <td className={`r num ex-td${p.tracksStock && !p.free ? ' neg' : ''}`}>{p.tracksStock ? <><b>{p.free}</b><small className="blk">{t('screens.products.reserved', { count: apt })}</small></> : <><span className="mut">—</span><small className="blk">{L.onlyToOrderLower}</small></>}</td>
              <td className="r num cost">{money(p.costCents / 100)}</td>
              <td className="r num"><b>{centsTotal(p.listCents)}</b>{p.mode === 'formula' ? <small className="blk">{L.costPlusMargin}</small> : null}</td>
              <td className="bar-td"><MarginBar cost={p.costCents} price={p.listCents} /></td>
              <td className={`r num ${gain >= 0 ? 'pos' : 'neg'}`}>{centsTotal(gain)}</td>
              <td className="r num">{ratio(p.listCents, p.costCents)}</td>
              <td className="r num">{number1(p.sold)}</td>
              <td className="r" onClick={(e) => e.stopPropagation()}><span className="rowa"><Button size="sm" onClick={() => go(sellPath(p.id, p.free))}>{p.free > 0 ? L.sell : L.order}</Button><Button size="sm" variant="ghost" icon="plus" onClick={() => go(newVariantPath(p.id))}>{L.variants.add}</Button></span></td>
            </tr>
          );
        })}
        {!items.length ? <tr><td colSpan={9} className="empty-td"><p>{anyPieces ? L.noPieceMatch : L.emptyPieces}</p><Button variant="green" onClick={() => go('/productos/pieza')}>{L.createPiece}</Button></td></tr> : null}
      </tbody></table></div>
  );
}
