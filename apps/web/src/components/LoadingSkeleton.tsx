// Slow first load (docs/15 §5 "Carga lenta"): after 300 ms without data a skeleton takes the place of the screen;
// at 8 s Root adds "Tarda más de lo normal" with Reintentar. Nothing shows for fast loads (no flicker).
import { useIsFetching } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { es } from '../i18n/es';

/** Queries that have never returned data (first load of a screen). */
export const usePendingFirstLoads = () => useIsFetching({ predicate: (q) => q.state.status === 'pending' });

export function LoadingSkeleton({ delayMs = 300 }: { delayMs?: number }) {
  const pending = usePendingFirstLoads();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(pending > 0), pending ? delayMs : 0);
    return () => clearTimeout(timer);
  }, [pending, delayMs]);
  if (!late || !pending) return null;
  return (
    <div className="skel" role="status" aria-busy="true" aria-live="polite" data-testid="loading-skeleton">
      <span className="sr-only">{es.common.loading}</span>
      <div className="skel-h" /><div className="skel-l" /><div className="skel-grid">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skel-c" />)}</div>
    </div>
  );
}
