import type { ReactNode } from 'react';

/** Two-column key/value list (mockup .dl). */
export function DataList({ items }: { items: { label: ReactNode; value: ReactNode; sub?: ReactNode }[] }) {
  return (
    <dl className="mb-[14px] grid grid-cols-2 gap-x-4 gap-y-[10px]">
      {items.map((it, i) => (
        <div key={i}>
          <dt className="text-[12.5px] font-semibold text-ink-3">{it.label}</dt>
          <dd className="num m-0 font-semibold">
            {it.value}
            {it.sub && <small className="block font-normal">{it.sub}</small>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
