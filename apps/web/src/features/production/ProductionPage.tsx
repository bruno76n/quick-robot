// Producción (docs/06 §9, ronda-3 produccion.html): what is printing now, figures of the runs, filters by reason and the log; register, open and undo a run.
import type { PrinterView } from '@app/contract';
import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { Kpis } from '../../components/Kpis';
import { Meter } from '../../components/Meter';
import { PageHead } from '../../components/PageHead';
import { Panel } from '../../components/Panel';
import { Button } from '../../components/Button';
import { Mascot } from '../../components/Mascot';
import { Pill, Swatch } from '../../components/Pill';
import { Table, Td, Th } from '../../components/Table';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { date, grams, number1, pct, queueDuration } from '../../lib/format';
import { go } from '../../lib/nav';
import { usePrinters, useSettings } from '../../lib/queries';
import { usePrintRuns, type PrintRunReason } from './api';
import { PrintRunDetailDialog } from './PrintRunDetailDialog';
import { PrintRunDialog } from './PrintRunDialog';
import { orderHref, reasonLabel, ResultPill, runName } from './runs';
import './production.css';

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
  const printing = printers.flatMap((p) => p.queue);
  return (
    <>
      <PageHead title={L.title} sub={L.sub} actions={<Button variant="primary" icon="plus" onClick={() => setRegistering(true)}>{L.register}</Button>} />
      <div className={`pr2${printing.length ? '' : ' one'}`}>
        {printing.length ? <PrintingNow printers={printers} /> : null}
        {data ? <Kpis label={L.kpisAria} items={[
          { label: L.kRuns, value: list.length },
          { label: L.kOk, value: list.length - failed, sub: pct(list.length ? 100 - rate : 0), tone: 'net' },
          { label: L.kFail, value: failed, sub: t('screens.production.reserveOf', { rate: pct(rate), reserve: pct(reserve) }), tone: failed && rate > reserve ? 'bad' : '' },
          { label: L.kFilament, value: grams(usedGrams) },
        ]} /> : null}
      </div>
      <div className="tags" role="group" aria-label={L.filterLabel}>
        {FILTERS.map(([k, label]) => (
          <button key={k} type="button" className={`tag${filter === k ? ' on' : ''}`} aria-pressed={filter === k} onClick={() => go(k === 'all' ? '/produccion' : `/produccion?motivo=${k}`, true)}>
            {label} {k === 'all' ? all.length : all.filter((r) => r.reason === k).length}
          </button>
        ))}
      </div>
      <Panel flush>
        <Table fit className="prod-log" head={<><Th>{L.colDate}</Th><Th>{L.colPiece}</Th><Th hideSm>{L.colPrinter}</Th><Th r>{L.colFilament}</Th><Th r hideSm>{L.colHours}</Th><Th>{L.colResult}</Th></>}>
          {isLoading ? <tr><td colSpan={6}><div className="skel" /></td></tr> : null}
          {data && !list.length ? <tr><td colSpan={6} className="empty-td"><Mascot size={48} /><p>{L.empty}</p></td></tr> : null}
          {list.map((r) => (
            <tr key={r.id} className="click" tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpen(r.id); }} data-testid="print-run-row">
              <Td className="num nw">{date(r.on)}</Td>
              <Td><b>{runName(r)}</b><span className="meta blk">{reasonLabel(r)}</span></Td>
              <Td hideSm>{r.printerId ? r.printerName ?? <span className="mut">{L.printerDeleted}</span> : ''}</Td>
              <Td r className="num nw"><span className="swstack">{r.filaments.map((f) => <Swatch key={f.filamentId} hex={f.hex} />)}</span>{grams(r.grams)}</Td>
              <Td r hideSm className="num">{t('screens.production.hoursShort', { h: number1(r.hours) })}</Td>
              <Td><ResultPill result={r.result} /></Td>
            </tr>
          ))}
        </Table>
      </Panel>
      {registering ? <PrintRunDialog onClose={() => setRegistering(false)} /> : null}
      {open ? <PrintRunDetailDialog id={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** "En impresión": each queued job with its printer, progress and time left (mockup .pp). */
function PrintingNow({ printers }: { printers: PrinterView[] }) {
  const printing = printers.flatMap((p) => p.queue.map((e, pos) => ({ p, e, pos })));
  const busy = printers.filter((p) => p.queue.length > 0).length;
  return (
    <Panel title={L.printingNow} aside={<span className="meta">{t('screens.production.printingOf', { count: busy, total: printers.length })}</span>}>
      <ul className={`prn-pp${printing.length > 1 ? ' two' : ''}`}>
        {printing.map(({ p, e, pos }) => (
          <li key={e.id}>
            <div className="prn-h"><b>{p.name}</b>{pos === 0 ? <span className="num">{pct(e.progress)}</span> : <Pill>{L.queuedChip}</Pill>}</div>
            <span className="meta">{e.text} · <a className="link" href={orderHref(e.orderId)} onClick={(ev) => { ev.preventDefault(); go(orderHref(e.orderId)); }}>{t('screens.production.order', { folio: e.orderNumber })}</a></span>
            {pos === 0 ? <><Meter value={e.progress} /><span className="meta">{t('screens.production.left', { time: queueDuration(e.remainingMinutes) })}</span></> : <span className="meta">{L.queued}</span>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
