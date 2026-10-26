/**
 * FR-AUTH-08/09: approve or reject people who self-registered at this gym
 * and are still PENDING_VERIFICATION. Member approval includes the plan sale
 * in the same server transaction; staff approval never requires a plan.
 */
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Screen, GlassCard, Button, TextField } from '../../components/ui';
import { PersonCard, type PersonSummary } from '../../components/PersonCard';
import { colors, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';

interface PlanSummary {
  id: string;
  name: string;
  durationMonths: number;
  priceMinor: number;
  currency: string;
}

interface LocationSummary {
  id: string;
  name: string;
  addressLine1: string;
  city: string;
  state: string;
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [approving, setApproving] = useState<PersonSummary | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError, error: queryError, refetch, isRefetching } = useQuery({
    queryKey: ['identity', 'pending-approvals'],
    queryFn: async () => (await api.get<PersonSummary[]>('/verifications/pending')).data,
  });

  const plansQuery = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: async () => (await api.get<PlanSummary[]>('/plans')).data,
    enabled: approving?.role === 'MEMBER',
  });

  const locationsQuery = useQuery({
    queryKey: ['org', 'live-locations'],
    queryFn: async () => (await api.get<LocationSummary[]>('/locations/live')).data,
  });

  const decisionMutation = useMutation({
    mutationFn: ({
      userId,
      approved,
      reason,
      planId,
    }: {
      userId: string;
      approved: boolean;
      reason?: string;
      planId?: string;
    }) => api.post(`/verifications/${userId}`, { approved, reason, planId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identity', 'pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['identity', 'roster'] });
    },
  });

  async function approve(userId: string, planId?: string) {
    setActingOn(userId);
    setError(null);
    try {
      await decisionMutation.mutateAsync({
        userId,
        approved: true,
        ...(planId ? { planId } : {}),
      });
      setApproving(null);
      setSelectedPlanId(null);
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not approve this person.');
    } finally {
      setActingOn(null);
    }
  }

  async function confirmReject(userId: string) {
    if (!rejectReason.trim()) return;
    setActingOn(userId);
    setError(null);
    try {
      await decisionMutation.mutateAsync({ userId, approved: false, reason: rejectReason.trim() });
      setRejecting(null);
      setRejectReason('');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not reject this person.');
    } finally {
      setActingOn(null);
    }
  }

  return (
    <Screen scroll={false}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Approvals</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{problemFrom(queryError).detail ?? 'Could not load approvals.'}</Text>
            <Button label="Retry" onPress={() => refetch()} variant="ghost" />
          </View>
        ) : (data ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle-outline" size={32} color={colors.dim} />
            <Text style={styles.emptyText}>Nobody is waiting for approval.</Text>
          </View>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            data={data}
            keyExtractor={(p) => p.userId}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
            renderItem={({ item }) => (
              <PersonCard person={item}>
                <ApprovalDetails person={item} locations={locationsQuery.data ?? []} loadingLocations={locationsQuery.isPending} />
                <Text style={styles.requestedAt}>
                  Requested {formatDistanceToNow(new Date(item.grantedAt), { addSuffix: true })}
                </Text>
                {rejecting === item.userId ? (
                  <View style={styles.rejectBox}>
                    <TextField
                      label="Reason for rejection"
                      value={rejectReason}
                      onChangeText={setRejectReason}
                      placeholder="Explain why this request is being rejected"
                      autoFocus
                      multiline
                    />
                    <View style={styles.actionsRow}>
                      <View style={styles.actionFlex}>
                        <Button label="Cancel" onPress={() => setRejecting(null)} variant="subtle" disabled={actingOn === item.userId} />
                      </View>
                      <View style={styles.actionFlex}>
                        <Button
                          label="Confirm reject"
                          onPress={() => confirmReject(item.userId)}
                          loading={actingOn === item.userId}
                          disabled={!rejectReason.trim()}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    <View style={styles.actionFlex}>
                      <Button
                        label="Reject"
                        onPress={() => {
                          setRejecting(item.userId);
                          setRejectReason('');
                        }}
                        variant="ghost"
                        disabled={actingOn !== null}
                      />
                    </View>
                    <View style={styles.actionFlex}>
                      <Button
                        label={item.role === 'MEMBER' ? 'Choose plan' : 'Approve'}
                        onPress={() => {
                          if (item.role === 'MEMBER') {
                            setApproving(item);
                            setSelectedPlanId(null);
                            setError(null);
                          } else {
                            void approve(item.userId);
                          }
                        }}
                        loading={actingOn === item.userId}
                        disabled={actingOn !== null && actingOn !== item.userId}
                      />
                    </View>
                  </View>
                )}
              </PersonCard>
            )}
          />
        )}

        {approving ? (
          <View style={styles.sheetOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setApproving(null);
                setSelectedPlanId(null);
                setError(null);
              }}
            />
            <GlassCard style={styles.sheet} raised>
              <View style={styles.sheetHeading}>
                <View style={styles.sheetIcon}>
                  <Ionicons name="card-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.sheetCopy}>
                  <Text style={styles.sheetTitle}>Choose membership plan</Text>
                  <Text style={styles.sheetSubtitle}>
                    {approving.firstName} {approving.lastName} will be approved with this plan starting today.
                  </Text>
                </View>
              </View>

              {plansQuery.isPending ? (
                <ActivityIndicator color={colors.accent} />
              ) : plansQuery.isError ? (
                <View style={styles.planEmpty}>
                  <Text style={styles.error}>{problemFrom(plansQuery.error).detail ?? 'Could not load plans.'}</Text>
                  <Button label="Retry" onPress={() => plansQuery.refetch()} variant="ghost" />
                </View>
              ) : (plansQuery.data ?? []).length === 0 ? (
                <View style={styles.planEmpty}>
                  <Text style={styles.emptyText}>Create a membership plan before approving members.</Text>
                  <Button
                    label="Create a plan"
                    onPress={() => {
                      setApproving(null);
                      router.push('/(training)/manage/plans');
                    }}
                    variant="ghost"
                  />
                </View>
              ) : (
                <View style={styles.planList}>
                  {(plansQuery.data ?? []).map((plan) => {
                    const selected = selectedPlanId === plan.id;
                    return (
                      <Pressable key={plan.id} onPress={() => setSelectedPlanId(plan.id)} accessibilityRole="radio">
                        <View style={[styles.planRow, selected && styles.planRowSelected]}>
                          <View style={[styles.radio, selected && styles.radioSelected]}>
                            {selected ? <View style={styles.radioDot} /> : null}
                          </View>
                          <View style={styles.planText}>
                            <Text style={styles.planName}>{plan.name}</Text>
                            <Text style={styles.planMeta}>{plan.durationMonths} months</Text>
                          </View>
                          <Text style={styles.planPrice}>{formatMoney(plan.priceMinor, plan.currency)}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.actionsRow}>
                <View style={styles.actionFlex}>
                  <Button
                    label="Cancel"
                    onPress={() => {
                      setApproving(null);
                      setSelectedPlanId(null);
                      setError(null);
                    }}
                    variant="subtle"
                    disabled={actingOn === approving.userId}
                  />
                </View>
                <View style={styles.actionFlex}>
                  <Button
                    label="Approve member"
                    onPress={() => selectedPlanId && void approve(approving.userId, selectedPlanId)}
                    loading={actingOn === approving.userId}
                    disabled={!selectedPlanId}
                  />
                </View>
              </View>
            </GlassCard>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function ApprovalDetails({ person, locations, loadingLocations }: {
  person: PersonSummary;
  locations: LocationSummary[];
  loadingLocations: boolean;
}) {
  const requestedLocations = person.locationIds
    .map((locationId) => locations.find((location) => location.id === locationId))
    .filter((location): location is LocationSummary => Boolean(location));
  const locationLabel = person.gymWide
    ? 'All gym locations'
    : loadingLocations
      ? 'Loading location…'
    : requestedLocations.length
      ? requestedLocations.map((location) => location.name).join(', ')
      : 'Location unavailable';
  const locationAddress = requestedLocations.length === 1
    ? [requestedLocations[0]?.addressLine1, requestedLocations[0]?.city, requestedLocations[0]?.state].filter(Boolean).join(', ')
    : null;

  return (
    <View style={styles.detailsSection}>
      <View style={styles.locationDetail}>
        <View style={styles.detailIcon}>
          <Ionicons name="location" size={17} color={colors.accent} />
        </View>
        <View style={styles.detailBody}>
          <Text style={styles.detailLabel}>REQUESTED LOCATION</Text>
          <Text style={styles.locationValue}>{locationLabel}</Text>
          {locationAddress ? <Text style={styles.locationAddress}>{locationAddress}</Text> : null}
        </View>
      </View>

      <View style={styles.detailGrid}>
        <DetailItem icon="call-outline" label="Phone" value={person.phoneE164 || 'Not provided'} />
        <DetailItem icon="mail-outline" label="Email" value={person.email || 'Not provided'} />
        <DetailItem
          icon="calendar-outline"
          label="Date of birth"
          value={person.dateOfBirth ? format(new Date(`${person.dateOfBirth}T00:00:00`), 'd MMM yyyy') : 'Not provided'}
        />
        <DetailItem icon="person-outline" label="Gender" value={displayValue(person.gender)} />
        <DetailItem icon="resize-outline" label="Height" value={person.heightCm ? `${person.heightCm} cm` : 'Not provided'} />
        <DetailItem icon="barbell-outline" label="Experience" value={displayValue(person.experienceLevel)} />
      </View>

      <View style={styles.goalRow}>
        <Ionicons name="flag-outline" size={15} color={colors.dim} />
        <View style={styles.detailBody}>
          <Text style={styles.detailItemLabel}>Primary goal</Text>
          <Text style={styles.detailItemValue}>{displayValue(person.primaryGoal)}</Text>
        </View>
      </View>
    </View>
  );
}

function DetailItem({ icon, label, value }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <Ionicons name={icon} size={14} color={colors.dim} />
      <View style={styles.detailBody}>
        <Text style={styles.detailItemLabel}>{label}</Text>
        <Text style={styles.detailItemValue} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

function displayValue(value: string | null | undefined) {
  if (!value) return 'Not provided';
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typography.title, color: colors.ink },
  error: { ...typography.caption, color: colors.alert },
  list: { gap: spacing.md, paddingBottom: spacing.lg },
  requestedAt: { ...typography.caption, color: colors.dim },
  detailsSection: { gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassLine },
  locationDetail: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 14, backgroundColor: `rgba(${colors.accentRgb},0.08)`, borderWidth: 1, borderColor: `rgba(${colors.accentRgb},0.18)` },
  detailIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: `rgba(${colors.accentRgb},0.12)` },
  detailBody: { flex: 1, gap: 2 },
  detailLabel: { ...typography.eyebrow, color: colors.dim, fontSize: 9 },
  locationValue: { ...typography.body, color: colors.ink, fontWeight: '700' },
  locationAddress: { ...typography.caption, color: colors.ink2, lineHeight: 17 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detailItem: { width: '48%', minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: spacing.sm, borderRadius: 12, backgroundColor: colors.glass },
  detailItemLabel: { fontSize: 9.5, fontWeight: '600', color: colors.dim },
  detailItemValue: { ...typography.caption, color: colors.ink2 },
  goalRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.sm },
  rejectBox: { gap: spacing.md },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionFlex: { flex: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: -spacing.xl,
    right: -spacing.xl,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    padding: spacing.xl,
    gap: spacing.lg,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${colors.accentRgb},0.14)`,
  },
  sheetCopy: { flex: 1, gap: spacing.xs },
  sheetTitle: { ...typography.headline, color: colors.ink },
  sheetSubtitle: { ...typography.caption, color: colors.ink2, lineHeight: 18 },
  planList: { gap: spacing.sm },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassLine,
  },
  planRowSelected: { borderColor: colors.accent, backgroundColor: `rgba(${colors.accentRgb},0.08)` },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: colors.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  planText: { flex: 1, gap: 2 },
  planName: { ...typography.body, color: colors.ink, fontWeight: '600' },
  planMeta: { ...typography.caption, color: colors.ink2 },
  planPrice: { ...typography.headline, color: colors.accent },
  planEmpty: { gap: spacing.md },
});

function formatMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(0)}`;
  }
}
