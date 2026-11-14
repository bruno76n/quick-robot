// "Agregar rollo" / "Editar rollo" (docs/06 §6, reference/ronda-4/rollo-nuevo.html). One spool = one purchase: it never adds
// grams to a spool that exists; with a quantity of 2 it creates two spools with consecutive numbers. Material and color come
// from lists so the spool always joins the same filament. The result is previewed with core; the server recalculates.
import type { FieldError, FilamentListItem, Spool } from '@app/contract';
import { canonicalEntry, DEFAULT_COLORS, defaultCatalog, filamentKey, findInCatalog, nextSpoolNumbers, splitCents, SPOOL_QUANTITY, type CatalogEntry, type SpoolInput } from '@app/core';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Swatch } from '../../components/Pill';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api, ApiError } from '../../lib/api';
import { errorText, fieldErrors, fieldText } from '../../lib/errors';
import { centsTotal, grams as fmtGrams } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { invalidate, useSettings, useSuppliers } from '../../lib/queries';
import { useAddSpool, useFilaments } from './api';
import { costSourceShort, perGram, previewCost, spoolName, spoolNumbers, SpoolTag, toSpoolInput } from './spools';

const L = es.screens.spoolDialog;
const OTHER = '__other';
type Props = { filamentId?: string | undefined; filaments: FilamentListItem[]; onClose: () => void; onAdded: (filamentId: string) => void; onDeleted?: (() => void) | undefined };

/** The generic lists plus the values this workspace already uses (they grow by themselves, docs/06 §15). */
function mergeCatalog(base: CatalogEntry[], extra: CatalogEntry[]): CatalogEntry[] {
  const out = [...base];
  for (const e of extra) if (e.name && !findInCatalog(out, e.name)) out.push(e);
  return out;
}

export function SpoolDialog({ spoolId, ...props }: Props & { spoolId?: string | undefined }) {
  const owner = spoolId ? props.filaments.find((f) => f.spools.some((s) => s.id === spoolId)) : undefined;
  const editing = owner?.spools.find((s) => s.id === spoolId);
  if (spoolId && !editing) return null;
  return <SpoolForm key={spoolId ?? 'new'} {...props} filamentId={props.filamentId ?? owner?.id} editing={editing} />;
}

function SpoolForm({ filamentId, editing, filaments, onClose, onAdded, onDeleted }: Props & { editing: Spool | undefined }) {
  const preset = filaments.find((f) => f.id === filamentId);
  const catalog = useMemo(() => {
    const c = defaultCatalog();
    return {
      material: mergeCatalog(c.material, filaments.map((f) => ({ name: f.material }))),
      color: mergeCatalog(c.color, filaments.map((f) => ({ name: f.color, hex: f.hex }))),
      brand: mergeCatalog(c.brand, filaments.flatMap((f) => f.brands.map((name) => ({ name })))),
    };
  }, [filaments]);
  const n = useSettings().data?.settings.costAvgPurchases;
  const nextNumber = useFilaments().data?.nextSpoolNumber;
  const suppliers = useSuppliers().data ?? [];
  const [material, setMaterial] = useState(preset?.material ?? '');
  const [materialNew, setMaterialNew] = useState('');
  const [color, setColor] = useState(preset?.color ?? '');
  const [colorNew, setColorNew] = useState('');
  const [hex, setHex] = useState(DEFAULT_COLORS[0]![1]); // a new color starts on the first of the list, never on an interface color
  // Until the person picks a brand (or a supplier), a new spool of a filament that exists proposes the ones of its last spool (D3).
  const [brand, setBrandChosen] = useState<string | null>(editing ? editing.brand : null);
  const [brandNew, setBrandNew] = useState('');
  const [supplier, setSupplier] = useState<string | null>(editing ? editing.supplierId ?? '' : null);
  const [cost, setCost] = useState(editing ? String(editing.costCents / 100) : '');
  const [shipping, setShipping] = useState(editing ? String(editing.shippingCents / 100) : '0');
  const [weight, setWeight] = useState(editing ? String(editing.grams) : '1000');
  const [qty, setQty] = useState('1');
  const [on, setOn] = useState(editing?.purchasedOn ?? todayLocal());
  const [noCost, setNoCost] = useState(editing?.noCost ?? false);
  const [reference, setReference] = useState('');
  const [askReference, setAskReference] = useState(false);
  const [errs, setErrs] = useState<FieldError[]>([]);
  const refInput = useRef<HTMLInputElement>(null);
  const add = useAddSpool();
  const qc = useQueryClient();
  const del = useWrite(() => api.spools.remove(editing!.id), {
    touches: ['filaments', 'products', 'collections'], ok: (out) => (out.movements > 1 ? `${es.toast['spool.deleted']} ${t('toast.spool.deleted.withMovements', { count: out.movements })}` : es.toast['spool.deleted']),
    undo: () => () => api.spools.restore(editing!.id),
    onDone: () => onDeleted?.(),
  });

  const M = canonicalEntry('material', catalog.material, material === OTHER ? materialNew : material);
  const C = canonicalEntry('color', catalog.color, color === OTHER ? colorNew : color, hex);
  const existing = M.name && C.name ? filaments.find((f) => filamentKey(f.material, f.color) === filamentKey(M.name, C.name)) : undefined;
  const last = existing ? [...existing.spools].sort((a, b) => b.purchasedOn.localeCompare(a.purchasedOn) || b.number - a.number)[0] : undefined;
  const brandValue = brand ?? last?.brand ?? '';
  const brandList = brandValue && brandValue !== OTHER && !findInCatalog(catalog.brand, brandValue) ? [...catalog.brand, { name: brandValue }] : catalog.brand;
  const B = canonicalEntry('brand', brandList, brandValue === OTHER ? brandNew : brandValue);
  const supplierValue = supplier ?? (last?.supplierId && suppliers.some((s) => s.id === last.supplierId) ? last.supplierId : '');
  const g = Math.max(0, parseNumber(weight));
  const count = editing ? 1 : Math.round(parseNumber(qty, 1));
  const qtyOk = count >= SPOOL_QUANTITY.min && count <= SPOOL_QUANTITY.max;
  const costCents = noCost ? 0 : Math.round(parseNumber(cost) * 100);
  const shippingCents = noCost ? 0 : Math.round(parseNumber(shipping) * 100);
  const name = M.name && C.name ? `${M.name} ${C.name}` : '';
  const swatch = C.name && !C.isNew ? C.hex! : color === OTHER ? hex : 'var(--line-2)';

  // The result: numbers that are created, the spools of the filament after, and the cost for pieces before → after (core).
  // The next number comes from GET /filaments (it counts deleted spools, which keep theirs); the server gives the real one.
  const known = filaments.flatMap((f) => f.spools.map((s) => s.number));
  const numbers = editing ? [editing.number] : nextSpoolNumbers(nextNumber ? [...known, nextNumber - 1] : known, qtyOk ? count : 1);
  const ship = splitCents(shippingCents, numbers.length);
  const created: SpoolInput[] = numbers.map((num, i) => ({ id: `new-${num}`, number: num, purchasedOn: on || todayLocal(), grams: g, costPesos: costCents / 100, shippingPesos: (editing ? shippingCents : ship[i] ?? 0) / 100, remaining: editing ? Math.min(editing.remainingGrams, g) : g, noCost }));
  const kept = (existing?.spools ?? []).filter((s) => s.id !== editing?.id).map(toSpoolInput);
  const refCents = Math.round(parseNumber(reference) * 100);
  const refNow = refCents > 0 ? refCents : existing?.referenceCentsPerKg ?? null;
  const after = previewCost(filaments.map((f) => (f.id === existing?.id || f.spools.some((s) => s.id === editing?.id) ? { ...f, spools: f.spools.filter((s) => s.id !== editing?.id) } : f)), M.name, [...kept, ...created], created, n ?? 3, refNow);
  const needsReference = !editing && noCost && (askReference || previewCost(filaments, M.name, [...kept, ...created], created, n ?? 3, existing?.referenceCentsPerKg ?? null).source === 'none');

  const body = () => ({
    ...(existing ? { filamentId: existing.id } : { filament: { material: M.name, color: C.name, ...(C.hex ? { hex: C.hex } : {}) } }),
    brand: B.name, costCents, shippingCents, grams: Math.max(1, Math.round(g * 10) / 10 || 1000), purchasedOn: on || todayLocal(), noCost,
    ...(supplierValue ? { supplierId: supplierValue } : {}),
  });
  const submit = () => {
    if (!M.name || !C.name) { toast(es.fields['spool.filament.required']); return; }
    if (!noCost && parseNumber(cost) <= 0) { toast(es.fields['spool.cost.required']); return; }
    if (!qtyOk) { toast(es.fields['spool.quantity.range']); return; }
    if (needsReference && refCents <= 0) { toast(es.fields['spool.reference.required']); refInput.current?.focus(); return; }
    setErrs([]);
    if (editing) {
      void api.spools.update(editing.id, { ...body(), supplierId: supplierValue || null }).then(async (r) => {
        await invalidate(qc, 'filaments', 'products', 'collections');
        toast(r.data.filament.id !== filamentId ? t('screens.spoolDialog.savedIn', { filament: `${r.data.filament.material} ${r.data.filament.color}` }) : L.saved);
        onAdded(r.data.filament.id);
      }).catch((e) => { setErrs(fieldErrors(e)); toast(errorText(e).text); });
      return;
    }
    add.mutate({ ...body(), quantity: count, ...(needsReference && refCents > 0 ? { referenceCentsPerKg: refCents } : {}) }, {
      onSuccess: (out) => {
        const p = { filament: `${out.filament.material} ${out.filament.color}`, available: fmtGrams(out.filament.remainingGrams) };
        toast(out.spools.length > 1 ? t('toast.spool.addedMany', { ...p, numbers: spoolNumbers(out.spools.map((s) => s.number)) }) : t('toast.spool.added', { ...p, number: spoolName(out.spool.number) }));
        onAdded(out.filament.id);
      },
      onError: (e) => {
        if (e instanceof ApiError && e.code === 'REFERENCE_COST_REQUIRED') { setAskReference(true); setTimeout(() => refInput.current?.focus(), 0); }
        setErrs(fieldErrors(e)); toast(errorText(e).text);
      },
    });
  };

  const err = (field: string) => { const f = errs.find((e) => e.path.split(/[.[]/)[0] === field); return f ? fieldText('spool', f) : undefined; };
  const options = (list: CatalogEntry[]) => list.map((x) => <option key={x.name} value={x.name}>{x.name}</option>);
  const submitLabel = editing ? L.submitEdit : numbers.length > 1 ? t('screens.spoolDialog.submitMany', { count: numbers.length }) : t('screens.spoolDialog.submitOne', { number: spoolName(numbers[0]!) });
  return (
    <Dialog open wide className="sheet r4w" title={editing ? t('screens.spoolDialog.titleEditNumber', { number: spoolName(editing.number) }) : L.titleNew} onClose={onClose} onSubmit={submit} submitLabel={submitLabel} busy={add.isPending}>
      <div className="grid3">
        <Field label={L.material} error={err('filament')}>
          <select name="material" value={material} onChange={(e) => setMaterial(e.target.value)}><option value="">{es.common.choose}</option>{options(catalog.material)}<option value={OTHER}>{L.otherMaterial}</option></select>
          <input name="material_n" placeholder={L.materialPlaceholder} aria-label={L.newMaterialLabel} hidden={material !== OTHER} value={materialNew} onChange={(e) => setMaterialNew(e.target.value)} />
        </Field>
        <Field label={L.color}>
          <span className="selsw"><Swatch hex={swatch} /><select name="color" value={color} onChange={(e) => setColor(e.target.value)}><option value="">{es.common.choose}</option>{options(catalog.color)}<option value={OTHER}>{L.otherColor}</option></select></span>
          <span className="newc" hidden={color !== OTHER}><input name="color_n" placeholder={L.colorPlaceholder} aria-label={L.newColorLabel} value={colorNew} onChange={(e) => setColorNew(e.target.value)} /><input name="hex" type="color" value={hex} aria-label={L.colorOnScreen} hidden={Boolean(C.name && !C.isNew)} onChange={(e) => setHex(e.target.value)} /></span>
        </Field>
        <Field label={L.brand}>
          <select name="marca" value={brandValue} onChange={(e) => setBrandChosen(e.target.value)}><option value="">{es.common.noBrand}</option>{options(brandList)}<option value={OTHER}>{L.otherBrand}</option></select>
          <input name="marca_n" placeholder={L.brandPlaceholder} aria-label={L.newBrandLabel} hidden={brandValue !== OTHER} value={brandNew} onChange={(e) => setBrandNew(e.target.value)} />
        </Field>
      </div>
      <LinkNote name={name} existing={Boolean(existing)} editing={Boolean(editing)} isNew={M.isNew || C.isNew} many={numbers.length > 1} />
      <div className="grid3">
        <Field label={L.weightPerSpool} error={err('grams')}><UnitInput unit="g" name="gramos" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        {editing ? null : <Field label={L.quantity} error={err('quantity')}><UnitInput unit={L.spoolsUnit} name="cantidad" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>}
        <Field label={L.date} error={err('purchasedOn')}><input name="fecha" type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
      </div>
      <div className="grid3">
        <Field label={L.pricePerSpool} error={err('costCents')}><UnitInput unit="$" name="costo" inputMode="decimal" placeholder={noCost ? undefined : '350'} value={noCost ? '' : cost} disabled={noCost} onChange={(e) => setCost(e.target.value)} data-autofocus={preset && !editing ? '' : undefined} /></Field>
        <Field label={editing ? L.shipping : L.orderShipping} hint={!editing && numbers.length > 1 ? L.shippingSplitHint : undefined} error={err('shippingCents')}><UnitInput unit="$" name="envio" inputMode="decimal" value={noCost ? '' : shipping} disabled={noCost} onChange={(e) => setShipping(e.target.value)} /></Field>
        <Field label={L.supplier}><select name="proveedor" value={supplierValue} onChange={(e) => setSupplier(e.target.value)}><option value="">{L.noSupplier}</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
      </div>
      <label className="tgl"><input type="checkbox" role="switch" name="sincosto" checked={noCost} onChange={(e) => setNoCost(e.target.checked)} />{L.noCost}</label>
      {needsReference ? (
        <Field label={L.referencePerKg} hint={t('screens.spoolDialog.referenceHint', { name: name || L.thisFilament })} error={err('referenceCentsPerKg')}>
          <UnitInput ref={refInput} unit="$" name="referencia" inputMode="decimal" placeholder="300" value={reference} onChange={(e) => setReference(e.target.value)} />
        </Field>
      ) : null}
      {name ? <Result material={M.name} name={name} brand={B.name} grams={g} numbers={numbers} costCents={costCents} noCost={noCost} editing={editing} existing={existing} kept={kept} created={created} after={after} /> : null}
      {editing ? <ConfirmButton variant="ghost" danger confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deleteSpool}</ConfirmButton> : null}
    </Dialog>
  );
}

function LinkNote({ name, existing, editing, isNew, many }: { name: string; existing: boolean; editing: boolean; isNew: boolean; many: boolean }) {
  if (!name) return <p className="note">{L.linkChoose}</p>;
  if (editing) return null;
  if (existing) return <p className="exists"><Icon name="check" size={14} />{t(many ? 'screens.spoolDialog.existsMany' : 'screens.spoolDialog.exists', { name })}</p>;
  return <p className="note">{t(isNew ? 'screens.spoolDialog.linkNewAndList' : 'screens.spoolDialog.linkNew', { name })}</p>;
}

type Cost = ReturnType<typeof previewCost>;
function Result({ material, name, brand, grams, numbers, costCents, noCost, editing, existing, kept, created, after }: {
  material: string; name: string; brand: string; grams: number; numbers: number[]; costCents: number; noCost: boolean; editing: Spool | undefined; existing: FilamentListItem | undefined;
  kept: SpoolInput[]; created: SpoolInput[]; after: Cost;
}) {
  const price = noCost ? es.screens.spools.noCost.toLowerCase() : numbers.length > 1 ? t('screens.spoolDialog.eachPrice', { price: centsTotal(costCents) }) : centsTotal(costCents);
  const line = t(numbers.length > 1 ? 'screens.spoolDialog.resultMany' : editing ? 'screens.spoolDialog.resultEdit' : 'screens.spoolDialog.resultOne', { count: numbers.length, name, brand: brand || es.common.noBrand, perSpool: fmtGrams(grams), price });
  const shown = [...kept.filter((s) => s.remaining > 0.5), ...created].sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
  const free = shown.filter((s) => s.noCost).map((s) => s.number!);
  const source = after.source === 'purchases' ? t('screens.spools.source.purchases', { numbers: spoolNumbers(after.spoolNumbers) }) : costSourceShort({ material, costSource: after.source, costSpoolNumbers: after.spoolNumbers });
  return (
    <div className="prev" aria-live="polite">
      <span className="lbl">{L.result}</span>
      <ul className="prev-l">
        <li><span className="nums">{numbers.map((x) => <SpoolTag key={x} n={x} small />)}</span><span>{line}</span></li>
        <li><span className="prev-k">{name}</span><span className="rchs">{shown.map((s) => (
          <span className="rch" key={s.id}><SpoolTag n={s.number!} small />{s.noCost ? t('screens.spoolDialog.chipNoCost', { leftGrams: s.remaining }) : fmtGrams(s.remaining)}</span>
        ))}</span></li>
        <li><span className="prev-k">{L.costForPieces}</span><span>
          {existing && Math.abs(existing.costPerGram - after.costPerGram) > 0.00005 ? <><span className="num old">{perGram(existing.costPerGram)}</span>{L.arrow}</> : null}
          <b className="num" data-testid="cost-after">{perGram(after.costPerGram)}</b>
          <span className="meta">{source}{free.length ? t('screens.spoolDialog.notCounted', { count: free.length, numbers: spoolNumbers(free) }) : ''}</span>
        </span></li>
      </ul>
    </div>
  );
}
