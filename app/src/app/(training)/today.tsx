/**
 * The training dashboard (FR-RPT-02) — shown to every account, whatever its
 * operational role (FR-PFP-01). Three real, independent reads: streak,
 * recent check-ins, and — for a MEMBER — current plan status. There is no
 * `/me/today` aggregate endpoint (scheduling/workout-logging modules are
 * out of this backend pass entirely), so this composes three small,
 * genuinely-built endpoints rather than pretending one bigger one exists.
 */
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, formatDistanceToNow, isToday } from 'date-fns';
import { Screen, GlassCard } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { useAuth, visibleSections } from '../../lib/auth/store';
import { pendingCheckIns } from '../../lib/sync/outbox';
import { TrainingOverview } from '../../components/dashboard/TrainingOverview';

interface StreakResponse {
  currentStreak: number;
  longestStreak: number;
  lastCheckInOn: string | null;
}

interface CheckInEntry {
  id: string;
  locationId: string;
  method: string;
  purpose: string;
  occurredAt: string;
  distanceM: number | null;
  deferred: boolean;
  flagged: boolean;
  pendingSync?: boolean;
}

interface MembershipView {
  planName: string;
  startsOn: string;
  expiresOn: string;
  state: string;
  currentlyActive: boolean;
}

export default function TodayScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const isMember = user?.grants.some((g) => g.role === 'MEMBER') ?? false;
  const sections = user ? visibleSections(user) : null;
  const canManageFeedback = Boolean(sections?.admin || sections?.trainer);

  const streakQuery = useQuery({
    queryKey: ['attendance', 'streak'],
    queryFn: async () => (await api.get<StreakResponse>('/me/streak')).data,
  });
  const historyQuery = useQuery({
    queryKey: ['attendance', 'history'],
    queryFn: async () => {
      const [server, pending] = await Promise.all([
        api.get<CheckInEntry[]>('/me/check-ins').then((response) => response.data),
        pendingCheckIns(),
      ]);
      return [...pending, ...server];
    },
  });
  const membershipQuery = useQuery({
    queryKey: ['billing', 'my-membership'],
    queryFn: async () => (await api.get<MembershipView | null>('/me/membership')).data,
    enabled: isMember,
  });

  const refreshing = streakQuery.isRefetching || historyQuery.isRefetching || membershipQuery.isRefetching;
  function refresh() {
    void streakQuery.refetch();
    void historyQuery.refetch();
    if (isMember) void membershipQuery.refetch();
  }

  const recent = (historyQuery.data ?? []).slice(0, 5);
  const checkedInToday = (historyQuery.data ?? []).some((entry) => isToday(new Date(entry.occurredAt)));
  const todayCheckIn = (historyQuery.data ?? []).find((entry) => isToday(new Date(entry.occurredAt)));

  return (
    <Screen scroll={false}>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={recent}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>LIMITBEYOND</Text>
                <Text style={styles.title}>{user ? `Hi, ${user.firstName}` : 'Today'}</Text>
              </View>
            </View>

            {checkedInToday ? (
              <Pressable onPress={() => router.push('/checkin')} accessibilityRole="button" accessibilityLabel="Open attendance calendar">
                {({ pressed }) => <GlassCard style={[styles.checkInCard, styles.checkedInCard, pressed && styles.checkInPressed]} raised>
                  <View style={[styles.checkInIcon, styles.checkedInIcon]}>
                    <Ionicons name="checkmark-circle" size={28} color={colors.good} />
                  </View>
                  <View style={styles.checkedInCopy}>
                    <Text style={styles.checkedInEyebrow}>YOU&apos;RE IN</Text>
                    <Text style={styles.checkedInLabel}>Checked in for today</Text>
                    <Text style={styles.checkedInMeta}>{todayCheckIn ? `${format(new Date(todayCheckIn.occurredAt), 'h:mm a')} · ${todayCheckIn.pendingSync ? 'Syncing securely' : 'View attendance calendar'}` : 'View attendance calendar'}</Text>
                  </View>
                  <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>ACTIVE</Text></View>
                  <Ionicons name="chevron-forward" size={18} color={colors.dim} />
                </GlassCard>}
              </Pressable>
            ) : (
              <Pressable onPress={() => router.push('/checkin')} accessibilityRole="button">
                <GlassCard style={styles.checkInCard} raised>
                  <View style={styles.checkInIcon}>
                    <Ionicons name="scan-outline" size={22} color={colors.onAccent} />
                  </View>
                  <Text style={styles.checkInLabel}>Check in</Text>
                </GlassCard>
              </Pressable>
            )}

            <View style={styles.statsRow}>
              <StatCard
                loading={streakQuery.isPending}
                icon="flame-outline"
                label="Current streak"
                value={streakQuery.data ? `${streakQuery.data.currentStreak}d` : '—'}
              />
              <StatCard
                loading={streakQuery.isPending}
                icon="trophy-outline"
                label="Best streak"
                value={streakQuery.data ? `${streakQuery.data.longestStreak}d` : '—'}
              />
            </View>

            <TrainingOverview />

            {isMember ? (
              <MembershipCard
                loading={membershipQuery.isPending}
                error={membershipQuery.isError ? (problemFrom(membershipQuery.error).detail ?? 'Could not load membership.') : null}
                membership={membershipQuery.data ?? null}
              />
            ) : null}

            <View style={styles.quickActions}>
              <Pressable style={styles.quickAction} onPress={() => router.push('/(training)/bookings')}><Ionicons name="barbell-outline" size={19} color={colors.accent} /><Text style={styles.quickLabel}>Log workout</Text></Pressable>
              {isMember ? <Pressable style={styles.quickAction} onPress={() => router.push('/(training)/feedback')}><Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.accent} /><Text style={styles.quickLabel}>Feedback</Text></Pressable> : canManageFeedback ? <Pressable style={styles.quickAction} onPress={() => router.push('/(training)/manage/feedback')}><Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.accent} /><Text style={styles.quickLabel}>Feedback inbox</Text></Pressable> : null}
            </View>

            <Text style={styles.sectionTitle}>Recent check-ins</Text>

            {historyQuery.isPending ? <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.lg }} /> : null}
            {historyQuery.isError ? (
              <Text style={styles.error}>{problemFrom(historyQuery.error).detail ?? 'Could not load history.'}</Text>
            ) : null}
            {!historyQuery.isPending && !historyQuery.isError && recent.length === 0 ? (
              <Text style={styles.emptyText}>No check-ins yet — tap Check in once you&apos;re at the gym.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <CheckInRow entry={item} />}
      />
    </Screen>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <GlassCard style={styles.statCard}>
      <Ionicons name={icon} size={18} color={colors.accent} />
      {loading ? (
        <ActivityIndicator color={colors.accent} size="small" style={{ marginTop: spacing.sm }} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </GlassCard>
  );
}

function MembershipCard({
  membership,
  loading,
  error,
}: {
  membership: MembershipView | null;
  loading: boolean;
  error?: string | null;
}) {
  return (
    <GlassCard style={styles.membershipCard}>
      <View style={styles.membershipHeader}>
        <Ionicons name="card-outline" size={16} color={colors.accent} />
        <Text style={styles.sectionTitleInline}>Membership</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : membership ? (
        <View style={styles.membershipBody}>
          <Text style={styles.membershipPlan}>{membership.planName}</Text>
          <View style={styles.membershipMetaRow}>
            <View style={[styles.statusDot, { backgroundColor: membership.currentlyActive ? colors.good : colors.alert }]} />
            <Text style={styles.membershipMeta}>
              {membership.currentlyActive ? 'Active' : 'Not active'} · Expires{' '}
              {format(new Date(membership.expiresOn), 'd MMM yyyy')}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.emptyText}>No plan on file yet — ask your gym&apos;s front desk.</Text>
      )}
    </GlassCard>
  );
}

function CheckInRow({ entry }: { entry: CheckInEntry }) {
  const icon = entry.method === 'QR' ? 'qr-code-outline' : entry.method === 'GEOFENCE' ? 'location-outline' : 'create-outline';
  return (
    <GlassCard style={styles.rowCard}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.accent} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{formatDistanceToNow(new Date(entry.occurredAt), { addSuffix: true })}</Text>
        <Text style={styles.rowMeta}>
          {entry.method} · {entry.purpose === 'PERSONAL_WORKOUT' ? 'Workout' : entry.purpose === 'SHIFT' ? 'Shift' : 'Workout + shift'}
          {entry.pendingSync ? ' · Syncing' : entry.deferred ? ' · Synced later' : ''}
        </Text>
      </View>
      {entry.flagged ? <Ionicons name="alert-circle-outline" size={16} color={colors.alert} /> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: spacing.lg, gap: spacing.md },
  headerStack: { gap: spacing.lg, marginBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.lg },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkInIcon: { alignItems: 'center', justifyContent: 'center' },
  checkInLabel: { ...typography.headline, color: colors.onAccent },
  checkedInCard: { justifyContent: 'flex-start', paddingHorizontal: spacing.lg, backgroundColor: 'rgba(63,209,124,0.08)', borderColor: 'rgba(63,209,124,0.28)' },
  checkInPressed: { opacity: 0.72 },
  checkedInIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(63,209,124,0.12)',
  },
  checkedInCopy: { gap: 2, flex: 1 },
  checkedInEyebrow: { ...typography.eyebrow, color: colors.good, fontSize: 9 },
  checkedInLabel: { ...typography.headline, color: colors.ink },
  checkedInMeta: { ...typography.caption, color: colors.ink2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(63,209,124,0.1)' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.good },
  liveText: { fontSize: 9, fontWeight: '800', color: colors.good, letterSpacing: 0.8 },
  quickActions: { flexDirection: 'row', gap: spacing.md },
  quickAction: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.field, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine },
  quickLabel: { ...typography.caption, color: colors.ink },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, padding: spacing.lg, gap: spacing.xs, alignItems: 'flex-start' },
  statValue: { ...typography.title, color: colors.ink, fontSize: 24, marginTop: spacing.xs },
  statLabel: { ...typography.caption, color: colors.ink2 },
  membershipCard: { padding: spacing.lg, gap: spacing.md },
  membershipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitleInline: { ...typography.eyebrow, color: colors.dim, fontSize: 10 },
  membershipBody: { gap: 4 },
  membershipPlan: { ...typography.headline, color: colors.ink },
  membershipMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  membershipMeta: { ...typography.caption, color: colors.ink2 },
  sectionTitle: { ...typography.eyebrow, color: colors.dim, fontSize: 10.5, marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.alert },
  emptyText: { ...typography.caption, color: colors.dim },
  rowCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.field,
    backgroundColor: 'rgba(247,208,70,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, color: colors.ink },
  rowMeta: { ...typography.caption, color: colors.dim },
});
