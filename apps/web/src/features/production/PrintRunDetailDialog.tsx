// Detail of a print run (mockup prodDlg): what it used, what it did, and "Eliminar registro" unless it is locked (docs/04 §8).
import { ConfirmButton } from '../../components/ConfirmButton';
import { Dialog } from '../../components/Dialog';
import { Icon } from '../../components/Icon';
import { Pill, Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { date, grams, number1 } from '../../lib/format';
import { go } from '../../lib/nav';
import { productionApi, usePrintRun, type PrintRunDetail } from './api';
import { orderHref, reasonLabel, REASON_TONE, ResultPill, runName } from './runs';
import { useWriteWithWarnings, warningTexts } from './write';

const L = es.screens.production;

export function lockText(r: PrintRunDetail): string {
  if (!r.lock) return '';
  return t(`errorParts.PRINT_RUN_LOCKED.${r.lock.reason}`, { pieces: r.lock.pieces });
}

export function PrintRunDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: r } = usePrintRun(id);
  const del = useWriteWithWarnings(() => productionApi.remove(id), {
    touches: ['printRuns', 'filaments', 'stock', 'supplies', 'printers', 'purchases', 'home', 'products'],
    ok: (_o, ws) => [
      es.toast['printRun.deleted'],
      r && r.returnGrams > 0 ? t('toast.printRun.deleted.filamentReturned', { grams: grams(r.returnGrams) }) : '',
      ...warningTexts(ws),
      r && r.piecesAdded ? t('toast.printRun.deleted.piecesRemoved', { count: r.piecesAdded }) : '',
      r && r.hours > 0 && r.printerName ? t('screens.production.hoursRemoved', { h: number1(r.hours), printer: r.printerName }) : '',
    ].filter(Boolean).join(' '),
    onDone: onClose,
  });
  const effect = !r ? '' : r.result !== 'ok' ? L.failedNoAdd : r.reason === 'stock' ? (r.piecesAdded ? t('screens.production.added', { count: r.piecesAdded }) : L.notAdded) : '';
  const lock = r ? lockText(r) : '';
  return (
    <Dialog open wide title={r ? t('screens.production.detailTitle', { date: date(r.on) }) : es.common.loading} onClose={onClose} cancelLabel={es.common.close}>
      {r ? (
        <>
          <div className="det-h"><div><h2>{runName(r)}</h2><small><Pill tone={REASON_TONE[r.reason]}>{reasonLabel(r)}</Pill> <ResultPill result={r.result} /></small></div></div>
          <dl className="dl">
            <div><dt>{L.printer}</dt><dd>{r.printerId ? r.printerName ?? <span className="mut">{L.printerDeleted}</span> : <span className="mut">{L.noPrinter}</span>}</dd></div>
            <div><dt>{L.time}</dt><dd className="num">{t('screens.production.hoursShort', { h: number1(r.hours) })}</dd></div>
          </dl>
          <span className="k">{L.filament}</span>
          <ul className="fl-u">
            {r.filaments.length ? r.filaments.map((f) => <li key={f.filamentId}><Swatch hex={f.hex} /><span>{f.name}</span><b className="num">{grams(f.grams)}</b></li>) : <li className="mut">{L.noFilament}</li>}
          </ul>
          {r.photoUrl ? <p><img className="run-photo" src={r.photoUrl} alt={L.photo} /></p> : null}
          {effect ? <p className="note">{effect}</p> : null}
          {r.reason === 'order' ? (
            <p className="note">{lock}{r.orderId ? <> <button type="button" className="link" onClick={() => { onClose(); go(orderHref(r.orderId!)); }}>{L.openOrder}</button></> : null}</p>
          ) : lock ? (
            <p className="status warn" data-testid="run-locked"><Icon name="warn" size={16} /><span>{lock}</span></p>
          ) : (
            <>
              <p className="hint">
                {L.undoLead}
                {r.returnGrams > 0 ? t('screens.production.undoReturns', { grams: grams(r.returnGrams) }) : r.filaments.length ? L.undoNotReturned : L.undoNothing}
                {r.piecesAdded ? t('screens.production.undoPieces', { count: r.piecesAdded }) : ''}
                {r.hours > 0 && r.printerName ? t('screens.production.undoHours', { h: number1(r.hours) }) : ''}
                {L.undoEnd}
              </p>
              <ConfirmButton variant="ghost" danger confirmText={es.confirm.tapAgainDelete} onConfirm={() => del.mutate(undefined)} busy={del.isPending}>{L.deleteRun}</ConfirmButton>
            </>
          )}
        </>
      ) : <div className="skel" />}
    </Dialog>
  );
}
