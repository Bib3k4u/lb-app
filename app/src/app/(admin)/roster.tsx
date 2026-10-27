import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, Button, SearchableSelect } from '../../components/ui';
import { PersonCard, type PersonSummary } from '../../components/PersonCard';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';

interface LocationSummary {
  id: string;
  name: string;
}

type RoleFilter = 'ALL' | 'MEMBER' | 'TRAINER' | 'ADMIN';

const ROLE_OPTIONS = ['All roles', 'Members', 'Trainers', 'Admins'] as const;
const ROLE_LABELS: Record<RoleFilter, (typeof ROLE_OPTIONS)[number]> = {
  ALL: 'All roles',
  MEMBER: 'Members',
  TRAINER: 'Trainers',
  ADMIN: 'Admins',
};
const ROLE_VALUES: Record<(typeof ROLE_OPTIONS)[number], RoleFilter> = {
  'All roles': 'ALL',
  Members: 'MEMBER',
  Trainers: 'TRAINER',
  Admins: 'ADMIN',
};

export default function RosterScreen() {
  const router = useRouter();
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [locationId, setLocationId] = useState('ALL');

  const rosterQuery = useQuery({
    queryKey: ['identity', 'roster'],
    queryFn: async () => (await api.get<PersonSummary[]>('/roster')).data,
  });
  const locationsQuery = useQuery({
    queryKey: ['org', 'live-locations'],
    queryFn: async () => (await api.get<LocationSummary[]>('/locations/live')).data,
  });

  const filtered = useMemo(() => {
    let people = rosterQuery.data ?? [];
    if (roleFilter === 'ADMIN') {
      people = people.filter((person) =>
        person.role === 'GYM_OWNER' || person.role === 'LOCATION_ADMIN');
    } else if (roleFilter !== 'ALL') {
      people = people.filter((person) => person.role === roleFilter);
    }
    if (locationId !== 'ALL') {
      people = people.filter((person) =>
        person.gymWide || person.locationIds.includes(locationId));
    }
    return people;
  }, [locationId, roleFilter, rosterQuery.data]);

  function openPerson(person: PersonSummary) {
    if (person.role === 'MEMBER' && person.memberRecordId) {
      router.push({
        pathname: '/(training)/manage/member/[userId]',
        params: { userId: person.userId },
      });
    } else if (person.role === 'TRAINER') {
      router.push({
        pathname: '/(training)/manage/trainer/[userId]',
        params: { userId: person.userId },
      });
    }
  }

  const locations = locationsQuery.data ?? [];
  const selectedLocation = locationId === 'ALL'
    ? 'All locations'
    : locations.find((location) => location.id === locationId)?.name ?? 'All locations';

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={21} color={colors.ink} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PEOPLE</Text>
            <Text style={styles.title}>Member roster</Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filtered.length}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <View style={styles.filterControl}>
            <SearchableSelect
              label="Role"
              value={ROLE_LABELS[roleFilter]}
              options={[...ROLE_OPTIONS]}
              onSelect={(value) => setRoleFilter(ROLE_VALUES[value as (typeof ROLE_OPTIONS)[number]])}
              searchPlaceholder="Search roles"
              compact
            />
          </View>
          <View style={styles.filterControl}>
            <SearchableSelect
              label="Location"
              value={selectedLocation}
              options={['All locations', ...locations.map((location) => location.name)]}
              onSelect={(value) => setLocationId(
                value === 'All locations'
                  ? 'ALL'
                  : locations.find((location) => location.name === value)?.id ?? 'ALL',
              )}
              searchPlaceholder="Search locations"
              disabled={locationsQuery.isPending}
              compact
            />
          </View>
        </View>

        {rosterQuery.isPending ? (
          <ActivityIndicator color={colors.accent} style={styles.loader} />
        ) : rosterQuery.isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {problemFrom(rosterQuery.error).detail ?? 'Could not load the roster.'}
            </Text>
            <Button label="Retry" onPress={() => rosterQuery.refetch()} variant="ghost" />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={34} color={colors.dim} />
            <Text style={styles.emptyTitle}>No matching people</Text>
            <Text style={styles.emptyText}>Try changing the role or location filter.</Text>
          </View>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            data={filtered}
            keyExtractor={(person) => person.userId}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={rosterQuery.isRefetching}
                onRefresh={() => void rosterQuery.refetch()}
                tintColor={colors.accent}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => openPerson(item)}
                disabled={!((item.role === 'MEMBER' && item.memberRecordId) || item.role === 'TRAINER')}
                accessibilityRole={item.role === 'MEMBER' || item.role === 'TRAINER' ? 'button' : undefined}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <PersonCard person={item}>
                  {item.role === 'MEMBER' || item.role === 'TRAINER' ? (
                    <View style={styles.openRow}>
                      <Text style={styles.openText}>Open {item.role === 'TRAINER' ? 'trainer' : 'member'} profile</Text>
                      <Ionicons name="arrow-forward" size={16} color={colors.accent} />
                    </View>
                  ) : null}
                </PersonCard>
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  headerCopy: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: 2 },
  countBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${colors.accentRgb},0.14)`,
  },
  countText: { ...typography.headline, color: colors.accent },
  filters: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  filterControl: { flex: 1, minWidth: 0 },
  loader: { marginTop: spacing.xxl },
  list: { gap: spacing.md },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  openRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassLine2,
    paddingTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openText: { ...typography.caption, color: colors.accent },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyTitle: { ...typography.headline, color: colors.ink },
  emptyText: { ...typography.body, color: colors.ink2, textAlign: 'center' },
});
