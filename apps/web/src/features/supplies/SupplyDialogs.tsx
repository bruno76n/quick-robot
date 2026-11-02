import { useEffect, useState } from 'react';
import type { Supplier, SupplyDetail } from '@app/contract';
import { planSupplyMovement, unitCostAfterPurchase } from '@app/core';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Note } from '../../components/Note';
import { showUndo, useToast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { useTwoTap } from '../../components/useTwoTap';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { formatMoney, formatNumber1, todayIso } from '../../lib/format';
import { centsFromText, numFromText, textFromCents, textFromNum } from '../../lib/numbers';
import { useInvalidate } from '../../lib/queries';
import { useQueryClient } from '@tanstack/react-query';

const t = es.supplies;

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-card bg-red-soft px-[14px] py-[11px] text-[13.5px] text-red-ink">
      {text}
    </p>
  ) : null;
}

function useSupplyRefresh() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return (detail?: SupplyDetail) => {
    if (detail) qc.setQueryData(['supplies', 'detail', detail.id], detail);
    return invalidate('supplies');
  };
}

export function SupplyDialog({
  open,
  supply,
  suppliers,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  supply?: SupplyDetail;
  suppliers: readonly Supplier[];
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const toast = useToast((s) => s.show);
  const refresh = useSupplyRefresh();
  const two = useTwoTap();
  const d = t.dialog;
  const [f, setF] = useState({ name: '', unit: 'pza', cost: '', minimum: '10', initial: '', supplierId: '', note: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr(null);
    setF(
      supply
        ? { name: supply.name, unit: supply.unit, cost: textFromCents(supply.costCents), minimum: textFromNum(supply.minimum), initial: '', supplierId: supply.supplierId ?? '', note: supply.note }
        : { name: '', unit: 'pza', cost: '', minimum: '10', initial: '', supplierId: '', note: '' },
    );
  }, [open, supply]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    if (!f.name.trim()) return setErr(d.nameMissing);
    const base = { name: f.name, unit: f.unit.trim(), costCents: Math.max(0, centsFromText(f.cost)), minimum: Math.max(0, numFromText(f.minimum)), note: f.note, supplierId: f.supplierId || null };
    setBusy(true);
    try {
      const r = supply ? await api.supplies.update(supply.id, base) : await api.supplies.create({ ...base, initialQty: Math.max(0, numFromText(f.initial)), initialNote: d.initialNote, on: todayIso() });
      await refresh(r);
      toast(d.saved);
      onClose();
      onSaved(r.id);
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = () =>
    two.tap(async () => {
      if (!supply) return;
      try {
        await api.supplies.remove(supply.id);
        await refresh();
        onClose();
        onDeleted();
        showUndo(d.deleted, es.app.undo, () => api.supplies.restore(supply.id), () => void refresh());
      } catch (e) {
        setErr(errorText(e));
      }
    });
  const ids = (k: string) => `sup-${k}`;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={supply ? d.editTitle : d.newTitle}
      onSubmit={(e) => (e.preventDefault(), void submit())}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {es.app.cancel}
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {es.app.save}
          </Button>
        </>
      }
    >
      <Field label={d.name} htmlFor={ids('name')}>
        <input id={ids('name')} value={f.name} placeholder={d.namePh} onChange={set('name')} data-autofocus="" />
      </Field>
      <div className="grid grid-cols-3 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={d.unit} htmlFor={ids('unit')}>
          <input id={ids('unit')} value={f.unit} placeholder={d.unitPh} onChange={set('unit')} />
        </Field>
        <Field label={d.cost} htmlFor={ids('cost')}>
          <UnitInput id={ids('cost')} unit={es.units.money} inputMode="decimal" placeholder="0" value={f.cost} onChange={set('cost')} />
        </Field>
        <Field label={d.minimum} htmlFor={ids('min')}>
          <input id={ids('min')} inputMode="decimal" value={f.minimum} onChange={set('minimum')} />
        </Field>
      </div>
      {!supply && (
        <Field label={d.initial} help={d.initialHelp} htmlFor={ids('initial')}>
          <input id={ids('initial')} inputMode="decimal" placeholder="0" value={f.initial} onChange={set('initial')} />
        </Field>
      )}
      <Field label={d.supplier} help={d.supplierHelp} htmlFor={ids('sup')}>
        <select id={ids('sup')} value={f.supplierId} onChange={set('supplierId')}>
          <option value="">{d.noSupplier}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={d.note} htmlFor={ids('note')}>
        <input id={ids('note')} value={f.note} placeholder={d.notePh} onChange={set('note')} />
      </Field>
      <ErrorLine text={err} />
      {supply && (
        <div className="mt-1 border-t border-line pt-[14px]">
          <Button variant="ghost" size="sm" className="text-red-ink" onClick={remove}>
            {two.armed ? es.app.confirmDelete : d.delete}
          </Button>
        </div>
      )}
    </Dialog>
  );
}

export function SupplyPurchaseDialog({ supply, onClose }: { supply: SupplyDetail; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const refresh = useSupplyRefresh();
  const p = t.purchase;
  const [f, setF] = useState({ qty: '', total: '', on: todayIso(), note: '' });
  const [err, setErr] = useState<string | null>(null);
  const qty = numFromText(f.qty);
  const total = numFromText(f.total);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    if (!(qty > 0)) return setErr(p.qtyMissing);
    try {
      const r = await api.supplies.purchase(supply.id, { qty, totalCents: total > 0 ? centsFromText(f.total) : null, on: f.on || todayIso(), note: f.note.trim() || p.defaultNote(formatNumber1(qty), supply.unit) });
      await refresh(r);
      toast(p.saved);
      onClose();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={p.title(supply.name)}
      onSubmit={(e) => (e.preventDefault(), void submit())}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {es.app.cancel}
          </Button>
          <Button variant="primary" type="submit">
            {p.submit}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={p.qty} htmlFor="pur-qty">
          <input id="pur-qty" inputMode="decimal" placeholder="0" value={f.qty} onChange={set('qty')} data-autofocus="" />
        </Field>
        <Field label={p.total} help={p.totalHelp} htmlFor="pur-total">
          <UnitInput id="pur-total" unit={es.units.money} inputMode="decimal" placeholder="0" value={f.total} onChange={set('total')} />
        </Field>
        <Field label={p.date} htmlFor="pur-on">
          <input id="pur-on" type="date" value={f.on} onChange={set('on')} />
        </Field>
        <Field label={p.note} htmlFor="pur-note">
          <input id="pur-note" placeholder={p.notePh} value={f.note} onChange={set('note')} />
        </Field>
      </div>
      <Note>
        {p.after(formatNumber1(supply.stock + (qty > 0 ? qty : 0)))}
        {qty > 0 && total > 0 ? p.unitCost(formatMoney(unitCostAfterPurchase(supply.costCents / 100, qty, total))) : ''}
      </Note>
      <ErrorLine text={err} />
    </Dialog>
  );
}

export function SupplyMovementDialog({ supply, onClose }: { supply: SupplyDetail; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const refresh = useSupplyRefresh();
  const u = t.use;
  const [kind, setKind] = useState<'use' | 'waste' | 'adjustment'>('use');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const q = numFromText(qty, Number.NaN);
  const plan = Number.isFinite(q) ? planSupplyMovement(kind, q, supply.stock) : null;
  const submit = async () => {
    if (!Number.isFinite(q) || q < 0 || (kind !== 'adjustment' && q <= 0)) return setErr(u.qtyMissing);
    try {
      const r = await api.supplies.movement(supply.id, { kind, qty: q, on: todayIso(), note: note.trim() || u.defaultNotes[kind] });
      await refresh(r);
      toast(u.saved);
      onClose();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const preview = kind === 'adjustment' ? u.countChange(formatNumber1(supply.stock), formatNumber1(Number.isFinite(q) ? q : 0)) : u.after(formatNumber1(supply.stock - (Number.isFinite(q) ? q : 0)));
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={u.title(supply.name)}
      onSubmit={(e) => (e.preventDefault(), void submit())}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {es.app.cancel}
          </Button>
          <Button variant="primary" type="submit">
            {u.submit}
          </Button>
        </>
      }
    >
      <p>{u.available(formatNumber1(supply.stock), supply.unit)}</p>
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={u.reason} htmlFor="use-kind">
          <select id="use-kind" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            {(['use', 'waste', 'adjustment'] as const).map((k) => (
              <option key={k} value={k}>
                {u.reasons[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={u.qty} htmlFor="use-qty">
          <input id="use-qty" inputMode="decimal" placeholder="0" value={qty} onChange={(e) => setQty(e.target.value)} data-autofocus="" />
        </Field>
      </div>
      <Field label={u.note} htmlFor="use-note">
        <input id="use-note" placeholder={u.notePh} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Note tone={plan && !plan.ok && plan.reason === 'insufficient' ? 'warn' : 'plain'}>{preview}</Note>
      <ErrorLine text={err} />
    </Dialog>
  );
}

