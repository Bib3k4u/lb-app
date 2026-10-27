/**
 * FR-ORG-12: pricing catalogue. Creating a plan is Gym Owner-only (gym-wide
 * scope, enforced server-side); Location Admins can still see it here since
 * BillingService.listPlans is readable by any staff at the gym.
 */
import { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, GlassCard, Button, TextField } from '../../components/ui';
import { type PersonSummary } from '../../components/PersonCard';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';

interface PlanSummary {
  id: string;
  name: string;
  durationMonths: number;
  priceMinor: number;
  currency: string;
  assignedMemberCount: number;
}

export default function PlansScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanSummary | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: async () => (await api.get<PlanSummary[]>('/plans')).data,
  });
  const rosterQuery = useQuery({
    queryKey: ['identity', 'roster'],
    queryFn: async () => (await api.get<PersonSummary[]>('/roster')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (planId: string) => api.delete(`/plans/${planId}`),
    onSuccess: async () => {
      setDeleteConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
    },
  });

  async function deletePlan(planId: string) {
    setActionError(null);
    try {
      await deleteMutation.mutateAsync(planId);
    } catch (error) {
      setActionError(problemFrom(error).detail ?? 'Could not delete this plan.');
    }
  }

  return (
    <Screen scroll={false}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Plans</Text>
          <Pressable onPress={() => setAdding(true)} hitSlop={8} accessibilityRole="button" style={styles.addButton}>
            <Ionicons name="add" size={20} color={colors.onAccent} />
          </Pressable>
        </View>

        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        {query.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : query.isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{problemFrom(query.error).detail ?? 'Could not load plans.'}</Text>
            <Button label="Retry" onPress={() => query.refetch()} variant="ghost" />
          </View>
        ) : (query.data ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="pricetag-outline" size={32} color={colors.dim} />
            <Text style={styles.emptyText}>No plans yet — create your first one.</Text>
          </View>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            data={query.data}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
            renderItem={({ item }) => {
              const assignedMembers = (rosterQuery.data ?? []).filter((person) =>
                person.role === 'MEMBER'
                && person.membership?.planId === item.id
                && person.membership.state === 'ACTIVE');
              return <GlassCard style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardMeta}>{item.durationMonths} months</Text>
                  </View>
                  <Text style={styles.cardPrice}>{formatMoney(item.priceMinor, item.currency)}</Text>
                </View>
                {item.assignedMemberCount > 0 ? (
                  <View style={styles.lockedBlock}>
                    <View style={styles.lockedNote}>
                      <Ionicons name="lock-closed-outline" size={14} color={colors.dim} />
                      <Text style={styles.lockedText}>
                        Assigned to {item.assignedMemberCount} {item.assignedMemberCount === 1 ? 'member' : 'members'}. Revoke {item.assignedMemberCount === 1 ? 'the membership' : 'their memberships'} before editing or deleting.
                      </Text>
                    </View>
                    {assignedMembers.map((member) => (
                      <Pressable
                        key={member.userId}
                        onPress={() => router.push({ pathname: '/(training)/manage/member/[userId]', params: { userId: member.userId } })}
                        style={styles.memberLink}
                      >
                        <Text style={styles.memberLinkText}>{member.firstName} {member.lastName}</Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.accent} />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => { setEditingPlan(item); setActionError(null); }} style={styles.compactAction}>
                      <Ionicons name="create-outline" size={15} color={colors.ink2} />
                      <Text style={styles.compactActionText}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => setDeleteConfirmId(item.id)} style={styles.compactAction}>
                      <Ionicons name="trash-outline" size={15} color={colors.alert} />
                      <Text style={styles.dangerActionText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
                {deleteConfirmId === item.id ? (
                  <View style={styles.deleteConfirm}>
                    <Text style={styles.deleteText}>Delete this plan? Historical membership records will be preserved.</Text>
                    <View style={styles.actionsRow}>
                      <View style={styles.actionFlex}><Button label="Cancel" onPress={() => setDeleteConfirmId(null)} variant="subtle" /></View>
                      <View style={styles.actionFlex}><Button label="Delete" onPress={() => void deletePlan(item.id)} loading={deleteMutation.isPending} variant="danger" /></View>
                    </View>
                  </View>
                ) : null}
              </GlassCard>;
            }}
          />
        )}

        {adding ? (
          <PlanSheet
            onClose={() => setAdding(false)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
              setAdding(false);
            }}
          />
        ) : null}
        {editingPlan ? (
          <PlanSheet
            plan={editingPlan}
            onClose={() => setEditingPlan(null)}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['billing', 'plans'] });
              setEditingPlan(null);
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}

function PlanSheet({ plan, onClose, onSaved }: { plan?: PlanSummary; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [durationMonths, setDurationMonths] = useState(plan?.durationMonths.toString() ?? '1');
  const [priceRupees, setPriceRupees] = useState(plan ? (plan.priceMinor / 100).toString() : '');
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      (plan ? api.put(`/plans/${plan.id}`, {
        name: name.trim(),
        durationMonths: parseInt(durationMonths, 10) || 1,
        priceMinor: Math.round(parseFloat(priceRupees || '0') * 100),
      }) : api.post('/plans', {
        name: name.trim(),
        durationMonths: parseInt(durationMonths, 10) || 1,
        priceMinor: Math.round(parseFloat(priceRupees || '0') * 100),
      })),
    onSuccess: onSaved,
  });

  const valid = name.trim().length > 0 && parseInt(durationMonths, 10) > 0 && parseFloat(priceRupees || '0') > 0;

  async function submit() {
    if (!valid) return;
    setError(null);
    try {
      await saveMutation.mutateAsync();
    } catch (e) {
      setError(problemFrom(e).detail ?? `Could not ${plan ? 'update' : 'create'} this plan.`);
    }
  }

  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <GlassCard style={styles.sheet} raised>
          <Text style={styles.sheetTitle}>{plan ? 'Edit plan' : 'New plan'}</Text>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Monthly Unlimited" autoFocus />
          <View style={styles.row}>
            <View style={styles.flexHalf}>
              <TextField
                label="Duration (months)"
                value={durationMonths}
                onChangeText={(t) => setDurationMonths(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.flexHalf}>
              <TextField
                label="Price (₹)"
                value={priceRupees}
                onChangeText={(t) => setPriceRupees(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                placeholder="1500"
              />
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actionsRow}>
            <View style={styles.actionFlex}>
              <Button label="Cancel" onPress={onClose} variant="subtle" />
            </View>
            <View style={styles.actionFlex}>
              <Button label={plan ? 'Save changes' : 'Create'} onPress={submit} loading={saveMutation.isPending} disabled={!valid} />
            </View>
          </View>
        </GlassCard>
      </KeyboardAvoidingView>
    </View>
  );
}

function formatMoney(amountMinor: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(0)}`;
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typography.title, color: colors.ink, flex: 1 },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { padding: spacing.lg, gap: spacing.md },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBody: { gap: 2 },
  cardName: { ...typography.body, color: colors.ink, fontWeight: '600' },
  cardMeta: { ...typography.caption, color: colors.ink2 },
  cardPrice: { ...typography.headline, color: colors.accent },
  lockedBlock: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassLine2 },
  lockedNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  lockedText: { ...typography.caption, color: colors.dim, flex: 1, lineHeight: 18 },
  memberLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, paddingLeft: 22 },
  memberLinkText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  cardActions: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassLine2, paddingTop: spacing.sm },
  compactAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  compactActionText: { ...typography.caption, color: colors.ink2, fontWeight: '600' },
  dangerActionText: { ...typography.caption, color: colors.alert, fontWeight: '600' },
  deleteConfirm: { gap: spacing.md, paddingTop: spacing.sm },
  deleteText: { ...typography.caption, color: colors.ink2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  emptyText: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: { padding: spacing.xl, gap: spacing.lg, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  sheetTitle: { ...typography.headline, color: colors.ink },
  row: { flexDirection: 'row', gap: spacing.md },
  flexHalf: { flex: 1 },
  error: { ...typography.caption, color: colors.alert },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionFlex: { flex: 1 },
});
