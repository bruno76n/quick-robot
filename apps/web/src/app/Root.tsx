// Frame of every screen: shell, error limit per route, toasts and the "does not respond" banner (docs/15 §5).
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AppShell } from '../components/AppShell';
import { Banner } from '../components/Banner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ToastViewport } from '../components/Toast';
import { es } from '../i18n/es';
import { api, ApiError } from '../lib/api';
import { isDesktop } from '../lib/platform';

export function Root() {
  const me = useQuery({ queryKey: ['me'], queryFn: async () => (await api.me()).data, staleTime: Infinity });
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const down = me.error instanceof ApiError && me.error.code === 'NETWORK_ERROR';
  useEffect(() => { document.title = me.data?.workspace.name ?? ''; }, [me.data]);
  const banner = down ? (
    <Banner action={<button type="button" className="btn sm" onClick={() => void qc.refetchQueries()} disabled={fetching > 0}>{es.common.retry}</button>}>
      {isDesktop() ? es.screens.shell.bannerDown : es.screens.shell.bannerOffline}
    </Banner>
  ) : null;
  return (
    <>
      <AppShell businessName={me.data?.workspace.name ?? ''} trade="" banner={banner}>
        <ErrorBoundary resetKey={path} onHome={() => void navigate({ href: '/inicio' })}>
          <Outlet />
        </ErrorBoundary>
      </AppShell>
      <ToastViewport />
    </>
  );
}
