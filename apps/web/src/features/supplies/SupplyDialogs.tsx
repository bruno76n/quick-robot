// Nuevo/editar insumo, registrar compra y usar o ajustar (reference/mockup-textos.md › Diálogos de insumo).
import type { SupplyDetail } from '@app/contract';
import { useState } from 'react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { money, number1 } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { useSuppliers } from '../../lib/queries';

const L = es.screens.supplies;

export function SupplyDialog({ supply, onClose, onSaved, onDeleted }: { supply: SupplyDetail | null; onClose: () => void; onSaved: (id: string) => void; onDeleted: () => void }) {
  const suppliers = useSuppliers().data ?? [];
  const [f, setF] = useState({ name: supply?.name ?? '', unit: supply?.unit ?? L.pza, cost: supply ? String(supply.costCents / 100) : '', min: String(supply?.minimum ?? 10), initial: '', supplierId: supply?.supplier?.id ?? '', note: supply?.note ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = useWrite(async () => {
    const input = { name: f.name, unit: f.unit.trim() || L.pza, costCents: Math.round(Math.max(0, parseNumber(f.cost)) * 100), minimum: Math.max(0, parseNumber(f.min)), note: f.note, supplierId: f.supplierId || null };
    return supply ? api.supplies.update(supply.id, input) : api.supplies.create({ ...input, ...(parseNumber(f.initial) > 0 ? { initialStock: parseNumber(f.initial) } : {}) });
  }, { touches: ['supplies', 'products', 'collections'], ok: () => es.toast['supply.saved'], onDone: (out) => onSaved(out.id) });
  const del = useWrite(() => api.supplies.remove(supply!.id), {
    touches: ['supplies'], ok: () => es.toast['supply.deleted'], onDone: onDeleted,
    undo: () => () => api.supplies.restore(supply!.id),
  });
  return (
    <Dialog open title={supply ? L.editTitle : L.newTitle} onClose={onClose} busy={save.isPending} onSubmit={() => { if (!f.name.trim()) { toast(es.fields['supply.name.required']); return; } save.mutate(undefined); }}>
      <Field label={L.name}><input name="nombre" value={f.name} onChange={set('name')} placeholder={L.namePlaceholder} /></Field>
      <div className="grid3">
        <Field label={L.unit}><input name="unidad" value={f.unit} onChange={set('unit')} placeholder={L.unitPlaceholder} /></Field>
        <Field label={L.unitCost}><UnitInput unit="$" name="costo" inputMode="decimal" value={f.cost} onChange={set('cost')} placeholder="0" /></Field>
        <Field label={L.warnWhenLeft}><input name="minimo" inputMode="decimal" value={f.min} onChange={set('min')} /></Field>
      </div>
      {supply ? null : <Field label={L.haveNow} hint={L.haveNowHint}><input name="inicial" inputMode="decimal" value={f.initial} onChange={set('initial')} placeholder="0" /></Field>}
      <Field label={L.supplier} hint={L.supplierHint}>
        <select name="prov" value={f.supplierId} onChange={set('supplierId')}><option value="">{L.noSupplier}</option>{suppliers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </Field>
      <Field label={L.note}><input name="nota" value={f.note} onChange={set('note')} placeholder={L.notePlaceholder} /></Field>
      {supply ? <div className="det-z"><ConfirmButton variant="ghost" danger size="sm" confirmText={es.confirm.deleteQuestion} onConfirm={() => del.mutate(undefined)}>{L.deleteSupply}</ConfirmButton></div> : null}
    </Dialog>
  );
}

export function PurchaseDialog({ supply, onClose }: { supply: SupplyDetail; onClose: () => void }) {
  const [qty, setQty] = useState('');
  const [total, setTotal] = useState('');
  const [on, setOn] = useState(todayLocal());
  const [note, setNote] = useState('');
  const q = parseNumber(qty);
  const tot = parseNumber(total);
  const save = useWrite(() => api.supplies.purchase(supply.id, { qty: q, on, ...(tot > 0 ? { costCents: Math.round(tot * 100) } : {}), ...(note.trim() ? { note } : {}) }), { touches: ['supplies', 'products', 'collections'], ok: () => es.toast['supply.purchaseRecorded'], onDone: onClose });
  return (
    <Dialog open title={t('screens.supplies.purchaseTitle', { name: supply.name })} onClose={onClose} submitLabel={L.register} busy={save.isPending} onSubmit={() => { if (q <= 0) { toast(es.fields['supplyPurchase.qty.required']); return; } save.mutate(undefined); }}>
      <div className="grid2">
        <Field label={L.qtyBought}><input name="n" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></Field>
        <Field label={L.totalPaid} hint={L.totalPaidHint}><UnitInput unit="$" name="tot" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" /></Field>
      </div>
      <div className="grid2">
        <Field label={L.date}><input type="date" name="fecha" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        <Field label={L.note}><input name="nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L.supplier} /></Field>
      </div>
      <p className="note">{t('screens.supplies.afterTotal', { total: number1(supply.stock + q) })}{q > 0 && tot > 0 ? ` ${t('screens.supplies.unitCostIs', { cost: money(tot / q) })}` : ''}</p>
    </Dialog>
  );
}

export function UseDialog({ supply, onClose }: { supply: SupplyDetail; onClose: () => void }) {
  const [kind, setKind] = useState<'use' | 'waste' | 'adjustment'>('use');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const q = parseNumber(qty);
  const save = useWrite(() => api.supplies.move(supply.id, { kind, mode: kind === 'adjustment' ? 'count' : 'delta', value: q, on: todayLocal(), ...(note.trim() ? { note } : {}) }), { touches: ['supplies'], ok: () => es.toast['supply.movementRecorded'], onDone: onClose });
  const over = kind !== 'adjustment' && q > supply.stock;
  return (
    <Dialog open title={t('screens.supplies.useTitle', { name: supply.name })} onClose={onClose} busy={save.isPending} onSubmit={() => {
      if (q < 0 || (kind !== 'adjustment' && q <= 0)) { toast(es.fields['supplyMovement.value.required']); return; }
      save.mutate(undefined);
    }}>
      <p>{t('screens.supplies.availableNow', { qty: number1(supply.stock), unit: supply.unit || L.pza })}</p>
      <div className="grid2">
        <Field label={L.reason}><select name="tipo" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}><option value="use">{L.reasonUse}</option><option value="waste">{L.reasonWaste}</option><option value="adjustment">{L.reasonCount}</option></select></Field>
        <Field label={L.qty}><input name="n" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" /></Field>
      </div>
      <Field label={L.note}><input name="nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L.usePlaceholder} /></Field>
      <p className={`note${over ? ' warn' : ''}`}>{kind === 'adjustment' ? t('screens.supplies.countChange', { from: number1(supply.stock), to: number1(q) }) : t('screens.supplies.afterTotal', { total: number1(supply.stock - q) })}</p>
    </Dialog>
  );
}
