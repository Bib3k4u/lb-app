/**
 * One row in a roster — shared between the admin roster screen and the
 * trainer's read-only view, since both are "who's at my gym" over the same
 * GET /roster response shape.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { GlassCard } from './ui';
import { colors, radius, spacing, typography } from '../lib/theme';

export interface PersonSummary {
  userId: string;
  firstName: string;
  lastName: string;
  phoneE164: string | null;
  email: string | null;
  role: string;
  gymWide: boolean;
  locationIds: string[];
  accountState: string;
  grantedAt: string;
  membership: { planId: string; planName: string; expiresOn: string; state: string; currentlyActive: boolean } | null;
  memberRecordId: string | null;
  assignedTrainer: { trainerUserId: string; firstName: string; lastName: string; locationId: string; assignedAt: string } | null;
  dateOfBirth: string | null;
  gender: string | null;
  heightCm: number | null;
  experienceLevel: string | null;
  primaryGoal: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  GYM_OWNER: 'Gym Owner',
  LOCATION_ADMIN: 'Location Admin',
  TRAINER: 'Trainer',
  MEMBER: 'Member',
};

export function PersonCard({ person, children }: { person: PersonSummary; children?: React.ReactNode }) {
  const initials = `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase() || '?';

  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.body}>
          <Text style={styles.name}>
            {person.firstName} {person.lastName}
          </Text>
          <Text style={styles.meta}>{[person.phoneE164, person.email].filter(Boolean).join(' · ') || 'No contact on file'}</Text>
        </View>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{ROLE_LABEL[person.role] ?? person.role}</Text>
        </View>
      </View>

      {person.accountState !== 'ACTIVE' ? (
        <View style={styles.inactiveRow}>
          <Ionicons name="pause-circle-outline" size={14} color={colors.alert} />
          <Text style={styles.inactiveText}>Account deactivated</Text>
        </View>
      ) : null}

      {person.membership ? (
        <View style={styles.membershipRow}>
          <View style={[styles.statusDot, { backgroundColor: person.membership.currentlyActive ? colors.good : colors.alert }]} />
          <Text style={styles.membershipText}>
            {person.membership.planName} · {person.membership.currentlyActive ? 'Active' : formatMembershipState(person.membership.state)} · until{' '}
            {format(new Date(person.membership.expiresOn), 'd MMM yyyy')}
          </Text>
        </View>
      ) : person.role === 'MEMBER' ? (
        <View style={styles.membershipRow}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.dim} />
          <Text style={styles.membershipTextMuted}>No plan sold yet</Text>
        </View>
      ) : null}

      {person.role === 'MEMBER' && person.assignedTrainer ? (
        <View style={styles.trainerRow}>
          <Ionicons name="fitness-outline" size={14} color={colors.accent} />
          <Text style={styles.membershipText}>Trainer · {person.assignedTrainer.firstName} {person.assignedTrainer.lastName}</Text>
        </View>
      ) : null}

      {children}
    </GlassCard>
  );
}

function formatMembershipState(state: string): string {
  return state.toLowerCase().split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.caption, color: colors.ink, fontWeight: '800' },
  body: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.ink, fontWeight: '600' },
  meta: { ...typography.caption, color: colors.ink2 },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine2,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '700', color: colors.ink2 },
  membershipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderTopWidth: 1, borderTopColor: colors.glassLine, paddingTop: spacing.sm },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  membershipText: { ...typography.caption, color: colors.ink2 },
  membershipTextMuted: { ...typography.caption, color: colors.dim },
  trainerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inactiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: spacing.xs },
  inactiveText: { ...typography.caption, color: colors.alert, fontWeight: '700' },
});
