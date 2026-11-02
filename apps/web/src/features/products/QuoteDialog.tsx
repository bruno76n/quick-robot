// "Cotizar a cliente": a message to copy; no cost nor margin, only what the customer sees (mockup).
import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { moneyTotal } from '../../lib/format';
import { num } from './costing';

export function QuoteDialog({ name, price, colors, attendedBy, onClose }: { name: string; price: number; colors: string[]; attendedBy: string; onClose: () => void }) {
  const L = es.screens.quote;
  const [n, setN] = useState('1');
  const [p, setP] = useState(price ? String(price) : '');
  const [days, setDays] = useState('5');
  const [who, setWho] = useState(attendedBy);
  const qty = Math.max(1, Math.round(num(n, 1)));
  const text = t('screens.quote.message', { name: name || L.piece, qty, price: moneyTotal(num(p)), total: moneyTotal(qty * num(p)), days: num(days, 5), colors: colors.join(` ${L.and} `), who });
  return (
    <Dialog open title={L.title} onClose={onClose} submitLabel={L.copy} onSubmit={() => { void navigator.clipboard?.writeText(text).then(() => toast(t('toast.copy.done', { what: L.messageCopied })), () => toast(es.toast['copy.failed'])); onClose(); }}>
      <div className="grid2">
        <Field label={L.qty}><input inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} /></Field>
        <Field label={L.pricePerPiece}><UnitInput unit="$" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} /></Field>
        <Field label={L.deliveryIn}><UnitInput unit={L.days} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></Field>
        <Field label={L.attends}><input value={who} onChange={(e) => setWho(e.target.value)} /></Field>
      </div>
      <Field label={L.messageLabel} hint={L.hint}><textarea rows={8} readOnly value={text} /></Field>
    </Dialog>
  );
}
