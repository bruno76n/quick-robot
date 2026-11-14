// Impresoras (docs/06 §8): state, queue, investment recovered and maintenance by hours.
import type { MaintenanceView, PrinterView } from '@app/contract';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Mascot } from '../../components/Mascot';
import { Pill } from '../../components/Pill';
import { es } from '../../i18n/es';
import { tb } from '../../i18n/rich';
import { t } from '../../i18n/t';
import { centsTotal, date, money, number1, pct, queueDuration } from '../../lib/format';
import { usePrinters, useSettings } from '../../lib/queries';
import { DoneDialog, PrinterDialog, TaskDialog } from './PrinterDialogs';
import { QueueFinishButton, QueueList, QueueOrderLink } from './PrinterQueue';
import './printers.css';

const L = es.screens.printers;
const TONE = { ok: 'good', soon: 'warn', due: 'bad' } as const;
type Dlg = { kind: 'printer'; printer: PrinterView | null } | { kind: 'task'; printer: PrinterView; task: MaintenanceView | null } | { kind: 'done'; printer: PrinterView; task: MaintenanceView } | null;

export function PrintersPage() {
  const { data } = usePrinters();
  const kwh = (useSettings().data?.settings.kwhPriceCents ?? 0) / 100;
  const [dlg, setDlg] = useState<Dlg>(null);
  const items = data?.items ?? [];
  const inv = data?.investment;
  const pending = items.flatMap((p) => p.maintenance).filter((m) => m.status !== 'ok').length;
  const hours = items.reduce((a, p) => a + p.hours, 0);
  return (
    <>
      <PageHead title={L.title} actions={<Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'printer', printer: null })}>{L.add}</Button>} />
      {items.length && inv ? (
        <section className="brf one sm"><div>
          <p className="brf-l">
            {tb(items.length === 1 ? 'screens.printers.summaryOne' : 'screens.printers.summaryMany', { count: items.length, equipment: centsTotal(inv.equipmentCents), recovered: pct(inv.recoveredPct), net: centsTotal(inv.netCents), hours: number1(hours) })}
            {' '}{pending ? tb('screens.printers.pending', { count: pending }) : L.upToDate}
          </p>
          <div className="rk-b big mt" role="img" aria-label={t('screens.printers.recoveredAria', { pct: Math.round(inv.recoveredPct) })}><i style={{ width: `${Math.min(100, Math.max(1.5, inv.recoveredPct))}%` }} /></div>
          <p className="hint">{t('screens.printers.recovered', { pct: pct(inv.recoveredPct) })}</p>
        </div></section>
      ) : null}
      <div className="pc-grid">
        {items.map((p) => <PrinterCard key={p.id} p={p} kwh={kwh} open={setDlg} />)}
        {data && !items.length ? <div className="empty-card"><Mascot size={64} /><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'printer', printer: null })}>{L.add}</Button></div> : null}
      </div>
      {dlg?.kind === 'printer' ? <PrinterDialog printer={dlg.printer} kwh={kwh} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'task' ? <TaskDialog printer={dlg.printer} task={dlg.task} onClose={() => setDlg(null)} /> : null}
      {dlg?.kind === 'done' ? <DoneDialog printer={dlg.printer} task={dlg.task} onClose={() => setDlg(null)} /> : null}
    </>
  );
}

function PrinterCard({ p, kwh, open }: { p: PrinterView; kwh: number; open: (d: Dlg) => void }) {
  const machine = p.costCents / 100 / p.lifeHours + p.maintenanceCentsPerHour / 100;
  const power = p.kw * kwh;
  const life = Math.min(100, (p.hours / p.lifeHours) * 100);
  const busy = p.status === 'printing';
  const job = p.queue[0];
  return (
    <article className={`pc2${busy ? ' on' : ''}`} data-testid="printer-card">
      <header><div><h2>{p.name}</h2><small>{centsTotal(p.costCents)}{p.purchasedOn ? ` · ${t('screens.printers.bought', { date: date(p.purchasedOn) })}` : ''}</small></div><Pill tone={busy ? 'info' : 'good'}>{busy ? L.printing : L.idle}</Pill></header>
      {job ? (
        <div className="bay2"><span className="lay sm s0 printing" style={{ ['--p' as string]: `${job.progress}%` }} /><div className="bay-m"><div className="bay-t"><b>{job.text}</b><span className="num">{job.progress}%</span></div><div className="prog soft"><i style={{ width: `${job.progress}%` }} /></div><small>{t('screens.printers.left', { time: queueDuration(job.remainingMinutes) })} · <QueueOrderLink orderId={job.orderId} folio={job.orderNumber} /></small></div></div>
      ) : (
        <div className="bay2 idle"><span className="lay sm s0 empty" /><div><b>{L.free}</b><small>{L.freeHint}</small></div></div>
      )}
      <QueueList printer={p} />
      <div className="pc-sec">
        <div className="pc-h"><b>{L.investment}</b><span className={`num${p.roi.pct >= 100 ? ' pos' : ''}`}>{pct(p.roi.pct)}</span></div>
        <div className="rk-b"><i style={{ width: `${Math.max(1.5, p.roi.pct)}%` }} /></div>
        <small>{t('screens.printers.investmentLine', { recovered: centsTotal(p.roi.recoveredCents), cost: centsTotal(p.costCents) })}</small>
      </div>
      <div className="pc-sec">
        <div className="pc-h"><b>{L.maintenance}</b><span className="mut num">{t('screens.printers.hoursPrinted', { hours: number1(p.hours) })}</span></div>
        {p.maintenance.length ? (
          <ul className="mt-l">{p.maintenance.map((m) => (
            <li key={m.id}>
              <div className="mt-m"><b>{m.task}</b><small>{t('screens.printers.every', { hours: number1(m.everyHours) })} · {m.lastOn ? t('screens.printers.lastTime', { date: date(m.lastOn) }) : L.noRecord}</small><div className={`rk-b ${TONE[m.status]}`}><i style={{ width: `${Math.min(100, m.usage * 100)}%` }} /></div></div>
              <div className="mt-r"><span className={`pill ${TONE[m.status]}`}>{m.remaining <= 0 ? t('screens.printers.overdue', { hours: number1(-m.remaining) }) : t('screens.printers.remaining', { hours: number1(m.remaining) })}</span>
                <Button size="sm" onClick={() => open({ kind: 'done', printer: p, task: m })}>{L.done}</Button>
                <button type="button" className="btn sm ghost icon" onClick={() => open({ kind: 'task', printer: p, task: m })} aria-label={L.editTask}><Icon name="edit" size={14} /></button></div>
            </li>
          ))}</ul>
        ) : <small>{L.noTasks}</small>}
        <div><Button size="sm" variant="ghost" icon="plus" onClick={() => open({ kind: 'task', printer: p, task: null })}>{L.addTask}</Button></div>
      </div>
      <dl className="dl">
        <div><dt>{L.costPerHour}</dt><dd className="num">{money(machine + power)} <small>{t('screens.printers.costSplit', { machine: money(machine), power: money(power) })}</small></dd></div>
        <div><dt>{L.lifeUsed}</dt><dd className="num">{pct(life)} <small>{t('screens.printers.ofHours', { hours: number1(p.lifeHours) })}</small></dd></div>
      </dl>
      <footer>{job ? <QueueFinishButton printer={p} /> : null}<Button size="sm" onClick={() => open({ kind: 'printer', printer: p })}>{L.editCosts}</Button></footer>
    </article>
  );
}
