/**
 * Join an existing gym as a MEMBER or TRAINER (FR-AUTH-17 — the only two
 * roles anyone can self-register into; LOCATION_ADMIN is a promotion,
 * SUPER_ADMIN is seeded). Browse → pick a gym → pick a location → pick a
 * role → register. The account stays PENDING_VERIFICATION until the gym's
 * own admin approves it (see (auth)/pending.tsx), which is expected, not
 * an error.
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { Screen, GlassCard, TextField, Button, Chip } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { storeSession } from '../../lib/auth/session';
import {
  mapMeResponseToUser,
  useAuth,
  type TokenResponseDto,
} from '../../lib/auth/store';

interface LocationEntry {
  id: string;
  slug: string;
  name: string;
  city: string;
}

interface GymEntry {
  id: string;
  slug: string;
  legalName: string;
  tradingName: string | null;
  locations: LocationEntry[];
}

export default function JoinGymScreen() {
  const router = useRouter();
  const currentUser = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const [query, setQuery] = useState('');
  const [selectedGym, setSelectedGym] = useState<GymEntry | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<LocationEntry | null>(null);
  const [role, setRole] = useState<'MEMBER' | 'TRAINER'>('MEMBER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: gyms, isLoading, isError, refetch } = useQuery({
    queryKey: ['gym-directory'],
    queryFn: async () => (await api.get<GymEntry[]>('/platform/gyms/directory')).data,
  });

  const filtered = useMemo(() => {
    if (!gyms) return [];
    const q = query.trim().toLowerCase();
    if (!q) return gyms;
    return gyms.filter(
      (g) => g.legalName.toLowerCase().includes(q) || (g.tradingName ?? '').toLowerCase().includes(q),
    );
  }, [gyms, query]);

  function selectGym(gym: GymEntry) {
    void Haptics.selectionAsync();
    setSelectedGym(gym);
    setSelectedLocation(gym.locations.length === 1 ? (gym.locations[0] ?? null) : null);
    setError(null);
  }

  async function join() {
    if (!selectedGym || !selectedLocation) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<TokenResponseDto>('/auth/register', {
        gymId: selectedGym.id,
        locationId: selectedLocation.id,
        role,
      });

      // Registration changes both authority and account routing. The server
      // returns a fresh JWT containing the new scoped grant; retaining the old
      // zero-grant token/store would route straight back to choose-path.
      await storeSession(data.accessToken, data.refreshToken);
      setUser(mapMeResponseToUser(data.user, currentUser));
      router.replace('/');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not join this gym.');
    } finally {
      setBusy(false);
    }
  }

  if (selectedGym) {
    return (
      <Screen scroll>
        <View style={styles.flex}>
          <Pressable onPress={() => setSelectedGym(null)} style={styles.back} accessibilityRole="button">
            <Ionicons name="chevron-back" size={18} color={colors.ink2} />
            <Text style={styles.backLabel}>All gyms</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.eyebrow}>JOINING</Text>
            <Text style={styles.title}>{selectedGym.tradingName ?? selectedGym.legalName}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Location</Text>
            <View style={styles.chipRow}>
              {selectedGym.locations.map((loc) => (
                <Chip
                  key={loc.id}
                  label={`${loc.name} · ${loc.city}`}
                  selected={selectedLocation?.id === loc.id}
                  onPress={() => setSelectedLocation(loc)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>I am joining as a</Text>
            <View style={styles.chipRow}>
              <Chip label="Member" selected={role === 'MEMBER'} onPress={() => setRole('MEMBER')} />
              <Chip label="Trainer" selected={role === 'TRAINER'} onPress={() => setRole('TRAINER')} />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label={busy ? 'Joining…' : 'Join gym'}
            onPress={join}
            disabled={!selectedLocation}
            loading={busy}
            style={styles.cta}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>JOIN A GYM</Text>
          <Text style={styles.title}>Find your gym</Text>
        </View>

        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search by gym name"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {isLoading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Could not load gyms.</Text>
            <Button label="Retry" onPress={() => refetch()} variant="ghost" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={28} color={colors.dim} />
            <Text style={styles.emptyText}>
              {gyms && gyms.length === 0 ? 'No gyms are live yet.' : 'No gyms match your search.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(g) => g.id}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => selectGym(item)} accessibilityRole="button">
                <GlassCard style={styles.gymCard}>
                  <View style={styles.gymIconWrap}>
                    <Ionicons name="business-outline" size={20} color={colors.accent} />
                  </View>
                  <View style={styles.gymText}>
                    <Text style={styles.gymName}>{item.tradingName ?? item.legalName}</Text>
                    <Text style={styles.gymMeta}>
                      {item.locations.length} location{item.locations.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.dim} />
                </GlassCard>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.xl, gap: spacing.xl },
  header: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLabel: { ...typography.caption, color: colors.ink2 },
  section: { gap: spacing.md },
  label: { ...typography.caption, color: colors.ink2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.caption, color: colors.alert },
  cta: { marginTop: 'auto', marginBottom: spacing.lg },
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  gymCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  gymIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.field,
    backgroundColor: 'rgba(247,208,70,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gymText: { flex: 1, gap: 2 },
  gymName: { ...typography.headline, color: colors.ink },
  gymMeta: { ...typography.caption, color: colors.ink2 },
  emptyState: { alignItems: 'center', gap: spacing.md, marginTop: spacing.xxl },
  emptyText: { ...typography.body, color: colors.ink2, textAlign: 'center' },
});
