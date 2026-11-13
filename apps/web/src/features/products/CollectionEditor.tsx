// Colección (docs/06 §3.2): pieces with quantity, extras, set price (empty = loose sum), tags and notes.
import type { CollectionDetail, ProductListItem } from '@app/contract';
import { floorPrice, partQty, PRICE_TAGS } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Picker } from '../../components/Picker';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { money, moneyTotal, number1, pct } from '../../lib/format';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { keys, useProducts, useSettings } from '../../lib/queries';
import { num } from './costing';

const L = es.screens.collection;
interface CDraft { name: string; parts: { productId: string; qty: string }[]; extras: string; price: string; tags: string[]; note: string }
const fromDetail = (c: CollectionDetail): CDraft => ({ name: c.name, parts: c.parts.map((p) => ({ productId: p.productId, qty: String(p.qty) })), extras: c.extrasCents ? String(c.extrasCents / 100) : '', price: c.priceCents ? String(c.priceCents / 100) : '', tags: c.tags, note: c.note });
const round5 = (v: number) => (v >= 200 ? Math.round(v / 10) * 10 : Math.round(v / 5) * 5);

export function CollectionEditor() {
  const search = useSearch({ strict: false }) as { id?: string };
  const products = useProducts().data?.items;
  const settings = useSettings().data?.settings;
  const detail = useQuery({ queryKey: [...keys.collections, 'detail', search.id], queryFn: async () => (await api.collections.get(search.id!)).data, enabled: Boolean(search.id) });
  if (!products || !settings || (search.id && !detail.data)) return <div className="skel" />;
  const initial = search.id ? fromDetail(detail.data!) : { name: '', parts: [{ productId: '', qty: '1' }], extras: '', price: '', tags: [], note: '' };
  return <CollectionForm key={search.id ?? 'new'} id={search.id} initial={initial} products={products} minMarginPct={settings.minMarginPct} />;
}

function CollectionForm({ id, initial, products, minMarginPct }: { id: string | undefined; initial: CDraft; products: ProductListItem[]; minMarginPct: number }) {
  const [d, setD] = useState<CDraft>(initial);
  // Row just created by "Agregar pieza": its picker is born open (ronda-2 §12, D1).
  const [fresh, setFresh] = useState<number | null>(null);
  // A new collection opens with its name focused (ronda-2 §12, D2).
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!id) nameRef.current?.focus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- on open only
  const search = { id };
  const touches = ['collections', 'products'] as const;
  const input = () => ({ name: d.name, tags: d.tags, parts: d.parts.filter((p) => p.productId).map((p) => ({ productId: p.productId, qty: partQty(num(p.qty, 1)) })), extrasCents: Math.round(num(d.extras) * 100), priceCents: num(d.price) > 0 ? Math.round(num(d.price) * 100) : null, note: d.note });
  const save = useWrite(() => (search.id ? api.collections.update(search.id, input()) : api.collections.create(input())), { touches: [...touches], ok: () => es.toast['collection.saved'], onDone: () => go('/productos?tab=colecciones') });
  const del = useWrite(() => api.collections.remove(search.id!), {
    touches: [...touches], ok: () => es.toast['collection.deleted'], onDone: () => go('/productos?tab=colecciones'),
    undo: () => () => api.collections.restore(search.id!),
  });
  const set = (patch: Partial<CDraft>) => setD({ ...d, ...patch });
  const part = (i: number, patch: Partial<CDraft['parts'][number]>) => set({ parts: d.parts.map((p, k) => (k === i ? { ...p, ...patch } : p)) });
  const byId = new Map<string, ProductListItem>(products.map((p) => [p.id, p]));
  const pieceOptions = products.map((y) => ({ value: y.id, label: y.displayName }));
  const rows = d.parts.flatMap((p) => { const x = byId.get(p.productId); return x ? [{ x, qty: partQty(num(p.qty, 1)) }] : []; });
  const pieces = rows.reduce((a, r) => a + (r.x.costCents / 100) * r.qty, 0);
  const extras = num(d.extras);
  const total = pieces + extras;
  const loose = rows.reduce((a, r) => a + (r.x.listCents / 100) * r.qty, 0);
  const price = num(d.price) > 0 ? num(d.price) : loose;
  const gain = price - total;
  const floor = floorPrice(total, minMarginPct);
  const scale = Math.max(price, total, 1);
  const loss = price < total && total > 0;
  const status: ['info' | 'bad' | 'warn' | 'good', string] = !rows.length ? ['info', L.needPieces] : price <= 0 ? ['info', L.needPrice]
    : loss ? ['bad', t('screens.collection.loss', { amount: money(total - price) })] : price < floor ? ['warn', t('screens.calculator.belowFloor', { floor: moneyTotal(floor) })]
    : ['good', t('screens.collection.profit', { amount: moneyTotal(gain), times: number1(price / total) })];
  const auto = !(num(d.price) > 0);
  const dif = loose - price;
  const refs: [string, number, string][] = [[L.sameAsLoose, 0, moneyTotal(loose)], ...[5, 10, 15].map((x): [string, number, string] => { const v = Math.max(1, round5(loose * (1 - x / 100))); return [`−${x}%`, v, moneyTotal(v)]; }), [es.screens.calculator.floor, Math.ceil(floor), t('screens.calculator.costPlus', { pct: minMarginPct })]];
  const valid = () => {
    if (!d.name.trim()) { toast(es.fields['collection.name.required']); return false; }
    if (!rows.length) { toast(es.errors.COLLECTION_EMPTY); return false; }
    return true;
  };
  return (
    <>
      <nav className="crumbs"><a href="/productos" onClick={(e) => { e.preventDefault(); go('/productos'); }}>{es.screens.products.title}</a><span>/</span><a href="/productos?tab=colecciones" onClick={(e) => { e.preventDefault(); go('/productos?tab=colecciones'); }}>{es.screens.products.collections}</a><span>/</span><span>{search.id ? L.edit : L.new}</span></nav>
      <div className="ed">
        <div className="ed-form">
          <label className="fld title-f"><span className="sr">{L.name}</span><input ref={nameRef} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={L.namePlaceholder} /></label>
          <fieldset className="blk"><legend>{L.pieces}</legend>
            <div>{d.parts.map((p, i) => {
              const x = byId.get(p.productId);
              const q = partQty(num(p.qty, 1));
              return (
                <div className="frow cparte" key={i}>
                  <div className="fld"><Picker label={L.piece} value={p.productId} options={pieceOptions} placeholder={L.choosePiece} onChange={(v) => part(i, { productId: v })} autoOpen={fresh === i} next={(el) => el.closest('.cparte')?.querySelector<HTMLInputElement>('.unit input')} /></div>
                  <label className="fld"><span className="sr">{L.qtyInSet}</span><UnitInput unit="×" inputMode="numeric" value={p.qty} onChange={(e) => part(i, { qty: e.target.value })} aria-label={L.qtyInSet} /></label>
                  <span className="fcost num">{x ? moneyTotal((x.listCents / 100) * q) : ''}</span>
                  <button type="button" className="btn ghost icon" onClick={() => set({ parts: d.parts.filter((_, k) => k !== i) })} aria-label={L.removePiece} disabled={d.parts.length < 2}><Icon name="x" size={16} /></button>
                </div>
              );
            })}</div>
            <Button size="sm" icon="plus" onClick={() => { setFresh(d.parts.length); set({ parts: [...d.parts, { productId: '', qty: '1' }] }); }}>{L.addPiece}</Button>
            <p className="hint">{L.piecesHint}</p>
          </fieldset>
          <fieldset className="blk"><legend>{L.box}</legend>
            <div className="grid4"><Field label={L.setExtras} hint={L.setExtrasHint}><UnitInput unit="$" inputMode="decimal" value={d.extras} onChange={(e) => set({ extras: e.target.value })} placeholder="0" /></Field></div>
          </fieldset>
          <fieldset className="blk"><legend>{L.tagsNotes}</legend>
            <div className="tags" role="group" aria-label={L.setTags}>{PRICE_TAGS.map((tag) => <button key={tag} type="button" className={`tag${d.tags.includes(tag) ? ' on' : ''}`} aria-pressed={d.tags.includes(tag)} onClick={() => set({ tags: d.tags.includes(tag) ? d.tags.filter((x) => x !== tag) : [...d.tags, tag] })}>{tag}</button>)}</div>
            <Field label={es.screens.calculator.notes}><textarea rows={2} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder={L.notesPlaceholder} /></Field>
          </fieldset>
        </div>
        <aside className="ed-res" aria-label={es.screens.calculator.result}>
          <div className="res-top">
            <div><span className="k">{L.setCost}</span><b className="big num">{money(total)}</b></div>
            <label className="price"><span className="k">{L.setPrice}</span><span className="unit big"><i className="pre">$</i><input inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder={String(Math.round(loose))} /></span></label>
          </div>
          <div id="r-dyn">
          <div className={`sbar${loss ? ' loss' : ''}`} role="img" aria-label={L.priceSplit}>
            {pieces > 0 ? <i style={{ width: `${(pieces / scale) * 100}%`, '--s': 'var(--c-m)' } as CSSProperties} title={`${L.setPieces}: ${money(pieces)}`} /> : null}
            {extras > 0 ? <i style={{ width: `${(extras / scale) * 100}%`, '--s': 'var(--c-t)' } as CSSProperties} title={`${L.box}: ${money(extras)}`} /> : null}
            {gain > 0 ? <i className="gain" style={{ width: `${(gain / scale) * 100}%` }} /> : null}
          </div>
          <div className="kpis"><div><span className="k">{es.screens.calculator.gain}</span><b className={`num ${gain >= 0 ? 'pos' : 'neg'}`}>{price > 0 ? moneyTotal(gain) : '—'}</b></div><div><span className="k">{es.screens.calculator.margin}</span><b className="num">{price > 0 ? pct((gain / price) * 100) : '—'}</b></div><div><span className="k">{L.piecesKpi}</span><b className="num">{rows.reduce((a, r) => a + r.qty, 0)}</b></div></div>
          <p className={`status ${status[0]}`}><Icon name={status[0] === 'good' ? 'check' : 'warn'} size={16} /><span>{status[1]}</span></p>
          {rows.length ? <p className="note">{t('screens.collection.looseSum', { amount: moneyTotal(loose) })} {auto ? L.autoPrice : dif > 0.5 ? t('screens.collection.discount', { amount: moneyTotal(dif), pct: pct((dif / loose) * 100) }) : dif < -0.5 ? t('screens.collection.surcharge', { amount: moneyTotal(-dif) }) : L.sameButSet}</p> : null}
          <table className="tbl sm legend"><tbody>
            {rows.map((r, i) => <tr key={i}><td><span className="lk" style={{ '--s': 'var(--c-m)' } as CSSProperties} />{r.qty > 1 ? `${r.qty} × ` : ''}{r.x.displayName}</td><td className="r num">{money((r.qty * r.x.costCents) / 100)}</td><td className="r num mut">{price > 0 ? pct((((r.qty * r.x.costCents) / 100) / price) * 100) : ''}</td></tr>)}
            {extras > 0 ? <tr><td><span className="lk" style={{ '--s': 'var(--c-t)' } as CSSProperties} />{L.box}</td><td className="r num">{money(extras)}</td><td className="r num mut">{price > 0 ? pct((extras / price) * 100) : ''}</td></tr> : null}
            <tr className="tot"><td>{L.setCost}</td><td className="r num">{money(total)}</td><td /></tr>
            {price > 0 && rows.length ? <tr className="gan"><td><span className="lk gain" />{es.screens.calculator.gain}</td><td className="r num">{money(gain)}</td><td className="r num mut">{pct((gain / price) * 100)}</td></tr> : null}
          </tbody></table>
          <div className="refs"><span className="k">{es.screens.calculator.shortcuts}</span><div>{refs.map((r) => <button key={r[0]} type="button" className="ref" onClick={() => set({ price: r[1] ? String(r[1]) : '' })}><b>{r[2]}</b><small>{r[0]}</small></button>)}</div></div>
          <p className="hint">{L.emptyHint}</p>
          </div>
          <div className="res-act">
            <Button variant="primary" block busy={save.isPending} busyLabel={es.common.saving} onClick={() => { if (valid()) save.mutate(undefined); }}>{search.id ? es.screens.calculator.saveChanges : L.saveNew}</Button>
            {search.id ? <Button block disabled>{L.sellSet}</Button> : null}
            {search.id ? <ConfirmButton variant="ghost" danger block confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.delete}</ConfirmButton> : <Button variant="ghost" block onClick={() => go('/productos?tab=colecciones')}>{es.screens.calculator.discard}</Button>}
          </div>
        </aside>
      </div>
    </>
  );
}
