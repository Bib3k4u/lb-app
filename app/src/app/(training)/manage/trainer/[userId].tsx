import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, GlassCard, Button } from '../../../../components/ui';
import { PersonCard, type PersonSummary } from '../../../../components/PersonCard';
import { api, problemFrom } from '../../../../lib/api/client';
import { colors, radius, spacing, typography } from '../../../../lib/theme';

interface LocationSummary {
  id: string;
  name: string;
}

export default function TrainerDetailsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const [confirmingAction, setConfirmingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const rosterQuery = useQuery({
    queryKey: ['identity', 'roster'],
    queryFn: async () => (await api.get<PersonSummary[]>('/roster')).data,
  });
  const locationsQuery = useQuery({
    queryKey: ['org', 'live-locations'],
    queryFn: async () => (await api.get<LocationSummary[]>('/locations/live')).data,
  });

  const accountMutation = useMutation({
    mutationFn: (action: 'deactivation' | 'reactivation') =>
      api.post(`/roster/${userId}/${action}`, { role: 'TRAINER' }),
    onSuccess: async () => {
      setConfirmingAction(false);
      await queryClient.invalidateQueries({ queryKey: ['identity', 'roster'] });
    },
    onError: (error) => setActionError(problemFrom(error).detail ?? 'Could not update this trainer account.'),
  });

  if (rosterQuery.isPending) {
    return <Screen><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></Screen>;
  }

  if (rosterQuery.isError) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.error}>{problemFrom(rosterQuery.error).detail ?? 'Could not load the trainer profile.'}</Text>
          <Button label="Try again" onPress={() => void rosterQuery.refetch()} variant="ghost" />
          <Button label="Go back" onPress={() => router.back()} variant="subtle" />
        </View>
      </Screen>
    );
  }

  const trainer = rosterQuery.data?.find((person) => person.userId === userId && person.role === 'TRAINER');
  if (!trainer) {
    return <Screen><View style={styles.center}><Text style={styles.error}>Trainer could not be found.</Text><Button label="Go back" onPress={() => router.back()} variant="ghost" /></View></Screen>;
  }

  const initials = `${trainer.firstName[0] ?? ''}${trainer.lastName[0] ?? ''}`.toUpperCase();
  const locationNames = trainer.gymWide
    ? ['All gym locations']
    : trainer.locationIds.map((id) => locationsQuery.data?.find((location) => location.id === id)?.name ?? 'Location');
  const assignedMembers = (rosterQuery.data ?? []).filter((person) =>
    person.role === 'MEMBER' && person.assignedTrainer?.trainerUserId === trainer.userId);
  const active = trainer.accountState === 'ACTIVE';

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text style={styles.eyebrow}>TRAINER PROFILE</Text>
          <Text style={styles.pageTitle}>Trainer details</Text>
        </View>
      </View>

      <GlassCard style={styles.hero} raised>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.heroCopy}>
          <Text style={styles.name}>{trainer.firstName} {trainer.lastName}</Text>
          <Text style={styles.meta}>{locationNames.join(' · ') || 'No location assigned'}</Text>
          <View style={styles.statusLine}>
            <View style={[styles.statusDot, trainer.accountState !== 'ACTIVE' && styles.inactiveDot]} />
            <Text style={[styles.statusText, trainer.accountState !== 'ACTIVE' && styles.inactiveText]}>
              {trainer.accountState === 'ACTIVE' ? 'Active account' : formatLabel(trainer.accountState)}
            </Text>
          </View>
        </View>
      </GlassCard>

      <SectionTitle icon="person-outline" title="Personal information" />
      <GlassCard style={styles.sectionCard}>
        <InfoRow icon="mail-outline" label="Email" value={trainer.email ?? 'Not provided'} />
        <InfoRow icon="call-outline" label="Mobile" value={trainer.phoneE164 ?? 'Not provided'} />
        <InfoRow icon="calendar-outline" label="Date of birth" value={trainer.dateOfBirth ? format(new Date(`${trainer.dateOfBirth}T00:00:00`), 'd MMM yyyy') : 'Not provided'} />
        <InfoRow icon="body-outline" label="Gender" value={formatLabel(trainer.gender)} />
        <InfoRow icon="resize-outline" label="Height" value={trainer.heightCm ? `${trainer.heightCm} cm` : 'Not provided'} />
        <InfoRow icon="trending-up-outline" label="Experience" value={formatLabel(trainer.experienceLevel)} />
        <InfoRow icon="flag-outline" label="Primary goal" value={formatLabel(trainer.primaryGoal)} last />
      </GlassCard>

      <View style={styles.sectionTitleWithCount}>
        <SectionTitle icon="people-outline" title="Assigned members" />
        <View style={styles.countBadge}><Text style={styles.countText}>{assignedMembers.length}</Text></View>
      </View>
      {assignedMembers.length > 0 ? assignedMembers.map((member) => (
        <Pressable
          key={member.userId}
          onPress={() => router.push({ pathname: '/(training)/manage/member/[userId]', params: { userId: member.userId } })}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <PersonCard person={member}>
            <View style={styles.openRow}>
              <Text style={styles.openText}>Open member profile</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.accent} />
            </View>
          </PersonCard>
        </Pressable>
      )) : (
        <GlassCard style={styles.emptyMembers}>
          <Ionicons name="people-outline" size={25} color={colors.dim} />
          <Text style={styles.emptyMembersText}>No members are currently assigned to this trainer.</Text>
        </GlassCard>
      )}

      <SectionTitle icon="shield-checkmark-outline" title="Account access" />
      <GlassCard style={styles.accessCard}>
        <View style={styles.accessCopy}>
          <Text style={styles.accessTitle}>{active ? 'Trainer access is active' : 'Trainer access is deactivated'}</Text>
          <Text style={styles.accessMeta}>{active ? 'Deactivation also removes current member assignments.' : 'Trainers can be reactivated directly without selecting a plan.'}</Text>
        </View>
        {!confirmingAction ? (
          <Button label={active ? 'Deactivate trainer' : 'Reactivate trainer'} onPress={() => { setConfirmingAction(true); setActionError(null); }} variant={active ? 'danger' : 'primary'} />
        ) : (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>{active ? 'Deactivate this trainer and remove their current member assignments?' : 'Reactivate this trainer account now?'}</Text>
            <View style={styles.confirmActions}>
              <View style={styles.actionFlex}><Button label="Cancel" onPress={() => setConfirmingAction(false)} variant="subtle" /></View>
              <View style={styles.actionFlex}><Button label={active ? 'Deactivate' : 'Reactivate'} onPress={() => accountMutation.mutate(active ? 'deactivation' : 'reactivation')} loading={accountMutation.isPending} variant={active ? 'danger' : 'primary'} /></View>
            </View>
          </View>
        )}
        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
      </GlassCard>

      <SectionTitle icon="location-outline" title="Access and assignment" />
      <GlassCard style={styles.sectionCard}>
        <InfoRow icon="business-outline" label="Role" value="Trainer" />
        <InfoRow icon="location-outline" label={locationNames.length === 1 ? 'Location' : 'Locations'} value={locationNames.join(', ') || 'Not assigned'} />
        <InfoRow icon="time-outline" label="Joined" value={format(new Date(trainer.grantedAt), 'd MMM yyyy')} last />
      </GlassCard>
    </Screen>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return <View style={styles.sectionTitle}><Ionicons name={icon} size={16} color={colors.accent} /><Text style={styles.sectionLabel}>{title}</Text></View>;
}

function InfoRow({ icon, label, value, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.infoRow, !last && styles.infoBorder]}><View style={styles.infoIcon}><Ionicons name={icon} size={16} color={colors.ink2} /></View><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}

function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not provided';
  return value.toLowerCase().split('_').map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  error: { ...typography.body, color: colors.alert, textAlign: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, alignItems: 'center', justifyContent: 'center' },
  topBarCopy: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  pageTitle: { ...typography.title, color: colors.ink, marginTop: 2 },
  hero: { padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.title, color: colors.onAccent, fontWeight: '800' },
  heroCopy: { flex: 1, gap: 3 },
  name: { ...typography.title, color: colors.ink },
  meta: { ...typography.caption, color: colors.ink2 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.good },
  inactiveDot: { backgroundColor: colors.alert },
  statusText: { ...typography.caption, color: colors.good },
  inactiveText: { color: colors.alert },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitleWithCount: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { ...typography.eyebrow, color: colors.ink2 },
  countBadge: { minWidth: 30, height: 30, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: `rgba(${colors.accentRgb},0.14)`, alignItems: 'center', justifyContent: 'center' },
  countText: { ...typography.caption, color: colors.accent, fontWeight: '800' },
  sectionCard: { overflow: 'hidden' },
  infoRow: { minHeight: 55, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassLine2 },
  infoIcon: { width: 22, alignItems: 'center' },
  infoLabel: { ...typography.caption, color: colors.ink2, flex: 1 },
  infoValue: { ...typography.body, color: colors.ink, flex: 1.5, textAlign: 'right' },
  pressed: { opacity: 0.72 },
  openRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassLine2, paddingTop: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  openText: { ...typography.caption, color: colors.accent },
  emptyMembers: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyMembersText: { ...typography.body, color: colors.dim, textAlign: 'center' },
  accessCard: { padding: spacing.lg, gap: spacing.md },
  accessCopy: { gap: 3 },
  accessTitle: { ...typography.headline, color: colors.ink },
  accessMeta: { ...typography.caption, color: colors.dim, lineHeight: 18 },
  confirmBox: { gap: spacing.md },
  confirmText: { ...typography.body, color: colors.ink2 },
  confirmActions: { flexDirection: 'row', gap: spacing.md },
  actionFlex: { flex: 1 },
});
