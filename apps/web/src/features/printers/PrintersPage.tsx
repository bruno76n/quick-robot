// Impresoras (docs/06 §8): state, queue, investment recovered and maintenance by hours.
import type { MaintenanceView, PrinterView } from '@app/contract';
import { useState } from 'react';
import { Meter } from '../../components/Meter';
import { PageHead } from '../../components/PageHead';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import { Mascot } from '../../components/Mascot';
import { Pill } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, money, number1, pct, queueDuration } from '../../lib/format';
import { usePrinters, useSettings } from '../../lib/queries';
import { DoneDialog, PrinterDialog, TaskDialog } from './PrinterDialogs';
import { QueueFinishButton, QueueList, QueueOrderLink } from './PrinterQueue';
import './printers.css';

const L = es.screens.printers;
const TONE = { ok: 'ok', soon: 'warn', due: 'bad' } as const;
type Dlg = { kind: 'printer'; printer: PrinterView | null } | { kind: 'task'; printer: PrinterView; task: MaintenanceView | null } | { kind: 'done'; printer: PrinterView; task: MaintenanceView } | null;

export function PrintersPage() {
  const { data } = usePrinters();
  const kwh = (useSettings().data?.settings.kwhPriceCents ?? 0) / 100;
  const [dlg, setDlg] = useState<Dlg>(null);
  const items = data?.items ?? [];
  const printing = items.filter((p) => p.status === 'printing').length;
  return (
    <>
      <PageHead title={L.title} sub={items.length ? t('screens.printers.sub', { count: items.length, printing }) : undefined}
        actions={<Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'printer', printer: null })}>{L.add}</Button>} />
      <div className="pc-grid">
        {items.map((p) => <PrinterCard key={p.id} p={p} kwh={kwh} open={setDlg} />)}
        {data && !items.length ? <div className="panel empty-card"><Mascot size={64} /><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg({ kind: 'printer', printer: null })}>{L.add}</Button></div> : null}
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
    <article className="panel pc2" data-testid="printer-card">
      <header className="pr-h">
        <span className="pr-ic" aria-hidden="true"><Icon name="printer" size={16} /></span>
        <div><h2>{p.name}</h2><span className="meta">{t('screens.printers.hoursPrinted', { hours: number1(p.hours) })}</span></div>
        <Pill tone={busy ? 'ok' : ''}>{busy ? L.printing : L.idle}</Pill>
      </header>
      {job ? (
        <div className="pc-job">
          <span className="lbl">{L.nowLabel}</span>
          <div className="pr-job"><b>{job.text}</b><span className="num">{pct(job.progress)}</span></div>
          <span className="meta"><QueueOrderLink orderId={job.orderId} folio={job.orderNumber} /> · {t('screens.printers.left', { time: queueDuration(job.remainingMinutes) })}</span>
          <Meter value={job.progress} />
          <QueueFinishButton printer={p} />
        </div>
      ) : (
        <div className="pc-job idle"><span className="lbl">{L.nowLabel}</span><b>{L.free}</b><span className="meta">{L.freeHint}</span></div>
      )}
      <QueueList printer={p} />
      <div className="pc-sec">
        <div className="pc-h"><span className="lbl">{L.maintenance}</span></div>
        {p.maintenance.length ? (
          <ul className="mt-l">{p.maintenance.map((m) => (
            <li key={m.id}>
              <div className="mt-m"><b>{m.task}</b><span className="meta">{t('screens.printers.every', { hours: number1(m.everyHours) })} · {m.remaining <= 0 ? t('screens.printers.overdue', { hours: number1(-m.remaining) }) : t('screens.printers.remaining', { hours: number1(m.remaining) })}</span>
                <span className="meta sm">{m.lastOn ? t('screens.printers.lastTime', { date: date(m.lastOn) }) : L.noRecord}</span>
                <div className="mt-r">
                  <Button size="sm" onClick={() => open({ kind: 'done', printer: p, task: m })}>{L.done}</Button>
                  <button type="button" className="btn sm ghost icon" onClick={() => open({ kind: 'task', printer: p, task: m })} aria-label={L.editTask}><Icon name="edit" size={14} /></button>
                </div>
              </div>
              <Meter value={Math.min(100, m.usage * 100)} tone={m.status === 'ok' ? '' : TONE[m.status]} />
              <Pill tone={TONE[m.status]}>{es.status.maintenance[m.status]}</Pill>
            </li>
          ))}</ul>
        ) : <p className="meta">{L.noTasks}</p>}
        <div><Button size="sm" variant="ghost" icon="plus" onClick={() => open({ kind: 'task', printer: p, task: null })}>{L.addTask}</Button></div>
      </div>
      <div className="pc-sec">
        <span className="lbl">{L.investment}</span>
        <div className="pc-invr"><b className="num">{pct(p.roi.pct)}</b><span className="meta">{t('screens.printers.ofCost', { cost: centsTotal(p.costCents) })}</span></div>
        <Meter value={p.roi.pct} tone="ok" label={t('screens.printers.recoveredAria', { pct: pct(p.roi.pct) })} />
        <p className="meta">{t('screens.printers.investmentLine', { recovered: centsTotal(p.roi.recoveredCents), cost: centsTotal(p.costCents) })}</p>
      </div>
      <div className="pc-sec">
        <dl className="pc-kv">
          <div><dt>{L.costPerHour}</dt><dd className="num">{money(machine + power)}</dd><small>{t('screens.printers.costSplit', { machine: money(machine), power: money(power) })}</small></div>
          <div><dt>{L.lifeUsed}</dt><dd className="num">{pct(life)}</dd><small>{t('screens.printers.ofHours', { hours: number1(p.lifeHours) })}</small></div>
        </dl>
        <div><Button size="sm" onClick={() => open({ kind: 'printer', printer: p })}>{L.editCosts}</Button></div>
      </div>
    </article>
  );
}
