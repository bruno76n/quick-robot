import { useState } from 'react';
import type { MaintenanceTask, Printer } from '@app/contract';
import { PageHeader } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { DataList } from '../../components/DataList';
import { Icon } from '../../components/Icon';
import { Pill, type Tone } from '../../components/Pill';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { errorText } from '../../lib/error-text';
import { formatMoney, formatMoney0, formatNumber1, formatShortDate } from '../../lib/format';
import { usePrinters } from '../../lib/queries';
import { CompleteTaskDialog, PrinterDialog, TaskDialog } from './PrinterDialogs';

const t = es.printers;
const taskTone: Record<MaintenanceTask['status'], Tone> = { due: 'bad', soon: 'warn', ok: 'good' };
const pct = (n: number) => `${formatNumber1(n)}%`;

type DialogState = { kind: 'printer'; printer?: Printer } | { kind: 'task'; printer: Printer; task?: MaintenanceTask } | { kind: 'complete'; printer: Printer; task: MaintenanceTask } | null;

function Sec({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 rounded-[16px] bg-panel px-4 py-[14px]">{children}</div>;
}

function PrinterCard({ p, onEdit, onTask, onComplete }: { p: Printer; onEdit: () => void; onTask: (task?: MaintenanceTask) => void; onComplete: (task: MaintenanceTask) => void }) {
  return (
    <article className="grid content-start gap-4 rounded-[20px] bg-bg p-5 shadow-[0_0_0_1px_var(--line),0_8px_30px_rgba(18,18,20,.05)]" data-testid="printer-card">
      <header className="flex items-start justify-between gap-[10px]">
        <div>
          <h2>{p.name}</h2>
          <small>{p.purchasedOn ? t.purchased(formatMoney0(p.costCents / 100), formatShortDate(p.purchasedOn)) : formatMoney0(p.costCents / 100)}</small>
        </div>
        <Pill tone="good">{t.free}</Pill>
      </header>
      <div className="flex items-center gap-[6px] rounded-[18px] bg-panel py-3 pl-2 pr-[14px]">
        <span className="lay sm s0 empty" aria-hidden="true" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--line-2)' }} />
        <div>
          <b>{t.free}</b>
          <small className="block">{t.freeHelp}</small>
        </div>
      </div>
      <Sec>
        <div className="flex justify-between gap-[10px]">
          <b>{t.recovery}</b>
          <span className={cn('num', p.recovery.pct >= 100 && 'text-green-ink')}>{pct(p.recovery.pct)}</span>
        </div>
        <div className="rk-b bg-bg">
          <i style={{ width: `${Math.max(1.5, p.recovery.pct)}%` }} />
        </div>
        <small>{t.recoveryHelp(formatMoney0(p.recovery.contributionCents / 100), formatMoney0(p.costCents / 100))}</small>
      </Sec>
      <Sec>
        <div className="flex justify-between gap-[10px]">
          <b>{t.maintenance}</b>
          <span className="num text-ink-3">{t.printedHours(formatNumber1(p.hours))}</span>
        </div>
        {p.tasks.length ? (
          <ul className="m-0 grid list-none gap-3 p-0">
            {p.tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 max-[560px]:flex-wrap" data-testid="maintenance-task">
                <div className="grid min-w-0 flex-1 gap-1">
                  <b>{task.task}</b>
                  <small>
                    {t.every(formatNumber1(task.everyHours))} · {task.lastOn ? t.lastTime(formatShortDate(task.lastOn)) : t.noRecord}
                  </small>
                  <div className={cn('rk-b bg-bg', taskTone[task.status] !== 'good' && taskTone[task.status])}>
                    <i style={{ width: `${Math.min(100, task.usage * 100)}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-[6px]">
                  <Pill tone={taskTone[task.status]} dot={false}>{task.remaining <= 0 ? t.passed(formatNumber1(-task.remaining)) : t.remaining(formatNumber1(task.remaining))}</Pill>
                  <Button size="sm" onClick={() => onComplete(task)}>
                    {t.done}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label={t.editTask} onClick={() => onTask(task)}>
                    <Icon name="edit" size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <small>{t.noTasks}</small>
        )}
        <div>
          <Button variant="ghost" size="sm" onClick={() => onTask()}>
            <Icon name="plus" size={14} />
            {t.addTask}
          </Button>
        </div>
      </Sec>
      <DataList
        items={[
          { label: t.hourCost, value: formatMoney(p.machinePerHour + p.electricityPerHour), sub: t.hourCostDetail(formatMoney(p.machinePerHour), formatMoney(p.electricityPerHour)) },
          { label: t.lifeUsed, value: pct(p.lifeUsedPct), sub: t.ofHours(formatNumber1(p.lifeHours)) },
        ]}
      />
      <footer className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" onClick={onEdit}>
          {t.editCosts}
        </Button>
      </footer>
    </article>
  );
}

export function PrintersPage() {
  const { data, error } = usePrinters();
  const [dialog, setDialog] = useState<DialogState>(null);
  const s = data?.summary;
  const n = data?.items.length ?? 0;
  const sum = s && n ? t.summary(n, formatMoney0(s.equipmentCents / 100), pct(s.recoveredPct), formatMoney0(s.netCents / 100), `${formatNumber1(s.hours)} h`) : null;
  const pending = s && s.pendingTasks ? t.pending(s.pendingTasks) : null;
  return (
    <>
      <PageHeader
        title={t.title}
        actions={
          <Button variant="primary" onClick={() => setDialog({ kind: 'printer' })}>
            <Icon name="plus" size={16} />
            {t.add}
          </Button>
        }
      />
      {error && <p className="text-red-ink">{errorText(error)}</p>}
      {sum && s && (
        <section className="mb-5 rounded-[24px] bg-panel px-6 py-5">
          <p className="max-w-[920px] text-[20px] font-medium leading-[1.4] tracking-[-0.03em]">
            {sum.a}
            <b>{sum.cost}</b>
            {sum.b}
            <b className={cn(s.recoveredPct >= 100 && 'text-green-ink')}>{sum.pct}</b>
            {sum.c}
            <b>{sum.net}</b>
            {sum.d}
            <b>{sum.hours}</b>
            {sum.e}
            {pending ? (
              <>
                {pending.before}
                <b className="text-red-ink">{pending.n}</b>
                {pending.text}
              </>
            ) : (
              t.upToDate
            )}
          </p>
          <div className="rk-b mt-[14px] h-3 bg-bg" role="img" aria-label={t.recoveredAria(pct(s.recoveredPct))}>
            <i style={{ width: `${Math.min(100, Math.max(1.5, s.recoveredPct))}%` }} />
          </div>
          <p className="mt-2 text-[13px] text-ink-3">{t.recovered(pct(s.recoveredPct))}</p>
        </section>
      )}
      {data &&
        (data.items.length ? (
          <div className="grid grid-cols-2 gap-5 max-[1000px]:grid-cols-1">
            {data.items.map((p) => (
              <PrinterCard
                key={p.id}
                p={p}
                onEdit={() => setDialog({ kind: 'printer', printer: p })}
                onTask={(task) => setDialog({ kind: 'task', printer: p, ...(task ? { task } : {}) })}
                onComplete={(task) => setDialog({ kind: 'complete', printer: p, task })}
              />
            ))}
          </div>
        ) : (
          <div className="card grid justify-items-center gap-3 px-6 py-9 text-center text-ink-2">
            <p className="max-w-[60ch]">{t.empty}</p>
            <Button variant="primary" onClick={() => setDialog({ kind: 'printer' })}>
              <Icon name="plus" size={16} />
              {t.add}
            </Button>
          </div>
        ))}
      {dialog?.kind === 'printer' && <PrinterDialog printer={dialog.printer} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'task' && <TaskDialog printer={dialog.printer} task={dialog.task} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'complete' && <CompleteTaskDialog printer={dialog.printer} task={dialog.task} onClose={() => setDialog(null)} />}
    </>
  );
}
