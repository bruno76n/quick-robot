import { useEffect, useId, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { AddSpoolInput, type Filament, type Spool } from '@app/contract';
import { canonicalName, DEFAULT_BRANDS, DEFAULT_COLORS, DEFAULT_MATERIALS, filamentKey, findColorHex, spoolCostPerGram, toCents } from '@app/core';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useCatalog, useInvalidate } from '../../lib/queries';
import { textFromCents, textFromNum } from '../../lib/numbers';
import { useTwoTap } from '../../components/useTwoTap';
import { showUndo } from '../../components/Toast';
import { filamentKeys } from './api';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { UnitInput } from '../../components/UnitInput';
import { useToast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { errorText } from '../../lib/error-text';
import { formatGrams, formatMoney, parseAmount, todayIso } from '../../lib/format';
import { useAddSpool } from './api';
import { filamentName } from './names';

const t = es.filament.dialog;
const NEUTRAL_SWATCH = '#d2d2da';

interface FormValues {
  material: string;
  color: string;
  hex: string;
  brand: string;
  cost: string;
  shipping: string;
  grams: string;
  purchasedOn: string;
}
type FieldErrors = Partial<Record<'filament' | 'cost' | 'grams' | 'purchasedOn' | 'server', string>>;

const uniq = (xs: string[]) => [...new Map(xs.filter(Boolean).map((x) => [x.toLowerCase(), x])).values()];

function Note({ tone = 'plain', children }: { tone?: 'plain' | 'ok'; children: React.ReactNode }) {
  return <p className={tone === 'ok' ? 'rounded-card bg-green-soft px-[14px] py-[11px] text-[13.5px] text-green-ink' : 'rounded-card bg-panel px-[14px] py-[11px] text-[13.5px] text-ink-2'}>{children}</p>;
}

export function SpoolDialog({
  open,
  onOpenChange,
  filaments,
  filamentId,
  spool,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filaments: readonly Filament[];
  /** Pre-selected filament ("Agregar rollo de PLA Negro"): the picker bar stays closed. */
  filamentId?: string;
  /** Edit this spool (of `filamentId`). */
  spool?: Spool;
  onAdded: (filamentId: string) => void;
}) {
  const catalog = useCatalog();
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  const two = useTwoTap();
  const ids = useId();
  const toast = useToast((s) => s.show);
  const addSpool = useAddSpool();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [barOpen, setBarOpen] = useState(true);
  const preset = filaments.find((f) => f.id === filamentId);

  const cat = catalog.data;
  const lists = useMemo(
    () => ({
      materials: uniq([...(cat?.materials ?? DEFAULT_MATERIALS), ...filaments.map((f) => f.material)]),
      colors: [...(cat?.colors ?? DEFAULT_COLORS), ...filaments.map((f) => ({ name: f.color, hex: f.hex }))],
      brands: uniq([...(cat?.brands ?? DEFAULT_BRANDS), ...filaments.flatMap((f) => f.brands)]),
    }),
    [filaments, cat],
  );
  const colorNames = useMemo(() => uniq(lists.colors.map((c) => c.name)), [lists]);

  const { register, handleSubmit, reset, control, setValue } = useForm<FormValues>();
  useEffect(() => {
    if (!open) return;
    reset(
      spool
        ? { material: preset?.material ?? '', color: preset?.color ?? '', hex: preset?.hex ?? '', brand: spool.brand, cost: textFromCents(spool.costCents), shipping: textFromCents(spool.shippingCents), grams: textFromNum(spool.grams), purchasedOn: spool.purchasedOn }
        : { material: preset?.material ?? '', color: preset?.color ?? '', hex: preset?.hex ?? '', brand: preset?.brands[0] ?? '', cost: '', shipping: '0', grams: '1000', purchasedOn: todayIso() },
    );
    setErrors({});
    setBarOpen(!preset);
    addSpool.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open, filamentId]);

  const v = useWatch({ control }) as Partial<FormValues>;
  const material = canonicalName(lists.materials, v.material ?? '');
  const color = canonicalName(colorNames, v.color ?? '', true);
  const knownHex = findColorHex(lists.colors, color.name);
  useEffect(() => {
    if (knownHex) setValue('hex', knownHex);
  }, [knownHex, setValue]);
  const hex = knownHex ?? (v.hex || (color.name ? '#9a9aa6' : NEUTRAL_SWATCH));
  const brand = (v.brand ?? '').trim();
  const grams = parseAmount(v.grams ?? '');
  const paid = parseAmount(v.cost ?? '') + (parseAmount(v.shipping ?? '') || 0);
  const chosen = material.name && color.name;
  const existing = chosen ? filaments.find((f) => filamentKey(f.material, f.color) === filamentKey(material.name, color.name)) : undefined;
  const chosenName = chosen ? `${existing?.material ?? material.name} ${existing?.color ?? color.name}` : '';

  let joinNote: React.ReactNode;
  if (!chosen) joinNote = <Note>{t.joinHelp}</Note>;
  else if (spool && existing && existing.id === filamentId) {
    const j = t.belongsTo(filamentName(existing));
    joinNote = (
      <Note tone="ok">
        {j.before}
        <b>{j.name}</b>
        {j.after}
      </Note>
    );
  } else if (existing && existing.activeSpoolCount > 0) {
    const j = t.joins(filamentName(existing), formatGrams(existing.remainingGrams), existing.activeSpoolCount, formatGrams(existing.remainingGrams + (grams > 0 ? grams : 0)));
    joinNote = (
      <Note tone="ok">
        {j.before}
        <b>{j.name}</b>
        {j.middle}
        <b>{j.total}</b>
        {j.after}
      </Note>
    );
  } else if (existing) {
    const j = t.joinsEmpty(filamentName(existing));
    joinNote = (
      <Note tone="ok">
        {j.before}
        <b>{j.name}</b>
        {j.after}
      </Note>
    );
  } else {
    const j = t.newFilament(`${material.name} ${color.name}`, material.isNew || color.isNew);
    joinNote = (
      <Note>
        {j.before}
        <b>{j.name}</b>
        {j.after}
      </Note>
    );
  }

  const onSubmit = handleSubmit(async (values) => {
    const errs: FieldErrors = {};
    const cost = parseAmount(values.cost);
    const shipping = parseAmount(values.shipping) || 0;
    const g = parseAmount(values.grams);
    if (!chosen) errs.filament = t.errors.chooseFilament;
    if (!(cost > 0)) errs.cost = t.errors.cost;
    if (!(g > 0)) errs.grams = t.errors.grams;
    if (!values.purchasedOn) errs.purchasedOn = t.errors.date;
    setErrors(errs);
    if (errs.filament) setBarOpen(true);
    if (Object.keys(errs).length) return;
    const input = {
      material: existing?.material ?? material.name,
      color: existing?.color ?? color.name,
      hex,
      brand: canonicalName(lists.brands, values.brand).name,
      costCents: toCents(cost),
      shippingCents: toCents(shipping),
      grams: Math.round(g * 10) / 10,
      purchasedOn: values.purchasedOn,
    };
    const parsed = AddSpoolInput.safeParse(input);
    if (!parsed.success) return setErrors({ server: es.errors.VALIDATION_FAILED });
    try {
      if (spool) {
        const result = await api.filaments.updateSpool(spool.id, input);
        qc.setQueryData(filamentKeys.detail(result.filament.id), result.filament);
        await invalidate('spools');
        toast(result.filament.id !== filamentId ? t.savedIn(filamentName(result.filament)) : t.saved);
        onOpenChange(false);
        onAdded(result.filament.id);
        return;
      }
      const result = await addSpool.mutateAsync(input);
      await invalidate('spools');
      toast(t.added(filamentName(result.filament), formatGrams(result.filament.remainingGrams)));
      onOpenChange(false);
      onAdded(result.filament.id);
    } catch (e) {
      setErrors({ server: errorText(e) });
    }
  });

  const perGram = paid > 0 && grams > 0 ? spoolCostPerGram({ cost: paid, shipping: 0, grams }) : 0;
  const preview = t.preview(formatMoney(perGram));
  const fid = (k: string) => `${ids}-${k}`;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={spool ? t.editTitle : t.title}
      wide
      onSubmit={(e) => void onSubmit(e)}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t.cancel}
          </Button>
          <Button variant="primary" type="submit" disabled={addSpool.isPending}>
            {addSpool.isPending ? t.saving : spool ? t.editSubmit : t.submit}
          </Button>
        </>
      }
    >
      <details open={barOpen} onToggle={(e) => setBarOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-[12px] border border-line-2 bg-bg" data-testid="filament-picker">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-[12px] px-3 py-[10px] hover:bg-panel [&::-webkit-details-marker]:hidden [details[open]>&]:rounded-b-none [details[open]>&]:border-b [details[open]>&]:border-line">
          <span className="sw" style={{ background: chosen ? hex : NEUTRAL_SWATCH, width: 22, height: 22 }} />
          <span className="grid min-w-0 flex-1 leading-[1.25]">
            <b className="truncate text-[16px]">{chosenName || t.choose}</b>
            <small>{brand || es.filament.noBrand}</small>
          </span>
          <span className="inline-flex flex-none items-center gap-[6px] text-[13.5px] font-semibold text-ink-2">
            <Icon name="edit" size={14} />
            {barOpen ? t.close : t.change}
          </span>
        </summary>
        <div className="grid gap-[10px] px-3 pb-[14px] pt-3">
          <p className="max-w-[64ch] text-[13px] text-ink-3">{t.barHint}</p>
          <div className="grid grid-cols-3 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
            <Field label={t.material} htmlFor={fid('material')}>
              <input id={fid('material')} list={fid('materials')} placeholder={t.choosePlaceholder} data-autofocus={preset ? undefined : ''} {...register('material')} />
              <datalist id={fid('materials')}>
                {lists.materials.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label={t.color} htmlFor={fid('color')}>
              <div className={color.isNew && !knownHex ? 'grid grid-cols-[minmax(0,1fr)_auto] gap-[6px]' : 'grid'}>
                <input id={fid('color')} list={fid('colors')} placeholder={t.choosePlaceholder} {...register('color')} />
                {color.isNew && !knownHex && <input type="color" aria-label={t.colorSwatch} className="w-[46px]" {...register('hex')} />}
              </div>
              <datalist id={fid('colors')}>
                {colorNames.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label={t.brand} htmlFor={fid('brand')}>
              <input id={fid('brand')} list={fid('brands')} placeholder={es.filament.noBrand} {...register('brand')} />
              <datalist id={fid('brands')}>
                {lists.brands.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
          </div>
        </div>
      </details>
      {errors.filament && !chosen ? (
        <p role="alert" className="rounded-card bg-red-soft px-[14px] py-[11px] text-[13.5px] text-red-ink">
          {errors.filament}
        </p>
      ) : (
        joinNote
      )}
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={t.cost} htmlFor={fid('cost')} error={errors.cost}>
          <UnitInput id={fid('cost')} data-autofocus={preset ? '' : undefined} unit={es.units.money} inputMode="decimal" placeholder={t.costPlaceholder} aria-invalid={!!errors.cost} {...register('cost')} />
        </Field>
        <Field label={t.shipping} htmlFor={fid('shipping')} help={t.shippingHelp}>
          <UnitInput id={fid('shipping')} unit={es.units.money} inputMode="decimal" {...register('shipping')} />
        </Field>
        <Field label={t.grams} htmlFor={fid('grams')} error={errors.grams}>
          <UnitInput id={fid('grams')} unit={es.units.grams} inputMode="numeric" aria-invalid={!!errors.grams} {...register('grams')} />
        </Field>
        <Field label={t.purchasedOn} htmlFor={fid('date')} error={errors.purchasedOn}>
          <input id={fid('date')} type="date" {...register('purchasedOn')} />
        </Field>
      </div>
      <Note>
        {perGram > 0 ? (
          <>
            {preview.before}
            <b>{preview.value}</b>
            {preview.after}
          </>
        ) : (
          t.previewEmpty
        )}
      </Note>
      {errors.server && (
        <p role="alert" className="rounded-card bg-red-soft px-[14px] py-[11px] text-[13.5px] text-red-ink">
          {errors.server}
        </p>
      )}
      {spool && (
        <div className="border-t border-line pt-[14px]">
          <Button
            variant="ghost"
            size="sm"
            className="text-red-ink"
            onClick={() =>
              two.tap(async () => {
                try {
                  const r = await api.filaments.deleteSpool(spool.id);
                  await invalidate('spools');
                  onOpenChange(false);
                  showUndo(t.deleted, es.app.undo, () => api.filaments.restoreSpool(spool.id), () => void invalidate('spools').then(() => qc.invalidateQueries({ queryKey: filamentKeys.detail(r.filamentId) })));
                } catch (e) {
                  setErrors({ server: errorText(e) });
                }
              })
            }
          >
            {two.armed ? es.app.confirmDelete : t.deleteSpool}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
