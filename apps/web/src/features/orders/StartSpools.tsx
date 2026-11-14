// «Empezar con el rollo» of Poner en producción (ronda-4 §4–§5, reference/ronda-4/produccion-pedido.html): per item and
// filament, the spool it starts with, and the split that results (which spool ends, which one continues). Previewed with
// core › startSpoolPicks + planSpoolUse, the same rule the server applies (docs/04 §1, case 1.5c).
import type { FilamentListItem } from '@app/contract';
import { itemMaterial, planSpoolUse, startSpoolPicks, suggestedSpool, type LineItemData, type SpoolPlan } from '@app/core';
import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { Field } from '../../components/Field';
import { Swatch } from '../../components/Pill';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { api } from '../../lib/api';
import { grams as fmtGrams } from '../../lib/format';
import { keys } from '../../lib/queries';
import { filamentName, spoolName, spoolNumbers, SpoolTag, toSpoolInput } from '../filament/spools';
import { useFilaments } from '../filament/api';
import { partsOf } from '../filament/SpoolUse';
import type { OrderItem } from './api';

const L = es.screens.spoolUse;
type FilamentsOf = (productId: string) => readonly { filamentId: string; grams: number }[];
type Picks = Record<string, string>;
const key = (itemId: string, filamentId: string) => `${itemId}|${filamentId}`;

export interface StartPlan {
  /** Filaments each item prints, with the grams it needs without purge. */
  needs: Map<string, { filamentId: string; grams: number }[]>;
  /** Per filament: the plan of all the items, and the last item that uses it (where the split is shown). */
  plans: Map<string, { plan: SpoolPlan; last: string; total: number; suggested: string | undefined }>;
  /** What is sent: only the spools the person chose (the rest goes in the use order, as before). */
  startSpools: (itemId: string) => { filamentId: string; spoolId: string }[] | undefined;
}

export function startPlan(items: readonly OrderItem[], lineData: (it: OrderItem) => LineItemData, filamentsOf: FilamentsOf, filaments: readonly FilamentListItem[], purgePct: number, picks: Picks): StartPlan {
  const needs = new Map(items.map((it) => [it.id, Object.entries(itemMaterial(lineData(it), filamentsOf)).filter(([, g]) => g > 0).map(([filamentId, grams]) => ({ filamentId, grams }))]));
  const plans = new Map<string, { plan: SpoolPlan; last: string; total: number; suggested: string | undefined }>();
  for (const f of filaments) {
    const users = items.filter((it) => needs.get(it.id)!.some((n) => n.filamentId === f.id));
    if (!users.length) continue;
    const spools = f.spools.map(toSpoolInput);
    const starts = users.flatMap((it) => (picks[key(it.id, f.id)] ? [{ spoolId: picks[key(it.id, f.id)]!, grams: needs.get(it.id)!.find((n) => n.filamentId === f.id)!.grams }] : []));
    const total = users.reduce((a, it) => a + needs.get(it.id)!.find((n) => n.filamentId === f.id)!.grams, 0);
    plans.set(f.id, { plan: planSpoolUse(spools, total, purgePct, startSpoolPicks(spools, starts, purgePct)), last: users[users.length - 1]!.id, total, suggested: suggestedSpool(spools)?.id });
  }
  const startSpools = (itemId: string) => {
    const out = (needs.get(itemId) ?? []).flatMap((n) => (picks[key(itemId, n.filamentId)] ? [{ filamentId: n.filamentId, spoolId: picks[key(itemId, n.filamentId)]! }] : []));
    return out.length ? out : undefined;
  };
  return { needs, plans, startSpools };
}

/** The filaments of one item: «Empezar con el rollo» and, under the last item of each filament, the split. */
export function ItemSpools({ item, sp, filaments, purgePct, picks, onPick }: { item: OrderItem; sp: StartPlan; filaments: readonly FilamentListItem[]; purgePct: number; picks: Picks; onPick: (key: string, spoolId: string) => void }) {
  return (
    <>{(sp.needs.get(item.id) ?? []).map((n) => {
      const f = filaments.find((x) => x.id === n.filamentId);
      const p = sp.plans.get(n.filamentId);
      if (!f || !p) return null;
      const live = f.spools.filter((s) => s.status !== 'empty' && s.remainingGrams > 0.5);
      const value = picks[key(item.id, f.id)] ?? p.suggested ?? '';
      return (
        <div className="stsp" key={n.filamentId} data-testid="start-spool">
          <div className="fsec-h sub"><Swatch hex={f.hex} /><b>{filamentName(f)}</b><span className="meta num">{t('screens.spoolUse.need', { pieceGrams: n.grams, purgePct, needGrams: n.grams * (1 + purgePct / 100) })}</span></div>
          {live.length ? (
            <div className="grid2">
              <Field label={L.startWith}><select name={`inicio-${item.id}-${f.id}`} value={value} onChange={(e) => onPick(key(item.id, f.id), e.target.value)}>
                {live.map((s) => <option key={s.id} value={s.id}>{t('screens.spoolUse.option', { number: spoolName(s.number), brand: s.brand || es.common.noBrand, leftGrams: s.remainingGrams })}</option>)}
              </select></Field>
            </div>
          ) : null}
          {p.last === item.id ? <Split f={f} plan={p.plan} shared={p.total > n.grams + 0.05} /> : null}
        </div>
      );
    })}</>
  );
}

function Split({ f, plan, shared }: { f: FilamentListItem; plan: SpoolPlan; shared: boolean }) {
  if (!plan.ok) return <p className="note warn" role="alert">{plan.code === 'SPOOL_INSUFFICIENT' ? t('errors.SPOOL_INSUFFICIENT', { availableGrams: plan.availableGrams }) : es.errors.SPOOL_NOT_IN_FILAMENT}</p>;
  const parts = partsOf(plan);
  // In the order the spools are used: the plan's movements come spool by spool.
  const order = [...new Set(plan.movements.map((m) => m.spoolId))].map((id) => f.spools.find((s) => s.id === id)!).filter(Boolean);
  const after = (id: string, rem: number) => Math.max(0, rem - (parts.get(id)?.taken ?? 0));
  const ends = order.filter((s) => after(s.id, s.remainingGrams) <= 0.5);
  const next = order.find((s) => after(s.id, s.remainingGrams) > 0.5);
  const lead = ends.length && next ? t('screens.spoolUse.endsThen', { ended: spoolNumbers(ends.map((s) => s.number)), next: spoolName(next.number) }) : '';
  return (
    <>
      <ul className="spk alloc">
        {order.map((s) => {
          const a = after(s.id, s.remainingGrams);
          return (
            <li key={s.id}><SpoolTag n={s.number} />
              <span className="pk-b"><b>{s.brand || es.common.noBrand}</b><span className="meta">{a <= 0.5 ? L.ends : order.length > 1 ? L.continues : L.startsHere}</span></span>
              <span className="pk-a num">{t('screens.spoolUse.from', { before: fmtGrams(s.remainingGrams) })}<b>{fmtGrams(a)}</b></span>
              <span className="take num">{t('screens.spoolUse.take', { takenGrams: parts.get(s.id)!.taken })}</span>
            </li>
          );
        })}
      </ul>
      <p className="meta hint">{[lead, t('screens.spoolUse.filamentAfter', { name: filamentName(f), beforeGrams: f.remainingGrams, afterGrams: Math.max(0, f.remainingGrams - plan.taken) }), shared ? L.allItems : '', plan.missing ? t('screens.spoolUse.missing', { missingGrams: plan.missing }) : ''].filter(Boolean).join(' ')}</p>
    </>
  );
}

/** The filaments of every piece an order prints (product details, cached like the calculator's). */
export function usePieceFilaments(items: readonly OrderItem[]): FilamentsOf {
  const ids = [...new Set(items.flatMap((it) => [...(it.productId ? [it.productId] : []), ...it.parts.map((p) => p.productId)]))];
  const qs = useQueries({ queries: ids.map((id) => ({ queryKey: [...keys.products, 'detail', id], queryFn: async () => (await api.products.get(id)).data })) });
  const map = new Map(qs.flatMap((q) => (q.data ? [[q.data.id, q.data.filaments] as const] : [])));
  return (pid) => map.get(pid) ?? [];
}

/** State of «Empezar con el rollo» in a dialog: the plan, the picks and what each assignment sends. */
export function useStartSpools(items: readonly OrderItem[], lineData: (it: OrderItem) => LineItemData, purgePct: number, shown: boolean) {
  const [picks, setPicks] = useState<Picks>({});
  const filaments = useFilaments().data?.items ?? [];
  const sp = startPlan(items, lineData, usePieceFilaments(items), filaments, purgePct, picks);
  const render = (item: OrderItem) => (shown ? <ItemSpools item={item} sp={sp} filaments={filaments} purgePct={purgePct} picks={picks} onPick={(k, v) => setPicks({ ...picks, [k]: v })} /> : null);
  /** Spread into an assignment: `{ startSpools }` with the spools chosen for that item, or nothing. */
  const startSpools = (itemId: string) => { const st = shown ? sp.startSpools(itemId) : undefined; return st ? { startSpools: st } : {}; };
  return { render, startSpools };
}
