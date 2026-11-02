import { cn } from '../lib/cn';

/** Underlined segmented control (mockup .seg). */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-x-[22px] gap-y-1 border-b border-line-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('-mb-px block cursor-pointer border-0 border-b-2 bg-transparent px-[2px] pb-[9px] pt-2 font-semibold', value === o.value ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
