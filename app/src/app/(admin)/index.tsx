/**
 * Admin home — GYM_OWNER/LOCATION_ADMIN's operational dashboard. Reached
 * via the "Manage" tab in (training) (see that layout's Javadoc); "Sign
 * out" and the training tabs remain one tap away regardless.
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Screen, GlassCard } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/store';

interface PersonSummary {
  accountState: string;
  role: string;
}

export default function AdminHome() {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  const approvalsQuery = useQuery({
    queryKey: ['identity', 'pending-approvals'],
    queryFn: async () => (await api.get<PersonSummary[]>('/verifications/pending')).data,
  });
  const rosterQuery = useQuery({
    queryKey: ['identity', 'roster'],
    queryFn: async () => (await api.get<PersonSummary[]>('/roster')).data,
  });
  const locationsQuery = useQuery({
    queryKey: ['org', 'managed-locations'],
    queryFn: async () => (await api.get<{ id: string }[]>('/locations')).data,
  });

  const pendingCount = approvalsQuery.data?.length ?? 0;
  const rosterCount = rosterQuery.data?.length ?? 0;
  const locationCount = locationsQuery.data?.length ?? 0;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR GYM</Text>
          <Text style={styles.title}>{user ? `Hi, ${user.firstName}` : 'Dashboard'}</Text>
        </View>
        <Pressable onPress={() => router.push('/(training)/today')} accessibilityRole="button" hitSlop={8} style={styles.iconButton}>
          <Ionicons name="barbell-outline" size={18} color={colors.ink2} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <Stat loading={approvalsQuery.isPending} value={pendingCount} label="Awaiting approval" highlight={pendingCount > 0} />
        <Stat loading={rosterQuery.isPending} value={rosterCount} label="Active people" />
        <Stat loading={locationsQuery.isPending} value={locationCount} label="Locations" />
      </View>

      <View style={styles.grid}>
        <MenuCard
          icon="person-add-outline"
          title="Approvals"
          subtitle={pendingCount > 0 ? `${pendingCount} waiting for you` : 'Nothing pending'}
          badge={pendingCount > 0 ? pendingCount : undefined}
          onPress={() => router.push('/(training)/manage/approvals')}
        />
        <MenuCard
          icon="people-outline"
          title="Roster"
          subtitle="Members & staff"
          onPress={() => router.push('/(training)/manage/roster')}
        />
        <MenuCard
          icon="location-outline"
          title="Locations"
          subtitle={`${locationCount} location${locationCount === 1 ? '' : 's'}`}
          onPress={() => router.push('/(training)/manage/locations')}
        />
        <MenuCard
          icon="pricetag-outline"
          title="Plans"
          subtitle="Manage pricing"
          onPress={() => router.push('/(training)/manage/plans')}
        />
        <MenuCard
          icon="chatbubbles-outline"
          title="Feedback"
          subtitle="Member conversations"
          onPress={() => router.push('/(training)/manage/feedback')}
        />
      </View>
    </Screen>
  );
}

function Stat({ value, label, loading, highlight }: { value: number; label: string; loading: boolean; highlight?: boolean }) {
  return (
    <GlassCard style={styles.statCard} raised={highlight ?? false}>
      {loading ? (
        <ActivityIndicator color={colors.accent} size="small" />
      ) : (
        <Text style={[styles.statValue, highlight && { color: colors.accent }]}>{value}</Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </GlassCard>
  );
}

function MenuCard({
  icon,
  title,
  subtitle,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  badge?: number | undefined;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.menuCardWrap} accessibilityRole="button">
      <GlassCard style={styles.menuCard} raised>
        <View style={styles.menuIconWrap}>
          <Ionicons name={icon} size={22} color={colors.accent} />
          {badge ? (
            <View style={styles.menuBadge}>
              <Text style={styles.menuBadgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, marginBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs, flexShrink: 1 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
    marginLeft: 'auto',
  },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  statCard: { flex: 1, padding: spacing.md, alignItems: 'center', gap: 4 },
  statValue: { ...typography.title, color: colors.ink, fontSize: 22 },
  statLabel: { ...typography.caption, color: colors.ink2, textAlign: 'center', fontSize: 10.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingBottom: spacing.lg },
  menuCardWrap: { width: '47%' },
  menuCard: { padding: spacing.lg, gap: spacing.sm, minHeight: 120 },
  menuIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.field,
    backgroundColor: 'rgba(247,208,70,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.alert,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBadgeText: { fontSize: 10, fontWeight: '800', color: colors.ink },
  menuTitle: { ...typography.headline, color: colors.ink, marginTop: spacing.xs },
  menuSubtitle: { ...typography.caption, color: colors.ink2 },
});
