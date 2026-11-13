// Productos (docs/06 §3): Piezas (families, mejoras/ronda-2.md §3) and Colecciones, as tiles or list, with filters and search.
import type { CollectionListItem, ProductFamilyFilter } from '@app/contract';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Pill, Swatch } from '../../components/Pill';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, money } from '../../lib/format';
import { go } from '../../lib/nav';
import { useCollections } from '../../lib/queries';
import { useProductFamilies } from './api';
import { FamilyTiles } from './FamilyTiles';
import { FamilyTable } from './FamilyTable';
import { MarginBar, Piece3d } from './Piece3d';
import './products.css';

const L = es.screens.products;
type Filter = 'todo' | 'tecnico' | 'con-variantes';
const API_FILTER: Record<Filter, ProductFamilyFilter> = { todo: 'all', tecnico: 'technical', 'con-variantes': 'with_variants' };
const FILTERS: [Filter, string, 'families' | 'technical' | 'withVariants'][] = [['todo', L.all, 'families'], ['tecnico', L.technical, 'technical'], ['con-variantes', L.filter.withVariants, 'withVariants']];

/** Search text after a short pause (the server searches names and variant labels). */
function useDebounced(value: string, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), ms); return () => clearTimeout(id); }, [value, ms]);
  return v;
}

export function ProductsPage() {
  const search = useSearch({ strict: false }) as { tab?: string; vista?: string; filtro?: string; abierta?: string };
  const tab = search.tab === 'colecciones' ? 'colecciones' : 'piezas';
  const view = search.vista === 'lista' ? 'lista' : 'fichas';
  const filter: Filter = search.filtro === 'tecnico' || search.filtro === 'con-variantes' ? search.filtro : 'todo';
  const [q, setQ] = useState('');
  const needle = useDebounced(q.trim());
  // One family open at a time; it comes back open after creating a variant (?abierta=) and opens when the search matched only a variant.
  const [open, setOpen] = useState<string | null>(search.abierta ?? null);
  const families = useProductFamilies(needle, API_FILTER[filter]);
  const pages = families.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const counts = pages[0]?.counts ?? { families: 0, technical: 0, withVariants: 0 };
  const matched = needle ? items.find((f) => f.matchedByVariant)?.id ?? null : null;
  const [seenMatch, setSeenMatch] = useState<string | null>(null);
  if (matched !== seenMatch) { setSeenMatch(matched); if (matched) setOpen(matched); }
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
  const shownC = collections.filter((c) => !needle || c.name.toLocaleLowerCase('es').includes(needle.toLocaleLowerCase('es')));
  const newCollection = () => { if (!counts.families && !needle) { toast(es.errors.NO_PRODUCTS); return; } go('/productos/coleccion'); };
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const anyPieces = counts.families > 0 || Boolean(needle) || filter !== 'todo';
  return (
    <>
      <PageHead title={L.title} sub={isCol ? L.subCollections : L.subPieces} actions={<>
        <Button variant={isCol ? 'green' : 'default'} icon={isCol ? 'plus' : undefined} onClick={newCollection}>{L.newCollection}</Button>
        <Button variant={isCol ? 'default' : 'green'} icon={isCol ? undefined : 'plus'} onClick={() => go('/productos/pieza')}>{L.newPiece}</Button>
      </>} />
      <div className="toolbar prod-tb">
        <div className="seg" role="group" aria-label={L.catalogView}>
          <button type="button" className={!isCol ? 'on' : ''} onClick={() => nav({ tab: 'piezas' })}>{L.pieces} <small data-testid="pieces-count">{counts.families}</small></button>
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
          <div className="tags" role="group" aria-label={L.filter.aria}>
            {FILTERS.map(([k, l, c]) => <button key={k} type="button" className={`tag${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => nav({ filtro: k })}>{l} {counts[c]}</button>)}
          </div>
          {!families.data ? <div className="skel" /> : view === 'lista'
            ? <FamilyTable items={items} anyPieces={anyPieces} open={open} onToggle={toggle} />
            : <FamilyTiles items={items} open={open} onToggle={toggle} empty={<div className="empty-card"><Mascot size={64} /><p>{anyPieces ? L.noPieceMatchTile : L.emptyPiecesTile}</p><Button variant="green" icon="plus" onClick={() => go('/productos/pieza')}>{L.createPiece}</Button></div>} />}
          {families.hasNextPage ? <div className="more-row"><Button busy={families.isFetchingNextPage} onClick={() => void families.fetchNextPage()}>{L.showMore}</Button></div> : null}
          <p className="foot-note">{L.piecesFoot}</p>
        </>
      )}
    </>
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
      <div className="pt-a" onClick={(e) => e.stopPropagation()}><Button size="sm" onClick={() => go(`/armar?modo=${c.buildableSets > 0 ? 'venta' : 'pedido'}&coleccion=${c.id}`)}>{c.buildableSets > 0 ? L.sell : L.order}</Button></div>
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
              <td className="r" onClick={(e) => e.stopPropagation()}><span className="rowa"><Button size="sm" onClick={() => go(`/armar?modo=${c.buildableSets > 0 ? 'venta' : 'pedido'}&coleccion=${c.id}`)}>{c.buildableSets > 0 ? L.sell : L.order}</Button></span></td>
            </tr>
          );
        })}
        {!items.length ? <tr><td colSpan={8} className="empty-td"><Mascot size={48} /><p>{total ? L.noCollectionMatch : L.emptyCollections}</p><Button variant="green" onClick={onNew}>{L.createCollection}</Button></td></tr> : null}
      </tbody></table></div>
  );
}
