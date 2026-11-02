// Frame of every screen: shell, error limit per route, toasts and the "does not respond" banner (docs/15 §5).
import { useIsFetching, useQuery, useQueryClient } from '@tanstack/react-query';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { AppShell } from '../components/AppShell';
import { Banner } from '../components/Banner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { openPalette } from '../components/CommandPalette';
import { CommandLayer } from '../components/Shortcuts';
import { ToastViewport } from '../components/Toast';
import { es } from '../i18n/es';
import { api, ApiError } from '../lib/api';
import { isDesktop } from '../lib/platform';
import { useSettings } from '../lib/queries';
import { go } from '../lib/nav';

export function Root() {
  const me = useQuery({ queryKey: ['me'], queryFn: async () => (await api.me()).data, staleTime: Infinity });
  const settings = useSettings();
  const business = settings.data?.settings.business;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const down = me.error instanceof ApiError && me.error.code === 'NETWORK_ERROR';
  useEffect(() => { document.title = business?.name || me.data?.workspace.name || ''; }, [me.data, business?.name]);
  const banner = down ? (
    <Banner action={<button type="button" className="btn sm" onClick={() => void qc.refetchQueries()} disabled={fetching > 0}>{es.common.retry}</button>}>
      {isDesktop() ? es.screens.shell.bannerDown : es.screens.shell.bannerOffline}
    </Banner>
  ) : null;
  return (
    <>
      <AppShell businessName={business?.name || me.data?.workspace.name || ''} trade={business?.trade ?? ''} banner={banner} onNewPiece={() => void go('/productos/pieza')} onSearch={openPalette}>
        <ErrorBoundary resetKey={path} onHome={() => void go('/inicio')}>
          <Outlet />
        </ErrorBoundary>
      </AppShell>
      <ToastViewport />
      <CommandLayer />
    </>
  );
}
