import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Screen, GlassCard, Button } from '../../../../components/ui';
import { type PersonSummary } from '../../../../components/PersonCard';
import { api, problemFrom } from '../../../../lib/api/client';
import { useAuth } from '../../../../lib/auth/store';
import { colors, radius, spacing, typography } from '../../../../lib/theme';

interface LocationSummary { id: string; name: string }
interface TrainerSummary { userId: string; firstName: string; lastName: string; phoneE164: string | null; email: string | null }
interface PlanSummary { id: string; name: string; durationMonths: number; priceMinor: number; currency: string }
interface Progress {
  workoutCount: number;
  personalRecords: { exerciseId: string; exerciseName: string; maxWeightKg: number | null; maxReps: number | null }[];
  metrics: { id: string; metricType: string; value: number; unit: string; recordedOn: string }[];
}
interface DietPlan {
  id: string; objective: string; content: string; kcalTarget: number | null;
  proteinG: number | null; carbsG: number | null; fatG: number | null;
  startsOn: string; endsOn: string | null; active: boolean;
}

export default function MemberDetailsScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const currentUser = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const canManageAssignment = currentUser?.grants.some((grant) =>
    grant.role === 'GYM_OWNER' || grant.role === 'LOCATION_ADMIN') ?? false;

  const [trainerPicker, setTrainerPicker] = useState(false);
  const [planPicker, setPlanPicker] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [confirmingDeactivation, setConfirmingDeactivation] = useState(false);

  const rosterQuery = useQuery({
    queryKey: ['identity', 'roster'],
    queryFn: async () => (await api.get<PersonSummary[]>('/roster')).data,
  });
  const locationsQuery = useQuery({
    queryKey: ['org', 'live-locations'],
    queryFn: async () => (await api.get<LocationSummary[]>('/locations/live')).data,
  });
  const person = rosterQuery.data?.find((entry) => entry.userId === userId);
  const memberLocationId = person?.assignedTrainer?.locationId ?? person?.locationIds[0];
  const locationName = locationsQuery.data?.find((location) => location.id === memberLocationId)?.name;

  const progressQuery = useQuery({
    queryKey: ['training', 'member-progress', userId],
    queryFn: async () => (await api.get<Progress>(`/users/${userId}/progress`)).data,
    enabled: Boolean(userId),
  });
  const dietQuery = useQuery({
    queryKey: ['training', 'member-diet', userId],
    queryFn: async () => (await api.get<DietPlan | null>(`/users/${userId}/diet-plan`)).data,
    enabled: Boolean(userId),
  });
  const trainersQuery = useQuery({
    queryKey: ['identity', 'trainers', memberLocationId],
    queryFn: async () =>
      (await api.get<TrainerSummary[]>(`/locations/${memberLocationId}/trainers`)).data,
    enabled: trainerPicker && Boolean(memberLocationId),
  });
  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: async () => (await api.get<PlanSummary[]>('/plans')).data,
    enabled: planPicker || person?.accountState === 'SUSPENDED',
  });

  function refreshMember() {
    void queryClient.invalidateQueries({ queryKey: ['identity', 'roster'] });
  }

  const assignTrainer = useMutation({
    mutationFn: (trainerUserId: string) =>
      api.put(`/members/${person?.memberRecordId}/trainer`, { trainerUserId }),
    onSuccess: () => { refreshMember(); setTrainerPicker(false); },
    onError: (error) => setOperationError(problemFrom(error).detail ?? 'Could not assign trainer.'),
  });
  const removeTrainer = useMutation({
    mutationFn: () => api.delete(`/members/${person?.memberRecordId}/trainer`),
    onSuccess: () => { refreshMember(); setTrainerPicker(false); },
    onError: (error) => setOperationError(problemFrom(error).detail ?? 'Could not remove trainer.'),
  });
  const sellMembership = useMutation({
    mutationFn: () => api.post(`/members/${person?.memberRecordId}/memberships`, {
      planId: selectedPlanId,
      startsOn: format(new Date(), 'yyyy-MM-dd'),
    }),
    onSuccess: () => { refreshMember(); void queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] }); setPlanPicker(false); setSelectedPlanId(null); },
    onError: (error) => setOperationError(problemFrom(error).detail ?? 'Could not activate membership.'),
  });
  const deactivateMember = useMutation({
    mutationFn: () => api.post(`/roster/${userId}/deactivation`, { role: 'MEMBER' }),
    onSuccess: async () => {
      setConfirmingDeactivation(false);
      await queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
      await queryClient.invalidateQueries({ queryKey: ['identity', 'roster'] });
    },
    onError: (error) => setOperationError(problemFrom(error).detail ?? 'Could not deactivate this member.'),
  });
  const reactivateMember = useMutation({
    mutationFn: () => api.post(`/roster/${userId}/reactivation`, { role: 'MEMBER', planId: selectedPlanId }),
    onSuccess: async () => {
      setPlanPicker(false);
      setSelectedPlanId(null);
      await queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
      await queryClient.invalidateQueries({ queryKey: ['identity', 'roster'] });
    },
    onError: (error) => setOperationError(problemFrom(error).detail ?? 'Could not reactivate this member.'),
  });
  if (rosterQuery.isPending) {
    return <Screen><View style={styles.center}><ActivityIndicator color={colors.accent} /></View></Screen>;
  }
  if (!person) {
    return <Screen><View style={styles.center}><Text style={styles.error}>Member could not be found.</Text><Button label="Go back" onPress={() => router.back()} variant="ghost" /></View></Screen>;
  }

  const initials = `${person.firstName[0] ?? ''}${person.lastName[0] ?? ''}`.toUpperCase();
  const progress = progressQuery.data;
  const diet = dietQuery.data;
  const accountActive = person.accountState === 'ACTIVE';

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <Ionicons name="chevron-back" size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.topBarCopy}>
          <Text style={styles.eyebrow}>MEMBER PROFILE</Text>
          <Text style={styles.pageTitle}>Member details</Text>
        </View>
      </View>

      <GlassCard style={styles.hero} raised>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
        <View style={styles.heroCopy}>
          <Text style={styles.memberName}>{person.firstName} {person.lastName}</Text>
          <Text style={styles.memberMeta}>{locationName ?? 'Gym member'}</Text>
          <View style={styles.statusLine}>
            <View style={[styles.activeDot, !accountActive && styles.inactiveDot]} />
            <Text style={[styles.activeText, !accountActive && styles.inactiveText]}>{accountActive ? 'Active account' : formatLabel(person.accountState)}</Text>
          </View>
        </View>
      </GlassCard>

      <SectionTitle icon="person-outline" title="Personal information" />
      <GlassCard style={styles.sectionCard}>
        <InfoRow icon="mail-outline" label="Email" value={person.email ?? 'Not provided'} />
        <InfoRow icon="call-outline" label="Mobile" value={person.phoneE164 ?? 'Not provided'} />
        <InfoRow icon="calendar-outline" label="Date of birth" value={person.dateOfBirth ? format(new Date(`${person.dateOfBirth}T00:00:00`), 'd MMM yyyy') : 'Not provided'} />
        <InfoRow icon="body-outline" label="Gender" value={formatLabel(person.gender)} />
        <InfoRow icon="resize-outline" label="Height" value={person.heightCm ? `${person.heightCm} cm` : 'Not provided'} />
        <InfoRow icon="trending-up-outline" label="Experience" value={formatLabel(person.experienceLevel)} />
        <InfoRow icon="flag-outline" label="Primary goal" value={formatLabel(person.primaryGoal)} last />
      </GlassCard>

      <SectionTitle icon="card-outline" title="Membership" />
      <GlassCard style={styles.featureCard}>
        <View style={[styles.featureIcon, person.membership?.currentlyActive && styles.goodIcon]}>
          <Ionicons name="card" size={21} color={person.membership?.currentlyActive ? colors.good : colors.accent} />
        </View>
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>{person.membership?.planName ?? 'No active membership'}</Text>
          <Text style={styles.featureMeta}>
            {person.membership
              ? `${person.membership.currentlyActive ? 'Active' : formatLabel(person.membership.state)} · valid until ${format(new Date(person.membership.expiresOn), 'd MMM yyyy')}`
              : 'Choose a plan to activate gym access.'}
          </Text>
        </View>
        {accountActive && !person.membership?.currentlyActive && canManageAssignment ? (
          <Pressable onPress={() => { setPlanPicker((value) => !value); setOperationError(null); }} style={styles.smallAction}>
            <Text style={styles.smallActionText}>Add plan</Text>
          </Pressable>
        ) : null}
      </GlassCard>
      {planPicker && accountActive ? (
        <GlassCard style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>{accountActive ? 'Select membership plan' : 'Select a plan to reactivate this member'}</Text>
          {(plansQuery.data ?? []).map((plan) => (
            <Pressable key={plan.id} onPress={() => setSelectedPlanId(plan.id)} style={[styles.optionRow, selectedPlanId === plan.id && styles.optionSelected]}>
              <View style={styles.optionCopy}><Text style={styles.optionTitle}>{plan.name}</Text><Text style={styles.optionMeta}>{plan.durationMonths} months</Text></View>
              <Text style={styles.optionPrice}>{formatMoney(plan.priceMinor, plan.currency)}</Text>
            </Pressable>
          ))}
          {plansQuery.data?.length === 0 ? <Text style={styles.muted}>Create a plan from Manage → Plans first.</Text> : null}
          <Button
            label={accountActive ? 'Activate membership' : 'Reactivate member'}
            onPress={() => accountActive ? sellMembership.mutate() : reactivateMember.mutate()}
            disabled={!selectedPlanId}
            loading={sellMembership.isPending || reactivateMember.isPending}
          />
          <Button label="Cancel" onPress={() => setPlanPicker(false)} variant="subtle" />
        </GlassCard>
      ) : null}

      <SectionTitle icon="fitness-outline" title="Assigned trainer" />
      <GlassCard style={styles.featureCard}>
        <View style={styles.featureIcon}><Ionicons name="fitness" size={21} color={colors.accent} /></View>
        <View style={styles.featureCopy}>
          <Text style={styles.featureTitle}>{person.assignedTrainer ? `${person.assignedTrainer.firstName} ${person.assignedTrainer.lastName}` : 'No trainer assigned'}</Text>
          <Text style={styles.featureMeta}>{person.assignedTrainer ? `Assigned ${format(new Date(person.assignedTrainer.assignedAt), 'd MMM yyyy')}` : 'Assign a trainer from this location.'}</Text>
        </View>
        {canManageAssignment ? (
          <Pressable onPress={() => { setTrainerPicker((value) => !value); setOperationError(null); }} style={styles.smallAction}>
            <Text style={styles.smallActionText}>{person.assignedTrainer ? 'Change' : 'Assign'}</Text>
          </Pressable>
        ) : null}
      </GlassCard>
      {trainerPicker ? (
        <GlassCard style={styles.pickerCard}>
          <Text style={styles.pickerTitle}>Choose a trainer</Text>
          {trainersQuery.isPending ? <ActivityIndicator color={colors.accent} /> : null}
          {(trainersQuery.data ?? []).map((trainer) => (
            <Pressable key={trainer.userId} onPress={() => assignTrainer.mutate(trainer.userId)} style={[styles.optionRow, person.assignedTrainer?.trainerUserId === trainer.userId && styles.optionSelected]}>
              <View style={styles.optionAvatar}><Text style={styles.optionAvatarText}>{trainer.firstName[0]}{trainer.lastName[0]}</Text></View>
              <View style={styles.optionCopy}><Text style={styles.optionTitle}>{trainer.firstName} {trainer.lastName}</Text><Text style={styles.optionMeta}>{trainer.phoneE164 ?? trainer.email ?? 'Trainer'}</Text></View>
              <Ionicons name="chevron-forward" size={17} color={colors.dim} />
            </Pressable>
          ))}
          {trainersQuery.data?.length === 0 ? <Text style={styles.muted}>No active trainers are available at this location.</Text> : null}
          {person.assignedTrainer ? <Button label="Remove trainer" onPress={() => removeTrainer.mutate()} loading={removeTrainer.isPending} variant="danger" /> : null}
          <Button label="Cancel" onPress={() => setTrainerPicker(false)} variant="subtle" />
        </GlassCard>
      ) : null}

      <SectionTitle icon="analytics-outline" title="Performance" />
      <View style={styles.statsRow}>
        <Stat value={progress?.workoutCount ?? 0} label="Workouts" />
        <Stat value={progress?.personalRecords.length ?? 0} label="Records" />
        <Stat value={progress?.metrics.length ?? 0} label="Measurements" />
      </View>
      {(progress?.personalRecords ?? []).slice(0, 3).map((record) => (
        <GlassCard key={record.exerciseId} style={styles.recordRow}>
          <View style={styles.recordIcon}><Ionicons name="trophy" size={16} color={colors.accent} /></View>
          <View style={styles.featureCopy}><Text style={styles.optionTitle}>{record.exerciseName}</Text><Text style={styles.optionMeta}>Personal best</Text></View>
          <Text style={styles.recordValue}>{record.maxWeightKg != null ? `${record.maxWeightKg} kg` : `${record.maxReps ?? 0} reps`}</Text>
        </GlassCard>
      ))}
      {!progressQuery.isPending && (progress?.personalRecords.length ?? 0) === 0 ? <Text style={styles.muted}>No personal records yet.</Text> : null}

      <View style={styles.sectionTitleWithAction}>
        <SectionTitle icon="nutrition-outline" title="Diet plan" />
        <Pressable onPress={() => router.push({ pathname: '/(training)/manage/member/[userId]/nutrition', params: { userId, name: `${person.firstName} ${person.lastName}` } })} style={styles.textAction}><Ionicons name="open-outline" size={15} color={colors.accent} /><Text style={styles.textActionLabel}>Open nutrition</Text></Pressable>
      </View>
      {diet ? (
        <GlassCard style={styles.dietCard} raised>
          <View style={styles.dietHeader}><View style={styles.featureIcon}><Ionicons name="nutrition" size={21} color={colors.accent} /></View><View style={styles.featureCopy}><Text style={styles.featureTitle}>{diet.objective}</Text><Text style={styles.featureMeta}>Since {format(new Date(`${diet.startsOn}T00:00:00`), 'd MMM yyyy')}</Text></View></View>
          <View style={styles.macroRow}>
            <Macro value={diet.kcalTarget} unit="kcal" label="Calories" />
            <Macro value={diet.proteinG} unit="g" label="Protein" />
            <Macro value={diet.carbsG} unit="g" label="Carbs" />
            <Macro value={diet.fatG} unit="g" label="Fat" />
          </View>
          <Text style={styles.dietContent}>{diet.content}</Text>
        </GlassCard>
      ) : <GlassCard style={styles.emptyDiet}><Ionicons name="restaurant-outline" size={27} color={colors.accent} /><Text style={styles.featureTitle}>No diet plan yet</Text><Text style={styles.muted}>Open nutrition to create goals and track daily intake for this member.</Text></GlassCard>}

      {operationError ? <View style={styles.errorBanner}><Ionicons name="alert-circle-outline" size={18} color={colors.alert} /><Text style={styles.errorText}>{operationError}</Text></View> : null}

      {canManageAssignment ? (
        <>
          <SectionTitle icon="shield-checkmark-outline" title="Account access" />
          <GlassCard style={styles.accessCard}>
            <View style={styles.featureCopy}>
              <Text style={styles.featureTitle}>{accountActive ? 'Member access is active' : 'Member access is deactivated'}</Text>
              <Text style={styles.featureMeta}>
                {accountActive
                  ? 'Deactivation revokes the active membership and blocks account access.'
                  : 'Select a new membership plan to reactivate this member.'}
              </Text>
            </View>
            {accountActive ? (
              !confirmingDeactivation ? (
                <Button label="Deactivate member & revoke membership" onPress={() => { setConfirmingDeactivation(true); setOperationError(null); }} variant="danger" />
              ) : (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>Deactivate this account and cancel its active membership?</Text>
                  <View style={styles.confirmActions}>
                    <View style={styles.actionFlex}><Button label="Cancel" onPress={() => setConfirmingDeactivation(false)} variant="subtle" /></View>
                    <View style={styles.actionFlex}><Button label="Deactivate" onPress={() => deactivateMember.mutate()} loading={deactivateMember.isPending} variant="danger" /></View>
                  </View>
                </View>
              )
            ) : (
              <View style={styles.reactivationPlans}>
                <Text style={styles.pickerTitle}>Choose a new membership plan</Text>
                {plansQuery.isPending ? <ActivityIndicator color={colors.accent} /> : null}
                {(plansQuery.data ?? []).map((plan) => (
                  <Pressable key={plan.id} onPress={() => setSelectedPlanId(plan.id)} style={[styles.optionRow, selectedPlanId === plan.id && styles.optionSelected]}>
                    <View style={styles.optionCopy}><Text style={styles.optionTitle}>{plan.name}</Text><Text style={styles.optionMeta}>{plan.durationMonths} months</Text></View>
                    <Text style={styles.optionPrice}>{formatMoney(plan.priceMinor, plan.currency)}</Text>
                  </Pressable>
                ))}
                {plansQuery.data?.length === 0 ? <Text style={styles.muted}>Create a plan from Manage → Plans first.</Text> : null}
                <Button label="Reactivate member" onPress={() => reactivateMember.mutate()} disabled={!selectedPlanId} loading={reactivateMember.isPending} />
              </View>
            )}
          </GlassCard>
        </>
      ) : null}
    </Screen>
  );
}

function SectionTitle({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return <View style={styles.sectionTitle}><Ionicons name={icon} size={16} color={colors.accent} /><Text style={styles.sectionLabel}>{title}</Text></View>;
}
function InfoRow({ icon, label, value, last = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return <View style={[styles.infoRow, !last && styles.infoBorder]}><View style={styles.infoIcon}><Ionicons name={icon} size={16} color={colors.ink2} /></View><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View>;
}
function Stat({ value, label }: { value: number; label: string }) {
  return <GlassCard style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></GlassCard>;
}
function Macro({ value, unit, label }: { value: number | null; unit: string; label: string }) {
  return <View style={styles.macro}><Text style={styles.macroValue}>{value ?? '—'}{value != null ? unit : ''}</Text><Text style={styles.macroLabel}>{label}</Text></View>;
}
function formatLabel(value: string | null | undefined) {
  if (!value) return 'Not provided';
  return value.toLowerCase().split('_').map((part) => part[0]?.toUpperCase() + part.slice(1)).join(' ');
}
function formatMoney(amountMinor: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amountMinor / 100); }
  catch { return `${currency} ${(amountMinor / 100).toFixed(0)}`; }
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  backButton: { width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, alignItems: 'center', justifyContent: 'center' },
  topBarCopy: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  pageTitle: { ...typography.title, color: colors.ink, marginTop: 2 },
  hero: { padding: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...typography.title, color: colors.onAccent, fontWeight: '800' },
  heroCopy: { flex: 1, gap: 3 },
  memberName: { ...typography.title, color: colors.ink },
  memberMeta: { ...typography.caption, color: colors.ink2 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.good },
  activeText: { ...typography.caption, color: colors.good },
  inactiveDot: { backgroundColor: colors.alert },
  inactiveText: { color: colors.alert },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitleWithAction: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLabel: { ...typography.eyebrow, color: colors.ink2 },
  sectionCard: { overflow: 'hidden' },
  infoRow: { minHeight: 55, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassLine2 },
  infoIcon: { width: 22, alignItems: 'center' },
  infoLabel: { ...typography.caption, color: colors.ink2, flex: 1 },
  infoValue: { ...typography.body, color: colors.ink, flex: 1.5, textAlign: 'right' },
  featureCard: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: { width: 42, height: 42, borderRadius: radius.field, backgroundColor: `rgba(${colors.accentRgb},0.12)`, alignItems: 'center', justifyContent: 'center' },
  goodIcon: { backgroundColor: 'rgba(63,209,124,0.11)' },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { ...typography.headline, color: colors.ink },
  featureMeta: { ...typography.caption, color: colors.dim, lineHeight: 18 },
  smallAction: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: `rgba(${colors.accentRgb},0.14)` },
  smallActionText: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  pickerCard: { padding: spacing.lg, gap: spacing.md },
  pickerTitle: { ...typography.headline, color: colors.ink },
  optionRow: { minHeight: 58, padding: spacing.md, borderRadius: radius.field, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  optionSelected: { borderColor: colors.accent, backgroundColor: `rgba(${colors.accentRgb},0.08)` },
  optionAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.glass2, alignItems: 'center', justifyContent: 'center' },
  optionAvatarText: { ...typography.caption, color: colors.ink, fontWeight: '800' },
  optionCopy: { flex: 1 },
  optionTitle: { ...typography.body, color: colors.ink, fontWeight: '600' },
  optionMeta: { ...typography.caption, color: colors.dim },
  optionPrice: { ...typography.headline, color: colors.accent },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, padding: spacing.md, gap: 2 },
  statValue: { ...typography.title, color: colors.ink },
  statLabel: { fontSize: 10.5, fontWeight: '600', color: colors.dim },
  recordRow: { padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  recordIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: `rgba(${colors.accentRgb},0.12)`, alignItems: 'center', justifyContent: 'center' },
  recordValue: { ...typography.headline, color: colors.accent },
  textAction: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: spacing.sm },
  textActionLabel: { ...typography.caption, color: colors.accent },
  dietCard: { padding: spacing.lg, gap: spacing.lg },
  dietHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  macroRow: { flexDirection: 'row', gap: spacing.sm },
  macro: { flex: 1, padding: spacing.sm, borderRadius: 12, backgroundColor: colors.glass, alignItems: 'center' },
  macroValue: { ...typography.caption, color: colors.ink, fontWeight: '800' },
  macroLabel: { fontSize: 9.5, color: colors.dim, marginTop: 2 },
  dietContent: { ...typography.body, color: colors.ink2, lineHeight: 22 },
  emptyDiet: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  editorCard: { padding: spacing.lg, gap: spacing.md },
  editorHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { ...typography.caption, color: colors.dim },
  error: { ...typography.body, color: colors.alert, textAlign: 'center' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.field, backgroundColor: 'rgba(240,66,66,0.1)', borderWidth: 1, borderColor: 'rgba(240,66,66,0.25)' },
  errorText: { ...typography.caption, color: colors.alert, flex: 1 },
  accessCard: { padding: spacing.lg, gap: spacing.md },
  confirmBox: { gap: spacing.md },
  confirmText: { ...typography.body, color: colors.ink2 },
  confirmActions: { flexDirection: 'row', gap: spacing.md },
  actionFlex: { flex: 1 },
  reactivationPlans: { gap: spacing.md },
});
