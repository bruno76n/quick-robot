// Calculadora (docs/06 §3.1): the piece form and its live breakdown. Save sends the inputs; the server costs it.
import type { ProductDetail, SaveProductInput } from '@app/contract';
import { PRICE_TAGS } from '@app/core';
import { useQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { grams as fmtGrams, money } from '../../lib/format';
import { useWrite } from '../../lib/mutate';
import { go } from '../../lib/nav';
import { keys, usePrinters, useSettings, useSupplies } from '../../lib/queries';
import { useFilaments } from '../filament/api';
import { SpoolDialog } from '../filament/SpoolDialog';
import { num, previewCost, priceOf, type Catalog, type Draft } from './costing';
import { PieceResult } from './PieceResult';
import { PhotoField } from './PhotoField';
import { QuoteDialog } from './QuoteDialog';
import './products.css';

const L = es.screens.calculator;
const SPEC: [string, string, string, string][] = [['layer', L.layer, 'mm', '0.20'], ['infill', L.infill, '%', '15'], ['walls', L.walls, '', '3']];
const SPEC2: [string, string, string, string][] = [['nozzle', L.nozzle, '°C', '215'], ['bed', L.bed, '°C', '60']];

function fromDetail(p: ProductDetail): Draft {
  const h = Math.floor(p.hours + 1e-9);
  return {
    name: p.name, tags: p.tags, mode: p.mode, price: p.priceCents ? String(p.priceCents / 100) : '', margin: p.marginPct === null ? '' : String(p.marginPct),
    printerId: p.printerId ?? '', hours: h ? String(h) : '', minutes: Math.round((p.hours - h) * 60) ? String(Math.round((p.hours - h) * 60)) : '',
    batch: String(p.batchSize), extras: p.extrasCents ? String(p.extrasCents / 100) : '', filaments: p.filaments.length ? p.filaments.map((f) => ({ filamentId: f.filamentId, grams: String(f.grams) })) : [{ filamentId: '', grams: '' }],
    supplies: p.supplies.map((s) => ({ supplyId: s.supplyId, qty: String(s.qty) })), spec: Object.fromEntries(Object.entries(p.spec ?? {}).map(([k, v]) => [k, String(v ?? '')])),
    note: p.note, tracksStock: p.tracksStock, photoFileId: p.photoFileId, photoUrl: p.photoUrl, parentId: p.parentId, variantLabel: p.variantLabel ?? '',
  };
}
const blank = (printerId: string): Draft => ({ name: '', tags: [], mode: 'value', price: '', margin: '', printerId, hours: '', minutes: '', batch: '1', extras: '', filaments: [{ filamentId: '', grams: '' }], supplies: [], spec: {}, note: '', tracksStock: false, photoFileId: null, photoUrl: null, parentId: null, variantLabel: '' });

function toInput(d: Draft, c: Catalog): SaveProductInput {
  const spec = Object.fromEntries(Object.entries(d.spec).filter(([, v]) => v.trim()));
  const total = previewCost(d, c).total;
  return {
    name: d.name, tags: d.tags, mode: d.mode, priceCents: Math.round((d.mode === 'value' ? num(d.price) : priceOf(d, c, total)) * 100), marginPct: d.margin === '' ? null : num(d.margin),
    printerId: d.printerId || null, hours: Math.round((num(d.hours) + num(d.minutes) / 60) * 100) / 100, batchSize: Math.max(1, Math.round(num(d.batch, 1)) || 1),
    extrasCents: Math.round(num(d.extras) * 100), tracksStock: d.tracksStock,
    filaments: d.filaments.filter((f) => f.filamentId && num(f.grams) > 0).map((f) => ({ filamentId: f.filamentId, grams: Math.round(num(f.grams) * 10) / 10 })),
    supplies: d.supplies.filter((s) => s.supplyId && num(s.qty) > 0).map((s) => ({ supplyId: s.supplyId, qty: num(s.qty) })),
    spec: Object.keys(spec).length ? spec : null, note: d.note, photoFileId: d.photoFileId,
    ...(d.variantLabel.trim() ? { variantLabel: d.variantLabel.trim() } : {}),
  };
}

interface Root { id: string; name: string }

export function ProductEditor() {
  // ?id= edits a piece; ?variante= opens a copy of that piece as a new variant of its original (mejoras/ronda-2.md §3.4).
  const search = useSearch({ strict: false }) as { id?: string; variante?: string };
  const editId = search.id;
  const fromId = editId ? undefined : search.variante;
  const settings = useSettings().data;
  const printers = usePrinters().data?.items;
  const filaments = useFilaments().data?.items;
  const supplies = useSupplies().data?.items;
  const loadId = editId ?? fromId;
  const detail = useQuery({ queryKey: [...keys.products, 'detail', loadId], queryFn: async () => (await api.products.get(loadId!)).data, enabled: Boolean(loadId) });
  const parentId = detail.data?.parentId ?? null;
  const parentQ = useQuery({ queryKey: [...keys.products, 'detail', parentId], queryFn: async () => (await api.products.get(parentId!)).data, enabled: Boolean(parentId) });
  const c: Catalog | null = settings && printers && filaments && supplies ? { settings: settings.settings, printers, filaments, supplies } : null;
  if (!c || (loadId && !detail.data) || (parentId && !parentQ.data)) return <div className="skel" />;
  let initial: Draft;
  let parent: Draft | null = null;
  let root: Root | null = null;
  if (!loadId) initial = blank(c.printers[0]?.id ?? '');
  else {
    const base = fromDetail(detail.data!);
    const original = parentQ.data ?? (fromId ? detail.data! : null);
    if (original) { root = { id: original.id, name: original.name }; parent = fromDetail(original); }
    initial = fromId ? { ...base, name: root!.name, variantLabel: '', parentId: root!.id, photoFileId: null, photoUrl: null } : base;
  }
  return <PieceForm key={`${loadId ?? 'new'}-${fromId ?? ''}`} initial={initial} parent={parent} root={root} c={c} editId={editId} fromId={fromId} />;
}

function PieceForm({ initial, parent, root, c, editId, fromId }: { initial: Draft; parent: Draft | null; root: Root | null; c: Catalog; editId: string | undefined; fromId: string | undefined }) {
  const [d, setD] = useState<Draft>(initial);
  const [spoolFor, setSpoolFor] = useState<number | null>(null);
  const [quote, setQuote] = useState(false);
  // Creating a variant: from Productos (?variante=) or "Guardar como variante nueva" while editing (keeps the edits as the copy).
  const [newOf, setNewOf] = useState<Root | null>(fromId ? root : null);
  const isVariant = Boolean(newOf) || Boolean(editId && root);
  const labelRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (newOf) labelRef.current?.focus(); }, [newOf]);
  const touches = ['products', 'collections', 'supplies', 'stock'] as const;
  const save = useWrite((input: SaveProductInput) => (newOf ? api.products.variant(fromId ?? editId!, { ...input, variantLabel: d.variantLabel.trim() }) : editId ? api.products.update(editId, input) : api.products.create(input)), {
    touches: [...touches], ok: () => (newOf ? es.toast['product.variantSaved'] : es.toast['product.saved']),
    onDone: (out) => go(newOf ? `/productos?abierta=${out.parentId ?? newOf.id}` : '/productos'),
  });
  const del = useWrite(() => api.products.remove(editId!), {
    touches: [...touches], ok: () => es.toast['product.deleted'], onDone: () => go('/productos'),
    undo: () => () => api.products.restore(editId!),
  });
  const set = (patch: Partial<Draft>) => setD({ ...d, ...patch });
  const total = previewCost(d, c).total;
  const price = priceOf(d, c, total);
  const valid = () => {
    if (isVariant && !d.variantLabel.trim()) { labelRef.current?.focus(); return false; }
    if (!d.name.trim()) { toast(es.fields['product.name.required']); return false; }
    if (d.mode === 'value' && !(num(d.price) > 0)) { toast(es.fields['product.price.required']); return false; }
    return true;
  };
  const fil = (i: number, patch: Partial<Draft['filaments'][number]>) => set({ filaments: d.filaments.map((f, k) => (k === i ? { ...f, ...patch } : f)) });
  const sup = (i: number, patch: Partial<Draft['supplies'][number]>) => set({ supplies: d.supplies.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const sortedFil = [...c.filaments].sort((a, b) => a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es'));
  return (
    <>
      <nav className="crumbs"><a href="/productos" onClick={(e) => { e.preventDefault(); go('/productos'); }}>{es.screens.products.title}</a><span>/</span><span>{newOf ? t('screens.products.variants.editorTitle', { name: newOf.name }) : editId ? L.edit : L.new}</span></nav>
      {newOf ? <h1 className="var-title">{t('screens.products.variants.editorTitle', { name: newOf.name })}</h1> : null}
      {editId && root && !newOf ? <p className="banner" data-testid="variant-of">{t('screens.products.variantOf', { name: root.name })}</p> : null}
      <div className="ed">
        <div className="ed-form">
          {isVariant
            ? <label className="fld title-f var-label"><span>{es.screens.products.variants.labelField}</span><input ref={labelRef} value={d.variantLabel} required maxLength={60} onChange={(e) => set({ variantLabel: e.target.value })} /></label>
            : <label className="fld title-f"><span className="sr">{L.name}</span><input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder={L.namePlaceholder} /></label>}
          <PhotoField fileId={d.photoFileId} url={d.photoUrl} hexes={d.filaments.map((f) => c.filaments.find((x) => x.id === f.filamentId)?.hex ?? '').filter(Boolean)} seed={editId ?? 'new'} onChange={(photoFileId, photoUrl) => set({ photoFileId, photoUrl })} />
          <fieldset className="blk"><legend>{L.printing}</legend>
            <div className="grid2">
              <Field label={L.printer} hint={L.printerHint}><select value={d.printerId} onChange={(e) => set({ printerId: e.target.value })}>{c.printers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}{c.printers.length > 1 || !c.printers.length ? <option value="">{L.anyPrinter}</option> : null}</select></Field>
              <div className="fld"><span>{L.time}</span><div className="hm"><UnitInput unit="h" inputMode="numeric" value={d.hours} onChange={(e) => set({ hours: e.target.value })} placeholder="0" aria-label={L.hoursLabel} /><UnitInput unit="min" inputMode="numeric" value={d.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder="0" aria-label={L.minutesLabel} /></div></div>
            </div>
          </fieldset>
          <fieldset className="blk"><legend>{L.filaments}</legend>
            <div>{d.filaments.map((f, i) => {
              const x = c.filaments.find((y) => y.id === f.filamentId);
              const g = num(f.grams);
              return (
                <div className="frow" key={i}>
                  <span className="sw lg" style={{ ['--c' as string]: x?.hex ?? '#ccc' }} />
                  <label className="fld"><span className="sr">{L.filament}</span><select value={f.filamentId} onChange={(e) => fil(i, { filamentId: e.target.value })}>{x ? null : <option value="">{L.chooseFilament}</option>}{sortedFil.map((y) => <option key={y.id} value={y.id}>{y.material} {y.color}</option>)}</select></label>
                  <label className="fld"><span className="sr">{L.grams}</span><UnitInput unit="g" inputMode="decimal" value={f.grams} onChange={(e) => fil(i, { grams: e.target.value })} placeholder="0" /></label>
                  <span className="fcost num">{money(g * (x?.costPerGram ?? 0))}</span>
                  <button type="button" className="btn ghost icon" onClick={() => set({ filaments: d.filaments.filter((_, k) => k !== i) })} aria-label={L.removeFilament} disabled={d.filaments.length < 2}><Icon name="x" size={16} /></button>
                  <small className={`stock${x && g > x.remainingGrams ? ' bad' : ''}`}>{x ? (g > x.remainingGrams ? t('screens.calculator.availableShort', { grams: fmtGrams(x.remainingGrams) }) : t('screens.calculator.available', { grams: fmtGrams(x.remainingGrams), count: x.activeSpools, perGram: money(x.costPerGram) })) : ''}</small>
                </div>
              );
            })}</div>
            <div className="btnrow"><Button size="sm" icon="plus" onClick={() => set({ filaments: [...d.filaments, { filamentId: '', grams: '' }] })}>{L.addFilament}</Button><Button size="sm" variant="ghost" onClick={() => setSpoolFor(d.filaments.findIndex((f) => !f.filamentId))}>{L.addSpoolOther}</Button></div>
            <p className="hint">{L.filamentsHint}</p>
          </fieldset>
          <fieldset className="blk"><legend>{L.supplies}</legend>
            {c.supplies.length ? (
              <>
                {d.supplies.length ? d.supplies.map((s, i) => {
                  const x = c.supplies.find((y) => y.id === s.supplyId);
                  return <div className="irow" key={i}><select value={s.supplyId} onChange={(e) => sup(i, { supplyId: e.target.value })} aria-label={L.supply}><option value="">{L.chooseSupply}</option>{c.supplies.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select><UnitInput unit={x?.unit || es.screens.supplies.pza} inputMode="decimal" value={s.qty} onChange={(e) => sup(i, { qty: e.target.value })} placeholder="1" aria-label={L.qtyPerPiece} /><b className="num icost">{x ? money((num(s.qty) * x.costCents) / 100) : ''}</b><button type="button" className="btn ghost icon" onClick={() => set({ supplies: d.supplies.filter((_, k) => k !== i) })} aria-label={L.removeSupply}><Icon name="x" size={16} /></button></div>;
                }) : <p className="hint">{L.noSupplies}</p>}
                <div className="btnrow"><Button size="sm" icon="plus" onClick={() => set({ supplies: [...d.supplies, { supplyId: '', qty: '1' }] })}>{L.addSupply}</Button></div>
              </>
            ) : <p className="hint">{L.noSuppliesYet}</p>}
            <p className="hint">{L.suppliesHint}</p>
          </fieldset>
          <fieldset className="blk"><legend>{L.plate}</legend>
            <div className="grid2">
              <Field label={L.perPlate} hint={L.perPlateHint}><input inputMode="numeric" value={d.batch} onChange={(e) => set({ batch: e.target.value })} /></Field>
              <Field label={L.otherExtras} hint={L.otherExtrasHint}><UnitInput unit="$" inputMode="decimal" value={d.extras} onChange={(e) => set({ extras: e.target.value })} placeholder="0" /></Field>
            </div>
          </fieldset>
          <fieldset className="blk"><legend>{L.listPrice}</legend>
            <div className="seg wide" role="group" aria-label={L.priceMethod}>
              <button type="button" className={d.mode === 'value' ? 'on' : ''} onClick={() => set({ mode: 'value' })}>{es.status.priceMode.value}</button>
              <button type="button" className={d.mode === 'formula' ? 'on' : ''} onClick={() => set({ mode: 'formula' })}>{es.status.priceMode.formula}</button>
            </div>
            {d.mode === 'formula' ? <div className="grid3"><Field label={L.margin} hint={L.marginHint}><UnitInput unit="%" inputMode="decimal" value={d.margin === '' ? String(c.settings.formulaMarginPct) : d.margin} onChange={(e) => set({ margin: e.target.value })} /></Field></div> : null}
            <p className="hint">{d.mode === 'value' ? L.valueHint : L.formulaHint} {L.listHint}</p>
            <div className="tags" role="group" aria-label={L.priceTags}>{PRICE_TAGS.map((tag) => <button key={tag} type="button" className={`tag${d.tags.includes(tag) ? ' on' : ''}`} aria-pressed={d.tags.includes(tag)} onClick={() => set({ tags: d.tags.includes(tag) ? d.tags.filter((x) => x !== tag) : [...d.tags, tag] })}>{tag}</button>)}</div>
            <Field label={L.notes}><textarea rows={2} value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder={L.notesPlaceholder} /></Field>
          </fieldset>
          <fieldset className="blk"><legend>{L.spec}</legend>
            <p className="hint">{L.specHint}</p>
            <div className="grid3">{SPEC.map(([k, label, unit, ph]) => <Field key={k} label={label}>{unit ? <UnitInput unit={unit} inputMode="decimal" value={d.spec[k] ?? ''} onChange={(e) => set({ spec: { ...d.spec, [k]: e.target.value } })} placeholder={ph} /> : <input inputMode="numeric" value={d.spec[k] ?? ''} onChange={(e) => set({ spec: { ...d.spec, [k]: e.target.value } })} placeholder={ph} />}</Field>)}</div>
            <div className="grid3">
              <Field label={L.supports}><select value={d.spec.supports ?? ''} onChange={(e) => set({ spec: { ...d.spec, supports: e.target.value } })}>{['', L.supportsNo, L.supportsYes, L.supportsTree].map((o) => <option key={o} value={o}>{o || '—'}</option>)}</select></Field>
              {SPEC2.map(([k, label, unit, ph]) => <Field key={k} label={label}><UnitInput unit={unit} inputMode="numeric" value={d.spec[k] ?? ''} onChange={(e) => set({ spec: { ...d.spec, [k]: e.target.value } })} placeholder={ph} /></Field>)}
            </div>
            <Field label={L.modelFile} hint={L.modelFileHint}><input value={d.spec.file ?? ''} onChange={(e) => set({ spec: { ...d.spec, file: e.target.value } })} placeholder={L.modelFilePlaceholder} /></Field>
            <Field label={L.printNotes}><textarea rows={2} value={d.spec.note ?? ''} onChange={(e) => set({ spec: { ...d.spec, note: e.target.value } })} placeholder={L.printNotesPlaceholder} /></Field>
            <div className="btnrow"><Button size="sm" onClick={() => {
              const text = [d.name, ...Object.entries(d.spec).filter(([, v]) => v.trim()).map(([k, v]) => `${(L as Record<string, string>)[k === 'file' ? 'modelFile' : k === 'note' ? 'printNotes' : k] ?? k}: ${v}`)].join('\n');
              void navigator.clipboard?.writeText(text).then(() => toast(t('toast.copy.done', { what: L.specCopied })), () => toast(es.toast['copy.failed']));
            }}>{L.copySpec}</Button></div>
          </fieldset>
          <fieldset className="blk"><legend>{L.stock}</legend>
            <label className="chk"><input type="checkbox" checked={d.tracksStock} onChange={(e) => set({ tracksStock: e.target.checked })} /><span>{L.tracksStock}</span><small>{L.tracksStockHint}</small></label>
          </fieldset>
        </div>
        <aside className="ed-res" aria-label={L.result}>
          <div className="res-top">
            <div><span className="k">{L.cost}</span><b className="big num">{money(total)}</b></div>
            <label className="price"><span className="k">{L.listPrice}</span><span className="unit big"><i className="pre">$</i><input inputMode="decimal" value={d.mode === 'formula' ? (price ? String(price) : '') : d.price} onChange={(e) => set({ price: e.target.value })} placeholder="0" disabled={d.mode === 'formula'} /></span></label>
          </div>
          <div id="r-dyn"><PieceResult d={d} c={c} parent={parent} onPrice={(v) => set({ price: String(v) })} onFormula={() => set({ mode: 'formula' })} /></div>
          <div className="res-act">
            <Button variant="primary" block busy={save.isPending} busyLabel={es.common.saving} onClick={() => { if (valid()) save.mutate(toInput(d, c)); }}>{editId && !newOf ? L.saveChanges : L.saveNew}</Button>
            {editId && !newOf ? <Button block onClick={() => { setNewOf(root ?? { id: editId, name: d.name }); setD({ ...d, variantLabel: '', photoFileId: null, photoUrl: null }); }}>{L.saveVariant}</Button> : null}
            <div className="row2"><Button block onClick={() => setQuote(true)}>{L.quote}</Button>{editId ? <Button block disabled>{L.sell}</Button> : null}</div>
            {editId && !newOf ? <ConfirmButton variant="ghost" danger block confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deletePiece}</ConfirmButton> : <Button variant="ghost" block onClick={() => go('/productos')}>{L.discard}</Button>}
          </div>
        </aside>
      </div>
      {spoolFor !== null ? <SpoolDialog filaments={c.filaments} onClose={() => setSpoolFor(null)} onAdded={(id) => { const i = spoolFor; setSpoolFor(null); if (i >= 0) fil(i, { filamentId: id }); else set({ filaments: [...d.filaments, { filamentId: id, grams: '' }] }); }} /> : null}
      {quote ? <QuoteDialog name={isVariant && root ? `${root.name} · ${d.variantLabel.trim()}` : d.name} price={price} colors={d.filaments.map((f) => c.filaments.find((x) => x.id === f.filamentId)?.color.toLocaleLowerCase('es') ?? '').filter(Boolean)} attendedBy={c.settings.business.name} onClose={() => setQuote(false)} /> : null}
    </>
  );
}
