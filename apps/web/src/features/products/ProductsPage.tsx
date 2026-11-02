// Productos (docs/06 §3): Piezas and Colecciones, as tiles or list, with filters and search.
import type { CollectionListItem, ProductListItem } from '@app/contract';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Pill, Swatch } from '../../components/Pill';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, money, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { useCollections, useProducts } from '../../lib/queries';
import { MarginBar, Piece3d } from './Piece3d';

const L = es.screens.products;
type Filter = 'todo' | 'tecnico' | 'variante';

export function ProductsPage() {
  const search = useSearch({ strict: false }) as { tab?: string; vista?: string; filtro?: string };
  const tab = search.tab === 'colecciones' ? 'colecciones' : 'piezas';
  const view = search.vista === 'lista' ? 'lista' : 'fichas';
  const filter = (search.filtro ?? 'todo') as Filter;
  const [q, setQ] = useState('');
  const products = useProducts().data?.items ?? [];
  const collections = useCollections().data?.items ?? [];
  const nav = (next: { tab?: string; vista?: string; filtro?: string }) => {
    const p = new URLSearchParams();
    const merged = { tab, vista: view, filtro: filter, ...next };
    if (merged.tab === 'colecciones') p.set('tab', 'colecciones');
    if (merged.vista === 'lista') p.set('vista', 'lista');
    if (merged.filtro !== 'todo') p.set('filtro', merged.filtro);
    go(`/productos${p.size ? `?${p}` : ''}`, true);
  };
  const isCol = tab === 'colecciones';
  const count = (f: Filter) => products.filter((p) => f === 'todo' || (f === 'tecnico' && p.technical) || (f === 'variante' && p.parentId)).length;
  const needle = q.trim().toLocaleLowerCase('es');
  const shownP = products.filter((p) => (filter === 'tecnico' ? p.technical : filter === 'variante' ? Boolean(p.parentId) : true) && (!needle || p.name.toLocaleLowerCase('es').includes(needle)));
  const shownC = collections.filter((c) => !needle || c.name.toLocaleLowerCase('es').includes(needle));
  const newCollection = () => { if (!products.length) { toast(es.errors.NO_PRODUCTS); return; } go('/productos/coleccion'); };
  return (
    <>
      <PageHead title={L.title} sub={isCol ? L.subCollections : L.subPieces} actions={<>
        <Button variant={isCol ? 'green' : 'default'} icon={isCol ? 'plus' : undefined} onClick={newCollection}>{L.newCollection}</Button>
        <Button variant={isCol ? 'default' : 'green'} icon={isCol ? undefined : 'plus'} onClick={() => go('/productos/pieza')}>{L.newPiece}</Button>
      </>} />
      <div className="toolbar">
        <div className="seg" role="group" aria-label={L.catalogView}>
          <button type="button" className={!isCol ? 'on' : ''} onClick={() => nav({ tab: 'piezas' })}>{L.pieces} <small>{products.length}</small></button>
          <button type="button" className={isCol ? 'on' : ''} onClick={() => nav({ tab: 'colecciones' })}>{L.collections} <small>{collections.length}</small></button>
        </div>
        <div className="tb-r">
          <label className="search"><span className="sr">{es.common.search}</span><input type="search" placeholder={isCol ? L.searchCollection : L.searchPiece} value={q} onChange={(e) => setQ(e.target.value)} /></label>
          <div className="seg2" role="group" aria-label={L.howToSee}>
            {(['fichas', 'lista'] as const).map((k) => <button key={k} type="button" className={view === k ? 'on' : ''} aria-pressed={view === k} onClick={() => nav({ vista: k })}>{k === 'fichas' ? L.tiles : L.list}</button>)}
          </div>
        </div>
      </div>
      {isCol ? (
        <>
          {view === 'lista' ? <CollectionTable items={shownC} total={collections.length} onNew={newCollection} /> : <div className="pt-grid">{shownC.map((c) => <CollectionTile key={c.id} c={c} />)}{!shownC.length ? <div className="empty-card"><Mascot size={64} /><p>{collections.length ? L.noCollectionMatch : L.emptyCollectionsTile}</p><Button variant="green" icon="plus" onClick={newCollection}>{L.createCollection}</Button></div> : null}</div>}
          <p className="foot-note">{L.collectionsFoot}</p>
        </>
      ) : (
        <>
          <div className="tags" role="group" aria-label={L.filter}>
            {([['todo', L.all], ['tecnico', L.technical], ['variante', L.variants]] as const).map(([k, l]) => <button key={k} type="button" className={`tag${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => nav({ filtro: k })}>{l} {count(k)}</button>)}
          </div>
          {view === 'lista' ? <ProductTable items={shownP} total={products.length} /> : <div className="pt-grid">{shownP.map((p) => <ProductTile key={p.id} p={p} />)}{!shownP.length ? <div className="empty-card"><Mascot size={64} /><p>{products.length ? L.noPieceMatchTile : L.emptyPiecesTile}</p><Button variant="green" icon="plus" onClick={() => go('/productos/pieza')}>{L.createPiece}</Button></div> : null}</div>}
          <p className="foot-note">{L.piecesFoot}</p>
        </>
      )}
    </>
  );
}

const subOf = (p: ProductListItem) => (p.parentName ? t('screens.products.variantOf', { name: p.parentName }) : p.printerName ?? (p.printerId ? '' : L.anyPrinter));
const openPiece = (id: string) => go(`/productos/pieza?id=${id}`);
const ratio = (price: number, cost: number) => `×${number1(cost ? price / cost : 0)}`;
function stockPill(p: ProductListItem) {
  if (!p.tracksStock) return <span className="pill">{L.onlyToOrder}</span>;
  const apt = Math.min(p.physical, p.reserved);
  if (p.free > 0) return <span className="pill good">{t('screens.products.free', { count: p.free })}{apt ? ` · ${t('screens.products.reserved', { count: apt })}` : ''}</span>;
  return <span className="pill warn">{apt ? es.status.stock.all_reserved : L.noStock}</span>;
}

function ProductTile({ p }: { p: ProductListItem }) {
  const gain = p.listCents - p.costCents;
  return (
    <article className="pt" tabIndex={0} onClick={() => openPiece(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') openPiece(p.id); }} data-testid="product-tile">
      <div className={`pt-top${p.photoUrl ? ' has-img' : ''}`}>{p.photoUrl ? <img className="pt-img" src={p.photoUrl} alt="" /> : <Piece3d hexes={p.hexes} id={p.id} />}<span className="pt-tags">{p.technical ? <span className="pill">{L.technicalTag}</span> : null}{p.parentId ? <span className="pill">{L.variantTag}</span> : null}</span></div>
      <div className="pt-b">
        <div className="pt-n">{p.name}</div><small className="pt-s">{subOf(p)}</small>
        <div className="pt-pr"><b className="pt-p num">{centsTotal(p.listCents)}</b><span className={`pt-g num ${gain >= 0 ? 'pos' : 'neg'}`}>{t(gain >= 0 ? 'screens.products.youGain' : 'screens.products.youLose', { amount: centsTotal(Math.abs(gain)) })} · {ratio(p.listCents, p.costCents)}</span></div>
        <MarginBar cost={p.costCents} price={p.listCents} />
        <div className="pt-f"><span>{t('screens.products.cost', { cost: money(p.costCents / 100) })}</span><span>{t('screens.products.sold', { count: number1(p.sold) })}</span></div>
        <div className="pt-st">{stockPill(p)}</div>
      </div>
      <div className="pt-a" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" disabled>{p.free > 0 ? L.sell : L.order}</Button>
        <Button size="sm" variant="ghost" onClick={() => go(`/productos/pieza?de=${p.id}`)}>{L.variant}</Button>
      </div>
    </article>
  );
}

function ProductTable({ items, total }: { items: ProductListItem[]; total: number }) {
  return (
    <div className="tw"><table className="tbl prods"><thead><tr><th>{L.colPiece}</th><th className="r">{L.colInStock}</th><th className="r">{L.colCost}</th><th className="r">{L.colList}</th><th className="bar-th"><span className="sr">{L.costVsPrice}</span></th><th className="r">{L.colProfit}</th><th className="r nw">{L.colTimes}</th><th className="r">{L.colSold}</th><th /></tr></thead>
      <tbody>
        {items.map((p) => {
          const gain = p.listCents - p.costCents;
          const apt = Math.min(p.physical, p.reserved);
          return (
            <tr key={p.id} className="click" tabIndex={0} onClick={() => openPiece(p.id)}>
              <td><div className="pn"><span className="swstack">{p.hexes.map((h, i) => <Swatch key={i} hex={h} />)}</span><div><b>{p.name}</b><small>{subOf(p)}</small>{p.collections.length ? <span className="pcols">{p.collections.slice(0, 2).map((c) => <Pill key={c.id} tone="info">{c.name}</Pill>)}{p.collections.length > 2 ? <Pill>+{p.collections.length - 2}</Pill> : null}</span> : null}</div></div></td>
              <td className={`r num ex-td${p.tracksStock && !p.free ? ' neg' : ''}`}>{p.tracksStock ? <><b>{p.free}</b>{apt ? <small className="blk">{t('screens.products.reserved', { count: apt })}</small> : null}</> : <><span className="mut">—</span><small className="blk">{L.onlyToOrderLower}</small></>}</td>
              <td className="r num">{money(p.costCents / 100)}</td>
              <td className="r num"><b>{centsTotal(p.listCents)}</b>{p.mode === 'formula' ? <small className="blk">{L.costPlusMargin}</small> : null}</td>
              <td className="bar-td"><MarginBar cost={p.costCents} price={p.listCents} /></td>
              <td className={`r num ${gain >= 0 ? 'pos' : 'neg'}`}>{centsTotal(gain)}</td>
              <td className="r num">{ratio(p.listCents, p.costCents)}</td>
              <td className="r num">{number1(p.sold)}</td>
              <td className="r" onClick={(e) => e.stopPropagation()}><span className="rowa"><Button size="sm" disabled>{p.free > 0 ? L.sell : L.order}</Button><Button size="sm" variant="ghost" onClick={() => go(`/productos/pieza?de=${p.id}`)}>{L.variant}</Button></span></td>
            </tr>
          );
        })}
        {!items.length ? <tr><td colSpan={9} className="empty-td"><Mascot size={48} /><p>{total ? L.noPieceMatch : L.emptyPieces}</p><Button variant="green" onClick={() => go('/productos/pieza')}>{L.createPiece}</Button></td></tr> : null}
      </tbody></table></div>
  );
}

const openCol = (id: string) => go(`/productos/coleccion?id=${id}`);
const diffText = (c: CollectionListItem, long: boolean) => {
  if (c.listCents < c.looseCents - 50) return t(long ? 'screens.products.setCheaperLong' : 'screens.products.setCheaper', { amount: centsTotal(c.looseCents - c.listCents) });
  if (c.listCents > c.looseCents + 50) return t(long ? 'screens.products.setPricierLong' : 'screens.products.setPricier', { amount: centsTotal(c.listCents - c.looseCents) });
  return long ? L.sameAsLoose : '';
};

function CollectionTile({ c }: { c: CollectionListItem }) {
  const gain = c.listCents - c.costCents;
  return (
    <article className="pt pt-col" tabIndex={0} onClick={() => openCol(c.id)} onKeyDown={(e) => { if (e.key === 'Enter') openCol(c.id); }}>
      <div className="pt-top"><span className="lay-row">{c.partHexes.slice(0, 4).map((h, i) => <Piece3d key={i} hexes={h} id={`${c.id}${i}`} cls={`z${i}`} />)}</span></div>
      <div className="pt-b">
        <div className="pt-n">{c.name}</div><small className="pt-s">{t('screens.products.setPieces', { count: c.pieces, names: c.partNames.join(', ') })}</small>
        <div className="pt-pr"><b className="pt-p num">{centsTotal(c.listCents)}</b><span className={`pt-g num ${gain >= 0 ? 'pos' : 'neg'}`}>{t(gain >= 0 ? 'screens.products.youGain' : 'screens.products.youLose', { amount: centsTotal(Math.abs(gain)) })}</span></div>
        <MarginBar cost={c.costCents} price={c.listCents} />
        <div className="pt-f"><span>{t('screens.products.cost', { cost: money(c.costCents / 100) })}</span><span>{t('screens.products.soldSets', { count: c.sold })}</span></div>
        <small className="pt-s">{diffText(c, true)}</small>
        <div className="pt-st">{c.buildableSets > 0 ? <span className="pill good">{t('screens.products.setsReady', { count: c.buildableSets })}</span> : <span className="pill">{L.noFullSet}</span>}</div>
      </div>
      <div className="pt-a" onClick={(e) => e.stopPropagation()}><Button size="sm" disabled>{c.buildableSets > 0 ? L.sell : L.order}</Button></div>
    </article>
  );
}

function CollectionTable({ items, total, onNew }: { items: CollectionListItem[]; total: number; onNew: () => void }) {
  return (
    <div className="tw"><table className="tbl prods"><thead><tr><th>{L.colCollection}</th><th className="r">{L.colCost}</th><th className="r">{L.colSetPrice}</th><th className="r">{L.colLoose}</th><th className="bar-th"><span className="sr">{L.costVsPrice}</span></th><th className="r">{L.colProfit}</th><th className="r">{L.colSoldSets}</th><th /></tr></thead>
      <tbody>
        {items.map((c) => {
          const gain = c.listCents - c.costCents;
          return (
            <tr key={c.id} className="click" tabIndex={0} onClick={() => openCol(c.id)}>
              <td><div className="pn"><span className="swstack">{c.hexes.map((h, i) => <Swatch key={i} hex={h} />)}</span><div><b>{c.name}</b><small>{t('screens.products.setPieces', { count: c.pieces, names: c.partNames.join(', ') })}</small><span className="pcols">{c.buildableSets > 0 ? <Pill tone="good">{t('screens.products.setsReadyInStock', { count: c.buildableSets })}</Pill> : <Pill tone="plain">{L.noFullSetInStock}</Pill>}</span></div></div></td>
              <td className="r num">{money(c.costCents / 100)}</td>
              <td className="r num"><b>{centsTotal(c.listCents)}</b>{c.typedPrice ? null : <small className="blk">{L.sameAsLooseShort}</small>}</td>
              <td className="r num">{centsTotal(c.looseCents)}{diffText(c, false) ? <small className="blk">{diffText(c, false)}</small> : null}</td>
              <td className="bar-td"><MarginBar cost={c.costCents} price={c.listCents} /></td>
              <td className={`r num ${gain >= 0 ? 'pos' : 'neg'}`}>{centsTotal(gain)}</td>
              <td className="r num">{c.sold}</td>
              <td className="r" onClick={(e) => e.stopPropagation()}><span className="rowa"><Button size="sm" disabled>{c.buildableSets > 0 ? L.sell : L.order}</Button></span></td>
            </tr>
          );
        })}
        {!items.length ? <tr><td colSpan={8} className="empty-td"><Mascot size={48} /><p>{total ? L.noCollectionMatch : L.emptyCollections}</p><Button variant="green" onClick={onNew}>{L.createCollection}</Button></td></tr> : null}
      </tbody></table></div>
  );
}
