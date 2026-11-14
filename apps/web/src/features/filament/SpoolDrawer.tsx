// Drawer of a spool (docs/06 §6, reference/ronda-4/filamentos.html aside): what is left, its cost and where the cost per gram of
// its filament comes from, Pesar en báscula (live «Quedan»), Terminar rollo (with a confirmation), Editar and its movements.
// Ronda 4 · exception 2: it is the overlay drawer opened by tapping the spool, not a fixed right column.
import type { FilamentDetail, FilamentListItem, Spool } from '@app/contract';
import { weighSpool } from '@app/core';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { Drawer } from '../../components/Drawer';
import { Field } from '../../components/Field';
import { Pill } from '../../components/Pill';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { centsTotal, date, grams } from '../../lib/format';
import { parseNumber, todayLocal } from '../../lib/input';
import { useWrite } from '../../lib/mutate';
import { useSettings } from '../../lib/queries';
import { useFilament } from './api';
import { MovementDialog } from './MovementDialog';
import { costSourceShort, filamentName, perGram, spoolName, SpoolTag } from './spools';
import { SPOOL_TONE } from './tone';

const L = es.screens.filaments;
const TOUCHES = ['filaments', 'products', 'collections', 'purchases', 'home'] as const;

export function SpoolDrawer({ spool, focus, filaments, onClose, onEdit, onFinish }: { spool: Spool | null; focus?: 'pesar' | 'movimientos' | undefined; filaments: readonly FilamentListItem[]; onClose: () => void; onEdit: (s: Spool) => void; onFinish: (s: Spool) => void }) {
  return (
    <Drawer open={Boolean(spool)} kind={L.spoolKind} onClose={onClose}>
      {spool ? <SpoolDetail key={spool.id} s={spool} focus={focus} f={filaments.find((x) => x.id === spool.filamentId)} onEdit={() => onEdit(spool)} onFinish={() => onFinish(spool)} /> : null}
    </Drawer>
  );
}

function SpoolDetail({ s, f, focus, onEdit, onFinish }: { s: Spool; f: FilamentListItem | undefined; focus?: 'pesar' | 'movimientos' | undefined; onEdit: () => void; onFinish: () => void }) {
  const detail = useFilament(s.filamentId).data;
  const settings = useSettings().data;
  const brand = s.brand || es.common.noBrand;
  const savedTare = settings?.catalogs.brands.find((b) => b.name === s.brand)?.tareGrams;
  const [scale, setScale] = useState('');
  const [tare, setTare] = useState<string | null>(null);
  const [move, setMove] = useState(false);
  const scaleRef = useRef<HTMLInputElement>(null);
  const movesRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus === 'pesar') scaleRef.current?.focus({ preventScroll: false });
    if (focus === 'movimientos') movesRef.current?.scrollIntoView({ block: 'start' });
  }, [focus, detail]);
  const tareValue = tare ?? (savedTare !== null && savedTare !== undefined ? String(savedTare) : '');
  const typed = scale.trim() !== '' && tareValue.trim() !== '';
  const w = typed ? weighSpool({ grams: s.grams, remaining: s.remainingGrams }, parseNumber(scale), parseNumber(tareValue)) : null;
  const save = useWrite(() => api.spools.weigh(s.id, { scaleGrams: parseNumber(scale), tareGrams: Math.round(parseNumber(tareValue)), on: todayLocal() }), {
    touches: [...TOUCHES, 'settings'],
    ok: (out) => (out.adjustmentGrams ? t('screens.filaments.weighedAdjust', { leftGrams: out.leftGrams, adjustmentGrams: out.adjustmentGrams }) : t('screens.filaments.weighed', { leftGrams: out.leftGrams })),
    onDone: () => { setScale(''); setTare(null); },
  });
  const name = f ? filamentName(f) : '';
  const empty = s.status === 'empty';
  return (
    <div className="sdr">
      <div className="sdr-h"><SpoolTag n={s.number} /><h2>{t('screens.filaments.spoolTitle', { name, brand })}</h2><Pill tone={SPOOL_TONE[s.status]}>{es.status.spool[s.status]}</Pill></div>
      <dl className="mini-kv">
        <div><dt>{L.left}</dt><dd className="num">{grams(s.remainingGrams)}</dd></div>
        <div><dt>{L.ofSpool}</dt><dd className="num">{grams(s.grams)}</dd></div>
        <div><dt>{L.cost}</dt><dd className="num">{s.noCost ? es.screens.spools.noCost : centsTotal(s.costCents + s.shippingCents)}{s.noCost ? null : <small>{t('screens.filaments.spoolBought', { date: date(s.purchasedOn) })}</small>}</dd></div>
      </dl>
      {f ? <p className="hint0">{t(s.noCost ? 'screens.filaments.noCostNote' : 'screens.filaments.costNote', { name, perGram: perGram(f.costPerGram), source: costSourceShort(f) })}</p> : null}
      <section aria-label={L.weighTitle}>
        <h3 className="lbl">{L.weighTitle}</h3>
        <div className="grid2">
          <Field label={L.scale}><UnitInput ref={scaleRef} unit="g" name="bascula" inputMode="decimal" value={scale} onChange={(e) => setScale(e.target.value)} placeholder="0" /></Field>
          <Field label={s.brand ? t('screens.filaments.tareOf', { brand: s.brand }) : L.tare}><UnitInput unit="g" name="tara" inputMode="numeric" value={tareValue} onChange={(e) => setTare(e.target.value)} placeholder="0" /></Field>
        </div>
        {w ? (
          w.ok
            ? <p className="weigh-r" aria-live="polite"><span>{L.left}</span><b className="num">{grams(w.leftGrams)}</b><span className="meta">{w.adjustmentGrams ? t('screens.filaments.weighAdjust', { adjustmentGrams: w.adjustmentGrams }) : L.weighSame}</span></p>
            : <p className="weigh-r bad" aria-live="polite"><span>{t('screens.filaments.weighMax', { maxGrams: w.maxGrams })}</span></p>
        ) : <p className="weigh-r"><span>{L.left}</span><b className="num">{grams(s.remainingGrams)}</b><span className="meta">{L.weighAsk}</span></p>}
        <div className="acts">
          <Button variant="primary" disabled={!w?.ok} busy={save.isPending} onClick={() => save.mutate(undefined)}>{L.saveWeight}</Button>
          <Button disabled={empty} onClick={onFinish}>{L.finish}</Button>
          <Button onClick={onEdit}>{es.common.edit}</Button>
        </div>
        <p className="meta hint">{L.finishHint}</p>
      </section>
      <SpoolMovements s={s} detail={detail} sectionRef={movesRef} onRecord={() => setMove(true)} />
      {move && detail ? <MovementDialog f={detail} spoolId={s.id} onClose={() => setMove(false)} /> : null}
    </div>
  );
}

function SpoolMovements({ s, detail, sectionRef, onRecord }: { s: Spool; detail: FilamentDetail | undefined; sectionRef: RefObject<HTMLElement | null>; onRecord: () => void }) {
  const moves = (detail?.movements ?? []).filter((m) => m.spoolId === s.id);
  return (
    <section ref={sectionRef} aria-label={L.movements}>
        <h3 className="lbl">{L.movements}</h3>
        {moves.length ? (
          <ul className="mv">
            {moves.map((m) => (
              <li key={m.id}>
                <span className="num">{date(m.on)}</span>
                <span><b>{es.status.spoolMovement[m.kind]}</b>{m.note || m.kind === 'purchase' ? <span className="meta">{m.note || L.purchaseNote}</span> : null}</span>
                <b className={`num${m.grams >= 0 ? ' pos' : ''}`}>{m.grams > 0 ? '+' : ''}{grams(m.grams)}</b>
              </li>
            ))}
          </ul>
        ) : <p className="meta">{detail ? L.noSpoolMovements : es.common.loading}</p>}
        <div className="acts"><Button size="sm" onClick={onRecord} disabled={!detail}>{L.recordMovement}</Button></div>
      </section>
  );
}

/** Terminar rollo (ronda-4 §2.6): what is left goes as waste («Rollo terminado») and the spool is Vacío. */
export function FinishDialog({ spool, filament, onClose }: { spool: Spool; filament: FilamentListItem | undefined; onClose: () => void }) {
  const save = useWrite(() => api.spools.finish(spool.id, { on: todayLocal() }), {
    touches: [...TOUCHES], ok: () => t('screens.filaments.finished', { number: spoolName(spool.number) }), onDone: onClose,
  });
  const name = filament ? filamentName(filament) : '';
  return (
    <Dialog open className="sheet" title={t('screens.filaments.finishTitle', { number: spoolName(spool.number) })} submitLabel={L.finish} busy={save.isPending} onClose={onClose} onSubmit={() => save.mutate(undefined)}>
      <p>{t('screens.filaments.finishText', { leftGrams: spool.remainingGrams, name, afterGrams: Math.max(0, (filament?.remainingGrams ?? 0) - spool.remainingGrams) })}</p>
    </Dialog>
  );
}
