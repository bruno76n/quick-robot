import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';

/** Lists are fresh for 30 s; each operation invalidates only what it touched (docs/15 §3.6). */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (n, e) => n < 2 && e instanceof ApiError && (e.code === 'NETWORK_ERROR' || e.code === 'SERVICE_UNAVAILABLE'),
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
