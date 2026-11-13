// "Ajustar existencias" (mockup ajusteDlg) and "Llevar existencias de otra pieza" (mockup stockOnDlg).
import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { toast } from '../../components/Toast';
import { es } from '../../i18n/es';
import { tb } from '../../i18n/rich';
import { t } from '../../i18n/t';
import { parseNumber } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { stockApi, type StockDetail } from './api';

const L = es.screens.stock;
type Reason = 'gift' | 'damaged' | 'extra' | 'count';
const NOTE: Record<Reason, string> = { gift: L.noteGift, damaged: L.noteDamaged, extra: L.noteExtra, count: L.noteCount };
const TOUCHES = ['stock', 'products', 'collections', 'home', 'reports'] as const;

const REASONS: [Reason, 'reasonGift' | 'reasonDamaged' | 'reasonExtra' | 'reasonCount'][] = [['gift', 'reasonGift'], ['damaged', 'reasonDamaged'], ['extra', 'reasonExtra'], ['count', 'reasonCount']];

export function AdjustDialog({ detail: s, onClose }: { detail: StockDetail; onClose: () => void }) {
  const [reason, setReason] = useState<Reason>('gift');
  const [qty, setQty] = useState('1');
  const [note, setNote] = useState('');
  const n = Math.max(0, Math.round(parseNumber(qty)));
  const delta = reason === 'count' ? n - s.physical : reason === 'extra' ? n : -n;
  // Same checks and texts as the mockup's preview; the server checks again (COUNT_UNCHANGED, INSUFFICIENT_STOCK).
  const problem = !n && reason !== 'count' ? L.needQty
    : reason === 'count' && n < s.reserved ? t('screens.stock.belowReserved', { min: s.reserved })
      : reason === 'count' && delta === 0 ? es.errors.COUNT_UNCHANGED
        : delta < 0 && -delta > s.free ? t('screens.stock.onlyFree', { free: s.free, reserved: s.reserved }) : '';
  const save = useWrite(() => stockApi.adjust(s.productId, {
    mode: reason === 'count' ? 'count' : 'delta', value: reason === 'count' ? n : delta,
    note: note.trim() ? t('screens.stock.noteWith', { reason: NOTE[reason], note: note.trim() }) : NOTE[reason],
  }), { touches: [...TOUCHES], ok: (out) => t('toast.stock.summary', { name: out.name, physical: out.physical }), onDone: onClose });
  return (
    <Dialog open title={t('screens.stock.adjustTitle', { name: s.name })} submitLabel={L.registerAdjust} onClose={onClose} busy={save.isPending}
      onSubmit={() => { if (problem) { toast(problem); return; } save.mutate(undefined); }}>
      <p>{tb('screens.stock.counts', { total: s.physical, free: s.free, reserved: s.reserved })}</p>
      {/* The four reasons at sight, like "Motivo" of Registrar impresión (ronda-2 §12, D8): one tap, arrows move. */}
      <div className="fld" role="radiogroup" aria-labelledby="aj-reason">
        <span id="aj-reason">{L.reason}</span>
        <div className="seg wide seg4">
          {REASONS.map(([value, label]) => <label key={value} className="rad"><input type="radio" name="tipo" value={value} checked={reason === value} onChange={() => setReason(value)} /><span>{L[label]}</span></label>)}
        </div>
      </div>
      <div className="grid2">
        <Field label={reason === 'count' ? L.countLabel : L.qtyLabel}><input name="n" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      </div>
      <Field label={L.note}><input name="nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L.notePlaceholder} /></Field>
      <p className={`note${problem ? ' warn' : ''}`} id="aj-prev">{problem || tb('screens.stock.preview', { from: s.physical, to: s.physical + delta })}</p>
    </Dialog>
  );
}

export function EnableDialog({ candidates, onClose, onDone }: { candidates: { id: string; name: string }[]; onClose: () => void; onDone: (productId: string) => void }) {
  const [pieceId, setPieceId] = useState(candidates[0]?.id ?? '');
  const [count, setCount] = useState('0');
  const n = Math.max(0, Math.round(parseNumber(count)));
  const save = useWrite(() => stockApi.enable(pieceId, n), {
    touches: [...TOUCHES],
    ok: (out) => `${t('toast.stock.trackingEnabled', { name: out.name })}${n ? t('screens.stock.enabledTotal', { count: n }) : L.enabledNone}`,
    onDone: (out) => onDone(out.productId),
  });
  return (
    <Dialog open title={L.enableTitle} submitLabel={L.enableSubmit} onClose={onClose} busy={save.isPending} onSubmit={() => { if (pieceId) save.mutate(undefined); }}>
      <p>{L.enableIntro}</p>
      <div className="grid2">
        <Field label={L.piece}><select name="prod" value={pieceId} onChange={(e) => setPieceId(e.target.value)}>{candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
        <Field label={L.initialCount} hint={L.initialHint}><input name="n" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} /></Field>
      </div>
    </Dialog>
  );
}
