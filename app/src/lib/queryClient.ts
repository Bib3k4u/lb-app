/**
 * The one QueryClient instance, shared between the root layout (which
 * provides it) and auth/store.ts (which clears it on sign-out) — cached
 * server state from one account must never leak into the next account's
 * session on the same device.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      // The outbox handles writes offline; reads simply show cached data.
      networkMode: 'offlineFirst',
    },
  },
});
