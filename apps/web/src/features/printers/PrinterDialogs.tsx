// Agregar/editar impresora, tarea de mantenimiento y "Hecho" (reference/mockup-textos.md › Diálogos de impresora).
import type { MaintenanceView, PrinterView } from '@app/contract';
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

const L = es.screens.printers;

export function PrinterDialog({ printer, kwh, onClose }: { printer: PrinterView | null; kwh: number; onClose: () => void }) {
  const [f, setF] = useState({
    name: printer?.name ?? '', cost: printer ? String(printer.costCents / 100) : '', life: String(printer?.lifeHours ?? 5000),
    maint: String(printer ? printer.maintenanceCentsPerHour / 100 : 0.6), kw: String(printer?.kw ?? 0.12), hours: String(printer?.hours ?? 0), bought: printer?.purchasedOn ?? todayLocal(),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const input = () => ({ name: f.name, costCents: Math.round(parseNumber(f.cost) * 100), lifeHours: Math.max(1, parseNumber(f.life, 5000)), maintenanceCentsPerHour: Math.round(parseNumber(f.maint) * 100), kw: parseNumber(f.kw), hours: parseNumber(f.hours), purchasedOn: f.bought || null });
  const save = useWrite(() => (printer ? api.printers.update(printer.id, input()) : api.printers.create(input())), { touches: ['printers', 'products', 'collections', 'settings'], ok: () => es.toast['printer.saved'], onDone: onClose });
  const del = useWrite(() => api.printers.remove(printer!.id), {
    touches: ['printers', 'products', 'collections'], ok: () => t('toast.printer.deleted', { name: printer!.name }), onDone: onClose,
    undo: () => () => api.printers.restore(printer!.id),
  });
  const machine = parseNumber(f.cost) / Math.max(1, parseNumber(f.life, 1)) + parseNumber(f.maint);
  return (
    <Dialog open title={printer ? L.editTitle : L.addTitle} onClose={onClose} busy={save.isPending} onSubmit={() => save.mutate(undefined)}>
      <div className="grid2">
        <Field label={L.name}><input name="nombre" value={f.name} onChange={set('name')} placeholder={L.namePlaceholder} /></Field>
        <Field label={L.cost}><UnitInput unit="$" name="costo" inputMode="decimal" value={f.cost} onChange={set('cost')} /></Field>
        <Field label={L.life} hint={L.lifeHint}><UnitInput unit="h" name="vidaH" inputMode="numeric" value={f.life} onChange={set('life')} /></Field>
        <Field label={L.maintPerHour} hint={L.maintPerHourHint}><UnitInput unit="$" name="mantoH" inputMode="decimal" value={f.maint} onChange={set('maint')} /></Field>
        <Field label={L.power} hint={L.powerHint}><UnitInput unit="kW" name="kw" inputMode="decimal" value={f.kw} onChange={set('kw')} /></Field>
        <Field label={L.hoursPrintedLabel}><UnitInput unit="h" name="horas" inputMode="decimal" value={f.hours} onChange={set('hours')} /></Field>
        <Field label={L.boughtOn}><input type="date" name="compra" value={f.bought} onChange={set('bought')} /></Field>
      </div>
      <p className="note">{t('screens.printers.preview', { machine: money(machine), power: money(parseNumber(f.kw) * kwh) })}</p>
      {printer ? <div className="det-z"><ConfirmButton variant="ghost" danger size="sm" confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)}>{L.deletePrinter}</ConfirmButton></div> : null}
    </Dialog>
  );
}

export function TaskDialog({ printer, task, onClose }: { printer: PrinterView; task: MaintenanceView | null; onClose: () => void }) {
  const [name, setName] = useState(task?.task ?? '');
  const [every, setEvery] = useState(String(task?.everyHours ?? 100));
  const input = () => ({ task: name, everyHours: Math.max(1, parseNumber(every, 100)) });
  const save = useWrite(() => (task ? api.printers.updateTask(printer.id, task.id, input()) : api.printers.addTask(printer.id, input())), { touches: ['printers'], ok: () => es.toast['maintenance.saved'], onDone: onClose });
  const del = useWrite(() => api.printers.removeTask(printer.id, task!.id), { touches: ['printers'], ok: () => es.toast['maintenance.removed'], onDone: onClose });
  return (
    <Dialog open title={task ? L.editTaskTitle : L.addTaskTitle} onClose={onClose} busy={save.isPending} onSubmit={() => { if (!name.trim()) { toast(es.fields['maintenance.task.required']); return; } save.mutate(undefined); }}>
      <p>{t('screens.printers.taskIntro', { name: printer.name, hours: number1(printer.hours) })}</p>
      <div className="grid2">
        <Field label={L.task}><input name="tarea" value={name} onChange={(e) => setName(e.target.value)} placeholder={L.taskPlaceholder} /></Field>
        <Field label={L.everyHours}><UnitInput unit="h" name="cadaH" inputMode="decimal" value={every} onChange={(e) => setEvery(e.target.value)} /></Field>
      </div>
      {task ? <div className="det-z"><ConfirmButton variant="ghost" danger size="sm" confirmText={es.confirm.removeQuestion} onConfirm={() => del.mutate(undefined)}>{L.removeTask}</ConfirmButton></div> : null}
    </Dialog>
  );
}

export function DoneDialog({ printer, task, onClose }: { printer: PrinterView; task: MaintenanceView; onClose: () => void }) {
  const [on, setOn] = useState(todayLocal());
  const [cost, setCost] = useState('');
  const c = parseNumber(cost);
  const save = useWrite(() => api.printers.completeTask(printer.id, task.id, { on, ...(c > 0 ? { costCents: Math.round(c * 100) } : {}) }), { touches: ['printers'], ok: () => es.toast['maintenance.done'], onDone: onClose });
  return (
    <Dialog open title={`${task.task} · ${printer.name}`} onClose={onClose} submitLabel={L.markDone} busy={save.isPending} onSubmit={() => save.mutate(undefined)}>
      <p>{t('screens.printers.doneIntro', { hours: number1(printer.hours) })}</p>
      <div className="grid2">
        <Field label={L.date}><input type="date" name="fecha" value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        <Field label={L.partsCost} hint={L.partsCostHint}><UnitInput unit="$" name="costo" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" /></Field>
      </div>
    </Dialog>
  );
}
