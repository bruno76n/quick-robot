// Nuevo / editar proveedor (mockup provDlg): name, contact, brands it sells (they sort the shopping list) and a note.
import type { SupplierView } from '@app/contract';
import { useState } from 'react';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { useWrite } from '../../lib/mutate';

const L = es.screens.purchases;
const TOUCHES = ['suppliers', 'supplies', 'purchases'] as const;

export function SupplierDialog({ supplier, onClose }: { supplier: SupplierView | null; onClose: () => void }) {
  const [f, setF] = useState({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', brands: supplier?.brands ?? '', note: supplier?.note ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = useWrite(() => {
    const input = { name: f.name.trim(), phone: f.phone.trim(), brands: f.brands.trim(), note: f.note.trim() };
    return supplier ? api.suppliers.update(supplier.id, input) : api.suppliers.create(input);
  }, { touches: [...TOUCHES], ok: () => (supplier ? L.saved : L.added), onDone: onClose });
  const del = useWrite(() => api.suppliers.remove(supplier!.id), {
    touches: [...TOUCHES], ok: () => es.toast['supplier.deleted'], onDone: onClose,
    undo: () => () => api.suppliers.restore(supplier!.id),
  });
  return (
    <Dialog open title={supplier ? L.editTitle : L.newTitle} onClose={onClose} busy={save.isPending}
      onSubmit={() => { if (!f.name.trim()) { toast(es.fields['supplier.name.required']); return; } save.mutate(undefined); }}>
      <Field label={L.name}><input name="nombre" value={f.name} onChange={set('name')} placeholder={L.namePlaceholder} /></Field>
      <Field label={L.contact}><input name="tel" value={f.phone} onChange={set('phone')} placeholder={L.contactPlaceholder} /></Field>
      <Field label={L.brandsLabel} hint={L.brandsHint}><input name="marcas" value={f.brands} onChange={set('brands')} placeholder={L.brandsPlaceholder} /></Field>
      <Field label={L.note}><input name="nota" value={f.note} onChange={set('note')} placeholder={L.notePlaceholder} /></Field>
      {supplier ? <div className="det-z"><ConfirmButton variant="ghost" danger size="sm" confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deleteSupplier}</ConfirmButton></div> : null}
    </Dialog>
  );
}
