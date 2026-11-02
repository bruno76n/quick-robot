import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { Collection } from '@app/contract';
import { costCollection, costProduct, DEFAULT_TAGS, floorPrice, mergeParts, minutesToHours } from '@app/core';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Icon } from '../../components/Icon';
import { Note, StatusLine } from '../../components/Note';
import { Tag, TagRow } from '../../components/Tag';
import { showUndo, useToast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { useTwoTap } from '../../components/useTwoTap';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { formatMoney, formatMoney0, formatNumber1 } from '../../lib/format';
import { centsFromText, numFromText, textFromCents } from '../../lib/numbers';
import { useCatalogue, useCostingContext, useInvalidate } from '../../lib/queries';
import { BigPrice, BreakdownBar, Fieldset, Kpis, Legend, MiniSummary, ResultActions, ResultCard, Shortcuts, type Segment } from './ResultParts';
import { costingFromDto } from './shared';

const t = es.collection;
const ed = es.editor;
const pct = (n: number) => `${formatNumber1(n)}%`;
const round5 = (v: number) => (v >= 200 ? Math.round(v / 10) * 10 : Math.round(v / 5) * 5);

interface ColDraft {
  name: string;
  parts: { productId: string; qty: string }[];
  extras: string;
  price: string;
  tags: string[];
  note: string;
}

const fromCollection = (c: Collection): ColDraft => ({
  name: c.name,
  parts: c.parts.map((p) => ({ productId: p.productId, qty: String(p.qty) })),
  extras: c.extrasCents ? textFromCents(c.extrasCents) : '',
  price: c.priceCents ? textFromCents(c.priceCents) : '',
  tags: [...c.tags],
  note: c.note,
});

export function CollectionEditor({ id }: { id?: string }) {
  const catalogue = useCatalogue();
  const dto = useCostingContext().data;
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const toast = useToast((s) => s.show);
  const two = useTwoTap();
  const [draft, setDraft] = useState<ColDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const current = id ? catalogue.data?.collections.find((c) => c.id === id) : undefined;
  useEffect(() => {
    if (draft || !catalogue.data) return;
    if (id && current) setDraft(fromCollection(current));
    else if (!id) setDraft({ name: '', parts: [{ productId: '', qty: '1' }], extras: '', price: '', tags: [], note: '' });
  }, [draft, catalogue.data, id, current]);

  const ctx = useMemo(() => (dto ? costingFromDto(dto) : null), [dto]);
  if (!draft || !ctx || !catalogue.data || !dto) return <p className="text-ink-2">{catalogue.error ? errorText(catalogue.error) : es.app.loading}</p>;
  const products = catalogue.data.products;
  const d = draft;
  const set = (patch: Partial<ColDraft>) => setDraft({ ...d, ...patch });
  // Live preview with the same core functions as the server.
  const costed = Object.fromEntries(
    products.map((p) => {
      const c = costProduct(
        { mode: p.mode, price: p.priceCents / 100, marginPct: p.marginPct, printerId: p.printerId, hours: minutesToHours(p.printMinutes), extras: p.extrasCents / 100, filaments: p.filaments, supplies: p.supplies },
        ctx,
      );
      return [p.id, { listPrice: c.listPrice, total: c.total }];
    }),
  );
  const partsIn = d.parts.filter((r) => r.productId).map((r) => ({ productId: r.productId, qty: Math.max(1, Math.round(numFromText(r.qty, 1))) }));
  const priceIn = numFromText(d.price);
  const k = costCollection({ price: priceIn > 0 ? priceIn : null, extras: numFromText(d.extras), parts: partsIn }, costed, dto.settings.minMarginPct);
  const nameOf = (pid: string) => products.find((p) => p.id === pid)?.name ?? '';
  const seg: Segment[] = [
    ...k.parts.map((x) => ({ label: `${x.qty > 1 ? `${x.qty} ${es.units.times} ` : ''}${nameOf(x.productId)}`, value: x.qty * x.cost, color: 'var(--c-m)' })),
    ...(k.extras > 0 ? [{ label: t.box, value: k.extras, color: 'var(--c-t)' }] : []),
  ];
  const barSeg: Segment[] = [
    { label: t.segPieces, value: k.pieces, color: 'var(--c-m)' },
    { label: t.box, value: k.extras, color: 'var(--c-t)' },
  ];
  const floor = floorPrice(k.cost, dto.settings.minMarginPct);
  const status: ['good' | 'warn' | 'bad' | 'info', string] = !k.parts.length
    ? ['info', t.statusNoParts]
    : k.price <= 0
      ? ['info', t.statusNoPrice]
      : k.price < k.cost
        ? ['bad', t.statusLoss(formatMoney(k.cost - k.price))]
        : k.price < floor
          ? ['warn', ed.statusFloor(formatMoney0(floor))]
          : ['good', t.statusGood(formatMoney0(k.profit), formatNumber1(k.price / k.cost))];
  const dif = k.loose - k.price;
  const auto = !(priceIn > 0);
  const refs = [
    { value: 0, big: formatMoney0(k.loose), small: t.refs.same },
    ...[5, 10, 15].map((x) => {
      const v = Math.max(1, round5(k.loose * (1 - x / 100)));
      return { value: v, big: formatMoney0(v), small: `−${x}%` };
    }),
    { value: Math.ceil(floor), big: formatMoney0(Math.ceil(floor)), small: `${t.refs.floor} · ${ed.refs.floorDetail(dto.settings.minMarginPct)}` },
  ];
  const save = async () => {
    if (!d.name.trim()) return toast(t.errors.name);
    if (!partsIn.length) return toast(t.errors.parts);
    setBusy(true);
    const input = { name: d.name, priceCents: priceIn > 0 ? centsFromText(d.price) : null, extrasCents: Math.max(0, centsFromText(d.extras)), tags: d.tags, note: d.note, parts: mergeParts(partsIn) };
    try {
      if (current) await api.collections.update(current.id, input);
      else await api.collections.create(input);
      await invalidate('products');
      toast(t.saved);
      void navigate({ to: '/productos', search: { tab: 'colecciones' } });
    } catch (e) {
      toast(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    two.tap(async () => {
      if (!current) return;
      await api.collections.remove(current.id);
      await invalidate('products');
      void navigate({ to: '/productos', search: { tab: 'colecciones' } });
      showUndo(t.deleted, es.app.undo, () => api.collections.restore(current.id), () => void invalidate('products'));
    });
  const setPart = (i: number, patch: Partial<ColDraft['parts'][number]>) => set({ parts: d.parts.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const loose = t.looseSum(formatMoney0(k.loose));
  return (
    <>
      <nav className="mb-[14px] flex gap-2 text-[13.5px] text-ink-3">
        <Link to="/productos" className="text-ink-2">
          {ed.crumbs.products}
        </Link>
        <span>/</span>
        <Link to="/productos" search={{ tab: 'colecciones' }} className="text-ink-2">
          {ed.crumbs.collections}
        </Link>
        <span>/</span>
        <span>{current ? ed.crumbs.editCollection : ed.crumbs.newCollection}</span>
      </nav>
      <div className="grid grid-cols-[minmax(0,1fr)_392px] items-start gap-8 max-[1260px]:grid-cols-1">
        <div className="grid min-w-0 gap-[22px]">
          <label className="grid" htmlFor="c-name">
            <span className="sr-only">{ed.name}</span>
            <input
              id="c-name"
              value={d.name}
              placeholder={t.namePh}
              onChange={(e) => set({ name: e.target.value })}
              className="rounded-none border-0 border-b-2 border-line-2 bg-transparent px-0 pb-2 pt-1 text-[26px] font-semibold tracking-[-0.02em] focus-visible:border-ink focus-visible:outline-none"
            />
          </label>
          <Fieldset legend={t.parts}>
            <div>
              {d.parts.map((r, i) => {
                const p = products.find((x) => x.id === r.productId);
                const qty = Math.max(1, Math.round(numFromText(r.qty, 1)));
                return (
                  <div key={i} className="mb-[10px] grid grid-cols-[minmax(0,1fr)_118px_76px_auto] items-center gap-x-[10px] max-[560px]:grid-cols-[minmax(0,1fr)_96px_auto]">
                    <select aria-label={t.piece} value={r.productId} onChange={(e) => setPart(i, { productId: e.target.value })}>
                      <option value="">{t.choosePiece}</option>
                      {products.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                    <UnitInput aria-label={t.qtyInSet} unit={es.units.times} inputMode="numeric" value={r.qty} onChange={(e) => setPart(i, { qty: e.target.value })} />
                    <b className="num text-right max-[560px]:hidden">{p ? formatMoney0((costed[p.id]?.listPrice ?? 0) * qty) : ''}</b>
                    <Button variant="ghost" size="icon" aria-label={t.removePiece} disabled={d.parts.length < 2} onClick={() => set({ parts: d.parts.filter((_, j) => j !== i) })}>
                      <Icon name="x" size={16} />
                    </Button>
                  </div>
                );
              })}
            </div>
            <div>
              <Button size="sm" onClick={() => set({ parts: [...d.parts, { productId: '', qty: '1' }] })}>
                <Icon name="plus" size={14} />
                {t.addPiece}
              </Button>
            </div>
            <p className="text-[13px] text-ink-3">{t.partsHint}</p>
          </Fieldset>
          <Fieldset legend={t.box}>
            <div className="grid grid-cols-4 gap-[14px] max-[700px]:grid-cols-2">
              <Field label={t.extras} help={t.extrasHelp} htmlFor="c-extras">
                <UnitInput id="c-extras" unit={es.units.money} inputMode="decimal" placeholder="0" value={d.extras} onChange={(e) => set({ extras: e.target.value })} />
              </Field>
            </div>
          </Fieldset>
          <Fieldset legend={t.tagsNotes}>
            <TagRow label={t.tagsLabel}>
              {DEFAULT_TAGS.map((tag) => (
                <Tag key={tag} on={d.tags.includes(tag)} onClick={() => set({ tags: d.tags.includes(tag) ? d.tags.filter((x) => x !== tag) : [...d.tags, tag] })}>
                  {tag}
                </Tag>
              ))}
            </TagRow>
            <Field label={ed.notes} htmlFor="c-note">
              <textarea id="c-note" rows={2} placeholder={t.notesPh} value={d.note} onChange={(e) => set({ note: e.target.value })} />
            </Field>
          </Fieldset>
          <MiniSummary
            items={[
              { label: ed.cost, value: formatMoney(k.cost) },
              { label: t.setPrice, value: formatMoney0(k.price) },
              { label: ed.profit, value: k.price > 0 ? formatMoney0(k.profit) : es.app.dash, tone: k.profit >= 0 ? 'pos' : 'neg' },
            ]}
          />
        </div>
        <ResultCard label={ed.result}>
          <div className="grid grid-cols-[auto_1fr] items-end gap-4">
            <div>
              <span className="text-[13px] font-semibold text-ink-2">{t.setCost}</span>
              <b className="num block text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]" data-testid="set-cost">
                {formatMoney(k.cost)}
              </b>
            </div>
            <BigPrice id="c-price" label={t.setPrice} value={d.price} placeholder={String(Math.round(k.loose))} onChange={(v) => set({ price: v })} />
          </div>
          <BreakdownBar segments={barSeg} price={k.price} cost={k.cost} label={t.breakdown} />
          <Kpis
            items={[
              { label: ed.profit, value: k.price > 0 ? formatMoney0(k.profit) : es.app.dash, tone: k.profit >= 0 ? 'pos' : 'neg' },
              { label: ed.marginKpi, value: k.price > 0 ? pct((k.profit / k.price) * 100) : es.app.dash },
              { label: t.piecesKpi, value: String(k.pieceCount) },
            ]}
          />
          <StatusLine tone={status[0]}>{status[1]}</StatusLine>
          {k.parts.length > 0 && (
            <Note>
              {loose.a}
              <b>{loose.v}</b>
              {loose.b}
              {auto ? (
                t.autoPrice
              ) : dif > 0.5 ? (
                <>
                  {t.discount(formatMoney0(dif), pct((dif / k.loose) * 100)).a}
                  <b>{formatMoney0(dif)}</b>
                  {t.discount(formatMoney0(dif), pct((dif / k.loose) * 100)).b}
                </>
              ) : dif < -0.5 ? (
                <>
                  {t.surcharge(formatMoney0(-dif)).a}
                  <b>{formatMoney0(-dif)}</b>
                  {t.surcharge(formatMoney0(-dif)).b}
                </>
              ) : (
                t.samePrice
              )}
            </Note>
          )}
          <Legend segments={seg} price={k.price} cost={k.cost} totalLabel={t.setCost} />
          <Shortcuts items={refs} onPick={(v) => set({ price: v ? String(v) : '' })} />
          <p className="text-[13px] text-ink-3">{t.emptyHint}</p>
          <ResultActions>
            <Button variant="primary" block disabled={busy} onClick={() => void save()}>
              {current ? ed.saveChanges : t.saveNew}
            </Button>
            {current && (
              <Button block disabled title={es.app.nextPhase}>
                {t.registerSale}
              </Button>
            )}
            {current ? (
              <Button variant="ghost" block className="text-red-ink" onClick={remove}>
                {two.armed ? es.app.confirmDelete : t.delete}
              </Button>
            ) : (
              <Button variant="ghost" block onClick={() => void navigate({ to: '/productos', search: { tab: 'colecciones' } })}>
                {ed.discard}
              </Button>
            )}
          </ResultActions>
        </ResultCard>
      </div>
    </>
  );
}
