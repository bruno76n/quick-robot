// Pieces of the result panel shared by the piece calculator and the collection editor.
import type { ReactNode } from 'react';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatMoney, formatNumber1 } from '../../lib/format';

export interface Segment {
  label: string;
  value: number;
  color: string;
}

/** Stacked bar: cost layers then profit, scaled to max(price, cost) (mockup .sbar). */
export function BreakdownBar({ segments, price, cost, label }: { segments: Segment[]; price: number; cost: number; label: string }) {
  const scale = Math.max(price, cost, 1);
  const gain = price - cost;
  return (
    <div className={cn('sbar', price < cost && 'loss')} role="img" aria-label={label}>
      {segments
        .filter((s) => s.value > 0)
        .map((s) => (
          <i key={s.label} title={`${s.label}: ${formatMoney(s.value)}`} style={{ width: `${(s.value / scale) * 100}%`, ['--s' as string]: s.color }} />
        ))}
      {gain > 0 && <i className="gain" title={`${es.editor.profit}: ${formatMoney(gain)}`} style={{ width: `${(gain / scale) * 100}%` }} />}
    </div>
  );
}

export function Kpis({ items }: { items: { label: string; value: ReactNode; tone?: 'pos' | 'neg' }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((k) => (
        <div key={k.label} className="grid">
          <span className="text-[13px] font-semibold text-ink-2">{k.label}</span>
          <b className={cn('num text-[22px] font-semibold', k.tone === 'pos' && 'text-green-ink', k.tone === 'neg' && 'text-red-ink')}>{k.value}</b>
        </div>
      ))}
    </div>
  );
}

const pctOf = (v: number, price: number) => (price > 0 ? `${formatNumber1((v / price) * 100)}%` : '');

/** Legend table: each layer with amount and % of the price, total cost and profit (mockup .legend). */
export function Legend({ segments, price, cost, totalLabel }: { segments: Segment[]; price: number; cost: number; totalLabel: string }) {
  const gain = price - cost;
  return (
    <table className="mb-[18px] w-full border-collapse text-[14px] text-ink-2">
      <tbody>
        {segments.map((s) => (
          <tr key={s.label}>
            <td className="border-b border-line px-[10px] py-[7px]">
              <span className="lk" style={{ ['--s' as string]: s.color }} />
              {s.label}
            </td>
            <td className="num border-b border-line px-[10px] py-[7px] text-right">{formatMoney(s.value)}</td>
            <td className="num border-b border-line px-[10px] py-[7px] text-right text-ink-3">{pctOf(s.value, price)}</td>
          </tr>
        ))}
        <tr>
          <td className="border-t border-line-2 px-[10px] py-[7px] font-semibold">{totalLabel}</td>
          <td className="num border-t border-line-2 px-[10px] py-[7px] text-right font-semibold">{formatMoney(cost)}</td>
          <td className="border-t border-line-2" />
        </tr>
        {price > 0 && (
          <tr className="font-semibold text-green-ink">
            <td className="px-[10px] py-[7px]">
              <span className="lk" style={{ ['--s' as string]: 'var(--green)' }} />
              {es.editor.profit}
            </td>
            <td className="num px-[10px] py-[7px] text-right">{formatMoney(gain)}</td>
            <td className="num px-[10px] py-[7px] text-right">{pctOf(gain, price)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

/** Price shortcuts (mockup .refs). */
export function Shortcuts({ items, onPick }: { items: { value: number; big: string; small: string }[]; onPick: (v: number) => void }) {
  return (
    <div className="grid gap-[6px]">
      <span className="text-[13px] font-semibold text-ink-2">{es.editor.shortcuts}</span>
      <div className="flex flex-wrap gap-[6px]">
        {items.map((r) => (
          <button key={r.small} type="button" onClick={() => onPick(r.value)} className="grid cursor-pointer rounded-[9px] border border-line-2 bg-bg px-[10px] py-[5px] text-left leading-[1.2] hover:border-ink-3 hover:bg-panel">
            <b className="num">{r.big}</b>
            <small className="text-[12px]">{r.small}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Result card: sticky on wide screens (mockup .ed-res). */
export function ResultCard({ children, label }: { children: ReactNode; label: string }) {
  return (
    <aside aria-label={label} className="sticky top-1 grid gap-[14px] self-start rounded-[20px] bg-bg px-[18px] pt-[18px] shadow-[0_0_0_1px_var(--line),0_8px_30px_rgba(18,18,20,.06)] max-[1260px]:static">
      {children}
    </aside>
  );
}

export function ResultActions({ children }: { children: ReactNode }) {
  return <div className="sticky bottom-0 mt-1 grid gap-2 border-t border-line bg-bg pb-[18px] pt-3">{children}</div>;
}

/** Big money input with a "$" prefix (mockup .unit.big). */
export function BigPrice({ id, label, value, placeholder, disabled, onChange, onBlur }: { id: string; label: string; value: string; placeholder?: string; disabled?: boolean; onChange: (v: string) => void; onBlur?: () => void }) {
  return (
    <label className="grid gap-[2px]" htmlFor={id}>
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      <span className="flex items-center rounded-btn border border-line-2 bg-bg focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-purple">
        <i className="pl-3 text-[22px] font-semibold not-italic text-ink-2">{es.units.money}</i>
        <input
          id={id}
          inputMode="decimal"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="min-h-[48px] border-0 bg-transparent text-[30px] font-semibold tracking-[-0.02em] outline-none focus-visible:outline-none disabled:text-ink"
        />
      </span>
    </label>
  );
}

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 border-t border-line p-0 pt-[14px]">
      <legend className="float-left mb-3 w-full pr-3 text-[16px] font-semibold">{legend}</legend>
      <div className="clear-both grid gap-3">{children}</div>
    </fieldset>
  );
}

/** Sticky summary at the bottom of the form on narrow screens (mockup .ed-mini). */
export function MiniSummary({ items }: { items: { label: string; value: string; tone?: 'pos' | 'neg' }[] }) {
  return (
    <div aria-hidden="true" className="sticky bottom-0 z-[5] hidden items-baseline justify-between gap-3 border-t border-line-2 bg-bg px-[2px] pb-[calc(10px+env(safe-area-inset-bottom,0px))] pt-[10px] shadow-[0_-10px_20px_-14px_rgba(18,18,20,.3)] max-[1260px]:flex">
      {items.map((i) => (
        <span key={i.label} className="text-[13px] text-ink-2">
          {i.label}
          <b className={cn('num block text-[18px] text-ink', i.tone === 'pos' && 'text-green-ink', i.tone === 'neg' && 'text-red-ink')}>{i.value}</b>
        </span>
      ))}
    </div>
  );
}
