// Ajustes › Copia de seguridad and Vaciar negocio (docs/06 §15, docs/12 §10, docs/15 §5; mockup datosHTML, copiaManual,
// copiasAuto, confirmarRespaldo, leerArchivoRespaldo, aplicarRespaldo). Native functions only improve (CLAUDE.md rule 8).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { Button } from '../../components/Button';
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { tb } from '../../i18n/rich';
import { t } from '../../i18n/t';
import { ApiError } from '../../lib/api';
import { errorText } from '../../lib/errors';
import { date, daysBetween } from '../../lib/format';
import { todayLocal } from '../../lib/input';
import { saveFile } from '../../lib/platform';
import { keys, useSettings } from '../../lib/queries';
import { backupApi, previewBackup, type FilePreview, type ImportResult } from './backupApi';

const L = es.screens.backup;
const backupsKey = [...keys.settings, 'backups'] as const;
/** The desktop shell may expose the log under either name; both are optional (docs/15 §6). */
type LogBridge = { showLogs?: () => Promise<void>; showLogFile?: () => Promise<void> };
const showLogs = () => { const d = window.desktop as LogBridge | undefined; return d?.showLogs ?? d?.showLogFile; };

type Source = { kind: 'file'; blob: Blob; name: string } | { kind: 'auto'; id: string };
interface Pending { source: Source; origin: string; preview: FilePreview | null; invalid: boolean }
interface Failure { text: string; lines: string[] }

/** The order of the summary: what the person recognizes first. Tables with no rows are left out. */
const SUMMARY: (keyof typeof L.counts)[] = ['product', 'collection', 'filament', 'spool', 'supply', 'printer', 'customer', 'sale', 'order', 'print_run', 'expense', 'sales_channel'];

/** A server difference (`spool:PLA Negro 535 → 410`, `sales.income 13170 → 13000`, …) in Spanish. */
export function differenceText(d: string): string {
  const named = /^(spool|stock):(.+) (\S+) → (\S+)$/.exec(d);
  if (named) {
    const [, kind, name, a, b] = named;
    return kind === 'spool' ? t('screens.backup.diff.spool', { name, expectedGrams: Number(a), foundGrams: Number(b) })
      : t('screens.backup.diff.stock', { name, expected: a, found: b });
  }
  const sum = /^(sales\.income|sales\.profit|owed) (\S+) → (\S+)$/.exec(d);
  if (sum) {
    const key = sum[1] === 'sales.income' ? 'income' : sum[1] === 'sales.profit' ? 'profit' : 'owed';
    return t(`screens.backup.diff.${key}`, { expectedCents: Math.round(Number(sum[2]) * 100), foundCents: Math.round(Number(sum[3]) * 100) });
  }
  return d;
}

/** Server notes (`channel:<name>`, `customer:Sin nombre`, `image:<kind>`) in Spanish; images are counted. */
export function noteTexts(notes: string[]): string[] {
  const out: string[] = [];
  const images = { product_photo: 0, customer_logo: 0 };
  for (const n of notes) {
    if (n.startsWith('channel:')) out.push(t('screens.backup.notes.channel', { name: n.slice('channel:'.length) }));
    else if (n.startsWith('customer:')) out.push(L.notes.nameless);
    else if (n === 'image:product_photo') images.product_photo++;
    else if (n === 'image:customer_logo') images.customer_logo++;
  }
  if (images.product_photo) out.push(t('screens.backup.notes.productPhoto', { count: images.product_photo }));
  if (images.customer_logo) out.push(t('screens.backup.notes.customerLogo', { count: images.customer_logo }));
  return out;
}

function failureOf(e: unknown): Failure {
  const f = errorText(e);
  const code = e instanceof ApiError ? e.code : '';
  // IMPORT_INVALID_FILE already says it; the others get "No se cambió ningún dato" (docs/15 §5).
  return code === 'IMPORT_INVALID_FILE' ? f : { text: `${f.text} ${L.noChange}`, lines: f.lines };
}

/** Blocks the whole screen while the import runs (docs/15 §2: "Importando… No cerrar la aplicación."). */
function Importing({ open }: { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
    if (!open && d.open) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  }, [open]);
  return <dialog ref={ref} className="bak-busy" onCancel={(e) => e.preventDefault()} aria-busy="true"><p role="alert">{es.screens.fatal.importing.text}</p></dialog>;
}

export function BackupSection() {
  const qc = useQueryClient();
  const settings = useSettings().data?.settings;
  const backups = useQuery({ queryKey: backupsKey, queryFn: async () => (await backupApi.list()).data });
  const [busy, setBusy] = useState<'download' | 'auto' | 'import' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const today = todayLocal();
  const last = settings?.lastBackupOn ?? null;
  const days = last ? Math.max(0, daysBetween(last, today)) : null;
  const status: [string, 'good' | 'warn'] = days === null ? [L.never, 'warn'] : days === 0 ? [L.today, 'good'] : [t('screens.backup.daysAgo', { days }), days <= 7 ? 'good' : 'warn'];
  const logs = showLogs();

  const download = async () => {
    setBusy('download');
    try {
      const { name, bytes } = await backupApi.exportFile();
      const native = window.desktop?.saveFile;
      const saved = native ? await native(name, bytes, 'application/json') : (await saveFile(name, bytes, 'application/json'), true);
      if (saved) toast(es.toast['data.exported']);
      await qc.invalidateQueries({ queryKey: keys.settings });
      await qc.invalidateQueries({ queryKey: keys.home });
    } catch (e) { toast(errorText(e).text); } finally { setBusy(null); }
  };

  const choose = async (name: string, blob: Blob) => {
    let text: string;
    try { text = await blob.text(); } catch { toast(L.readFailed); return; }
    const preview = previewBackup(text);
    setFailure(preview ? null : { text: es.errors.IMPORT_INVALID_FILE, lines: [] });
    setPending({ source: { kind: 'file', blob, name }, origin: name, preview, invalid: !preview });
  };
  const onInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void choose(f.name, f);
  };
  const onPick = (e: MouseEvent) => {
    const open = window.desktop?.openFile;
    if (!open) return; // the label opens the browser's file input
    e.preventDefault();
    void open(['json']).then((f) => { if (f) void choose(f.name, new Blob([f.data as BlobPart], { type: 'application/json' })); }, () => toast(L.readFailed));
  };

  const apply = async () => {
    if (!pending || pending.invalid) return;
    setBusy('import');
    setFailure(null);
    try {
      const s = pending.source;
      const r = s.kind === 'file' ? await backupApi.importFile(s.blob, s.name) : await backupApi.restore(s.id);
      setPending(null);
      setResult(r.data);
      toast(es.toast['data.restored']);
      await qc.invalidateQueries(); // docs/12 §10 "Invalidan: todo"
    } catch (e) {
      setFailure(failureOf(e));
    } finally { setBusy(null); }
  };

  const makeNow = async () => {
    setBusy('auto');
    try { await backupApi.create(); toast(L.backupMade); await qc.invalidateQueries({ queryKey: backupsKey }); } catch (e) { toast(errorText(e).text); } finally { setBusy(null); }
  };

  const close = () => { if (busy !== 'import') { setPending(null); setFailure(null); } };
  const list = backups.data ?? [];
  return (
    <section className="panel dat" id="set-backup" data-testid="backup">
      <header className="panel-h">
        <h2>{L.title}</h2>
        <div className="panel-a dat-st">{last ? <span className="meta bak-last">{t('screens.backup.lastOn', { date: date(last) })}</span> : null}<span className={`pill ${status[1]}`}>{status[0]}</span></div>
      </header>
      <h3 className="lbl">{L.autoTitle} <small>{L.autoSub}</small></h3>
      {list.length ? (
        <ul className="auto-l" aria-label={L.autoTitle}>
          {list.map((c) => (
            <li key={c.id}>
              <b className="num">{date(c.on)}</b>
              <span className="meta">{t('screens.backup.sizeKb', { size: c.sizeKb })}</span>
              <Button size="sm" onClick={() => { setFailure(null); setPending({ source: { kind: 'auto', id: c.id }, origin: t('screens.backup.autoOrigin', { date: date(c.on) }), preview: null, invalid: false }); }}>{L.restore}</Button>
            </li>
          ))}
        </ul>
      ) : <p className="meta">{L.autoEmpty}</p>}
      <div className="btnrow">
        <Button variant="primary" onClick={() => void download()} busy={busy === 'download'}>{L.download}</Button>
        <label className="btn" htmlFor="rb-file" onClick={onPick}>{L.restoreFile}</label>
        <input type="file" id="rb-file" accept=".json,application/json" className="sr" onChange={onInput} data-testid="restore-file" />
        <Button variant="ghost" onClick={() => void makeNow()} busy={busy === 'auto'}>{L.backupNow}</Button>
        {logs ? <Button variant="ghost" onClick={() => void logs()}>{L.showLogs}</Button> : null}
      </div>
      <p className="meta dat-h">{L.hint}</p>
      <p className="note">{L.warning}</p>

      <Dialog open={pending !== null} title={L.confirmTitle} onClose={close} submitLabel={L.restore} busy={busy === 'import'}
        {...(pending && !pending.invalid && !failure ? { onSubmit: () => void apply() } : {})}>
        {pending?.preview ? <p>{tb('screens.backup.confirmCounts', { origin: pending.origin, ...pending.preview })}</p> : pending ? <p><b>{pending.origin}</b></p> : null}
        {failure ? (
          <div className="bak-err" role="alert"><p className="note warn">{failure.text}</p>{failure.lines.map((l) => <p key={l} className="muted"><small>{l}</small></p>)}</div>
        ) : <p className="note">{L.confirmNote}</p>}
      </Dialog>
      <Importing open={busy === 'import'} />
      <RestoreSummary result={result} onClose={() => setResult(null)} />
    </section>
  );
}

/** What the import left (docs/12 §10): rows per table, the differences with the file's totals and the notes. */
function RestoreSummary({ result, onClose }: { result: ImportResult | null; onClose: () => void }) {
  const rows = result ? SUMMARY.filter((k) => (result.counts[k] ?? 0) > 0) : [];
  const notes = result ? noteTexts(result.notes) : [];
  return (
    <Dialog open={result !== null} title={L.doneTitle} onClose={onClose} cancelLabel={es.common.close}>
      {result ? (
        <div className="bak-sum" data-testid="restore-summary">
          <p>{L.doneLead}</p>
          <ul className="effects bak-counts">{rows.map((k) => <li key={k}>{L.counts[k]}: <b>{result.counts[k]}</b></li>)}</ul>
          {result.differences.length ? (
            <><h3>{L.differencesTitle}</h3><ul className="effects">{result.differences.map((d) => <li key={d}>{differenceText(d)}</li>)}</ul></>
          ) : <p className="note">{L.noDifferences}</p>}
          {notes.length ? <ul className="effects">{notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
          {result.backupId ? <p className="muted">{t('screens.backup.previousSaved', { date: /^\d{4}-\d{2}-\d{2}$/.test(result.backupId) ? date(result.backupId) : result.backupId })}</p> : null}
        </div>
      ) : null}
    </Dialog>
  );
}

/** "Vaciar negocio" (docs/06 §15): two taps, a backup first on the server, then everything reloads. */
export function ClearSection() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const clear = async () => {
    setBusy(true);
    try { await backupApi.clear(); await qc.invalidateQueries(); toast(es.toast['data.cleared']); } catch (e) { toast(errorText(e).text); } finally { setBusy(false); }
  };
  return (
    <section className="panel dat" id="set-clear" data-testid="clear">
      <header className="panel-h"><h2>{L.clearTitle}</h2></header>
      <p className="meta">{L.clearHint}</p>
      <div className="btnrow"><ConfirmButton confirmText={es.confirm.tapAgainClear} onConfirm={() => void clear()} busy={busy}>{L.clear}</ConfirmButton></div>
    </section>
  );
}
