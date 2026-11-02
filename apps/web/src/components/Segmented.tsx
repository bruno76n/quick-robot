export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { value: T; label: string; count?: number }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className={o.value === value ? "on" : undefined} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}{o.count !== undefined ? <small>{o.count}</small> : null}
        </button>
      ))}
    </div>
  );
}
