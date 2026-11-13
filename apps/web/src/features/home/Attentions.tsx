// Inicio › Atención (docs/06 §2, ronda-2 §5; mockup reference/ronda-2/inicio.html): attentions grouped by
// priority (`severity` from core › classifyAttention), filter chips with counters (not saved), 5 per group and
// "Ver las N restantes" that adds batches of 50 in place, never painting more than 200 rows at once (D-2).
import { useMemo, useState } from 'react';
import { Icon } from '../../components/Icon';
import { es } from '../../i18n/es';
import { t } from '../../i18n/t';
import { go } from '../../lib/nav';
import type { Attention, AttentionSeverity } from '../reports/api';
import { attentionView } from './attentionView';

const L = es.screens.home.attention;
const GROUPS: readonly AttentionSeverity[] = ['urgent', 'soon', 'review'];
type Filter = 'all' | AttentionSeverity;

export const FIRST = 5;
export const BATCH = 50;
export const MAX_ROWS = 200;

const ICON: Record<Attention['kind'], string> = {
  order_filament_short: 'spool', filament_low: 'spool', order_due: 'list', sale_owed: 'coin',
  maintenance: 'gear', price_below_floor: 'percent', supply_low: 'nut', backup: 'backup',
};

/** Rows of one group to paint: the first `shown`, keeping at most `room` (the newest batch stays in view). */
export function visibleRange(total: number, shown: number, room: number): [number, number] {
  const end = Math.min(total, shown);
  return [Math.max(0, end - Math.max(FIRST, room)), end];
}

export function Attentions({ items }: { items: readonly Attention[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState<Record<AttentionSeverity, number>>({ urgent: FIRST, soon: FIRST, review: FIRST });
  const byGroup = useMemo(() => {
    const g: Record<AttentionSeverity, Attention[]> = { urgent: [], soon: [], review: [] };
    for (const a of items) (g[a.severity] ?? g.review).push(a);
    return g;
  }, [items]);
  const groups = GROUPS.filter((s) => (filter === 'all' || filter === s) && byGroup[s].length > 0);
  // Expanding one group folds the others back to 5, so the screen never holds more than MAX_ROWS rows.
  const more = (s: AttentionSeverity) => setShown((prev) => {
    const next = { urgent: FIRST, soon: FIRST, review: FIRST };
    next[s] = Math.min(byGroup[s].length, prev[s] + BATCH);
    return next;
  });
  const chips: [Filter, string, number][] = [
    ['all', L.filterAll, items.length],
    ...GROUPS.map((s): [Filter, string, number] => [s, L.group[s], byGroup[s].length]),
  ];
  return (
    <section className="atn" aria-labelledby="atn-title">
      <div className="atn-h">
        <h2 id="atn-title">{L.title}</h2>
        <div className="atn-f" role="group" aria-label={L.title}>
          {chips.map(([k, label, n]) => (
            <button key={k} type="button" className={`atn-chip${k === 'all' ? '' : ` s-${k}`}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label} <span className="num">{n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="atn-list" data-testid="attentions">
        {groups.map((s) => {
          const list = byGroup[s];
          const others = groups.filter((o) => o !== s).reduce((sum, o) => sum + Math.min(byGroup[o].length, shown[o]), 0);
          const [from, to] = visibleRange(list.length, shown[s], MAX_ROWS - others);
          const rest = list.length - to;
          return (
            <div key={s} className={`atn-g s-${s}`} data-severity={s}>
              {filter === 'all' ? <div className="atn-gh"><span className="dot" aria-hidden="true" /><b>{L.group[s]}</b><span>{L.groupNote[s]}</span></div> : null}
              <ul>{list.slice(from, to).map((a, i) => {
                const v = attentionView(a);
                return (
                  <li key={from + i}>
                    <span className="ai"><Icon name={ICON[a.kind] ?? 'warn'} size={19} /></span>
                    <span className="at">{v.text}</span>
                    <a className="btn sm" href={v.href} onClick={(e) => { e.preventDefault(); go(v.href); }}>{v.button}</a>
                  </li>
                );
              })}</ul>
              {rest > 0 ? <button type="button" className="atn-more" onClick={() => more(s)}>{t('screens.home.attention.showMore', { count: rest })}</button> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
