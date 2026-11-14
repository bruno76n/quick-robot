// Which spool a print uses (ronda-4 §2.5, reference/ronda-4/impresion.html): per filament, what it needs with purge, the live
// spools with the suggested one marked and «before → after» of each, the bar of the chosen one (what goes in light grey) and
// «Repartir entre dos rollos». Previewed with core › planSpoolUse; the server applies the same rule and decides.
import type { FilamentListItem, Spool } from '@app/contract';
import { planSpoolUse, suggestedSpool, type SpoolPick, type SpoolPlan } from '@app/core';
import type { ReactNode } from 'react';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { pctOf } from '../../components/Meter';
import { Pill, Swatch } from '../../components/Pill';
import { UnitInput } from '../../components/UnitInput';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { grams as fmtGrams } from '../../lib/format';
import { parseNumber } from '../../lib/input';
import { filamentName, perGram, spoolName, SpoolTag, toSpoolInput } from './spools';

const L = es.screens.spoolUse;
const LIVE = 0.5;
/** What the person chose for one filament; nothing chosen = the automatic order (as before ronda 4). */
export interface SpoolChoice { split: boolean; first?: string | undefined; firstGrams?: string | undefined; second?: string | undefined }

const live = (f: FilamentListItem) => f.spools.filter((s) => s.status !== 'empty' && s.remainingGrams > LIVE);

function resolve(f: FilamentListItem, c: SpoolChoice | undefined) {
  const spools = live(f);
  const suggested = suggestedSpool(f.spools.map(toSpoolInput))?.id ?? spools[0]?.id;
  const first = c?.first && spools.some((s) => s.id === c.first) ? c.first : suggested;
  const second = c?.second && c.second !== first && spools.some((s) => s.id === c.second) ? c.second : spools.find((s) => s.id !== first)?.id;
  return { spools, suggested, first, second };
}

/** The parts sent to the server (logPrintRun › filaments[].spools); undefined while nothing was chosen. */
export function spoolPicks(f: FilamentListItem | undefined, c: SpoolChoice | undefined): SpoolPick[] | undefined {
  if (!f || !c || (!c.split && !c.first)) return undefined;
  const r = resolve(f, c);
  if (!r.first) return undefined;
  if (!c.split || !r.second) return [{ spoolId: r.first }];
  const g = parseNumber(c.firstGrams ?? '');
  return [{ spoolId: r.first, ...(g > 0 ? { grams: Math.round(g * 10) / 10 } : {}) }, { spoolId: r.second }];
}

export function planOf(f: FilamentListItem, grams: number, purgePct: number, c: SpoolChoice | undefined): SpoolPlan {
  const r = resolve(f, c);
  const picks = spoolPicks(f, c) ?? (r.first ? [{ spoolId: r.first }] : []);
  return planSpoolUse(f.spools.map(toSpoolInput), grams, purgePct, picks);
}

/** Grams each spool gives in a plan (consumption + purge) and its consumption and purge apart. */
export function partsOf(plan: SpoolPlan) {
  const out = new Map<string, { taken: number; consumption: number; purge: number }>();
  if (!plan.ok) return out;
  for (const m of plan.movements) {
    const p = out.get(m.spoolId) ?? { taken: 0, consumption: 0, purge: 0 };
    p.taken -= m.grams;
    if (m.kind === 'consumption') p.consumption -= m.grams; else p.purge -= m.grams;
    out.set(m.spoolId, p);
  }
  return out;
}

export function SpoolUse({ f, grams, purgePct, choice, onChange, gramsInput }: { f: FilamentListItem; grams: number; purgePct: number; choice: SpoolChoice | undefined; onChange: (c: SpoolChoice) => void; gramsInput?: ReactNode }) {
  const r = resolve(f, choice);
  const need = Math.max(0, grams) * (1 + purgePct / 100);
  const plan = planOf(f, grams, purgePct, choice);
  const parts = partsOf(plan);
  const name = filamentName(f);
  const taken = plan.ok ? plan.taken : 0;
  const c: SpoolChoice = choice ?? { split: false };
  return (
    <div className="fsec" data-testid="spool-use">
      <div className="fsec-h">
        <Swatch hex={f.hex} /><b>{name}</b>{gramsInput}
        <span className="meta num">{gramsInput ? t('screens.spoolUse.plusPurge', { purgePct, needGrams: need }) : t('screens.spoolUse.need', { pieceGrams: grams, purgePct, needGrams: need })}</span>
      </div>
      {r.spools.length ? (c.split && r.second ? (
        <Split f={f} spools={r.spools} first={r.first!} second={r.second} c={c} onChange={onChange} parts={parts} need={need} />
      ) : (
        <>
          <span className="lbl">{L.spool}</span>
          <ul className="spk" role="radiogroup" aria-label={t('screens.spoolUse.spoolOf', { name })}>
            {r.spools.map((s) => {
              const on = s.id === r.first;
              const after = Math.max(0, s.remainingGrams - need);
              return (
                <li key={s.id} className={on ? 'on' : ''}>
                  <label>
                    <input type="radio" name={`rollo-${f.id}`} value={s.id} checked={on} onChange={() => onChange({ ...c, split: false, first: s.id })} />
                    <SpoolTag n={s.number} />
                    <span className="pk-b"><b>{s.brand || es.common.noBrand}</b>{s.id === r.suggested ? <Pill tone="info">{s.remainingGrams < s.grams - 0.05 ? L.suggestedOpen : L.suggested}</Pill> : null}</span>
                    <span className="pk-a num">{t('screens.spoolUse.from', { before: fmtGrams(s.remainingGrams) })}<b>{fmtGrams(after)}</b></span>
                  </label>
                </li>
              );
            })}
          </ul>
          {r.first ? <After s={r.spools.find((s) => s.id === r.first)!} part={parts.get(r.first)} /> : null}
          <Rest plan={plan} parts={parts} spools={f.spools} first={r.first} />
          {r.spools.length > 1 ? <Button size="sm" icon="plus" onClick={() => onChange({ ...c, split: true, first: r.first })}>{L.split}</Button> : null}
        </>
      )) : <p className="note warn">{L.noSpools}</p>}
      {plan.ok ? null : <p className="note warn" role="alert">{plan.code === 'SPOOL_INSUFFICIENT' ? t('errors.SPOOL_INSUFFICIENT', { availableGrams: plan.availableGrams }) : es.errors.SPOOL_NOT_IN_FILAMENT}</p>}
      <p className="meta hint">{t('screens.spoolUse.total', { name, beforeGrams: f.remainingGrams, afterGrams: Math.max(0, f.remainingGrams - taken), perGram: perGram(f.costPerGram) })}</p>
    </div>
  );
}

/** The chosen spool before → after, with the bar: before in light grey, what is left in ink (mockup .ui-meter.two). */
function After({ s, part }: { s: Spool; part: { taken: number; consumption: number; purge: number } | undefined }) {
  const after = Math.max(0, s.remainingGrams - (part?.taken ?? 0));
  return (
    <div className="after">
      <div className="after-h"><SpoolTag n={s.number} /><b className="num">{t('screens.spools.beforeAfter', { before: fmtGrams(s.remainingGrams), after: fmtGrams(after) })}</b>
        {part ? <span className="meta">{t('screens.spoolUse.spent', { consumptionGrams: part.consumption, purgeGrams: part.purge })}</span> : null}</div>
      <span className="meter2" aria-hidden="true"><i className="u" style={{ width: `${pctOf(s.remainingGrams, s.grams)}%` }} /><i className="v" style={{ width: `${pctOf(after, s.grams)}%` }} /></span>
    </div>
  );
}

/** What the chosen spool does not cover comes from the others in the use order; or it is missing. */
function Rest({ plan, parts, spools, first }: { plan: SpoolPlan; parts: ReturnType<typeof partsOf>; spools: readonly Spool[]; first: string | undefined }) {
  if (!plan.ok) return null;
  const others = spools.filter((s) => s.id !== first && parts.has(s.id));
  if (!others.length && !plan.missing) return null;
  return (
    <p className="meta hint">
      {others.map((s) => t('screens.spoolUse.restFrom', { number: spoolName(s.number), takenGrams: parts.get(s.id)!.taken, before: fmtGrams(s.remainingGrams), after: fmtGrams(Math.max(0, s.remainingGrams - parts.get(s.id)!.taken)) })).join(' ')}
      {plan.missing ? ` ${t('screens.spoolUse.missing', { missingGrams: plan.missing })}` : ''}
    </p>
  );
}

function Split({ f, spools, first, second, c, onChange, parts, need }: { f: FilamentListItem; spools: Spool[]; first: string; second: string; c: SpoolChoice; onChange: (c: SpoolChoice) => void; parts: ReturnType<typeof partsOf>; need: number }) {
  const label = (s: Spool) => t('screens.spoolUse.option', { number: spoolName(s.number), brand: s.brand || es.common.noBrand, leftGrams: s.remainingGrams });
  const a = spools.find((s) => s.id === first)!;
  const used = spools.filter((s) => parts.has(s.id));
  return (
    <>
      <div className="split">
        <Field label={L.firstSpool}><select name={`rollo1-${f.id}`} value={first} onChange={(e) => onChange({ ...c, first: e.target.value })}>{spools.map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}</select></Field>
        <Field label={L.fromIt}><UnitInput unit="g" name={`g1-${f.id}`} inputMode="decimal" value={c.firstGrams ?? ''} placeholder={String(Math.round(Math.min(a.remainingGrams, need) * 10) / 10)} onChange={(e) => onChange({ ...c, firstGrams: e.target.value })} /></Field>
        <Field label={L.thenSpool}><select name={`rollo2-${f.id}`} value={second} onChange={(e) => onChange({ ...c, second: e.target.value })}>{spools.filter((s) => s.id !== first).map((s) => <option key={s.id} value={s.id}>{label(s)}</option>)}</select></Field>
        <span className="meta">{L.theRest}</span>
      </div>
      <ul className="spk alloc">
        {used.map((s) => {
          const p = parts.get(s.id)!;
          const after = Math.max(0, s.remainingGrams - p.taken);
          return (
            <li key={s.id}><SpoolTag n={s.number} />
              <span className="pk-b"><b>{s.brand || es.common.noBrand}</b><span className="meta">{after <= LIVE ? L.ends : s.id === first ? L.startsHere : L.continues}</span></span>
              <span className="pk-a num">{t('screens.spoolUse.from', { before: fmtGrams(s.remainingGrams) })}<b>{fmtGrams(after)}</b></span>
              <span className="take num">{t('screens.spoolUse.take', { takenGrams: p.taken })}</span>
            </li>
          );
        })}
      </ul>
      <Button size="sm" variant="ghost" onClick={() => onChange({ split: false, first })}>{L.oneSpool}</Button>
    </>
  );
}
