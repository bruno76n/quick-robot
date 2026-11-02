import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type { Collection, CostingContextDto, Product } from '@app/contract';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { MiniBar, Piece3D } from '../../components/Piece3D';
import { Pill } from '../../components/Pill';
import { Segmented } from '../../components/Segmented';
import { Table, Td, Th, Tr } from '../../components/Table';
import { Tag, TagRow } from '../../components/Tag';
import { useToast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/error-text';
import { formatMoney, formatMoney0, formatNumber1 } from '../../lib/format';
import { useCatalogue, useCostingContext } from '../../lib/queries';
import { hexesOf, timesCost, useCatalogView } from './shared';

const t = es.products;
type Filter = 'all' | 'technical' | 'variants';

function subOf(p: Product) {
  return p.parentName ? t.variantOf(p.parentName) : p.printerId ? (p.printerName ?? t.anyPrinter) : t.anyPrinter;
}

function StockPill({ p }: { p: Product }) {
  // Free / set-aside pieces come with Existencias (phase 3).
  return p.tracksStock ? (
    <Pill tone="warn" dot={false}>
      {t.noStock}
    </Pill>
  ) : (
    <Pill tone="plain" dot={false}>
      {t.onlyToOrder}
    </Pill>
  );
}

function Gain({ price, cost, withTimes = true }: { price: number; cost: number; withTimes?: boolean }) {
  const gain = price - cost;
  const x = formatNumber1(timesCost(price, cost));
  return (
    <span className={cn('num text-[13px] font-semibold', gain >= 0 ? 'text-green-ink' : 'text-red-ink')}>
      {withTimes ? (gain >= 0 ? t.gain(formatMoney0(gain), x) : t.loss(formatMoney0(-gain), x)) : gain >= 0 ? t.gainShort(formatMoney0(gain)) : t.lossShort(formatMoney0(-gain))}
    </span>
  );
}

function Tile({ to, params, top, tags, actions, children }: { to: string; params: Record<string, string>; top: React.ReactNode; tags?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  const navigate = useNavigate();
  const open = () => void navigate({ to, params } as never);
  return (
    <article
      tabIndex={0}
      role="link"
      onClick={open}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget && (e.preventDefault(), open())}
      className="card card-hover group relative flex cursor-pointer flex-col"
      data-testid="product-tile"
    >
      {top}
      {tags && <span className="absolute left-3 top-3 z-[2] flex flex-wrap gap-1">{tags}</span>}
      {actions && (
        <div className="absolute right-3 top-3 z-[3] flex gap-[6px] opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
      <div className="grid gap-[6px] px-[18px] pb-[18px] pt-2">{children}</div>
    </article>
  );
}

const tileBtn = 'border-transparent bg-bg shadow-[0_1px_3px_rgba(18,18,20,.16)]';

function ProductTile({ p, ctx }: { p: Product; ctx: CostingContextDto | undefined }) {
  const navigate = useNavigate();
  const c = p.costing;
  return (
    <Tile
      to="/productos/pieza/$id"
      params={{ id: p.id }}
      top={<div className={cn('stage', p.photoUrl && 'has-img')}>{p.photoUrl ? <img src={p.photoUrl} alt="" className="h-full w-full object-cover" /> : <Piece3D hexes={hexesOf(p, ctx)} id={p.id} />}</div>}
      tags={
        (c.technical || p.parentId) && (
          <>
            {c.technical && <span className="rounded-pill bg-bg px-[11px] py-[3px] text-[12.5px] font-semibold text-ink-2">{t.technical}</span>}
            {p.parentId && <span className="rounded-pill bg-bg px-[11px] py-[3px] text-[12.5px] font-semibold text-ink-2">{t.variant}</span>}
          </>
        )
      }
      actions={
        <>
          <Button size="sm" className={tileBtn} disabled title={es.app.nextPhase}>
            {t.order}
          </Button>
          <Button size="sm" className={tileBtn} onClick={() => void navigate({ to: '/productos/pieza/nueva', search: { from: p.id } })}>
            {t.makeVariant}
          </Button>
        </>
      }
    >
      <div className="truncate text-[16.5px] font-semibold leading-[1.2] tracking-[-0.02em]">{p.name}</div>
      <small className="truncate">{subOf(p)}</small>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
        <b className="num text-[28px] font-semibold leading-none tracking-[-0.04em]">{formatMoney0(c.listPrice)}</b>
        <Gain price={c.listPrice} cost={c.total} />
      </div>
      <MiniBar cost={c.total} price={c.listPrice} className="w-full" title={t.barTitle(formatMoney(c.total), formatMoney0(c.listPrice))} />
      <div className="flex justify-between gap-2 text-[13px] text-ink-2">
        <span>{t.cost(formatMoney(c.total))}</span>
        <span>{t.sold(0)}</span>
      </div>
      <div className="mt-[2px]">
        <StockPill p={p} />
      </div>
    </Tile>
  );
}

function CollectionTile({ c, products, ctx }: { c: Collection; products: Product[]; ctx: CostingContextDto | undefined }) {
  const k = c.costing;
  const parts = c.parts.map((x) => products.find((p) => p.id === x.productId)).filter((p): p is Product => !!p);
  const dif = k.price < k.loose - 0.5 ? t.cheaper(formatMoney0(k.loose - k.price)) : k.price > k.loose + 0.5 ? t.pricier(formatMoney0(k.price - k.loose)) : t.sameAsLoose;
  return (
    <Tile
      to="/productos/coleccion/$id"
      params={{ id: c.id }}
      top={
        <div className="stage">
          <span className="lay-row">{parts.length ? parts.slice(0, 4).map((p) => <Piece3D key={p.id} hexes={hexesOf(p, ctx)} id={p.id} />) : <Piece3D hexes={[]} id={c.id} />}</span>
        </div>
      }
      actions={
        <Button size="sm" className={tileBtn} disabled title={es.app.nextPhase}>
          {t.order}
        </Button>
      }
    >
      <div className="truncate text-[16.5px] font-semibold leading-[1.2] tracking-[-0.02em]">{c.name}</div>
      <small>{t.piecesCount(k.pieceCount, parts.map((p) => p.name).join(', '))}</small>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-[10px] gap-y-1">
        <b className="num text-[28px] font-semibold leading-none tracking-[-0.04em]">{formatMoney0(k.price)}</b>
        <Gain price={k.price} cost={k.cost} withTimes={false} />
      </div>
      <MiniBar cost={k.cost} price={k.price} className="w-full" title={t.barTitle(formatMoney(k.cost), formatMoney0(k.price))} />
      <div className="flex justify-between gap-2 text-[13px] text-ink-2">
        <span>{t.cost(formatMoney(k.cost))}</span>
        <span>{t.soldSets(0)}</span>
      </div>
      <small>{dif}</small>
      <div className="mt-[2px]">
        <Pill tone="plain" dot={false}>
          {t.noSetReady}
        </Pill>
      </div>
    </Tile>
  );
}

function Empty({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return (
    <div className="card col-span-full grid justify-items-center gap-3 px-6 py-9 text-center text-ink-2">
      <p className="max-w-[60ch]">{text}</p>
      <Button variant="primary" onClick={onAction}>
        <Icon name="plus" size={16} />
        {action}
      </Button>
    </div>
  );
}

export function ProductsPage() {
  const { data, error } = useCatalogue();
  const ctx = useCostingContext().data;
  const search = useSearch({ from: '/productos' });
  const navigate = useNavigate();
  const toast = useToast((s) => s.show);
  const { view, setView } = useCatalogView();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const tab = search.tab === 'colecciones' ? 'collections' : 'pieces';
  const products = useMemo(() => data?.products ?? [], [data]);
  const collections = data?.collections ?? [];
  const query = q.trim().toLowerCase();
  const shown = useMemo(
    () => products.filter((p) => (filter === 'technical' ? p.costing.technical : filter === 'variants' ? !!p.parentId : true) && (!query || p.name.toLowerCase().includes(query))),
    [products, filter, query],
  );
  const shownCols = collections.filter((c) => !query || c.name.toLowerCase().includes(query));
  const count = (f: Filter) => products.filter((p) => (f === 'technical' ? p.costing.technical : f === 'variants' ? !!p.parentId : true)).length;
  const newPiece = () => void navigate({ to: '/productos/pieza/nueva' });
  const newCollection = () => (products.length ? void navigate({ to: '/productos/coleccion/nueva' }) : toast(t.needPieces));
  const isCol = tab === 'collections';

  return (
    <>
      <PageHeader
        title={t.title}
        sub={isCol ? t.subCollections : t.subPieces}
        actions={
          <>
            <Button variant={isCol ? 'primary' : 'default'} onClick={newCollection}>
              {isCol && <Icon name="plus" size={16} />}
              {t.newCollection}
            </Button>
            <Button variant={isCol ? 'default' : 'primary'} onClick={newPiece}>
              {!isCol && <Icon name="plus" size={16} />}
              {t.newPiece}
            </Button>
          </>
        }
      />
      <div className="mb-[14px] flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label={t.tabsLabel}
          value={tab}
          onChange={(v) => void navigate({ to: '/productos', search: v === 'collections' ? { tab: 'colecciones' } : {} })}
          options={[
            { value: 'pieces', label: (<>{t.tabs.pieces} <small className="ml-1 font-semibold">{products.length}</small></>) },
            { value: 'collections', label: (<>{t.tabs.collections} <small className="ml-1 font-semibold">{collections.length}</small></>) },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <input type="search" aria-label={isCol ? t.searchCollection : t.searchPiece} placeholder={isCol ? t.searchCollection : t.searchPiece} value={q} onChange={(e) => setQ(e.target.value)} className="w-[min(260px,100%)]" />
          <Segmented size="sm" label={t.view.label} value={view} onChange={setView} options={[{ value: 'tiles', label: t.view.tiles }, { value: 'list', label: t.view.list }]} />
        </div>
      </div>
      {error && <p className="text-red-ink">{errorText(error)}</p>}
      {!isCol && (
        <TagRow label={t.filters.label} className="mb-[14px] mt-[10px]">
          {(['all', 'technical', 'variants'] as const).map((f) => (
            <Tag key={f} on={filter === f} onClick={() => setFilter(f)}>
              {t.filters[f]} {count(f)}
            </Tag>
          ))}
        </TagRow>
      )}
      {data &&
        (isCol ? (
          view === 'tiles' ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[18px]">
              {shownCols.length ? shownCols.map((c) => <CollectionTile key={c.id} c={c} products={products} ctx={ctx} />) : <Empty text={collections.length ? t.emptyCollectionsFiltered : t.emptyCollections} action={t.createCollection} onAction={newCollection} />}
            </div>
          ) : (
            <CollectionTable cols={shownCols} />
          )
        ) : view === 'tiles' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[18px]">
            {shown.length ? shown.map((p) => <ProductTile key={p.id} p={p} ctx={ctx} />) : <Empty text={products.length ? t.emptyFiltered : t.emptyPieces} action={t.createPiece} onAction={newPiece} />}
          </div>
        ) : (
          <ProductTable products={shown} ctx={ctx} />
        ))}
      <p className="mt-3 max-w-[70ch] text-[13px] text-ink-3">{isCol ? t.footCollections : t.footPieces}</p>
    </>
  );
}

function ProductTable({ products, ctx }: { products: Product[]; ctx: CostingContextDto | undefined }) {
  const navigate = useNavigate();
  const c = t.col;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{c.piece}</Th>
          <Th align="right">{c.stock}</Th>
          <Th align="right">{c.cost}</Th>
          <Th align="right">{c.listPrice}</Th>
          <Th className="w-[112px]">
            <span className="sr-only">{c.bar}</span>
          </Th>
          <Th align="right">{c.profit}</Th>
          <Th align="right">{c.times}</Th>
          <Th align="right">{c.sold}</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        {products.map((p) => {
          const k = p.costing;
          const gain = k.listPrice - k.total;
          return (
            <Tr key={p.id} onActivate={() => void navigate({ to: '/productos/pieza/$id', params: { id: p.id } })} data-testid="product-row">
              <Td>
                <div className="flex items-center gap-[10px]">
                  <span className="inline-flex flex-none pl-[6px]">
                    {hexesOf(p, ctx).map((h, i) => (
                      <span key={i} className="sw -ml-[6px] border-2 border-bg" style={{ background: h, width: 18, height: 18 }} />
                    ))}
                  </span>
                  <div>
                    <b>{p.name}</b>
                    <small className="block">{subOf(p)}</small>
                    {p.collections.length > 0 && (
                      <span className="mt-[5px] flex flex-wrap gap-1">
                        {p.collections.map((x) => (
                          <Pill key={x.id} tone="plain">
                            {x.name}
                          </Pill>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
              </Td>
              <Td align="right">
                {p.tracksStock ? (
                  <b className="text-red-ink">{0}</b>
                ) : (
                  <>
                    <span className="text-ink-3">{es.app.dash}</span>
                    <small className="block">{t.onlyOrderLower}</small>
                  </>
                )}
              </Td>
              <Td align="right" className="num">
                {formatMoney(k.total)}
              </Td>
              <Td align="right" className="num font-semibold">
                {formatMoney0(k.listPrice)}
              </Td>
              <Td>
                <MiniBar cost={k.total} price={k.listPrice} className="w-full min-w-[80px]" />
              </Td>
              <Td align="right" className={cn('num', gain >= 0 ? 'text-green-ink' : 'text-red-ink')}>
                {formatMoney0(gain)}
              </Td>
              <Td align="right" className="num">
                {es.units.times}
                {formatNumber1(timesCost(k.listPrice, k.total))}
              </Td>
              <Td align="right" className="num">
                {0}
              </Td>
              <Td onClick={(e) => e.stopPropagation()}>
                <Link to="/productos/pieza/nueva" search={{ from: p.id }} className="text-[13.5px] text-ink-2 no-underline hover:text-ink">
                  {t.makeVariant}
                </Link>
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function CollectionTable({ cols }: { cols: Collection[] }) {
  const navigate = useNavigate();
  const c = t.col;
  return (
    <Table>
      <thead>
        <tr>
          <Th>{c.collection}</Th>
          <Th align="right">{c.cost}</Th>
          <Th align="right">{c.setPrice}</Th>
          <Th align="right">{c.loose}</Th>
          <Th className="w-[112px]">
            <span className="sr-only">{c.bar}</span>
          </Th>
          <Th align="right">{c.profit}</Th>
          <Th align="right">{c.soldSets}</Th>
        </tr>
      </thead>
      <tbody>
        {cols.map((col) => {
          const k = col.costing;
          return (
            <Tr key={col.id} onActivate={() => void navigate({ to: '/productos/coleccion/$id', params: { id: col.id } })}>
              <Td>
                <b>{col.name}</b>
                <small className="block">{t.piecesCount(k.pieceCount, col.parts.map((x) => x.productName).join(', '))}</small>
              </Td>
              <Td align="right" className="num">
                {formatMoney(k.cost)}
              </Td>
              <Td align="right" className="num font-semibold">
                {formatMoney0(k.price)}
              </Td>
              <Td align="right" className="num">
                {formatMoney0(k.loose)}
              </Td>
              <Td>
                <MiniBar cost={k.cost} price={k.price} className="w-full min-w-[80px]" />
              </Td>
              <Td align="right" className={cn('num', k.profit >= 0 ? 'text-green-ink' : 'text-red-ink')}>
                {formatMoney0(k.profit)}
              </Td>
              <Td align="right" className="num">
                {0}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </Table>
  );
}
