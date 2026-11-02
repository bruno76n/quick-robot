import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { costProduct, floorPrice, nicePrice, suggestedPrice } from '@app/core';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Piece3D } from '../../components/Piece3D';
import { Note, StatusLine } from '../../components/Note';
import { Segmented } from '../../components/Segmented';
import { Tag, TagRow } from '../../components/Tag';
import { showUndo, useToast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { useTwoTap } from '../../components/useTwoTap';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { formatGrams, formatMoney, formatMoney0, formatNumber1 } from '../../lib/format';
import { numFromText, textFromNum } from '../../lib/numbers';
import { useCatalogue, useCostingContext, useInvalidate } from '../../lib/queries';
import { DEFAULT_TAGS } from '@app/core';
import { useFilaments } from '../filament/api';
import { SpoolDialog } from '../filament/SpoolDialog';
import { ANY_PRINTER, draftFromProduct, emptyDraft, forCosting, toInput, type Draft } from './draft';
import { QuoteDialog } from './QuoteDialog';
import { BigPrice, BreakdownBar, Fieldset, Kpis, Legend, MiniSummary, ResultActions, ResultCard, Shortcuts, type Segment } from './ResultParts';
import { costingFromDto } from './shared';

const t = es.editor;
const pct = (n: number) => `${formatNumber1(n)}%`;
const hm = (hours: number) => {
  const m = Math.round(hours * 60);
  return t.hm(Math.floor(m / 60), m % 60);
};

export function ProductEditor({ id, from }: { id?: string; from?: string }) {
  const catalogue = useCatalogue();
  const dto = useCostingContext().data;
  const filaments = useFilaments();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const toast = useToast((s) => s.show);
  const two = useTwoTap();
  const fileInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(false);
  const [spoolDialog, setSpoolDialog] = useState(false);
  const products = catalogue.data?.products;
  const current = id ? products?.find((p) => p.id === id) : undefined;
  const source = from ? products?.find((p) => p.id === from) : undefined;
  const parentId = current ? current.parentId : (source?.id ?? null);
  const parent = parentId ? products?.find((p) => p.id === parentId) : undefined;

  useEffect(() => {
    if (draft || !products || !dto) return;
    if (id && current) setDraft(draftFromProduct(current));
    else if (from && source) setDraft({ ...draftFromProduct(source), name: source.name + t.variantSuffix });
    else if (!id && !from) setDraft(emptyDraft(dto.printers[0]?.id));
  }, [draft, products, dto, id, from, current, source]);

  const ctx = useMemo(() => (dto ? costingFromDto(dto) : null), [dto]);
  if (!draft || !ctx || !dto) return <p className="text-ink-2">{catalogue.error ? errorText(catalogue.error) : es.app.loading}</p>;

  const d = draft;
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });
  const k = costProduct(forCosting(d), ctx);
  const price = k.listPrice;
  const tot = k.total;
  const gain = price - tot;
  const s = dto.settings;
  const seg: Segment[] = [
    { label: t.segments.M, value: k.M, color: 'var(--c-m)' },
    { label: t.segments.L, value: k.L, color: 'var(--c-l)' },
    { label: t.segments.Q, value: k.Q, color: 'var(--c-q)' },
    { label: t.segments.E, value: k.E, color: 'var(--c-e)' },
    { label: t.segments.F, value: k.F, color: 'var(--c-f)' },
  ];
  const floor = floorPrice(tot, s.minMarginPct);
  const status: [tone: 'good' | 'warn' | 'bad' | 'info', text: string] =
    price <= 0 ? ['info', t.statusNoPrice] : price < tot ? ['bad', t.statusLoss(formatMoney(tot - price))] : price < floor ? ['warn', t.statusFloor(formatMoney0(floor))] : ['good', t.statusGood(formatMoney0(gain), formatNumber1(price / tot))];
  const mg = Math.min(95, k.marginPct);
  const hours = forCosting(d).hours;
  const gramsTotal = d.filaments.reduce((a, f) => a + numFromText(f.grams), 0);
  const plate = Math.max(1, Math.round(numFromText(d.batch, 1)) || 1);
  const filamentById = new Map(dto.filaments.map((f) => [f.id, f]));
  const supplyById = new Map(dto.supplies.map((x) => [x.id, x]));
  const hexes = d.filaments.map((f) => filamentById.get(f.filamentId)?.hex).filter((h): h is string => !!h);

  const validate = (): string | null => {
    if (!d.name.trim()) return t.errors.name;
    if (!d.filaments.some((f) => f.filamentId && numFromText(f.grams) > 0)) return d.filaments.some((f) => numFromText(f.grams) > 0) ? t.errors.filament : t.errors.grams;
    if (d.mode === 'value' && price <= 0) return t.errors.price;
    return null;
  };
  const done = async (message: string) => {
    await invalidate('products');
    toast(message);
    void navigate({ to: '/productos' });
  };
  const save = async (asVariant = false) => {
    const err = validate();
    if (err) return toast(err);
    setBusy(true);
    try {
      if (asVariant && current) {
        const name = d.name.trim() === current.name.trim() ? d.name + t.variantSuffix : d.name;
        await api.products.saveVariant(current.id, toInput({ ...d, name }, current.id));
        await done(t.variantSaved);
      } else if (current) {
        await api.products.update(current.id, toInput(d, current.parentId));
        await done(t.saved);
      } else if (source) {
        await api.products.saveVariant(source.id, toInput(d, source.id));
        await done(t.variantSaved);
      } else {
        await api.products.create(toInput(d, null));
        await done(t.saved);
      }
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    two.tap(async () => {
      if (!current) return;
      try {
        await api.products.remove(current.id);
        await invalidate('products');
        void navigate({ to: '/productos' });
        showUndo(current.collections.length ? t.deletedInCollections(current.collections.length) : t.deleted, es.app.undo, () => api.products.restore(current.id), () => void invalidate('products'));
      } catch (e) {
        toast(errorText(e));
      }
    });
  const upload = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await api.files.uploadImage(file);
      set({ photoFileId: r.id, photoUrl: r.url });
      toast(t.photo.uploaded);
    } catch (e) {
      toast(errorText(e));
    }
  };
  const copySpec = async () => {
    const lines = [t.specText.title(d.name || t.specText.piece)];
    for (const [key, [label, unit]] of Object.entries(t.specText.lines) as unknown as [keyof typeof t.specText.lines, readonly [string, string]][]) {
      const v = d.spec[key];
      if (v) lines.push(`${label}: ${v}${unit}`);
    }
    await navigator.clipboard?.writeText(lines.join('\n')).catch(() => undefined);
    toast(t.specCopied);
  };
  const setFilament = (i: number, patch: Partial<Draft['filaments'][number]>) => set({ filaments: d.filaments.map((f, j) => (j === i ? { ...f, ...patch } : f)) });
  const setSupply = (i: number, patch: Partial<Draft['supplies'][number]>) => set({ supplies: d.supplies.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const pickFilament = (fid: string) => {
    const i = d.filaments.findIndex((f) => !f.filamentId);
    if (i >= 0) setFilament(i, { filamentId: fid });
    else if (!d.filaments.some((f) => f.filamentId === fid)) set({ filaments: [...d.filaments, { filamentId: fid, grams: '' }] });
  };
  const switchMode = (mode: Draft['mode']) => set(mode === 'value' && d.mode === 'formula' && !d.price ? { mode, price: String(price) } : { mode });

  const refs = [
    { value: Math.ceil(floor), big: formatMoney0(Math.ceil(floor)), small: `${t.refs.floor} · ${t.refs.floorDetail(s.minMarginPct)}` },
    { value: Math.ceil(suggestedPrice(tot, mg)), big: formatMoney0(Math.ceil(suggestedPrice(tot, mg))), small: `${t.refs.formula} · ${t.refs.formulaDetail(mg)}` },
    { value: nicePrice(tot * 3), big: formatMoney0(nicePrice(tot * 3)), small: t.refs.x3 },
    { value: nicePrice(tot * 5), big: formatMoney0(nicePrice(tot * 5)), small: t.refs.x5 },
    { value: nicePrice(tot * 10), big: formatMoney0(nicePrice(tot * 10)), small: t.refs.x10 },
  ];
  let variantNote: React.ReactNode = null;
  if (parent && d.mode === 'value') {
    const dc = tot - parent.costing.total;
    const same = Math.abs(dc) < 0.005;
    const v = t.variantNote(
      parent.name,
      same ? t.costSame : dc > 0 ? t.costUp(formatMoney(Math.abs(dc))) : t.costDown(formatMoney(Math.abs(dc))),
      price === parent.costing.listPrice ? t.priceSame : t.priceChanges(formatMoney0(price)),
      same ? t.profitSame : dc > 0 ? t.profitLess(formatMoney(Math.abs(dc))) : t.profitMore(formatMoney(Math.abs(dc))),
    );
    variantNote = (
      <Note>
        {v.a}
        <b>{v.parent}</b>
        {v.b}
      </Note>
    );
  }
  const crumb = current ? t.crumbs.editPiece : t.crumbs.newPiece;
  const ids = (x: string) => `ed-${x}`;

  return (
    <>
      <nav className="mb-[14px] flex gap-2 text-[13.5px] text-ink-3">
        <Link to="/productos" className="text-ink-2">
          {t.crumbs.products}
        </Link>
        <span>/</span>
        <span>{crumb}</span>
      </nav>
      {parent && !current && (
        <p className="mb-4 max-w-[70ch] rounded-[10px] bg-panel px-[14px] py-[10px] text-ink">
          {t.variantBanner(parent.name).a}
          <b>{parent.name}</b>
          {t.variantBanner(parent.name).b}
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_392px] items-start gap-8 max-[1260px]:grid-cols-1">
        <div className="grid min-w-0 gap-[22px]">
          <label className="grid" htmlFor={ids('name')}>
            <span className="sr-only">{t.name}</span>
            <input
              id={ids('name')}
              value={d.name}
              placeholder={t.namePh}
              onChange={(e) => set({ name: e.target.value })}
              className="rounded-none border-0 border-b-2 border-line-2 bg-transparent px-0 pb-2 pt-1 text-[26px] font-semibold tracking-[-0.02em] focus-visible:border-ink focus-visible:outline-none"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <div className={`stage m-0 h-[100px] w-[132px] flex-none rounded-[16px] ${d.photoUrl ? 'has-img' : ''}`}>
              {d.photoUrl ? <img src={d.photoUrl} alt="" className="h-full w-full object-cover" /> : <Piece3D hexes={hexes} id={current?.id ?? 'new'} />}
            </div>
            <div className="grid min-w-0 flex-[1_1_220px] gap-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => fileInput.current?.click()}>
                  <Icon name="plus" size={14} />
                  {t.photo.upload}
                </Button>
                <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} />
                {d.photoUrl && (
                  <Button variant="ghost" size="sm" onClick={() => set({ photoFileId: null, photoUrl: null })}>
                    {t.photo.remove}
                  </Button>
                )}
              </div>
              <small className="max-w-[48ch]">{d.photoUrl ? t.photo.uploaded : t.photo.none}</small>
            </div>
          </div>

          <Fieldset legend={t.printing}>
            <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
              <Field label={t.printer} help={t.printerHelp} htmlFor={ids('printer')}>
                <select id={ids('printer')} value={d.printerId} onChange={(e) => set({ printerId: e.target.value })}>
                  {dto.printers.length === 0 && <option value="">{t.noPrinter}</option>}
                  {dto.printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {dto.printers.length > 1 && <option value={ANY_PRINTER}>{t.anyPrinter}</option>}
                </select>
              </Field>
              <Field label={t.time} htmlFor={ids('h')}>
                <div className="grid grid-cols-2 gap-2">
                  <UnitInput id={ids('h')} aria-label={t.hours} unit={es.units.hours} inputMode="numeric" placeholder="0" value={d.hours} onChange={(e) => set({ hours: e.target.value })} />
                  <UnitInput aria-label={t.minutes} unit={es.units.minutes} inputMode="numeric" placeholder="0" value={d.minutes} onChange={(e) => set({ minutes: e.target.value })} />
                </div>
              </Field>
            </div>
          </Fieldset>

          <Fieldset legend={t.filaments}>
            <div>
              {d.filaments.map((f, i) => {
                const x = filamentById.get(f.filamentId);
                const g = numFromText(f.grams);
                return (
                  <div key={i} className="mb-[10px] grid grid-cols-[auto_minmax(0,1fr)_128px_76px_auto] items-center gap-x-[10px] gap-y-2 max-[560px]:grid-cols-[auto_minmax(0,1fr)_100px_auto]" data-testid="filament-line">
                    <span className="sw" style={{ background: x?.hex ?? '#ccc', width: 22, height: 22 }} />
                    <select aria-label={t.filament} value={f.filamentId} onChange={(e) => setFilament(i, { filamentId: e.target.value })}>
                      {!x && <option value="">{t.chooseFilament}</option>}
                      {[...dto.filaments]
                        .sort((a, b) => a.material.localeCompare(b.material, 'es') || a.color.localeCompare(b.color, 'es'))
                        .map((y) => (
                          <option key={y.id} value={y.id}>
                            {y.material} {y.color}
                          </option>
                        ))}
                    </select>
                    <UnitInput aria-label={t.grams} unit={es.units.grams} inputMode="decimal" placeholder="0" value={f.grams} onChange={(e) => setFilament(i, { grams: e.target.value })} />
                    <b className="num text-right max-[560px]:hidden">{formatMoney(g * (x?.costPerGram ?? 0))}</b>
                    <Button variant="ghost" size="icon" aria-label={t.removeFilament} disabled={d.filaments.length < 2} onClick={() => set({ filaments: d.filaments.filter((_, j) => j !== i) })}>
                      <Icon name="x" size={16} />
                    </Button>
                    {x && <small className={`col-start-2 col-end-[-1] -mt-1 ${g > x.remainingGrams ? 'font-semibold text-red-ink' : ''}`}>{g > x.remainingGrams ? t.insufficient(formatGrams(x.remainingGrams)) : t.available(formatGrams(x.remainingGrams), x.activeSpoolCount, formatMoney(x.costPerGram))}</small>}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => set({ filaments: [...d.filaments, { filamentId: '', grams: '' }] })}>
                <Icon name="plus" size={14} />
                {t.addFilament}
              </Button>
              <Button variant="ghost" size="sm" title={t.addSpoolOtherTitle} onClick={() => setSpoolDialog(true)}>
                {t.addSpoolOther}
              </Button>
            </div>
            <p className="max-w-[64ch] text-[13px] text-ink-3">{t.filamentsHint}</p>
          </Fieldset>

          <Fieldset legend={t.supplies}>
            {dto.supplies.length === 0 ? (
              <p className="text-[13px] text-ink-3">
                {t.noSupplies.a}
                <Link to="/insumos">{t.noSupplies.link}</Link>
                {t.noSupplies.b}
              </p>
            ) : (
              <>
                {d.supplies.length === 0 && <p className="text-[13px] text-ink-3">{t.noSuppliesInPiece}</p>}
                {d.supplies.map((r, i) => {
                  const x = supplyById.get(r.supplyId);
                  return (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_150px_84px_auto] items-center gap-x-[10px] max-[700px]:grid-cols-[minmax(0,1fr)_118px_auto]">
                      <select aria-label={t.supplies} value={r.supplyId} onChange={(e) => setSupply(i, { supplyId: e.target.value, qty: e.target.value && !numFromText(r.qty) ? '1' : r.qty })}>
                        <option value="">{t.chooseSupply}</option>
                        {dto.supplies.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <UnitInput aria-label={t.supplyQty} unit={x?.unit ?? es.units.piece} inputMode="decimal" placeholder="1" value={r.qty} onChange={(e) => setSupply(i, { qty: e.target.value })} />
                      <b className="num text-right max-[700px]:hidden">{x ? formatMoney(numFromText(r.qty) * x.cost) : ''}</b>
                      <Button variant="ghost" size="icon" aria-label={t.removeSupply} onClick={() => set({ supplies: d.supplies.filter((_, j) => j !== i) })}>
                        <Icon name="x" size={16} />
                      </Button>
                    </div>
                  );
                })}
                <div>
                  <Button size="sm" onClick={() => set({ supplies: [...d.supplies, { supplyId: '', qty: '1' }] })}>
                    <Icon name="plus" size={14} />
                    {t.addSupply}
                  </Button>
                </div>
              </>
            )}
            <p className="text-[13px] text-ink-3">{t.suppliesHint}</p>
          </Fieldset>

          <Fieldset legend={t.plate}>
            <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
              <Field label={t.batch} help={t.batchHelp} htmlFor={ids('batch')}>
                <input id={ids('batch')} inputMode="numeric" value={d.batch} onChange={(e) => set({ batch: e.target.value })} />
              </Field>
              <Field label={t.extras} help={t.extrasHelp} htmlFor={ids('extras')}>
                <UnitInput id={ids('extras')} unit={es.units.money} inputMode="decimal" placeholder="0" value={d.extras} onChange={(e) => set({ extras: e.target.value })} />
              </Field>
            </div>
          </Fieldset>

          <Fieldset legend={t.listPrice}>
            <Segmented label={t.priceMode} value={d.mode} onChange={switchMode} options={[{ value: 'value', label: t.modeValue }, { value: 'formula', label: t.modeFormula }]} />
            {d.mode === 'formula' && (
              <div className="grid grid-cols-3 gap-[14px] max-[560px]:grid-cols-1">
                <Field label={t.margin} help={t.marginHelp} htmlFor={ids('margin')}>
                  <UnitInput id={ids('margin')} unit={es.units.pct} inputMode="decimal" value={d.margin === '' ? textFromNum(k.marginPct) : d.margin} onChange={(e) => set({ margin: e.target.value })} />
                </Field>
              </div>
            )}
            <p className="text-[13px] text-ink-3">
              {d.mode === 'value' ? t.modeHintValue : t.modeHintFormula}
              {t.modeHintEnd}
            </p>
            <TagRow label={t.tagsLabel}>
              {DEFAULT_TAGS.map((tag) => (
                <Tag key={tag} on={d.tags.includes(tag)} onClick={() => set({ tags: d.tags.includes(tag) ? d.tags.filter((x) => x !== tag) : [...d.tags, tag] })}>
                  {tag}
                </Tag>
              ))}
            </TagRow>
            <Field label={t.notes} htmlFor={ids('note')}>
              <textarea id={ids('note')} rows={2} placeholder={t.notesPh} value={d.note} onChange={(e) => set({ note: e.target.value })} />
            </Field>
          </Fieldset>

          <Fieldset legend={t.spec}>
            <p className="text-[13px] text-ink-3">{t.specHint}</p>
            <div className="grid grid-cols-3 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
              <Field label={t.specFields.layer} htmlFor={ids('layer')}>
                <UnitInput id={ids('layer')} unit={t.specUnits.layer} inputMode="decimal" placeholder="0.20" value={d.spec.layer ?? ''} onChange={(e) => set({ spec: { ...d.spec, layer: e.target.value } })} />
              </Field>
              <Field label={t.specFields.infill} htmlFor={ids('infill')}>
                <UnitInput id={ids('infill')} unit={t.specUnits.infill} inputMode="decimal" placeholder="15" value={d.spec.infill ?? ''} onChange={(e) => set({ spec: { ...d.spec, infill: e.target.value } })} />
              </Field>
              <Field label={t.specFields.walls} htmlFor={ids('walls')}>
                <input id={ids('walls')} inputMode="numeric" placeholder="3" value={d.spec.walls ?? ''} onChange={(e) => set({ spec: { ...d.spec, walls: e.target.value } })} />
              </Field>
              <Field label={t.specFields.supports} htmlFor={ids('supports')}>
                <select id={ids('supports')} value={d.spec.supports ?? ''} onChange={(e) => set({ spec: { ...d.spec, supports: e.target.value } })}>
                  {t.supportOptions.map((o) => (
                    <option key={o} value={o}>
                      {o || es.app.dash}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t.specFields.nozzle} htmlFor={ids('nozzle')}>
                <UnitInput id={ids('nozzle')} unit={t.specUnits.nozzle} inputMode="numeric" placeholder="215" value={d.spec.nozzle ?? ''} onChange={(e) => set({ spec: { ...d.spec, nozzle: e.target.value } })} />
              </Field>
              <Field label={t.specFields.bed} htmlFor={ids('bed')}>
                <UnitInput id={ids('bed')} unit={t.specUnits.bed} inputMode="numeric" placeholder="60" value={d.spec.bed ?? ''} onChange={(e) => set({ spec: { ...d.spec, bed: e.target.value } })} />
              </Field>
            </div>
            <Field label={t.specFields.file} help={t.specFields.fileHelp} htmlFor={ids('file')}>
              <input id={ids('file')} placeholder="~/Modelos/llavero.3mf" value={d.spec.file ?? ''} onChange={(e) => set({ spec: { ...d.spec, file: e.target.value } })} />
            </Field>
            <Field label={t.specFields.note} htmlFor={ids('specnote')}>
              <textarea id={ids('specnote')} rows={2} placeholder={t.specFields.notePh} value={d.spec.note ?? ''} onChange={(e) => set({ spec: { ...d.spec, note: e.target.value } })} />
            </Field>
            <div>
              <Button size="sm" onClick={() => void copySpec()}>
                {t.copySpec}
              </Button>
            </div>
          </Fieldset>

          <Fieldset legend={t.stock}>
            <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-start gap-x-[10px] gap-y-[2px]">
              <input type="checkbox" className="mt-[2px] h-[18px] min-h-0 w-[18px] p-0 accent-[var(--ink)]" checked={d.tracksStock} onChange={(e) => set({ tracksStock: e.target.checked })} />
              <span className="font-semibold">{t.tracksStock}</span>
              <small className="col-start-2 leading-[1.35]">{t.tracksStockHelp}</small>
            </label>
          </Fieldset>
          <MiniSummary
            items={[
              { label: t.cost, value: formatMoney(tot) },
              { label: t.listPrice, value: formatMoney0(price) },
              { label: t.profit, value: price > 0 ? formatMoney0(gain) : es.app.dash, tone: gain >= 0 ? 'pos' : 'neg' },
            ]}
          />
        </div>

        <ResultCard label={t.result}>
          <div className="grid grid-cols-[auto_1fr] items-end gap-4">
            <div>
              <span className="text-[13px] font-semibold text-ink-2">{t.cost}</span>
              <b className="num block text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]" data-testid="calc-cost">
                {formatMoney(tot)}
              </b>
            </div>
            <BigPrice id={ids('price')} label={t.listPrice} value={d.mode === 'formula' ? String(price) : d.price} placeholder="0" disabled={d.mode === 'formula'} onChange={(v) => set({ price: v })} />
          </div>
          <BreakdownBar segments={seg} price={price} cost={tot} label={t.breakdown} />
          <Kpis
            items={[
              { label: t.profit, value: price > 0 ? formatMoney0(gain) : es.app.dash, tone: gain >= 0 ? 'pos' : 'neg' },
              { label: t.marginKpi, value: price > 0 ? pct((gain / price) * 100) : es.app.dash },
              { label: t.timesCost, value: price > 0 && tot > 0 ? `${es.units.times}${formatNumber1(price / tot)}` : es.app.dash },
            ]}
          />
          <StatusLine tone={status[0]}>{status[1]}</StatusLine>
          {variantNote}
          {k.technical && d.mode === 'value' && (
            <Note tone="warn">
              {t.technicalNote}{' '}
              <Button variant="link" onClick={() => switchMode('formula')}>
                {t.useFormula}
              </Button>
            </Note>
          )}
          {current && current.collections.length > 0 && (
            <Note>
              {t.inCollections(current.collections.length)}
              {current.collections.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && ', '}
                  <Link to="/productos/coleccion/$id" params={{ id: c.id }}>
                    {c.name}
                  </Link>
                </span>
              ))}
              {t.inCollectionsEnd}
            </Note>
          )}
          <Legend segments={seg} price={price} cost={tot} totalLabel={t.totalCost} />
          {d.mode === 'value' ? (
            <>
              <Shortcuts items={refs} onPick={(v) => set({ price: String(v), mode: 'value' })} />
              <p className="text-[13px] text-ink-3">{t.shortcutsHint}</p>
            </>
          ) : (
            <Note>{t.formulaNote(mg)}</Note>
          )}
          <div>
            <h3>{t.byQty}</h3>
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] font-medium text-ink-2">
                  <th className="border-b border-line-2 px-[10px] py-2">{t.qtyCols.pieces}</th>
                  <th className="border-b border-line-2 px-[10px] py-2 text-right">{t.qtyCols.plates}</th>
                  <th className="border-b border-line-2 px-[10px] py-2 text-right">{t.qtyCols.printing}</th>
                  <th className="border-b border-line-2 px-[10px] py-2 text-right">{t.qtyCols.filament}</th>
                  <th className="border-b border-line-2 px-[10px] py-2 text-right">{t.qtyCols.cost}</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 5, 10, 25, 50].map((n) => (
                  <tr key={n}>
                    <td className="border-b border-line px-[10px] py-[7px]">{n}</td>
                    <td className="num border-b border-line px-[10px] py-[7px] text-right">{Math.ceil(n / plate)}</td>
                    <td className="num whitespace-nowrap border-b border-line px-[10px] py-[7px] text-right">{hm(hours * n)}</td>
                    <td className="num border-b border-line px-[10px] py-[7px] text-right">{formatGrams(gramsTotal * n)}</td>
                    <td className="num border-b border-line px-[10px] py-[7px] text-right">{formatMoney(tot * n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[13px] text-ink-3">{t.qtyHint(formatMoney(tot))}</p>
          </div>
          {dto.printers.length > 1 && (
            <div>
              <h3>{t.otherPrinters}</h3>
              <table className="w-full border-collapse text-[14px]">
                <tbody>
                  {[...(d.printerId === ANY_PRINTER ? [ANY_PRINTER] : []), ...dto.printers.map((p) => p.id)].map((pid) => {
                    const c = costProduct(forCosting(d, pid), ctx).total;
                    const ref = d.printerId === pid;
                    return (
                      <tr key={pid}>
                        <td className="border-b border-line px-[10px] py-[7px]">
                          {pid === ANY_PRINTER ? t.averagePrinters : dto.printers.find((p) => p.id === pid)?.name} {ref && <small>{t.reference}</small>}
                        </td>
                        <td className="num border-b border-line px-[10px] py-[7px] text-right">{formatMoney(c)}</td>
                        <td className="num border-b border-line px-[10px] py-[7px] text-right text-ink-3">{ref ? '' : `${c >= tot ? '+' : '−'}${formatMoney(Math.abs(c - tot))}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[13px] text-ink-3">{t.otherPrintersHint}</p>
            </div>
          )}
          <ResultActions>
            <Button variant="primary" block disabled={busy} onClick={() => void save()}>
              {current ? t.saveChanges : t.saveNew}
            </Button>
            {current && (
              <Button block disabled={busy} onClick={() => void save(true)}>
                {t.saveVariant}
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button block onClick={() => setQuote(true)} className={current ? '' : 'col-span-2'}>
                {t.quote}
              </Button>
              {current && (
                <Button block disabled title={es.app.nextPhase}>
                  {t.registerSale}
                </Button>
              )}
            </div>
            {current ? (
              <Button variant="ghost" block className="text-red-ink" onClick={remove}>
                {two.armed ? es.app.confirmDelete : t.deletePiece}
              </Button>
            ) : (
              <Button variant="ghost" block onClick={() => void navigate({ to: '/productos' })}>
                {t.discard}
              </Button>
            )}
          </ResultActions>
        </ResultCard>
      </div>
      {quote && <QuoteDialog name={d.name} price={price} colors={d.filaments.map((f) => filamentById.get(f.filamentId)?.color).filter((c): c is string => !!c)} attends={dto.businessName} onClose={() => setQuote(false)} />}
      <SpoolDialog open={spoolDialog} onOpenChange={setSpoolDialog} filaments={filaments.data?.items ?? []} onAdded={(fid) => (void invalidate('spools'), pickFilament(fid))} />
    </>
  );
}
