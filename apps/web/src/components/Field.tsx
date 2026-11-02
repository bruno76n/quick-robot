import type { ReactNode } from 'react';

/** Label + control + help or error below (docs/07, docs/13 §6). */
export function Field({ label, hint, error, children, className = '' }: { label: ReactNode; hint?: ReactNode; error?: string | undefined; children: ReactNode; className?: string }) {
  return (
    <label className={`fld ${error ? 'bad' : ''} ${className}`}>
      <span>{label}</span>
      {children}
      {error ? <small className="fld-err" role="alert">{error}</small> : hint ? <small>{hint}</small> : null}
    </label>
  );
}
