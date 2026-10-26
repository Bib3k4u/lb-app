/**
 * Root layout. Providers, local database bootstrap, and outbox draining.
 *
 * Route files contain no logic (ENG-2.2) — this one is the single exception,
 * because app-wide wiring has to live somewhere.
 */
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initialiseLocalDatabase } from '../lib/db';
import { drain } from '../lib/sync/outbox';
import { api } from '../lib/api/client';
import { queryClient } from '../lib/queryClient';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../lib/auth/store';
import { isSignedIn, onSessionChange, signOut } from '../lib/auth/session';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const setUser = useAuth((s) => s.setUser);
  const setHydrated = useAuth((s) => s.setHydrated);

  useEffect(() => {
    initialiseLocalDatabase();

    void (async () => {
      const signedIn = await isSignedIn();
      if (signedIn) {
        // Tokens surviving a restart is only half of "stay signed in" — the
        // store itself starts empty every launch, so without this a valid
        // session still bounced back to the sign-in screen (index.tsx reads
        // `user`, not the token). Refetching also picks up anything that
        // changed server-side (a new grant, an admin's approval) since the
        // JWT's own claims were minted.
        try {
          const { data } = await api.get<MeResponseDto>('/me');
          setUser(mapMeResponseToUser(data));
        } catch {
          // Refresh token dead or revoked — same outcome as never having
          // signed in.
          await signOut();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setHydrated(true);
      setReady(true);
      // Anything queued while the app was closed goes out now.
      void drain();
    })();

    const unsubscribe = onSessionChange((signedIn) => {
      if (!signedIn) setUser(null);
    });

    // Drain on foreground: the commonest moment for connectivity to return is
    // the user walking out of the basement and opening the app.
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
      if (status === 'active') void drain();
    });
    const networkSub = Network.addNetworkStateListener((state) => {
      if (state.isConnected) void drain();
    });

    return () => {
      unsubscribe();
      sub.remove();
      networkSub.remove();
    };
  }, [setUser, setHydrated]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(training)" />
          <Stack.Screen name="(member)" />
          <Stack.Screen name="(trainer)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(superadmin)" />
          <Stack.Screen name="checkin" options={{ presentation: 'modal' }} />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
