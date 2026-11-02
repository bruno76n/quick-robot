import { useState } from 'react';
import type { MaintenanceTask, Printer } from '@app/contract';
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
import { useInvalidate, useSettings } from '../../lib/queries';

const t = es.printers;

function Footer({ onClose, submit, busy }: { onClose: () => void; submit: string; busy?: boolean }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        {es.app.cancel}
      </Button>
      <Button variant="primary" type="submit" disabled={busy}>
        {submit}
      </Button>
    </>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-card bg-red-soft px-[14px] py-[11px] text-[13.5px] text-red-ink">
      {text}
    </p>
  ) : null;
}

function DeleteRow({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const two = useTwoTap();
  return (
    <div className="mt-1 border-t border-line pt-[14px]">
      <Button variant="ghost" size="sm" className="text-red-ink" onClick={() => two.tap(onConfirm)}>
        {two.armed ? es.app.confirmDelete : label}
      </Button>
    </div>
  );
}

export function PrinterDialog({ printer, onClose }: { printer?: Printer; onClose: () => void }) {
  const d = t.dialog;
  const toast = useToast((s) => s.show);
  const invalidate = useInvalidate();
  const settings = useSettings();
  const [f, setF] = useState(() =>
    printer
      ? { name: printer.name, cost: textFromCents(printer.costCents), life: textFromNum(printer.lifeHours), maint: textFromCents(printer.maintenanceCentsPerHour), kw: textFromNum(printer.kw), hours: textFromNum(printer.hours), purchasedOn: printer.purchasedOn ?? '' }
      : { name: '', cost: '', life: '5000', maint: '0.6', kw: '0.12', hours: '0', purchasedOn: todayIso() },
  );
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const kwh = (settings.data?.settings.kwhPriceCents ?? 0) / 100;
  const life = Math.max(1, numFromText(f.life, 1));
  const preview = d.preview(formatMoney(numFromText(f.cost) / life + numFromText(f.maint)), formatMoney(numFromText(f.kw) * kwh));
  const submit = async () => {
    if (!f.name.trim()) return setErr(d.nameMissing);
    const input = {
      name: f.name,
      costCents: Math.max(0, centsFromText(f.cost)),
      lifeHours: Math.max(1, numFromText(f.life, 5000)),
      maintenanceCentsPerHour: Math.max(0, centsFromText(f.maint)),
      kw: Math.max(0, numFromText(f.kw)),
      hours: Math.max(0, numFromText(f.hours)),
      purchasedOn: f.purchasedOn || null,
    };
    try {
      if (printer) await api.printers.update(printer.id, input);
      else await api.printers.create(input);
      await invalidate('printers');
      toast(d.saved);
      onClose();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const remove = async () => {
    if (!printer) return;
    try {
      await api.printers.remove(printer.id);
      await invalidate('printers');
      onClose();
      showUndo(d.deleted(printer.name), es.app.undo, () => api.printers.restore(printer.id), () => void invalidate('printers'));
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const field = (k: keyof typeof f, label: string, unit: string, help?: string) => (
    <Field label={label} help={help} htmlFor={`pr-${k}`}>
      <UnitInput id={`pr-${k}`} unit={unit} inputMode="decimal" value={f[k]} onChange={set(k)} />
    </Field>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={printer ? d.editTitle : d.newTitle} onSubmit={(e) => (e.preventDefault(), void submit())} footer={<Footer onClose={onClose} submit={es.app.save} />}>
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={d.name} htmlFor="pr-name">
          <input id="pr-name" value={f.name} placeholder={d.namePh} onChange={set('name')} data-autofocus="" />
        </Field>
        {field('cost', d.cost, es.units.money)}
        {field('life', d.life, es.units.hours, d.lifeHelp)}
        {field('maint', d.maintenance, es.units.money, d.maintenanceHelp)}
        {field('kw', d.kw, es.units.kw, d.kwHelp)}
        {field('hours', d.hours, es.units.hours)}
        <Field label={d.purchasedOn} htmlFor="pr-date">
          <input id="pr-date" type="date" value={f.purchasedOn} onChange={set('purchasedOn')} />
        </Field>
      </div>
      <Note>
        {preview.a}
        <b>{preview.machine}</b>
        {preview.b}
        <b>{preview.light}</b>
        {preview.c}
      </Note>
      <ErrorLine text={err} />
      {printer && <DeleteRow label={d.delete} onConfirm={() => void remove()} />}
    </Dialog>
  );
}

export function TaskDialog({ printer, task, onClose }: { printer: Printer; task?: MaintenanceTask; onClose: () => void }) {
  const d = t.task;
  const toast = useToast((s) => s.show);
  const invalidate = useInvalidate();
  const [name, setName] = useState(task?.task ?? '');
  const [every, setEvery] = useState(textFromNum(task?.everyHours ?? 100));
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (!name.trim()) return setErr(d.nameMissing);
    const input = { task: name, everyHours: Math.max(1, numFromText(every, 100)) };
    try {
      if (task) await api.printers.updateTask(task.id, input);
      else await api.printers.addTask(printer.id, input);
      await invalidate('printers');
      toast(d.saved);
      onClose();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const remove = async () => {
    if (!task) return;
    await api.printers.removeTask(task.id);
    await invalidate('printers');
    onClose();
    showUndo(d.removed, es.app.undo, () => api.printers.restoreTask(task.id), () => void invalidate('printers'));
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={task ? d.editTitle : d.newTitle} onSubmit={(e) => (e.preventDefault(), void submit())} footer={<Footer onClose={onClose} submit={es.app.save} />}>
      <p>{d.header(printer.name, formatNumber1(printer.hours))}</p>
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={d.task} htmlFor="tk-name">
          <input id="tk-name" value={name} placeholder={d.taskPh} onChange={(e) => setName(e.target.value)} data-autofocus="" />
        </Field>
        <Field label={d.every} htmlFor="tk-every">
          <UnitInput id="tk-every" unit={es.units.hours} inputMode="decimal" value={every} onChange={(e) => setEvery(e.target.value)} />
        </Field>
      </div>
      <ErrorLine text={err} />
      {task && <DeleteRow label={d.remove} onConfirm={() => void remove()} />}
    </Dialog>
  );
}

export function CompleteTaskDialog({ printer, task, onClose }: { printer: Printer; task: MaintenanceTask; onClose: () => void }) {
  const d = t.complete;
  const toast = useToast((s) => s.show);
  const invalidate = useInvalidate();
  const [on, setOn] = useState(todayIso());
  const [cost, setCost] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const body = d.body(formatNumber1(printer.hours));
  const submit = async () => {
    const costCents = Math.max(0, centsFromText(cost));
    try {
      await api.printers.completeTask(task.id, { on: on || todayIso(), costCents });
      await invalidate('printers');
      toast(costCents > 0 ? d.savedWithExpense : d.saved);
      onClose();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={d.title(task.task, printer.name)} onSubmit={(e) => (e.preventDefault(), void submit())} footer={<Footer onClose={onClose} submit={d.submit} />}>
      <p>
        {body.a}
        <b>{body.h}</b>
        {body.b}
      </p>
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={d.date} htmlFor="mt-on">
          <input id="mt-on" type="date" value={on} onChange={(e) => setOn(e.target.value)} />
        </Field>
        <Field label={d.cost} help={d.costHelp} htmlFor="mt-cost">
          <UnitInput id="mt-cost" unit={es.units.money} inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value)} data-autofocus="" />
        </Field>
      </div>
      <ErrorLine text={err} />
    </Dialog>
  );
}
