import { cn } from '../lib/cn';

/** Pill segmented control (mockup .seg / .seg2, final look). `size="sm"` is the small variant. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
  role = 'group',
}: {
  value: T;
  options: readonly { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'md' | 'sm';
  role?: 'group' | 'tablist';
}) {
  return (
    <div role={role} aria-label={label} className="inline-flex flex-wrap gap-[2px] rounded-pill bg-panel p-1">
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            {...(role === 'tablist' ? { role: 'tab', 'aria-selected': on } : { 'aria-pressed': on })}
            onClick={() => onChange(o.value)}
            className={cn(
              'cursor-pointer rounded-pill border-0 font-semibold',
              size === 'sm' ? 'px-[14px] py-[5px] text-[13.5px]' : 'px-4 py-[6px] text-[15px]',
              on ? 'bg-bg text-ink shadow-[0_1px_3px_rgba(18,18,20,.14)]' : 'bg-transparent text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
