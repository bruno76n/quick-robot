// Producción (docs/06 §9): what is printing now, every print run with filters by reason and totals; register, open and undo a run.
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { PageHead } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Pill, Swatch } from '../../components/Pill';
import { Table } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { date, grams, number1, pct, queueDuration } from '../../lib/format';
import { go } from '../../lib/nav';
import { usePrinters, useSettings } from '../../lib/queries';
import { usePrintRuns, type PrintRunReason } from './api';
import { tbOnly } from './bold';
import { PrintRunDetailDialog } from './PrintRunDetailDialog';
import { PrintRunDialog } from './PrintRunDialog';
import { orderHref, reasonLabel, REASON_TONE, ResultPill, runName } from './runs';

const L = es.screens.production;
type Filter = 'all' | PrintRunReason;
const FILTERS: readonly [Filter, string][] = [['all', L.filterAll], ['stock', L.filterStock], ['order', L.filterOrder], ['test', L.filterTest]];

export function ProductionPage() {
  const search = useSearch({ strict: false }) as { motivo?: PrintRunReason };
  const filter: Filter = search.motivo ?? 'all';
  const { data, isLoading } = usePrintRuns();
  const printers = usePrinters().data?.items ?? [];
  const reserve = useSettings().data?.settings.failurePct ?? 0;
  const [registering, setRegistering] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const all = data?.items ?? [];
  const list = all.filter((r) => filter === 'all' || r.reason === filter).sort((a, b) => b.on.localeCompare(a.on) || (b.id > a.id ? 1 : -1));
  const failed = list.filter((r) => r.result === 'fail').length;
  const rate = list.length ? (failed / list.length) * 100 : 0;
  const usedGrams = list.reduce((a, r) => a + r.grams, 0);
  const tests = list.filter((r) => r.reason === 'test');
  const printing = printers.flatMap((p) => p.queue.map((e, pos) => ({ p, e, pos })));
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={<Button variant="primary" icon="plus" onClick={() => setRegistering(true)}>{L.register}</Button>} />
      {printing.length ? (
        <section className="enc">
          <h2>{L.printingNow}</h2>
          <ul className="pvl">
            {printing.map(({ p, e, pos }) => (
              <li key={e.id}>
                <div><b>{e.text}</b><small className="blk">{p.name} · <a className="link" href={orderHref(e.orderId)} onClick={(ev) => { ev.preventDefault(); go(orderHref(e.orderId)); }}>{t('screens.production.order', { folio: e.orderNumber })}</a> · {pos === 0 ? t('screens.production.left', { time: queueDuration(e.remainingMinutes) }) : L.queued}</small></div>
                {pos === 0 ? <div className="prog noz enc-b" role="img" aria-label={`${e.progress}%`}><i style={{ width: `${e.progress}%` }} /></div> : <Pill>{L.queuedChip}</Pill>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="tags" role="group" aria-label={L.filterLabel}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`tag${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => go(k === 'all' ? '/produccion' : `/produccion?motivo=${k}`, true)}>
            {label} {k === 'all' ? all.length : all.filter((r) => r.reason === k).length}
          </button>
        ))}
      </div>
      {data ? (
        <section className="brf one sm">
          <div>
            {list.length ? (
              <>
                <p className="brf-l">
                  {tbOnly('screens.production.summary', { count: list.length, grams: usedGrams }, { count: '', grams: '' })}{' '}
                  {failed ? tbOnly('screens.production.failed', { failed, rate: pct(rate), reserve: pct(reserve) }, { failed: rate > reserve ? 'r' : '' }) : L.noneFailed}
                  {tests.length ? <> {t('screens.production.tests', { count: tests.length, grams: grams(tests.reduce((a, r) => a + r.grams, 0)) })}</> : null}
                </p>
                <ResultBar ok={list.length - failed} fail={failed} />
              </>
            ) : <p className="brf-l">{L.summaryEmpty}</p>}
          </div>
        </section>
      ) : null}
      <Table head={<><th>{L.colDate}</th><th>{L.colDetail}</th><th>{L.colPrinter}</th><th>{L.colFilament}</th><th className="r">{L.colGrams}</th><th className="r">{L.colTime}</th><th>{L.colResult}</th></>}>
        {isLoading ? <tr><td colSpan={7}><div className="skel" /></td></tr> : null}
        {data && !list.length ? <tr><td colSpan={7} className="empty-td"><Mascot size={48} /><p>{L.empty}</p></td></tr> : null}
        {list.map((r) => (
          <tr key={r.id} className="click" tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(r.id); }} data-testid="print-run-row">
            <td>{date(r.on)}</td>
            <td><b>{runName(r)}</b><small className="blk"><Pill tone={REASON_TONE[r.reason]}>{reasonLabel(r)}</Pill></small></td>
            <td>{r.printerId ? r.printerName ?? <span className="mut">{L.printerDeleted}</span> : ''}</td>
            <td><span className="swstack">{r.filaments.map((f) => <Swatch key={f.filamentId} hex={f.hex} />)}</span></td>
            <td className="r num">{grams(r.grams)}</td>
            <td className="r num">{t('screens.production.hoursShort', { h: number1(r.hours) })}</td>
            <td><ResultPill result={r.result} /></td>
          </tr>
        ))}
      </Table>
      {registering ? <PrintRunDialog onClose={() => setRegistering(false)} /> : null}
      {open ? <PrintRunDetailDialog id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** Mockup c100Bar with base 0: good runs in green, failed in red, legend with the count of each. */
function ResultBar({ ok, fail }: { ok: number; fail: number }) {
  const segs = [{ name: L.barOk, n: ok, color: '--green', cls: 'dk gan' }, { name: L.barFail, n: fail, color: '--red', cls: '' }];
  const total = Math.max(1, ok + fail);
  const runs = (n: number) => t('screens.production.runs', { count: n });
  return (
    <>
      <div className="c100 sm" role="img" aria-label={L.barAria}>
        {segs.filter((s) => s.n > 0).map((s) => <i key={s.name} className={s.cls} style={{ width: `${((s.n / total) * 100).toFixed(2)}%`, ['--s' as string]: `var(${s.color})` }} data-tip={`${s.name}: ${runs(s.n)}`} tabIndex={0} />)}
      </div>
      <ul className="c100-l">
        {segs.map((s) => <li key={s.name} className={s.cls}><span className="lk" style={{ ['--s' as string]: `var(${s.color})` }} /><span className="nm">{s.name}</span><b className="num">{runs(s.n)}</b></li>)}
      </ul>
    </>
  );
}
