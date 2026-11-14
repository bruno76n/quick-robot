// Colección (docs/06 §3.2): pieces with quantity, extras, set price (empty = loose sum), tags and notes.
import type { CollectionDetail, ProductListItem } from '@app/contract';
import { floorPrice, partQty, PRICE_TAGS } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Meter } from '../../components/Meter';
import { PageHead } from '../../components/PageHead';
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
import './products.css';

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
  const heading = d.name.trim() || (search.id ? L.edit : L.new);
  const costRows: [string, string, number][] = [...rows.map((r, i): [string, string, number] => [String(i), `${r.qty > 1 ? `${r.qty} × ` : ''}${r.x.displayName}`, (r.qty * r.x.costCents) / 100]), ...(extras > 0 ? [['box', L.box, extras] as [string, string, number]] : [])];
  return (
    <>
      <PageHead crumbs={[{ label: es.screens.products.title, to: '/productos' }, { label: es.screens.products.collections, to: '/productos?tab=colecciones' }]} title={heading} short={heading} sub={es.screens.products.colCollection}
        actions={<>
          {search.id ? <Button disabled>{L.sellSet}</Button> : null}
          <Button variant="primary" busy={save.isPending} busyLabel={es.common.saving} onClick={() => { if (valid()) save.mutate(undefined); }}>{search.id ? es.screens.calculator.saveChanges : L.saveNew}</Button>
        </>} />
      <div className="ed pz">
        <div className="ed-form">
          <fieldset className="blk"><legend>{es.screens.calculator.data}</legend>
            <label className="fld"><span>{L.name}</span><input ref={nameRef} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={L.namePlaceholder} /></label>
          </fieldset>
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
            <section className="pz-bd" aria-label={es.screens.calculator.breakdown}>
              <span className="k">{es.screens.calculator.breakdown}</span>
              <ul className="pz-rows">
                {costRows.map(([key, label, v]) => <li key={key}><b>{label}</b><Meter value={total > 0 ? (v / total) * 100 : 0} /><span className="num mut">{total > 0 ? pct((v / total) * 100) : '—'}</span><span className="num">{money(v)}</span></li>)}
              </ul>
              <div className="pz-cost"><span>{L.setCost}</span><b className="big num">{money(total)}</b></div>
            </section>
            <div className="pz-price">
              <label className="price"><span className="k">{L.setPrice}</span><span className="unit big"><i className="pre">$</i><input inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder={String(Math.round(loose))} /></span></label>
              <dl className="pz-k">
                <div className="g"><dt>{es.screens.calculator.gain}</dt><dd className={`num ${gain >= 0 ? 'pos' : 'neg'}`}>{price > 0 ? money(gain) : '—'}</dd></div>
                <div><dt>{es.screens.calculator.margin}</dt><dd className="num">{price > 0 ? pct((gain / price) * 100) : '—'}</dd></div>
                <div><dt>{L.piecesKpi}</dt><dd className="num">{rows.reduce((a, r) => a + r.qty, 0)}</dd></div>
              </dl>
              <p className={`pz-st ${status[0]}`}><Icon name={status[0] === 'good' ? 'check' : 'warn'} size={14} /><span>{status[1]}</span></p>
            </div>
          </div>
          {rows.length ? <p className="note">{t('screens.collection.looseSum', { amount: moneyTotal(loose) })} {auto ? L.autoPrice : dif > 0.5 ? t('screens.collection.discount', { amount: moneyTotal(dif), pct: pct((dif / loose) * 100) }) : dif < -0.5 ? t('screens.collection.surcharge', { amount: moneyTotal(-dif) }) : L.sameButSet}</p> : null}
          <div className="refs"><span className="k">{es.screens.calculator.shortcuts}</span><div>{refs.map((r) => <button key={r[0]} type="button" className="ref" onClick={() => set({ price: r[1] ? String(r[1]) : '' })}><b>{r[2]}</b><small>{r[0]}</small></button>)}</div></div>
          <p className="hint">{L.emptyHint}</p>
          <div className="res-act">
            {search.id ? <ConfirmButton variant="ghost" danger block confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.delete}</ConfirmButton> : <Button variant="ghost" block onClick={() => go('/productos?tab=colecciones')}>{es.screens.calculator.discard}</Button>}
          </div>
        </aside>
      </div>
    </>
  );
}
