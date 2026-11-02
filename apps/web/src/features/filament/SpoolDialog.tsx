// "Agregar rollo" (docs/06 §6, reference/mockup-textos.md › Diálogo · rollo nuevo). Material and color are picked
// from lists so the spool always joins the same filament; the server decides and recalculates.
import type { FieldError, FilamentListItem, Spool } from '@app/contract';
import { canonicalEntry, defaultCatalog, filamentKey, findInCatalog, type CatalogEntry } from '@app/core';
import { useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Swatch } from '../../components/Pill';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { errorText, fieldErrors, fieldText } from '../../lib/errors';
import { grams as fmtGrams, money2d } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useAddSpool, useFilament } from './api';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmButton } from '../../components/ConfirmButton';
import { api } from '../../lib/api';
import { useWrite } from '../../lib/mutate';
import { invalidate } from '../../lib/queries';

const L = es.screens.spoolDialog;
const OTHER = '__other';

/** The generic lists plus the values this workspace already uses (they grow by themselves, docs/06 §15). */
function mergeCatalog(base: CatalogEntry[], extra: CatalogEntry[]): CatalogEntry[] {
  const out = [...base];
  for (const e of extra) if (e.name && !findInCatalog(out, e.name)) out.push(e);
  return out;
}

function Bold({ text, bold }: { text: string; bold: string[] }) {
  // Bold the given fragments of an already translated sentence (names and grams, like the mockup).
  const parts: ReactNode[] = [];
  let rest = text;
  let k = 0;
  for (const b of bold) {
    const i = rest.indexOf(b);
    if (i < 0) continue;
    parts.push(rest.slice(0, i), <b key={k++}>{b}</b>);
    rest = rest.slice(i + b.length);
  }
  parts.push(rest);
  return <>{parts}</>;
}

export function SpoolDialog({ filamentId, spoolId, filaments, onClose, onAdded, onDeleted }: { filamentId?: string | undefined; spoolId?: string | undefined; filaments: FilamentListItem[]; onClose: () => void; onAdded: (filamentId: string) => void; onDeleted?: () => void }) {
  const detail = useFilament(spoolId ? filamentId ?? null : null).data;
  const editing = spoolId ? detail?.spools.find((x) => x.id === spoolId) : undefined;
  if (spoolId && !editing) return null;
  return <SpoolForm key={spoolId ?? 'new'} filamentId={filamentId} editing={editing} filaments={filaments} onClose={onClose} onAdded={onAdded} onDeleted={onDeleted} />;
}

function SpoolForm({ filamentId, editing, filaments, onClose, onAdded, onDeleted }: { filamentId?: string | undefined; editing: Spool | undefined; filaments: FilamentListItem[]; onClose: () => void; onAdded: (filamentId: string) => void; onDeleted?: (() => void) | undefined }) {
  const preset = filaments.find((f) => f.id === filamentId);
  const catalog = useMemo(() => {
    const c = defaultCatalog();
    return {
      material: mergeCatalog(c.material, filaments.map((f) => ({ name: f.material }))),
      color: mergeCatalog(c.color, filaments.map((f) => ({ name: f.color, hex: f.hex }))),
      brand: mergeCatalog(c.brand, filaments.flatMap((f) => f.brands.map((name) => ({ name })))),
    };
  }, [filaments]);
  const [open, setOpen] = useState(!preset);
  const [material, setMaterial] = useState(preset?.material ?? '');
  const [materialNew, setMaterialNew] = useState('');
  const [color, setColor] = useState(preset?.color ?? '');
  const [colorNew, setColorNew] = useState('');
  const [hex, setHex] = useState('#6b3fd4');
  const [brand, setBrand] = useState(editing?.brand ?? '');
  const [brandNew, setBrandNew] = useState('');
  const [cost, setCost] = useState(editing ? String(editing.costCents / 100) : '');
  const [shipping, setShipping] = useState(editing ? String(editing.shippingCents / 100) : '0');
  const [weight, setWeight] = useState(editing ? String(editing.grams) : '1000');
  const [on, setOn] = useState(editing?.purchasedOn ?? todayLocal());
  const [errs, setErrs] = useState<FieldError[]>([]);
  const add = useAddSpool();
  const qc = useQueryClient();
  const del = useWrite(() => api.spools.remove(editing!.id), {
    touches: ['filaments', 'products', 'collections'], ok: (out) => (out.movements > 1 ? `${es.toast['spool.deleted']} ${t('toast.spool.deleted.withMovements', { count: out.movements })}` : es.toast['spool.deleted']),
    undo: () => () => api.spools.restore(editing!.id),
    onDone: () => onDeleted?.(),
  });

  const M = canonicalEntry('material', catalog.material, material === OTHER ? materialNew : material);
  const C = canonicalEntry('color', catalog.color, color === OTHER ? colorNew : color, hex);
  const B = canonicalEntry('brand', catalog.brand, brand === OTHER ? brandNew : brand);
  const g = Math.max(0, parseNumber(weight));
  const swatch = C.name && !C.isNew ? C.hex! : color === OTHER ? hex : '#d2d2da';
  const existing = M.name && C.name ? filaments.find((f) => filamentKey(f.material, f.color) === filamentKey(M.name, C.name)) : undefined;
  const pay = parseNumber(cost) + parseNumber(shipping);
  const err = (field: string) => { const f = errs.find((e) => e.path.split(/[.[]/)[0] === field); return f ? fieldText('spool', f) : undefined; };

  let link: ReactNode;
  let linkOk = false;
  if (M.name && C.name) {
    const name = `${M.name} ${C.name}`;
    if (editing && existing) {
      linkOk = true;
      const others = Math.max(0, existing.spools - (existing.id === filamentId ? 1 : 0));
      const without = existing.id === filamentId ? existing.remainingGrams - editing.remainingGrams : existing.remainingGrams;
      link = <Bold text={others ? t('screens.spoolDialog.belongsWith', { name, count: others, grams: fmtGrams(Math.max(0, without)) }) : t('screens.spoolDialog.belongsOnly', { name })} bold={[name]} />;
    } else if (existing && existing.activeSpools) {
      linkOk = true;
      const text = t('screens.spoolDialog.linkJoins', { name, grams: fmtGrams(existing.remainingGrams), count: existing.activeSpools, totalGrams: fmtGrams(existing.remainingGrams + g) });
      link = <Bold text={text} bold={[name, fmtGrams(existing.remainingGrams + g)]} />;
    } else if (existing) {
      linkOk = true;
      link = <Bold text={t('screens.spoolDialog.linkNoMaterial', { name, totalGrams: fmtGrams(g) })} bold={[name, fmtGrams(g)]} />;
    } else {
      link = <Bold text={t(M.isNew || C.isNew ? 'screens.spoolDialog.linkNewAndList' : 'screens.spoolDialog.linkNew', { name })} bold={[name]} />;
    }
  } else link = L.linkChoose;

  const submit = () => {
    if (!M.name || !C.name) { toast(es.fields['spool.filament.required']); setOpen(true); return; }
    if (parseNumber(cost) <= 0) { toast(es.fields['spool.cost.required']); return; }
    setErrs([]);
    if (editing) {
      const input = {
        ...(existing ? { filamentId: existing.id } : { filament: { material: M.name, color: C.name, ...(C.hex ? { hex: C.hex } : {}) } }),
        brand: B.name, costCents: Math.round(parseNumber(cost) * 100), shippingCents: Math.round(parseNumber(shipping) * 100), grams: Math.max(1, Math.round(g * 10) / 10), purchasedOn: on || todayLocal(),
      };
      void api.spools.update(editing.id, input).then(async (r) => {
        await invalidate(qc, 'filaments', 'products', 'collections');
        toast(r.data.filament.id !== filamentId ? t('screens.spoolDialog.savedIn', { filament: `${r.data.filament.material} ${r.data.filament.color}` }) : L.saved);
        onAdded(r.data.filament.id);
      }).catch((e) => { setErrs(fieldErrors(e)); toast(errorText(e).text); });
      return;
    }
    add.mutate({
      ...(existing ? { filamentId: existing.id } : { filament: { material: M.name, color: C.name, ...(C.hex ? { hex: C.hex } : {}) } }),
      brand: B.name, costCents: Math.round(parseNumber(cost) * 100), shippingCents: Math.round(parseNumber(shipping) * 100),
      grams: Math.max(1, Math.round(g * 10) / 10 || 1000), purchasedOn: on || todayLocal(),
    }, {
      onSuccess: (out) => {
        toast(t('toast.spool.added', { filament: `${out.filament.material} ${out.filament.color}`, available: fmtGrams(out.filament.remainingGrams) }));
        onAdded(out.filament.id);
      },
      onError: (e) => { const f = fieldErrors(e); setErrs(f); toast(errorText(e).text); },
    });
  };

  const options = (list: CatalogEntry[]) => list.map((x) => <option key={x.name} value={x.name}>{x.name}</option>);
  return (
    <Dialog open title={editing ? L.titleEdit : L.titleNew} wide onClose={onClose} onSubmit={submit} submitLabel={editing ? L.submitEdit : L.submitNew} busy={add.isPending}>
      <details className="fbar" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>
          <Swatch hex={swatch} large />
          <span className="fb-t"><b>{M.name && C.name ? `${M.name} ${C.name}` : L.chooseFilament}</b><small>{B.name || es.common.noBrand}</small></span>
          <span className="fb-c"><Icon name="edit" size={14} /><span className="fb-co">{es.common.change}</span><span className="fb-cc">{es.common.close}</span></span>
        </summary>
        <div className="fb-b">
          <p className="hint">{L.pickHint}</p>
          <div className="grid3">
            <Field label={L.material} error={err('filament')}>
              <select name="material" value={material} onChange={(e) => setMaterial(e.target.value)}><option value="">{es.common.choose}</option>{options(catalog.material)}<option value={OTHER}>{L.otherMaterial}</option></select>
              <input name="material_n" placeholder={L.materialPlaceholder} aria-label={L.newMaterialLabel} hidden={material !== OTHER} value={materialNew} onChange={(e) => setMaterialNew(e.target.value)} />
            </Field>
            <Field label={L.color}>
              <select name="color" value={color} onChange={(e) => setColor(e.target.value)}><option value="">{es.common.choose}</option>{options(catalog.color)}<option value={OTHER}>{L.otherColor}</option></select>
              <span className="newc" hidden={color !== OTHER}><input name="color_n" placeholder={L.colorPlaceholder} aria-label={L.newColorLabel} value={colorNew} onChange={(e) => setColorNew(e.target.value)} /><input name="hex" type="color" value={hex} aria-label={L.colorOnScreen} hidden={Boolean(C.name && !C.isNew)} onChange={(e) => setHex(e.target.value)} /></span>
            </Field>
            <Field label={L.brand}>
              <select name="marca" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">{es.common.noBrand}</option>{options(catalog.brand)}<option value={OTHER}>{L.otherBrand}</option></select>
              <input name="marca_n" placeholder={L.brandPlaceholder} aria-label={L.newBrandLabel} hidden={brand !== OTHER} value={brandNew} onChange={(e) => setBrandNew(e.target.value)} />
            </Field>
          </div>
        </div>
      </details>
      <p className={`note${linkOk ? ' ok' : ''}`}>{link}</p>
      <div className="grid2">
        <Field label={L.cost} error={err('costCents')}><UnitInput unit="$" name="costo" inputMode="decimal" placeholder="350" value={cost} onChange={(e) => setCost(e.target.value)} autoFocus={Boolean(preset)} /></Field>
        <Field label={L.shipping} hint={L.shippingHint} error={err('shippingCents')}><UnitInput unit="$" name="envio" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} /></Field>
        <Field label={L.weight} error={err('grams')}><UnitInput unit="g" name="gramos" inputMode="numeric" value={weight} onChange={(e) => setWeight(e.target.value)} /></Field>
        <Field label={L.date} error={err('purchasedOn')}><input name="fecha" type="date" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
      </div>
      {editing ? <ConfirmButton variant="ghost" danger confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deleteSpool}</ConfirmButton> : null}
      <p className="note">{pay > 0 && g > 0 ? <Bold text={t('screens.spoolDialog.perGramPreview', { perGram: money2d(pay / g) })} bold={[money2d(pay / g)]} /> : L.perGramHint}</p>
    </Dialog>
  );
}
