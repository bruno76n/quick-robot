// A screen whose data could not be loaded says so instead of drawing an empty list (docs/15 §5): an error is never
// "nothing registered". While a failed first load is pending the screen is hidden behind a card with Reintentar.
import { useQueryClient, type Query } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { es } from '../i18n/es';
import { t } from '../i18n/t';
import { ApiError } from '../lib/api';

/** Failures that mean "the data did not arrive": the server did not answer or failed (not a 4xx such as NOT_FOUND, which a screen handles). */
export const isLoadFailure = (e: unknown) => !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.code === 'NETWORK_ERROR';

/** An active query whose first load failed: it has no data to show, so whatever the screen draws would be empty. */
export const failedFirstLoad = (q: Query) => q.state.status === 'error' && q.state.data === undefined && q.getObserversCount() > 0 && isLoadFailure(q.state.error);

/** Hashes of the failed first loads (stable string, so the hook only re-renders when the set changes). */
export function useFailedLoads(): { count: number; errorId: string | null } {
  const cache = useQueryClient().getQueryCache();
  const subscribe = useCallback((cb: () => void) => cache.subscribe(cb), [cache]);
  const snapshot = useCallback(() => {
    const failed = cache.findAll({ predicate: failedFirstLoad });
    const id = failed.map((q) => q.state.error).find((e): e is ApiError => e instanceof ApiError && Boolean(e.errorId))?.errorId ?? '';
    return `${failed.length}|${id}`;
  }, [cache]);
  const [count, errorId] = useSyncExternalStore(subscribe, snapshot, snapshot).split('|');
  return { count: Number(count), errorId: errorId || null };
}

export function LoadFailed({ errorId }: { errorId: string | null }) {
  const qc = useQueryClient();
  const busy = useSyncExternalStore(
    useCallback((cb: () => void) => qc.getQueryCache().subscribe(cb), [qc]),
    () => qc.getQueryCache().findAll({ predicate: failedFirstLoad }).some((q) => q.state.fetchStatus === 'fetching'),
  );
  const L = es.screens.fatal.loadFailed;
  return (
    <div className="crash load-failed" role="alert" data-testid="load-failed">
      <h2>{L.text}</h2>
      {errorId ? <p className="muted">{t('screens.fatal.loadFailed.detail', { errorId })}</p> : null}
      <button type="button" className="btn primary" disabled={busy} onClick={() => void qc.refetchQueries({ predicate: failedFirstLoad })}>{L.buttons[0]}</button>
    </div>
  );
}
