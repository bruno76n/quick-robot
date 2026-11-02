// Movimiento de rollo (docs/06 §6): consumption, failure, waste or adjustment, from one spool, with a note.
import type { FilamentDetail } from '@app/contract';
import { useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { toast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { date, grams } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';

const L = es.screens.movementDialog;
type Kind = 'consumption' | 'failure' | 'waste' | 'adjustment+' | 'adjustment-';

export function MovementDialog({ f, spoolId, onClose }: { f: FilamentDetail; spoolId?: string | undefined; onClose: () => void }) {
  const live = f.spools.filter((s) => s.status !== 'empty');
  const [kind, setKind] = useState<Kind>('consumption');
  const [g, setG] = useState('');
  const [spool, setSpool] = useState(spoolId ?? live[0]?.id ?? f.spools[0]?.id ?? '');
  const [note, setNote] = useState('');
  const name = `${f.material} ${f.color}`;
  const s = f.spools.find((x) => x.id === spool);
  const save = useWrite(() => {
    const amount = parseNumber(g);
    const k = kind.startsWith('adjustment') ? 'adjustment' : (kind as 'consumption');
    return api.spools.move(spool, { kind: k, grams: kind === 'adjustment+' ? amount : -amount, on: todayLocal(), ...(note.trim() ? { note } : {}) });
  }, { touches: ['filaments', 'products', 'collections'], ok: () => es.toast['spool.movementRecorded'], onDone: onClose });
  return (
    <Dialog open title={t('screens.movementDialog.title', { name })} onClose={onClose} submitLabel={L.register} busy={save.isPending} onSubmit={() => {
      const amount = parseNumber(g);
      if (amount <= 0) { toast(es.fields['spoolMovement.grams.required']); return; }
      if (kind !== 'adjustment+' && s && amount > s.remainingGrams + 0.05) { toast(t('errors.SPOOL_INSUFFICIENT', { availableGrams: s.remainingGrams })); return; }
      save.mutate(undefined);
    }}>
      <div className="grid2">
        <Field label={L.kind}><select name="tipo" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
          <option value="consumption">{L.consumption}</option><option value="failure">{L.failure}</option><option value="waste">{L.waste}</option><option value="adjustment+">{L.adjustUp}</option><option value="adjustment-">{L.adjustDown}</option>
        </select></Field>
        <Field label={L.grams}><UnitInput unit="g" name="g" inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} placeholder="0" /></Field>
      </div>
      {f.spools.length > 1 ? <Field label={L.whichSpool}><select name="rollo" value={spool} onChange={(e) => setSpool(e.target.value)}>{f.spools.map((x) => <option key={x.id} value={x.id}>{t('screens.movementDialog.spoolOption', { brand: x.brand || es.common.noBrand, date: date(x.purchasedOn), grams: grams(x.remainingGrams) })}</option>)}</select></Field> : null}
      <Field label={L.note}><input name="nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder={L.notePlaceholder} /></Field>
      <p className="note">{t('screens.movementDialog.after', { grams: grams(f.remainingGrams), name })}{f.spools.length > 1 && s ? ` ${t('screens.movementDialog.inSpool', { grams: grams(s.remainingGrams), brand: s.brand || es.common.noBrand })}` : ''}</p>
    </Dialog>
  );
}
