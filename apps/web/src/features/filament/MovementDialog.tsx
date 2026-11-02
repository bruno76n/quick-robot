import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FilamentDetail } from '@app/contract';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Field } from '../../components/Field';
import { Note } from '../../components/Note';
import { useToast } from '../../components/Toast';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { api } from '../../lib/api';
import { errorText } from '../../lib/error-text';
import { formatGrams, formatShortDate, todayIso } from '../../lib/format';
import { numFromText } from '../../lib/numbers';
import { useInvalidate } from '../../lib/queries';
import { filamentKeys } from './api';
import { filamentName } from './names';

const t = es.filament.movement;
type Kind = keyof typeof t.kinds;

/** "Registrar movimiento" of a filament: consumption, failure, waste or adjustment, from a chosen spool. */
export function MovementDialog({ filament, spoolId, onClose }: { filament: FilamentDetail; spoolId?: string; onClose: () => void }) {
  const toast = useToast((s) => s.show);
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const withMaterial = filament.spools.filter((s) => s.status !== 'empty');
  const [kind, setKind] = useState<Kind>('consumption');
  const [grams, setGrams] = useState('');
  const [sid, setSid] = useState(spoolId ?? withMaterial[0]?.id ?? filament.spools[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const g = numFromText(grams);
  const sign = kind === 'adjust+' ? 1 : -1;
  const spool = filament.spools.find((s) => s.id === sid);
  const after = Math.max(0, filament.remainingGrams + sign * (g > 0 ? g : 0));
  const submit = async () => {
    if (!(g > 0)) return setErr(t.missingGrams);
    try {
      const r = await api.filaments.recordMovement(sid, {
        kind: kind === 'adjust+' || kind === 'adjust-' ? 'adjustment' : kind,
        grams: kind === 'adjust+' ? g : kind === 'adjust-' ? -g : g,
        note: note.trim(),
        on: todayIso(),
      });
      qc.setQueryData(filamentKeys.detail(r.filament.id), r.filament);
      await invalidate('spools');
      toast(t.saved);
      onClose();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.title(filamentName(filament))}
      onSubmit={(e) => (e.preventDefault(), void submit())}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {es.app.cancel}
          </Button>
          <Button variant="primary" type="submit">
            {t.submit}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-[14px] gap-y-3 max-[560px]:grid-cols-1">
        <Field label={t.kind} htmlFor="mv-kind">
          <select id="mv-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            {(Object.keys(t.kinds) as Kind[]).map((k) => (
              <option key={k} value={k}>
                {t.kinds[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.grams} htmlFor="mv-g">
          <UnitInput id="mv-g" unit={es.units.grams} inputMode="decimal" placeholder="0" value={grams} onChange={(e) => setGrams(e.target.value)} data-autofocus="" />
        </Field>
      </div>
      {filament.spools.length > 1 && (
        <Field label={t.spool} htmlFor="mv-spool">
          <select id="mv-spool" value={sid} onChange={(e) => setSid(e.target.value)}>
            {filament.spools.map((s) => (
              <option key={s.id} value={s.id}>
                {t.spoolOption(s.brand || es.filament.noBrand, formatShortDate(s.purchasedOn), formatGrams(s.remainingGrams))}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t.note} htmlFor="mv-note">
        <input id="mv-note" placeholder={t.notePlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Note tone={sign < 0 && spool && g > spool.remainingGrams + 0.05 ? 'warn' : 'plain'}>{t.after(formatGrams(after), filamentName(filament))}</Note>
      {err && (
        <p role="alert" className="rounded-card bg-red-soft px-[14px] py-[11px] text-[13.5px] text-red-ink">
          {err}
        </p>
      )}
    </Dialog>
  );
}
