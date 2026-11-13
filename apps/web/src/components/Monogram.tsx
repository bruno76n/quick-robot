import { initialsOf } from '../lib/initials';

/** Initials of the business in a grey box (ronda-2 §2). The panel shows no product brand nor mascot. */
export function Monogram({ name, size = 40 }: { name: string; size?: number }) {
  return <span className="mono" aria-hidden="true" style={{ width: size, height: size, fontSize: Math.round(size * 0.375) }}>{initialsOf(name)}</span>;
}
