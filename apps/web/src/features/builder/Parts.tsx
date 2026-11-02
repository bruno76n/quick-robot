// Pieces of the builder screen: the pick list, a line with where each piece comes from, and the live summary.
import type { CollectionListItem, FilamentListItem, ProductListItem } from '@app/contract';
import { Fragment, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Pill, Swatch } from '../../components/Pill';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { grams, hours, money, money2d, moneyTotal, number1 } from '../../lib/format';
import { parseNumber } from '../../lib/input';
import { rich } from '../sales/rich';
import { share, type Calc, type Defs, type Line, type Row } from './calc';

const L = es.screens.builder;
const fmtNum = (x: number) => String(Math.round((x || 0) * 100) / 100);
const filamentName = (f: FilamentListItem) => `${f.material} ${f.color}`.trim();

export function Pick({ q, order, products, collections, free, onAdd }: { q: string; order: boolean; products: ProductListItem[]; collections: CollectionListItem[]; free: (id: string) => number; onAdd: (k: 'piece' | 'set', id: string, list: number) => void }) {
  const needle = q.trim().toLocaleLowerCase('es');
  const cols = collections.filter((c) => c.pieces > 0 && (!needle || c.name.toLocaleLowerCase('es').includes(needle)));
  const pcs = products.filter((p) => !needle || p.name.toLocaleLowerCase('es').includes(needle));
  if (!cols.length && !pcs.length) return <p className="kempty">{L.noResults}</p>;
  const stP = (p: ProductListItem) => {
    if (!p.tracksStock) return order ? null : <Pill tone="plain">{L.onlyOrder}</Pill>;
    const n = free(p.id);
    return n > 0 ? <Pill tone="good">{t('screens.builder.free', { count: n })}</Pill> : <Pill tone={order ? 'plain' : 'bad'}>{order ? L.noFree : L.soldOut}</Pill>;
  };
  return (
    <>
      {cols.length ? <span className="pk-g">{L.groupSets}</span> : null}
      {cols.map((c) => (
        <button key={c.id} type="button" className="pk" data-testid="pick-set" onClick={() => onAdd('set', c.id, c.listCents / 100)}>
          <span className="pk-n"><b>{c.name}</b><small className="blk"><Pill tone="info">{L.collection}</Pill> {t('screens.builder.setPieces', { count: c.pieces })}{c.looseCents - c.listCents > 50 ? t('screens.builder.saves', { amount: moneyTotal((c.looseCents - c.listCents) / 100) }) : ''} {c.buildableSets > 0 ? <Pill tone="good">{t('screens.builder.setsReady', { count: c.buildableSets })}</Pill> : order ? null : <Pill tone="bad">{L.notEnough}</Pill>}</small></span>
          <span className="pk-p num">{moneyTotal(c.listCents / 100)}</span><span className="pk-add"><Icon name="plus" size={14} /></span>
        </button>
      ))}
      {pcs.length ? <span className="pk-g">{L.groupPieces}</span> : null}
      {pcs.map((p) => (
        <button key={p.id} type="button" className="pk" data-testid="pick-piece" onClick={() => onAdd('piece', p.id, p.listCents / 100)}>
          <span className="pk-n"><b>{p.name}</b><small className="blk"><span className="swstack">{p.hexes.map((h, i) => <Swatch key={i} hex={h} />)}</span>{p.collections.length ? t('screens.builder.inSets', { names: p.collections.map((c) => c.name).join(', ') }) : L.loosePiece} {stP(p)}</small></span>
          <span className="pk-p num">{moneyTotal(p.listCents / 100)}</span><span className="pk-add"><Icon name="plus" size={14} /></span>
        </button>
      ))}
    </>
  );
}

const Tag = ({ k, n, text }: { k: string; n: number; text: string }) => <span className={`tg ${k}`}><b className="num">{n}</b>{text}</span>;

export function LineView({ r, defs, order, gPct, byProduct, onChange, onRemove, onSplit }: {
  r: Row; defs: Defs; order: boolean; gPct: number; byProduct: Map<string, ProductListItem>; onChange: (p: Partial<Line>) => void; onRemove: () => void; onSplit: () => void;
}) {
  const p = r.set ? null : byProduct.get(r.line.id);
  const nParts = Object.values(r.set ? Object.fromEntries((defs.sets.get(r.line.id)?.parts ?? []).map((x) => [x.productId, x.qty])) : {}).reduce((a, b) => a + Math.max(1, b), 0);
  const dsc = r.list > 0 ? (1 - r.unit / r.list) * 100 : 0;
  const g1 = r.unit * (1 - gPct / 100) - r.c1;
  const bad = g1 < 0 || (!order && r.printN > 0);
  const ids = Object.keys(r.need);
  const solo = !r.set && ids.length === 1;
  const sh = share(r, defs);
  return (
    <div className={`ln${bad ? ' bad' : ''}`} data-testid="builder-line">
      <div className="ln-n"><b>{r.name}</b><small className="blk ln-s">{r.set ? <><Pill tone="info">{L.collection}</Pill> {t('screens.builder.setSub', { count: nParts })}</> : <><span className="swstack">{(p?.hexes ?? []).map((h, i) => <Swatch key={i} hex={h} />)}</span>{t('screens.builder.eachHours', { hours: hours(p?.hours ?? 0) })}</>}</small></div>
      <label className="fld ln-q"><span>{L.qty}</span><input data-b="cant" inputMode="numeric" value={r.line.qty} aria-label={t('screens.builder.qtyAria', { name: r.name })} onChange={(e) => onChange({ qty: e.target.value })} /></label>
      <label className="fld ln-u"><span>{r.set ? L.priceSet : L.priceEach}</span><UnitInput unit="$" data-b="unit" inputMode="decimal" value={r.line.unit} aria-label={t('screens.builder.priceAria', { name: r.name })} onChange={(e) => onChange({ unit: e.target.value })} /></label>
      <div className="ln-tt"><span className="k">{L.total}</span><output className="ln-t num">{money2d(r.total)}</output></div>
      {ids.length ? (
        <div className="ln-sx">
          <div className="sx-hd" aria-hidden="true"><span>{L.sxPiece}</span><span>{L.sxQty}</span><span>{L.sxPrice}</span><span>{L.sxFree}</span><span>{order ? L.sxFromStock : ''}</span><span>{L.sxWhere}</span></div>
          {ids.map((pid) => {
            const pr = defs.pieces.get(pid)!;
            const nd = r.need[pid]!, u = r.use[pid] ?? 0, missing = nd - u, s = sh[pid] ?? { qty: nd, income: 0 };
            let where: ReactNode;
            if (order) where = <>{u > 0 ? <Tag k="stock" n={u} text={L.tStock} /> : null}{missing > 0 ? <Tag k="todo" n={missing} text={L.tPrint} /> : null}</>;
            else if (!pr.tracks) where = <span className="tg warn">{L.tOnlyOrder}</span>;
            else if (missing > 0) where = <Tag k="warn" n={missing} text={L.tMissing} />;
            else where = <Tag k="sale" n={nd} text={L.tStock} />;
            return (
              <div key={pid} className={`sx-r${solo ? ' solo' : ''}${!order && missing > 0 ? ' bad' : ''}`}>
                <span className="sx-n">{solo ? L.sxPiece : pr.name}</span><span className="sx-q num">{nd}</span><span className="sx-p num">{money(s.qty ? s.income / s.qty : 0)}</span>
                <span className="sx-l num">{pr.tracks ? defs.free(pid) : '—'}</span>
                <span className="sx-u">{order && pr.tracks ? (
                  <label className="sx-c"><span className="sr">{L.sxFromStock}</span><input data-b="uso" inputMode="numeric" value={String(u)} aria-label={t('screens.builder.sxFromStockAria', { name: pr.name })}
                    onChange={(e) => onChange({ man: { ...(r.line.man ?? {}), [pid]: Math.max(0, Math.round(parseNumber(e.target.value))) } })} /><span className="sx-de">{t('screens.builder.sxOf', { count: nd })}</span></label>
                ) : null}</span>
                <span className="sx-o">{where}</span>
              </div>
            );
          })}
        </div>
      ) : null}
      <div className="ln-foot">
        <small className="ln-h">
          {t('screens.builder.lineList', { list: money(r.list) })}{Math.abs(dsc) >= 1 ? t(dsc > 0 ? 'screens.builder.lineDiscount' : 'screens.builder.lineSurcharge', { pct: Math.round(Math.abs(dsc)) }) : ''}
          {rich(g1 >= 0 ? L.lineGain : L.lineLoss, { unit: r.set ? L.unitSet : L.unitPiece }, { amount: <b className={g1 >= 0 ? 'pos' : 'neg'}>{money(Math.abs(g1))}</b> })}
        </small>
        <div className="ln-a">
          {r.set ? <Button size="sm" variant="ghost" title={L.splitTitle} onClick={onSplit}>{L.split}</Button> : null}
          <Button size="sm" variant="ghost" title={L.useListTitle} onClick={() => onChange({ unit: fmtNum(r.list) })}>{L.useList}</Button>
          <button type="button" className="btn ghost icon" aria-label={t('screens.builder.removeAria', { name: r.name })} onClick={onRemove}><Icon name="x" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

export function Summary({ C, order, accepted, channelName, deposit, names, filaments, purgePct, onToOrder }: {
  C: Calc; order: boolean; accepted: boolean; channelName: string; deposit: number; names: (id: string) => string; filaments: FilamentListItem[]; purgePct: number; onToOrder: () => void;
}) {
  if (!C.rows.length) return <p className="note">{L.dynEmpty}</p>;
  const dl = C.list - C.total;
  const k = 1 + purgePct / 100;
  const fil = new Map(filaments.map((f) => [f.id, f]));
  const mats = Object.entries(C.material).flatMap(([id, g]) => { const f = fil.get(id); return f ? [{ f, need: g * k, rest: f.remainingGrams }] : []; });
  const short = mats.filter((m) => m.need > m.rest + 0.01);
  const status: [string, string] = C.total < C.cost - 0.005 ? ['bad', t('screens.builder.lossTotal', { amount: moneyTotal(C.cost - C.total) })]
    : C.profit < 0 ? ['bad', t('screens.builder.lossCommission', { amount: moneyTotal(-C.profit) })]
      : C.total < C.floor - 0.005 ? ['warn', t('screens.builder.belowFloor', { amount: moneyTotal(Math.ceil(C.floor)) })]
        : ['good', C.cost > 0 ? t('screens.builder.goodTimes', { amount: moneyTotal(C.profit), times: number1(C.total / C.cost) }) : t('screens.builder.good', { amount: moneyTotal(C.profit) })];
  return (
    <>
      <dl className="kv">
        {Math.abs(dl) > 0.5 ? <div><dt>{L.listPrice}</dt><dd>{money2d(C.list)}<small>{dl > 0 ? t('screens.builder.listDiscount', { amount: moneyTotal(dl), pct: (dl / C.list) * 100 }) : t('screens.builder.listSurcharge', { amount: moneyTotal(-dl) })}</small></dd></div> : null}
        <div><dt>{L.cost}</dt><dd>{money2d(C.cost)}<small>{t('screens.builder.costSub', { pieces: C.pieces, lines: C.rows.length })}</small></dd></div>
        {C.commission > 0 ? <div><dt>{t('screens.builder.commission', { channel: channelName })}</dt><dd>{money2d(C.commission)}</dd></div> : null}
        {deposit > 0 ? <div><dt>{L.toCollect}</dt><dd>{money2d(C.total - deposit)}</dd></div> : null}
        <div className={`gan${C.profit < 0 ? ' neg' : ''}`}><dt>{L.profit}</dt><dd>{money2d(C.profit)}<small>{C.total > 0 ? t('screens.builder.profitSub', { pct: (C.profit / C.total) * 100 }) : ''}</small></dd></div>
      </dl>
      {order ? (
        <>
          {C.pieces > 0 ? (
            <div className="surt"><span className="k">{L.whereTitle}</span>
              <span className="capas" role="img" aria-label={[C.useN ? t('screens.builder.whereStock', { count: C.useN }) : '', C.printN ? t('screens.builder.wherePrint', { count: C.printN }) : ''].filter(Boolean).join(' · ')}>
                {C.useN ? <i className="stock" style={{ flex: C.useN }} /> : null}{C.printN ? <i className="todo" style={{ flex: C.printN }} /> : null}
              </span>
              <ul className="lg">{C.useN ? <li><i className="stock" /><b className="num">{C.useN}</b> {L.tStock}</li> : null}{C.printN ? <li><i className="todo" /><b className="num">{C.printN}</b> {L.tPrint}</li> : null}</ul>
              {C.printN === 0 ? <p className="hint">{L.allFromStock} {accepted ? L.reserveNow : L.reserveLater}</p> : C.useN ? <p className="hint">{accepted ? L.partNow : L.partLater}</p> : null}
            </div>
          ) : null}
          <div className="calc">
            <div className="calc-h"><b>{L.calcTitle}</b><span>{C.printN ? t('screens.builder.printHours', { hours: hours(C.hours) }) : L.noPrint}</span></div>
            {mats.length ? (
              <div className="mats"><span className="k">{t('screens.builder.materialTitle', { pct: purgePct })}{C.useN ? L.materialOnlyPrinted : ''}</span>
                {mats.map(({ f, need, rest }) => {
                  const bad = need > rest + 0.01;
                  return <span key={f.id} className={`mrow${bad ? ' bad' : ''}`}><Swatch hex={f.hex} /><span>{filamentName(f)}{f.spools > 1 ? <>{' '}<small className="inl">{t('screens.builder.spools', { count: f.spools })}</small></> : null}</span><b className="num">{grams(need)}</b><small>{bad ? t('screens.builder.missing', { grams: grams(need - rest) }) : t('screens.builder.left', { grams: grams(rest - need) })}</small></span>;
                })}
              </div>
            ) : null}
            {short.length ? <p className="status warn"><Icon name="warn" size={16} /><span>{t('screens.builder.filamentShort', { list: short.map((m) => t('screens.builder.filamentShortItem', { missingGrams: m.need - m.rest, name: filamentName(m.f), availableGrams: m.rest })).join(L.and) })}</span></p> : null}
          </div>
        </>
      ) : (
        <>
          {C.printN > 0 ? (
            <p className="status bad"><Icon name="warn" size={16} /><span>
              {rich(L.noStock, {}, { list: <>{Object.entries(C.print).map(([id, n], i) => <Fragment key={id}>{i ? ', ' : ''}<b>{t('screens.builder.noStockItem', { count: n, name: names(id) })}</b></Fragment>)}</> })}
              <br /><button type="button" className="link" onClick={onToOrder}>{L.toOrder}</button>{L.noStockAfter}
            </span></p>
          ) : <p className="note">{rich(L.salesOut, {}, { pieces: <b>{t('screens.builder.setPieces', { count: C.useN })}</b> })}</p>}
        </>
      )}
      <p className={`status ${status[0]}`}><Icon name={status[0] === 'good' ? 'check' : 'warn'} size={16} /><span>{status[1]}</span></p>
    </>
  );
}

