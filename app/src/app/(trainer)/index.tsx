/**
 * Trainer home. Deliberately thin: there is no scheduling/PT-session or
 * training-plan backend built yet (that's the (training/scheduling/
 * engagement) modules, entirely out of this pass's scope) — what a trainer
 * genuinely has today is read-only visibility into who's at their gym
 * (GET /roster, same endpoint the admin roster uses, just without any
 * write actions), plus their own training tab like everyone else.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, TextField, Chip, Button } from '../../components/ui';
import { PersonCard, type PersonSummary } from '../../components/PersonCard';
import { colors, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/store';

type RoleFilter = 'ALL' | 'MEMBER' | 'TRAINER';

export default function TrainerHome() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<RoleFilter>('MEMBER');

  const rosterQuery = useQuery({
    queryKey: ['identity', 'roster'],
    queryFn: async () => (await api.get<PersonSummary[]>('/roster')).data,
  });

  const filtered = useMemo(() => {
    let people = rosterQuery.data ?? [];
    if (filter !== 'ALL') people = people.filter((p) => p.role === filter);
    const q = query.trim().toLowerCase();
    if (q) people = people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
    return people;
  }, [rosterQuery.data, filter, query]);

  return (
    <Screen scroll={false}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>TRAINER</Text>
            <Text style={styles.title}>{user ? `Hi, ${user.firstName}` : 'Roster'}</Text>
          </View>
          <Pressable onPress={() => router.push('/(training)/today')} accessibilityRole="button" hitSlop={8} style={styles.iconButton}>
            <Ionicons name="barbell-outline" size={18} color={colors.ink2} />
          </Pressable>
          <Pressable onPress={() => router.push('/(training)/manage/feedback')} accessibilityRole="button" hitSlop={8} style={styles.iconButton}>
            <Ionicons name="chatbubbles-outline" size={18} color={colors.ink2} />
          </Pressable>
        </View>

        <TextField value={query} onChangeText={setQuery} placeholder="Search by name" autoCapitalize="none" />

        <View style={styles.filterRow}>
          <Chip label="Members" selected={filter === 'MEMBER'} onPress={() => setFilter('MEMBER')} />
          <Chip label="Trainers" selected={filter === 'TRAINER'} onPress={() => setFilter('TRAINER')} />
          <Chip label="Everyone" selected={filter === 'ALL'} onPress={() => setFilter('ALL')} />
        </View>

        {rosterQuery.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : rosterQuery.isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{problemFrom(rosterQuery.error).detail ?? 'Could not load the roster.'}</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={32} color={colors.dim} />
            <Text style={styles.emptyText}>No one matches.</Text>
          </View>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            data={filtered}
            keyExtractor={(p) => p.userId}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={rosterQuery.isRefetching} onRefresh={rosterQuery.refetch} tintColor={colors.accent} />}
            renderItem={({ item }) => <PersonCard person={item}>{item.role === 'MEMBER' ? <Button label="View progress & diet" onPress={() => router.push({ pathname: '/(training)/manage/member/[userId]', params: { userId: item.userId, name: `${item.firstName} ${item.lastName}` } })} variant="ghost" /> : null}</PersonCard>}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
    marginLeft: 'auto',
  },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.md, paddingBottom: spacing.lg },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: colors.ink2, textAlign: 'center' },
});
