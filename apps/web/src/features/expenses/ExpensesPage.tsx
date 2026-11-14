// Gastos (docs/06 §13; mockup vGastos): last 30 days against the profit of sales, by category, break-even and the list.
import { useEffect, useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Mascot } from '../../components/Mascot';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { centsTotal, date, pct } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { useSettings } from '../../lib/queries';
import { useReport } from '../reports/api';
import { C100Bar } from '../reports/Brief';
import { PERIODS, type Period } from '../reports/ReportsPage';
import { rt } from '../reports/text';
import { onNewExpenseRequest, takeNewExpenseRequest } from '../../components/CommandPalette';
import { expensesApi, useExpenses, type ExpenseView } from './api';
import './expenses.css';

const L = es.screens.expenses;

export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const when = (g: ExpenseView) => (g.recurring ? `${t('screens.expenses.monthlyFrom', { from: date(g.on) })}${g.endsOn ? t('screens.expenses.until', { to: date(g.endsOn) }) : ''}` : date(g.on));

export function ExpensesPage() {
  const today = todayLocal();
  const from30 = addDays(today, -29);
  const last30 = useExpenses(from30, today).data;
  const all = useExpenses().data;
  const R = useReport('30').data;
  const [period, setPeriod] = useState<Period>('todo');
  const listFrom = period === 'todo' ? undefined : addDays(today, -(Number(period) - 1));
  const list = useExpenses(listFrom, period === 'todo' ? undefined : today).data;
  const [dlg, setDlg] = useState<ExpenseView | 'new' | null>(() => (takeNewExpenseRequest() ? 'new' : null));
  useEffect(() => onNewExpenseRequest(() => setDlg('new')), []);
  const actions = <Button variant="primary" icon="plus" onClick={() => setDlg('new')}>{L.newExpense}</Button>;
  const dialog = dlg ? <ExpenseDialog expense={dlg === 'new' ? null : dlg} onClose={() => setDlg(null)} /> : null;
  if (all && !all.total) {
    return (
      <>
        <PageHead title={L.title} sub={L.sub} actions={actions} />
        <div className="empty-card"><Mascot size={64} /><p>{L.empty}</p><Button variant="primary" icon="plus" onClick={() => setDlg('new')}>{L.firstExpense}</Button></div>
        {dialog}
      </>
    );
  }
  const g30 = last30?.periodTotalCents ?? 0;
  const T = R?.totals;
  const income = T?.incomeCents ?? 0;
  const profit = T?.profitCents ?? 0;
  const real = profit - g30;
  const fixed = all?.fixedPerMonthCents ?? 0;
  const nFixed = (all?.items ?? []).filter((g) => g.recurring && (!g.endsOn || g.endsOn >= today)).length;
  const mg = income > 0 ? profit / income : 0;
  const goal = mg > 0 ? g30 / mg : 0;
  const reached = goal > 0 ? Math.min(100, (income / goal) * 100) : 100;
  const cats = last30?.byCategory ?? [];
  const maxC = Math.max(1, ...cats.map((c) => c.cents));
  const items = [...(list?.items ?? [])].sort((x, y) => y.on.localeCompare(x.on));
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={actions} />
      {last30 && T ? (
        <section className="brf one sm" data-testid="expenses-summary"><div>
          <p className="brf-l">{rt('screens.expenses.summary', { expenses: centsTotal(g30), profit: centsTotal(profit), real: centsTotal(real), fixed: centsTotal(fixed), count: nFixed, goal: goal ? t('screens.expenses.summaryGoal', { goal: centsTotal(goal) }) : '' }, { expenses: '', profit: '', real: real >= 0 ? 'g' : 'r', fixed: '' })}</p>
          {real >= 0 && profit > 0 ? <C100Bar segs={[[L.segExpenses, g30, '--sand', 'dk'], [L.segReal, real, '--green', 'gan dk']]} base={0} label={L.barLabel} cls="sm" /> : null}
        </div></section>
      ) : <div className="skel" />}
      <div className="cols2 soft">
        <section>
          <h2>{L.byCategory}</h2>
          {cats.length ? (
            <ul className="rk cat">{cats.map((c) => (
              <li key={c.category}><div className="rk-m"><div className="rk-t"><b>{c.category}</b><span className="num">{centsTotal(c.cents)}</span></div><div className="rk-b"><i className="pu" style={{ width: `${Math.max(3, (c.cents / maxC) * 100)}%` }} /></div></div></li>
            ))}</ul>
          ) : <p className="muted">{L.noneInPeriod}</p>}
        </section>
        <section>
          <h2>{L.breakEven}</h2>
          {goal ? (
            <>
              <p className="muted">{rt('screens.expenses.breakEvenText', { expenses: centsTotal(g30), margin: pct(mg * 100), goal: centsTotal(goal) }, { expenses: '', margin: '', goal: '' })}</p>
              <div className="eq">
                <div className="rk-b big"><i style={{ width: `${reached}%` }} /></div>
                <div className="eq-t"><span>{rt('screens.expenses.sold', { value: centsTotal(income) }, { value: '' })}</span><span>{rt('screens.expenses.goal', { value: centsTotal(goal) }, { value: '' })}</span></div>
                {reached >= 100 ? <span className="pill good">{L.reached}</span> : <span className="pill warn">{t('screens.expenses.missing', { value: centsTotal(goal - income) })}</span>}
              </div>
            </>
          ) : <p className="muted">{L.noMargin}</p>}
        </section>
      </div>
      <div className="exp-h">
        <h2 className="gap">{L.all}</h2>
        <div className="seg" role="group" aria-label={L.periodLabel}>
          {PERIODS.map((p) => <button key={p} type="button" className={p === period ? 'on' : undefined} aria-pressed={p === period} onClick={() => setPeriod(p)}>{es.screens.reports.periods[p]}</button>)}
        </div>
      </div>
      {list ? <p className="hint" data-testid="expenses-period">{rt('screens.expenses.periodTotal', { total: centsTotal(list.periodTotalCents), fixed: centsTotal(list.fixedPerMonthCents) }, { total: '', fixed: '' })}</p> : null}
      {list && !items.length ? <p className="muted">{L.noneInPeriod}</p> : null}
      <ul className="gl" data-testid="expense-list">{items.map((g) => (
        <li key={g.id} className="gi" tabIndex={0} onClick={() => setDlg(g)} onKeyDown={(e) => { if (e.key === 'Enter') setDlg(g); }}>
          <span className="pill">{g.category}</span>
          <div className="gi-m"><b>{g.concept}</b><small>{when(g)}</small></div>
          <span className="gi-v"><b className="num">{centsTotal(g.amountCents)}</b>{g.recurring ? <small>{L.perMonth}</small> : null}</span>
        </li>
      ))}</ul>
      {dialog}
    </>
  );
}

export function ExpenseDialog({ expense, onClose }: { expense: ExpenseView | null; onClose: () => void }) {
  const cats = (useSettings().data?.catalogs.expenseCategories ?? []).map((c) => c.name);
  const [f, setF] = useState({ concept: expense?.concept ?? '', category: expense?.category ?? '', amount: expense ? String(expense.amountCents / 100) : '', on: expense?.on ?? todayLocal(), endsOn: expense?.endsOn ?? '', recurring: expense?.recurring ?? false });
  const category = f.category || cats[0] || '';
  const options = category && !cats.includes(category) ? [category, ...cats] : cats;
  const set = (k: 'concept' | 'category' | 'amount' | 'on' | 'endsOn') => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = useWrite(() => {
    const input = { on: f.on, concept: f.concept.trim(), category, amountCents: Math.round(Math.max(0, parseNumber(f.amount)) * 100), recurring: f.recurring, endsOn: f.recurring && f.endsOn ? f.endsOn : null };
    return expense ? expensesApi.update(expense.id, input) : expensesApi.create(input);
  }, { touches: ['expenses', 'reports', 'home', 'printers'], ok: () => es.toast['expense.saved'], onDone: onClose });
  const del = useWrite(() => expensesApi.remove(expense!.id), {
    touches: ['expenses', 'reports', 'home', 'printers'], ok: () => es.toast['expense.deleted'], onDone: onClose,
    undo: () => () => expensesApi.restore(expense!.id),
  });
  const submit = () => {
    if (!f.concept.trim()) { toast(es.fields['expense.concept.required']); return; }
    if (parseNumber(f.amount) <= 0) { toast(es.fields['expense.amount.required']); return; }
    if (f.recurring && f.endsOn && f.endsOn < f.on) { toast(es.fields['expense.endsOn.before_start']); return; }
    save.mutate(undefined);
  };
  return (
    <Dialog open title={expense ? L.editTitle : L.newTitle} onClose={onClose} busy={save.isPending} onSubmit={submit}>
      <Field label={L.concept}><input name="concepto" value={f.concept} onChange={set('concept')} placeholder={L.conceptPlaceholder} /></Field>
      <div className="grid2">
        <Field label={L.category}><select name="cat" value={category} onChange={set('category')}>{options.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label={L.amount}><UnitInput unit="$" name="monto" inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" /></Field>
      </div>
      <div className="grid2">
        <Field label={L.date}><input type="date" name="fecha" value={f.on} onChange={set('on')} /></Field>
        <Field label={L.until2} hint={L.untilHint}><input type="date" name="fin" value={f.endsOn} onChange={set('endsOn')} /></Field>
      </div>
      <label className="chk"><input type="checkbox" name="rec" checked={f.recurring} onChange={(e) => setF({ ...f, recurring: e.target.checked })} /><span>{L.recurring}</span><small>{L.recurringHint}</small></label>
      {expense ? <div className="det-z"><ConfirmButton variant="ghost" danger size="sm" confirmText={es.confirm.deleteQuestion} onConfirm={() => del.mutate(undefined)}>{L.delete}</ConfirmButton></div> : null}
    </Dialog>
  );
}
