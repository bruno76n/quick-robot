// Charts of ronda 3 (§4): one chart, one color; costs and sales in grey, green only for profit; direct labels, no
// axes or grid. Every amount arrives already formatted (display) next to the number used for the size (value).
import type { KeyboardEvent, ReactNode } from 'react';
import { pctOf } from './Meter';

export interface WeekColumn {
  key: string;
  /** Label under the column ("20 oct"). */
  label: ReactNode;
  /** Sales of the period (any unit, e.g. cents): the height of the light grey column. */
  sales: number;
  /** Gross profit of the period, same unit: the green part inside the column (never taller than sales). */
  profit: number;
  /** Amount written above the column ("$1,550"); omitted when the chart is crowded. */
  display?: ReactNode;
  /** Tooltip with the detail of the period. */
  title?: string;
}

/** Height of each column (sales ÷ the largest sales) and of its green part (profit ÷ its own sales), in %. */
export function weekHeights(columns: readonly { sales: number; profit: number }[]) {
  const max = Math.max(0, ...columns.map((c) => c.sales));
  return columns.map((c) => ({ sales: pctOf(c.sales, max), profit: c.sales > 0 ? pctOf(Math.min(c.profit, c.sales), c.sales) : 0 }));
}

/**
 * Sales by week (ronda-3 §4, mockup .cc): a light grey column with the sales and, inside, green with the gross profit;
 * the amount above each column. Each column has the class .tcol and is focusable (its title is the tooltip).
 * - legend: the two entries under the chart ({ sales: 'Ventas', profit: 'Ganancia bruta' }).
 * - label: accessible name of the chart; testId: data-testid of the row of columns.
 */
export function WeekColumns({ columns, legend, label, testId }: { columns: readonly WeekColumn[]; legend?: { sales: ReactNode; profit: ReactNode }; label: string; testId?: string }) {
  const h = weekHeights(columns);
  return (
    <figure className="cc">
      <div className="cc-cols" role="img" aria-label={label} data-testid={testId} style={{ gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))` }}>
        {columns.map((c, i) => (
          <div key={c.key} className="tcol cc-col" title={c.title} tabIndex={0}>
            <span className="cc-v num">{c.display ?? ''}</span>
            <span className="cc-bar"><i className="s" style={{ height: `${h[i]!.sales}%` }}><i className="g" style={{ height: `${h[i]!.profit}%` }} /></i></span>
            <span className="cc-l">{c.label}</span>
          </div>
        ))}
      </div>
      {legend ? <figcaption className="leg"><span><i className="s" />{legend.sales}</span><span><i className="g" />{legend.profit}</span></figcaption> : null}
    </figure>
  );
}

export interface BarPart { label: ReactNode; value: number; display: ReactNode }
export interface Per100Item { key: string; label: ReactNode; value: number; display: ReactNode }

/** The two parts of the bar as percentages that add up to 100 (a loss shows the whole bar as cost). */
export function per100(cost: number, net: number) {
  const c = Math.max(0, cost);
  const n = Math.max(0, net);
  if (c + n <= 0) return { cost: 0, net: 0 };
  const costPct = (c / (c + n)) * 100;
  return { cost: costPct, net: 100 - costPct };
}

/**
 * Of every $100 sold (ronda-3 §4, mockup .sp-bar/.sp-list): one bar in two parts (costs and expenses in dark grey,
 * net profit in green), their key with the amount, and below the list of costs from largest to smallest with a grey bar.
 * - cost, net: the two parts (value for the size, display for the text).
 * - items: the breakdown; sorted here from largest to smallest.
 * - label: accessible name of the bar.
 */
export function Per100Bar({ cost, net, items = [], label }: { cost: BarPart; net: BarPart; items?: readonly Per100Item[]; label: string }) {
  const p = per100(cost.value, net.value);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(0, ...sorted.map((x) => x.value));
  return (
    <div className="p100">
      <div className="p100-bar" role="img" aria-label={label}>
        {p.cost > 0 ? <i className="c" style={{ width: `${p.cost}%` }} /> : null}
        {p.net > 0 ? <i className="n" style={{ width: `${p.net}%` }} /> : null}
      </div>
      <div className="p100-k">
        <span><i className="c" />{cost.label} <b className="num">{cost.display}</b></span>
        <span className="n"><i className="n" />{net.label} <b className="num">{net.display}</b></span>
      </div>
      {sorted.length ? (
        <ul className="p100-l">
          {sorted.map((x) => <li key={x.key}><span>{x.label}</span><span className="hb-track"><i style={{ width: `${pctOf(x.value, max)}%` }} /></span><b className="num">{x.display}</b></li>)}
        </ul>
      ) : null}
    </div>
  );
}

export interface HBarItem {
  key: string;
  label: ReactNode;
  /** Small grey line under the label ("5 vendidas"). */
  meta?: ReactNode;
  value: number;
  display: ReactNode;
  /** Makes the row a button (Enter or Space too). */
  onClick?: () => void;
  /** Accessible name of the row when it is a button. */
  actionLabel?: string;
}

/** The items from largest to smallest value, with each bar as a % of the largest. */
export function rankItems<T extends { value: number }>(items: readonly T[]) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = Math.max(0, ...sorted.map((x) => x.value));
  return sorted.map((x) => ({ item: x, pct: pctOf(x.value, max) }));
}

/**
 * Ranking with horizontal bars of one color and the amount on the right (ronda-3 §4, mockup .tp): products with the
 * most profit (tone 'green'), expenses by category ('ink'). Sorted here from largest to smallest.
 * - limit: show only the first n. label: accessible name of the list.
 */
export function HBarList({ items, tone = 'ink', limit, label }: { items: readonly HBarItem[]; tone?: 'green' | 'ink'; limit?: number; label?: string }) {
  const rows = rankItems(items).slice(0, limit ?? items.length);
  const key = (fn: () => void) => (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };
  return (
    <ul className={`hbl ${tone}`} aria-label={label}>
      {rows.map(({ item: x, pct }) => (
        <li key={x.key} className={x.onClick ? 'click' : undefined} {...(x.onClick ? { role: 'button', tabIndex: 0, 'aria-label': x.actionLabel, onClick: x.onClick, onKeyDown: key(x.onClick) } : {})}>
          <span className="hbl-n"><b>{x.label}</b>{x.meta !== undefined ? <span className="meta">{x.meta}</span> : null}</span>
          <span className="hb-track"><i style={{ width: `${pct}%` }} /></span>
          <b className="num">{x.display}</b>
        </li>
      ))}
    </ul>
  );
}
