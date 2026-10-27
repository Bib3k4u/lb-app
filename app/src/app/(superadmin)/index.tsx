/**
 * Super Admin review queue (LB-SRS-1.1 M20).
 *
 * PENDING_VERIFICATION registrations need a decision. VERIFIED registrations
 * have passed review and still need the separate subscription activation step.
 */
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewInstance,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { Screen, GlassCard, Button, TextField } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/store';

type MainTab = 'DASHBOARD' | 'RECORDS' | 'LOCATIONS';
type QueueFilter = 'ALL' | 'PENDING_VERIFICATION' | 'VERIFIED' | 'LIVE' | 'SUSPENDED' | 'REJECTED' | 'CLOSED';
type LifecycleAction = 'DEACTIVATE' | 'REACTIVATE' | 'DELETE';

interface LocationDetail {
  id: string;
  slug: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  pincode?: string | null;
  phoneE164?: string | null;
}

interface RegistrantSummary {
  firstName: string;
  lastName: string;
  phoneE164: string | null;
  email: string | null;
}

interface GymSummary {
  id: string;
  slug: string;
  legalName: string;
  tradingName: string | null;
  gstin: string | null;
  state: 'PENDING_VERIFICATION' | 'VERIFIED' | string;
  createdAt: string;
  registrant: RegistrantSummary | null;
  locations: LocationDetail[] | null;
}

interface OfferingSummary {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
}

interface LocationReview {
  id: string;
  gymId: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  phoneE164?: string | null;
}

export default function SuperAdminHome() {
  const firstName = useAuth((s) => s.user?.firstName);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MainTab>('DASHBOARD');
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [search, setSearch] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const gymsQuery = useQuery({
    queryKey: ['platform', 'gyms'],
    queryFn: async () => (await api.get<GymSummary[]>('/platform/gyms')).data,
  });

  const locationsQuery = useQuery({
    queryKey: ['org', 'location-review-queue'],
    queryFn: async () => (await api.get<LocationReview[]>('/locations/review-queue')).data,
  });

  const gyms = gymsQuery.data ?? [];
  const pendingCount = gyms.filter((gym) => gym.state === 'PENDING_VERIFICATION').length;
  const verifiedCount = gyms.filter((gym) => gym.state === 'VERIFIED').length;
  const activeCount = gyms.filter((gym) => gym.state === 'LIVE').length;
  const rejectedCount = gyms.filter((gym) => gym.state === 'REJECTED').length;
  const pendingLocationCount = locationsQuery.data?.length ?? 0;
  const attentionCount = pendingCount + verifiedCount + pendingLocationCount;
  const normalizedSearch = search.trim().toLowerCase();
  const searchDigits = normalizedSearch.replace(/\D/g, '');
  const filteredGyms = gyms.filter((gym) => {
    if (filter !== 'ALL' && gym.state !== filter) return false;
    if (!normalizedSearch) return true;
    const ownerName = gym.registrant ? fullName(gym.registrant) : '';
    const searchableText = [gym.legalName, gym.tradingName, ownerName, gym.registrant?.phoneE164]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const phoneDigits = gym.registrant?.phoneE164?.replace(/\D/g, '') ?? '';
    return searchableText.includes(normalizedSearch) || (searchDigits.length > 0 && phoneDigits.includes(searchDigits));
  });

  const offeringQuery = useQuery({
    queryKey: ['platform', 'default-offering'],
    queryFn: async () =>
      (await api.get<OfferingSummary>('/platform/subscription-offerings/default')).data,
    enabled: verifiedCount > 0,
    staleTime: 5 * 60 * 1000,
  });

  const decisionMutation = useMutation({
    mutationFn: ({ gymId, approved, reason }: { gymId: string; approved: boolean; reason?: string }) =>
      api.post(`/platform/gyms/${gymId}/verification`, { approved, reason }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'gyms'] }),
  });

  const activateMutation = useMutation({
    mutationFn: async (gymId: string) => {
      const offering =
        offeringQuery.data ??
        (await api.get<OfferingSummary>('/platform/subscription-offerings/default')).data;
      return api.post(
        `/platform/gyms/${gymId}/subscription-payments`,
        {
          offeringId: offering.id,
          amountMinor: offering.priceMinor,
          method: 'BANK_TRANSFER',
          reference: 'Activated via app',
          receivedOn: new Date().toISOString().slice(0, 10),
        },
        { headers: { 'Idempotency-Key': `activate-${gymId}` } },
      );
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'gyms'] }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: ({ gymId, action }: { gymId: string; action: LifecycleAction }) => {
      if (action === 'DEACTIVATE') {
        return api.post(`/platform/gyms/${gymId}/deactivation`, {
          reason: 'Deactivated by platform administrator',
        });
      }
      if (action === 'REACTIVATE') return api.post(`/platform/gyms/${gymId}/reactivation`);
      return api.delete(`/platform/gyms/${gymId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform', 'gyms'] }),
  });

  async function verify(gymId: string) {
    setActingOn(gymId);
    setActionError(null);
    try {
      await decisionMutation.mutateAsync({ gymId, approved: true });
    } catch (error) {
      setActionError(problemFrom(error).detail ?? 'Could not verify this gym.');
    } finally {
      setActingOn(null);
    }
  }

  async function confirmReject(gymId: string) {
    if (!rejectReason.trim()) return;
    setActingOn(gymId);
    setActionError(null);
    try {
      await decisionMutation.mutateAsync({ gymId, approved: false, reason: rejectReason.trim() });
      setRejecting(null);
      setRejectReason('');
    } catch (error) {
      setActionError(problemFrom(error).detail ?? 'Could not reject this gym.');
    } finally {
      setActingOn(null);
    }
  }

  async function activate(gymId: string) {
    setActingOn(gymId);
    setActionError(null);
    try {
      await activateMutation.mutateAsync(gymId);
    } catch (error) {
      setActionError(problemFrom(error).detail ?? 'Could not activate this gym.');
    } finally {
      setActingOn(null);
    }
  }

  async function manageLifecycle(gymId: string, action: LifecycleAction) {
    setActingOn(gymId);
    setActionError(null);
    try {
      await lifecycleMutation.mutateAsync({ gymId, action });
    } catch (error) {
      const fallback = action === 'DELETE' ? 'Could not delete this gym.' : 'Could not update this gym.';
      setActionError(problemFrom(error).detail ?? fallback);
      throw error;
    } finally {
      setActingOn(null);
    }
  }

  const fetchError = gymsQuery.isError
    ? problemFrom(gymsQuery.error).detail ?? 'Could not load gym registrations.'
    : null;

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.page}>
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <Text style={styles.brandText}>LB</Text>
          </View>
          <View style={styles.headingWrap}>
            <Text style={styles.eyebrow}>SUPER ADMIN</Text>
            <Text style={styles.title}>{firstName ? `Hi, ${firstName}` : 'Control center'}</Text>
          </View>
        </View>

        <View style={styles.mainTabs} accessibilityRole="tablist">
          <MainTabButton label="Dashboard" active={tab === 'DASHBOARD'} onPress={() => setTab('DASHBOARD')} />
          <MainTabButton
            label="Gyms"
            active={tab === 'RECORDS'}
            onPress={() => setTab('RECORDS')}
          />
          <MainTabButton
            label="Locations"
            active={tab === 'LOCATIONS'}
            onPress={() => setTab('LOCATIONS')}
          />
        </View>

        {actionError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.alert} />
            <Text style={styles.errorBannerText}>{actionError}</Text>
            <Pressable onPress={() => setActionError(null)} hitSlop={8} accessibilityLabel="Dismiss error">
              <Ionicons name="close" size={18} color={colors.dim} />
            </Pressable>
          </View>
        ) : null}

        {gymsQuery.isPending ? (
          <LoadingState />
        ) : fetchError ? (
          <ErrorState message={fetchError} onRetry={() => void gymsQuery.refetch()} />
        ) : tab === 'DASHBOARD' ? (
          <ScrollView
            contentContainerStyle={styles.dashboard}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={gymsQuery.isRefetching} onRefresh={() => void gymsQuery.refetch()} tintColor={colors.accent} />}
          >
            <GlassCard style={styles.overviewCard} raised>
              <View style={styles.overviewCopy}>
                <Text style={styles.overviewLabel}>PLATFORM OVERVIEW</Text>
                <View style={styles.overviewCountRow}>
                  <Text style={styles.overviewCount}>{gyms.length}</Text>
                  <Text style={styles.overviewUnit}>registered {gyms.length === 1 ? 'gym' : 'gyms'}</Text>
                </View>
                <Text style={styles.overviewHint}>
                  {attentionCount === 0 ? 'Everything is up to date.' : `${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} your attention.`}
                </Text>
              </View>
            </GlassCard>

            <View style={styles.metricsGrid}>
              <DashboardMetric icon="search-outline" label="Awaiting review" count={pendingCount} tone="accent" onPress={() => { setFilter('PENDING_VERIFICATION'); setTab('RECORDS'); }} />
              <DashboardMetric icon="flash-outline" label="To activate" count={verifiedCount} tone="accent" onPress={() => { setFilter('VERIFIED'); setTab('RECORDS'); }} />
              <DashboardMetric icon="checkmark-circle-outline" label="Active gyms" count={activeCount} tone="good" onPress={() => { setFilter('LIVE'); setTab('RECORDS'); }} />
              <DashboardMetric icon="close-circle-outline" label="Rejected" count={rejectedCount} tone="alert" onPress={() => { setFilter('REJECTED'); setTab('RECORDS'); }} />
              <DashboardMetric icon="location-outline" label="Location reviews" count={pendingLocationCount} tone="accent" onPress={() => setTab('LOCATIONS')} />
            </View>

            <Pressable
              onPress={() => {
                if (pendingLocationCount) setTab('LOCATIONS');
                else { setFilter(attentionCount ? 'PENDING_VERIFICATION' : 'ALL'); setTab('RECORDS'); }
              }}
              style={({ pressed }) => [styles.queueShortcut, pressed && styles.pressed]}
            >
              <View style={styles.queueShortcutIcon}>
                <Ionicons name={attentionCount ? 'notifications-outline' : 'checkmark'} size={20} color={attentionCount ? colors.accent : colors.good} />
              </View>
              <View style={styles.queueShortcutCopy}>
                <Text style={styles.queueShortcutTitle}>{attentionCount ? 'Open priority queue' : 'Queue cleared'}</Text>
                <Text style={styles.queueShortcutText}>{attentionCount ? 'Review gym registrations, activations and new locations.' : 'Browse the complete gym record when needed.'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.dim} />
            </Pressable>
          </ScrollView>
        ) : tab === 'RECORDS' ? (
          <View style={styles.recordsPane}>
          <View style={styles.recordsToolbar}>
            <View style={styles.searchField}>
              <Ionicons name="search-outline" size={17} color={colors.dim} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Gym, owner or phone"
                placeholderTextColor={colors.dim}
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="Search gym records"
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Clear search">
                  <Ionicons name="close-circle" size={17} color={colors.dim} />
                </Pressable>
              ) : null}
            </View>
            <FilterDropdown value={filter} gyms={gyms} onChange={setFilter} />
          </View>
          <FlatList
            data={filteredGyms}
            keyExtractor={(gym) => gym.id}
            contentContainerStyle={[styles.list, filteredGyms.length === 0 && styles.emptyList]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={gymsQuery.isRefetching}
                onRefresh={() => void gymsQuery.refetch()}
                tintColor={colors.accent}
              />
            }
            ListEmptyComponent={<EmptyState filtered={filter !== 'ALL'} onRefresh={() => void gymsQuery.refetch()} />}
            renderItem={({ item }) => (
              <GymCard
                gym={item}
                busy={actingOn === item.id}
                disabled={actingOn !== null && actingOn !== item.id}
                rejecting={rejecting === item.id}
                rejectReason={rejectReason}
                onRejectReasonChange={setRejectReason}
                onStartReject={() => {
                  setRejecting(item.id);
                  setRejectReason('');
                }}
                onCancelReject={() => {
                  setRejecting(null);
                  setRejectReason('');
                }}
                onConfirmReject={() => void confirmReject(item.id)}
                onVerify={() => void verify(item.id)}
                  onActivate={() => void activate(item.id)}
                  onManageLifecycle={(action) => manageLifecycle(item.id, action)}
                />
            )}
          />
          </View>
        ) : (
          <LocationReviewPane query={locationsQuery} gyms={gyms} />
        )}
      </View>
    </Screen>
  );
}

function LocationReviewPane({ query, gyms }: {
  query: {
    data: LocationReview[] | undefined;
    isPending: boolean;
    isError: boolean;
    error: unknown;
    isRefetching: boolean;
    refetch: () => unknown;
  };
  gyms: GymSummary[];
}) {
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ locationId, approved, reason: reviewReason }: { locationId: string; approved: boolean; reason: string | undefined }) =>
      api.post(`/locations/${locationId}/verification`, { approved, reason: reviewReason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['org', 'location-review-queue'] });
      await queryClient.invalidateQueries({ queryKey: ['org', 'managed-locations'] });
    },
  });

  async function decide(locationId: string, approved: boolean) {
    if (!approved && !reason.trim()) return;
    setActingOn(locationId);
    setError(null);
    try {
      await mutation.mutateAsync({ locationId, approved, reason: approved ? undefined : reason.trim() });
      setRejecting(null);
      setReason('');
    } catch (reviewError) {
      setError(problemFrom(reviewError).detail ?? 'Could not review this location.');
    } finally {
      setActingOn(null);
    }
  }

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return <ErrorState message={problemFrom(query.error).detail ?? 'Could not load location reviews.'} onRetry={() => void query.refetch()} />;
  }

  const locations = query.data ?? [];
  return (
    <FlatList
      data={locations}
      keyExtractor={(location) => location.id}
      contentContainerStyle={[styles.locationReviewList, locations.length === 0 && styles.emptyList]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
      ListHeaderComponent={error ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{error}</Text></View> : undefined}
      ListEmptyComponent={
        <View style={styles.stateWrap}>
          <View style={styles.stateIcon}><Ionicons name="checkmark-done" size={27} color={colors.good} /></View>
          <Text style={styles.stateTitle}>No location reviews</Text>
          <Text style={styles.stateText}>New gym locations awaiting approval will appear here.</Text>
        </View>
      }
      renderItem={({ item }) => {
        const gym = gyms.find((entry) => entry.id === item.gymId);
        const isRejecting = rejecting === item.id;
        const busy = actingOn === item.id;
        return (
          <GlassCard style={styles.locationReviewCard}>
            <View style={styles.locationReviewHeader}>
              <View style={styles.locationReviewIcon}><Ionicons name="location" size={18} color={colors.accent} /></View>
              <View style={styles.locationReviewCopy}>
                <Text style={styles.locationReviewName}>{item.name}</Text>
                <Text style={styles.locationReviewGym}>{gym?.legalName ?? 'Gym'} · New location</Text>
              </View>
              <View style={styles.reviewBadge}><Text style={styles.reviewBadgeText}>In review</Text></View>
            </View>
            <Text style={styles.locationReviewAddress}>
              {[item.addressLine1, item.addressLine2, item.city, item.state, item.pincode].filter(Boolean).join(', ')}
            </Text>
            {item.phoneE164 ? <ContactLine icon="call-outline" value={item.phoneE164} /> : null}
            {isRejecting ? (
              <View style={styles.rejectBox}>
                <TextField label="Reason for rejection" value={reason} onChangeText={setReason} multiline autoFocus placeholder="What should the gym correct?" />
                <View style={styles.actionsRow}>
                  <CompactAction label="Cancel" onPress={() => { setRejecting(null); setReason(''); }} disabled={busy} />
                  <CompactAction label="Confirm reject" onPress={() => void decide(item.id, false)} tone="danger" loading={busy} disabled={!reason.trim()} />
                </View>
              </View>
            ) : (
              <View style={styles.actionsRow}>
                <CompactAction label="Reject" onPress={() => { setRejecting(item.id); setReason(''); }} tone="danger" disabled={actingOn !== null} />
                <CompactAction label="Approve" onPress={() => void decide(item.id, true)} tone="primary" loading={busy} disabled={actingOn !== null && !busy} />
              </View>
            )}
          </GlassCard>
        );
      }}
    />
  );
}

function MainTabButton({ label, active, onPress }: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.mainTab, active && styles.mainTabActive, pressed && styles.pressed]}
    >
      <Text style={[styles.mainTabLabel, active && styles.mainTabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function DashboardMetric({ icon, label, count, tone, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  tone: 'accent' | 'good' | 'alert';
  onPress: () => void;
}) {
  const color = tone === 'good' ? colors.good : tone === 'alert' ? colors.alert : colors.accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.metricCard, pressed && styles.pressed]}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, { borderColor: color }]}><Ionicons name={icon} size={18} color={color} /></View>
        <Ionicons name="arrow-forward" size={15} color={colors.dim} />
      </View>
      <Text style={styles.metricCount}>{count}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </Pressable>
  );
}

function FilterDropdown({ value, gyms, onChange }: {
  value: QueueFilter;
  gyms: GymSummary[];
  onChange: (value: QueueFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 190, height: 36 });
  const triggerRef = useRef<ViewInstance>(null);
  const options: { value: QueueFilter; label: string; shortLabel: string }[] = [
    { value: 'ALL', label: 'All gyms', shortLabel: 'All' },
    { value: 'PENDING_VERIFICATION', label: 'Awaiting review', shortLabel: 'Review' },
    { value: 'VERIFIED', label: 'Awaiting activation', shortLabel: 'Activation' },
    { value: 'LIVE', label: 'Active', shortLabel: 'Active' },
    { value: 'SUSPENDED', label: 'Deactivated', shortLabel: 'Inactive' },
    { value: 'REJECTED', label: 'Rejected', shortLabel: 'Rejected' },
    { value: 'CLOSED', label: 'Deleted', shortLabel: 'Deleted' },
  ];
  const selected = options.find((option) => option.value === value) ?? options[0]!;
  const countFor = (option: QueueFilter) =>
    option === 'ALL' ? gyms.length : gyms.filter((gym) => gym.state === option).length;

  function toggleDropdown() {
    if (open) {
      setOpen(false);
      return;
    }
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }

  return (
    <View style={styles.filterDropdownWrap}>
      <Pressable
        ref={triggerRef}
        onPress={toggleDropdown}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.filterSelect, pressed && styles.pressed]}
      >
        <Ionicons name="filter-outline" size={15} color={colors.dim} />
        <Text style={styles.filterSelectText} numberOfLines={1}>{selected.shortLabel}</Text>
        <Text style={styles.filterSelectCount}>{countFor(selected.value)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.dim} />
      </Pressable>

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.dropdownOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close filter menu" />
          <View
            style={[
              styles.filterMenu,
              { top: anchor.y + anchor.height + 4, left: anchor.x + anchor.width - 220 },
            ]}
          >
            {options.map((option) => {
              const selectedOption = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [styles.filterOption, selectedOption && styles.filterOptionSelected, pressed && styles.pressed]}
                >
                  <Text style={[styles.filterOptionText, selectedOption && styles.filterOptionTextSelected]}>{option.label}</Text>
                  <Text style={styles.filterOptionCount}>{countFor(option.value)}</Text>
                  {selectedOption ? <Ionicons name="checkmark" size={16} color={colors.accent} /> : <View style={styles.filterCheckSpace} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CompactAction({
  label,
  onPress,
  tone = 'neutral',
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const color = tone === 'danger' ? colors.alert : tone === 'primary' ? colors.onAccent : colors.ink2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.compactAction,
        tone === 'primary' && styles.compactActionPrimary,
        tone === 'danger' && styles.compactActionDanger,
        (disabled || loading) && styles.compactActionDisabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={color} /> : <Text style={[styles.compactActionLabel, { color }]}>{label}</Text>}
    </Pressable>
  );
}

function GymCard({
  gym,
  busy,
  disabled,
  rejecting,
  rejectReason,
  onRejectReasonChange,
  onStartReject,
  onCancelReject,
  onConfirmReject,
  onVerify,
  onActivate,
  onManageLifecycle,
}: {
  gym: GymSummary;
  busy: boolean;
  disabled: boolean;
  rejecting: boolean;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  onStartReject: () => void;
  onCancelReject: () => void;
  onConfirmReject: () => void;
  onVerify: () => void;
  onActivate: () => void;
  onManageLifecycle: (action: LifecycleAction) => Promise<unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [managementAction, setManagementAction] = useState<LifecycleAction | null>(null);
  const isPending = gym.state === 'PENDING_VERIFICATION';
  const isVerified = gym.state === 'VERIFIED';
  const locations = gym.locations ?? [];
  const submitted = submissionLabel(gym.createdAt);

  async function confirmManagement() {
    if (!managementAction) return;
    try {
      await onManageLifecycle(managementAction);
      setManagementAction(null);
    } catch {
      // The parent exposes the server error in the shared banner. Keep the
      // confirmation open so the operator can retry or cancel deliberately.
    }
  }

  return (
    <GlassCard style={styles.card}>
      <View style={styles.cardTopLine}>
        <StateBadge state={gym.state} />
        <View style={styles.submittedWrap}>
          <Ionicons name="time-outline" size={13} color={colors.dim} />
          <Text style={styles.submittedText}>{submitted.relative}</Text>
        </View>
      </View>

      <View style={styles.gymIdentity}>
        <View style={styles.cardIconWrap}>
          <Ionicons name="business" size={23} color={colors.accent} />
        </View>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardTitle}>{gym.legalName}</Text>
          <Text style={styles.cardSubtitle}>
            {gym.tradingName && gym.tradingName !== gym.legalName
              ? `Trading as ${gym.tradingName}`
              : `Submitted ${submitted.date}`}
          </Text>
        </View>
      </View>

      <View style={styles.cardSummary}>
        <View style={styles.cardSummaryItem}>
          <Ionicons name="person-outline" size={15} color={colors.dim} />
          <Text style={styles.cardSummaryText} numberOfLines={1}>
            {gym.registrant ? fullName(gym.registrant) : 'Applicant unavailable'}
          </Text>
        </View>
        <View style={styles.cardSummaryItem}>
          <Ionicons name="location-outline" size={15} color={colors.dim} />
          <Text style={styles.cardSummaryText} numberOfLines={1}>
            {locations.length ? `${locations.length} ${locations.length === 1 ? 'location' : 'locations'} · ${locations[0]?.city}` : 'No locations'}
          </Text>
        </View>
      </View>

      <Pressable onPress={() => setExpanded((value) => !value)} style={styles.detailsToggle} accessibilityState={{ expanded }}>
        <Text style={styles.detailsToggleText}>{expanded ? 'Hide details' : isPending ? 'Review details' : 'View details'}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={colors.accent} />
      </Pressable>

      {expanded ? <>

      <View style={styles.businessGrid}>
        <DetailCell icon="link-outline" label="GYM SLUG" value={gym.slug || 'Not provided'} />
        <DetailCell icon="document-text-outline" label="GSTIN" value={gym.gstin || 'Not provided'} />
      </View>

      <View style={styles.detailSection}>
        <SectionTitle icon="person-outline" label="Applicant" />
        {gym.registrant ? (
          <View style={styles.contactCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(gym.registrant.firstName, gym.registrant.lastName)}</Text>
            </View>
            <View style={styles.contactBody}>
              <Text style={styles.contactName}>{fullName(gym.registrant)}</Text>
              <ContactLine icon="call-outline" value={gym.registrant.phoneE164 || 'Phone not provided'} />
              <ContactLine icon="mail-outline" value={gym.registrant.email || 'Email not provided'} />
            </View>
          </View>
        ) : (
          <MissingDetail text="Applicant details are not available." />
        )}
      </View>

      <View style={styles.detailSection}>
        <SectionTitle
          icon="location-outline"
          label={`${locations.length} ${locations.length === 1 ? 'location' : 'locations'}`}
        />
        {locations.length > 0 ? (
          <View style={styles.locationList}>
            {locations.map((location, index) => (
              <LocationBlock key={location.id || `${gym.id}-${index}`} location={location} index={index} />
            ))}
          </View>
        ) : (
          <MissingDetail text="No location details were returned." />
        )}
      </View>

      {isPending || isVerified ? <View style={[styles.nextStep, isVerified && styles.nextStepReady]}>
        <View style={[styles.nextStepIcon, isVerified && styles.nextStepIconReady]}>
          <Ionicons
            name={isPending ? 'shield-checkmark-outline' : 'flash-outline'}
            size={18}
            color={isPending ? colors.accent : colors.good}
          />
        </View>
        <View style={styles.nextStepCopy}>
          <Text style={styles.nextStepLabel}>{isPending ? 'REVIEW REQUIRED' : 'READY TO ACTIVATE'}</Text>
          <Text style={styles.nextStepText}>
            {isPending
              ? 'Confirm the business, applicant and location details before verifying.'
              : 'Verification is complete. Activate this gym to make it live.'}
          </Text>
        </View>
      </View> : null}

      {rejecting ? (
        <View style={styles.rejectBox}>
          <TextField
            label="Reason for rejection"
            value={rejectReason}
            onChangeText={onRejectReasonChange}
            placeholder="Tell the applicant what needs to be corrected"
            autoFocus
            multiline
          />
          <View style={styles.actionsRow}>
            <CompactAction label="Cancel" onPress={onCancelReject} disabled={busy} />
            <CompactAction
              label="Confirm reject"
              onPress={onConfirmReject}
              tone="danger"
              loading={busy}
              disabled={!rejectReason.trim() || disabled}
            />
          </View>
        </View>
      ) : isPending ? (
        <View style={styles.actionsRow}>
          <CompactAction label="Reject" onPress={onStartReject} tone="danger" disabled={busy || disabled} />
          <CompactAction label="Approve" onPress={onVerify} tone="primary" loading={busy} disabled={disabled} />
        </View>
      ) : null}

      {gym.state !== 'CLOSED' ? (
        managementAction ? (
          <View style={styles.managementConfirm}>
            <View style={styles.managementWarning}>
              <Ionicons name="warning-outline" size={17} color={managementAction === 'DELETE' ? colors.alert : colors.accent} />
              <Text style={styles.managementWarningText}>
                {managementAction === 'DELETE'
                  ? 'Delete this gym? It will be closed and hidden, while historical records remain preserved.'
                  : managementAction === 'DEACTIVATE'
                    ? 'Deactivate this gym? It will no longer appear as active.'
                    : 'Reactivate this gym and make it operational again?'}
              </Text>
            </View>
            <View style={styles.actionsRow}>
              <CompactAction label="Cancel" onPress={() => setManagementAction(null)} disabled={busy} />
              <CompactAction
                label={managementAction === 'DELETE' ? 'Delete gym' : managementAction === 'DEACTIVATE' ? 'Deactivate' : 'Reactivate'}
                onPress={() => void confirmManagement()}
                tone={managementAction === 'DELETE' ? 'danger' : 'primary'}
                loading={busy}
                disabled={disabled}
              />
            </View>
          </View>
        ) : (
          <View style={styles.managementActions}>
            <View style={styles.managementLeftAction}>
              {gym.state === 'VERIFIED' ? (
                <CompactAction label="Activate gym" onPress={onActivate} tone="primary" loading={busy} disabled={disabled} />
              ) : gym.state === 'LIVE' ? (
                <CompactAction label="Deactivate" onPress={() => setManagementAction('DEACTIVATE')} />
              ) : gym.state === 'SUSPENDED' ? (
                <CompactAction label="Reactivate" onPress={() => setManagementAction('REACTIVATE')} />
              ) : null}
            </View>
            <View style={styles.managementRightAction}>
              <CompactAction label="Delete" onPress={() => setManagementAction('DELETE')} tone="danger" />
            </View>
          </View>
        )
      ) : null}
      </> : null}
    </GlassCard>
  );
}

function DetailCell({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailCell}>
      <Ionicons name={icon} size={16} color={colors.accent} />
      <View style={styles.detailCellCopy}>
        <Text style={styles.detailCellLabel}>{label}</Text>
        <Text style={styles.detailCellValue} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

function SectionTitle({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons name={icon} size={15} color={colors.dim} />
      <Text style={styles.sectionTitle}>{label}</Text>
    </View>
  );
}

function ContactLine({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.contactLine}>
      <Ionicons name={icon} size={14} color={colors.dim} />
      <Text style={styles.contactValue} selectable>{value}</Text>
    </View>
  );
}

function LocationBlock({ location, index }: { location: LocationDetail; index: number }) {
  const address = [
    location.addressLine1,
    location.addressLine2,
    [location.city, location.state, location.pincode].filter(Boolean).join(' '),
  ].filter(Boolean);

  return (
    <View style={styles.locationBlock}>
      <View style={styles.locationNumber}>
        <Text style={styles.locationNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.locationBody}>
        <Text style={styles.locationName}>{location.name || 'Unnamed location'}</Text>
        <Text style={styles.locationSlug}>{location.slug ? `/${location.slug}` : 'No location slug'}</Text>
        <Text style={styles.addressText}>{address.join(', ') || 'Address not provided'}</Text>
        {location.phoneE164 ? <ContactLine icon="call-outline" value={location.phoneE164} /> : null}
      </View>
    </View>
  );
}

function MissingDetail({ text }: { text: string }) {
  return (
    <View style={styles.missingDetail}>
      <Ionicons name="information-circle-outline" size={16} color={colors.dim} />
      <Text style={styles.missingDetailText}>{text}</Text>
    </View>
  );
}

function StateBadge({ state }: { state: string }) {
  const status =
    state === 'LIVE'
      ? { label: 'Active', color: colors.good, background: 'rgba(63,209,124,0.10)', border: 'rgba(63,209,124,0.22)' }
      : state === 'SUSPENDED'
        ? { label: 'Deactivated', color: colors.dim, background: colors.glass, border: colors.glassLine2 }
        : state === 'REJECTED'
          ? { label: 'Rejected', color: colors.alert, background: 'rgba(240,66,66,0.10)', border: 'rgba(240,66,66,0.22)' }
          : state === 'CLOSED'
            ? { label: 'Deleted', color: colors.dim, background: colors.glass, border: colors.glassLine }
        : state === 'VERIFIED'
          ? { label: 'Awaiting activation', color: colors.good, background: 'rgba(63,209,124,0.10)', border: 'rgba(63,209,124,0.22)' }
          : state === 'PENDING_VERIFICATION'
            ? { label: 'Awaiting review', color: colors.accent, background: 'rgba(247,208,70,0.11)', border: 'rgba(247,208,70,0.20)' }
            : { label: state.replaceAll('_', ' ').toLowerCase(), color: colors.dim, background: colors.glass, border: colors.glassLine };
  return (
    <View style={[styles.badge, { backgroundColor: status.background, borderColor: status.border }]}>
      <View style={[styles.badgeDot, { backgroundColor: status.color }]} />
      <Text style={[styles.badgeLabel, { color: status.color }]}>{status.label}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator color={colors.accent} size="small" />
      <Text style={styles.stateText}>Loading registrations…</Text>
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <View style={[styles.stateIcon, styles.stateIconError]}>
        <Ionicons name="cloud-offline-outline" size={26} color={colors.alert} />
      </View>
      <Text style={styles.stateTitle}>Couldn’t load the queue</Text>
      <Text style={styles.stateText}>{message}</Text>
      <Button label="Try again" onPress={onRetry} variant="ghost" style={styles.stateButton} />
    </View>
  );
}

function EmptyState({ filtered, onRefresh }: { filtered: boolean; onRefresh: () => void }) {
  return (
    <View style={styles.stateWrap}>
      <View style={styles.stateIcon}>
        <Ionicons name={filtered ? 'filter-outline' : 'checkmark-done'} size={27} color={colors.good} />
      </View>
      <Text style={styles.stateTitle}>{filtered ? 'No gyms in this stage' : 'You’re all caught up'}</Text>
      <Text style={styles.stateText}>
        {filtered ? 'Choose another queue to see its registrations.' : 'There are no gym registrations waiting for action.'}
      </Text>
      {!filtered ? <Button label="Refresh" onPress={onRefresh} variant="ghost" style={styles.stateButton} /> : null}
    </View>
  );
}

function submissionLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { relative: 'Date unavailable', date: 'date unavailable' };
  return {
    relative: formatDistanceToNow(date, { addSuffix: true }),
    date: format(date, 'd MMM yyyy'),
  };
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function fullName(registrant: RegistrantSummary) {
  return [registrant.firstName, registrant.lastName].filter(Boolean).join(' ') || 'Name not provided';
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingTop: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  brandText: { fontSize: 14, fontWeight: '900', color: colors.onAccent, letterSpacing: -0.5 },
  headingWrap: { flex: 1, marginLeft: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.accent, fontSize: 9.5 },
  title: { ...typography.headline, color: colors.ink, marginTop: 2 },
  mainTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassLine,
  },
  mainTab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  mainTabActive: {
    borderBottomColor: colors.accent,
  },
  mainTabLabel: { ...typography.caption, color: colors.dim, fontWeight: '600' },
  mainTabLabelActive: { color: colors.accent, fontWeight: '800' },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  pressed: { opacity: 0.72 },
  dashboard: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
  overviewCard: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  overviewCopy: { gap: spacing.xs },
  overviewLabel: { ...typography.eyebrow, color: colors.dim, fontSize: 9.5 },
  overviewCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  overviewCount: { fontSize: 32, lineHeight: 36, fontWeight: '800', color: colors.ink, letterSpacing: -0.8 },
  overviewUnit: { ...typography.body, color: colors.ink2 },
  overviewHint: { ...typography.caption, color: colors.dim, marginTop: spacing.xs },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metricCard: { width: '47.8%', minHeight: 128, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1 },
  metricCount: { fontSize: 28, lineHeight: 32, fontWeight: '800', color: colors.ink, marginTop: spacing.md },
  metricLabel: { ...typography.caption, color: colors.ink2, marginTop: 2 },
  queueShortcut: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.card, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine },
  queueShortcutIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass2 },
  queueShortcutCopy: { flex: 1 },
  queueShortcutTitle: { ...typography.headline, color: colors.ink },
  queueShortcutText: { ...typography.caption, color: colors.ink2, marginTop: 3 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statCount: { ...typography.headline, color: colors.ink, lineHeight: 20 },
  statLabel: { ...typography.caption, color: colors.dim, marginTop: 1 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.glassLine, marginHorizontal: spacing.md },
  filterDropdownWrap: {
    zIndex: 20,
  },
  filterSelect: {
    width: 116,
    height: 38,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.glassLine2,
    backgroundColor: colors.glass2,
  },
  filterSelectText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.ink },
  filterSelectCount: { fontSize: 10.5, fontWeight: '800', color: colors.dim },
  dropdownOverlay: { flex: 1 },
  filterMenu: {
    position: 'absolute',
    width: 220,
    padding: 5,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.glassLine2,
    backgroundColor: '#211F1B',
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
  },
  filterOption: { height: 38, paddingHorizontal: 10, borderRadius: 11, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterOptionSelected: { backgroundColor: colors.glass2 },
  filterOptionText: { flex: 1, fontSize: 12, fontWeight: '500', color: colors.ink2 },
  filterOptionTextSelected: { color: colors.ink, fontWeight: '700' },
  filterOptionCount: { fontSize: 10.5, fontWeight: '700', color: colors.dim },
  filterCheckSpace: { width: 16 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.field,
    backgroundColor: 'rgba(240,66,66,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(240,66,66,0.25)',
  },
  errorBannerText: { ...typography.caption, color: colors.ink2, flex: 1 },
  recordsPane: { flex: 1 },
  recordsToolbar: {
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  searchField: {
    flex: 1,
    height: 38,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.field,
    borderWidth: 1,
    borderColor: colors.glassLine2,
    backgroundColor: colors.glass,
  },
  searchInput: { flex: 1, paddingVertical: 0, fontSize: 12.5, fontWeight: '500', color: colors.ink },
  list: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  emptyList: { flexGrow: 1 },
  locationReviewList: { gap: spacing.md, paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  locationReviewCard: { padding: spacing.lg, gap: spacing.md },
  locationReviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  locationReviewIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(247,208,70,0.12)' },
  locationReviewCopy: { flex: 1, gap: 2 },
  locationReviewName: { ...typography.headline, color: colors.ink },
  locationReviewGym: { ...typography.caption, color: colors.dim },
  locationReviewAddress: { ...typography.body, color: colors.ink2, lineHeight: 21 },
  reviewBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: 'rgba(247,208,70,0.10)', borderWidth: 1, borderColor: 'rgba(247,208,70,0.22)' },
  reviewBadgeText: { fontSize: 10, fontWeight: '800', color: colors.accent },
  card: { padding: spacing.md, gap: spacing.sm },
  cardTopLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  submittedWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  submittedText: { ...typography.caption, color: colors.dim, fontSize: 10.5 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(247,208,70,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(247,208,70,0.20)',
  },
  badgeVerified: { backgroundColor: 'rgba(63,209,124,0.10)', borderColor: 'rgba(63,209,124,0.22)' },
  badgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  badgeDotVerified: { backgroundColor: colors.good },
  badgeLabel: { fontSize: 11, fontWeight: '700', color: colors.accent },
  badgeLabelVerified: { color: colors.good },
  gymIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(247,208,70,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(247,208,70,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: { flex: 1, gap: 3 },
  cardTitle: { ...typography.headline, color: colors.ink, lineHeight: 21 },
  cardSubtitle: { fontSize: 11.5, fontWeight: '500', color: colors.dim },
  cardSummary: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderColor: colors.glassLine },
  cardSummaryItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardSummaryText: { fontSize: 11.5, fontWeight: '500', color: colors.ink2, flex: 1 },
  detailsToggle: { minHeight: 28, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailsToggleText: { fontSize: 11.5, fontWeight: '700', color: colors.accent },
  businessGrid: { flexDirection: 'row', gap: spacing.sm },
  detailCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  detailCellCopy: { flex: 1, minWidth: 0 },
  detailCellLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, color: colors.dim },
  detailCellValue: { ...typography.caption, color: colors.ink, marginTop: 3 },
  detailSection: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassLine, paddingTop: spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { ...typography.eyebrow, color: colors.dim, fontSize: 9.5 },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass2,
    borderWidth: 1,
    borderColor: colors.glassLine2,
  },
  avatarText: { ...typography.caption, color: colors.ink, fontWeight: '800' },
  contactBody: { flex: 1, gap: 4 },
  contactName: { ...typography.body, color: colors.ink, fontWeight: '600' },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  contactValue: { ...typography.caption, color: colors.ink2, flexShrink: 1 },
  locationList: { gap: spacing.sm },
  locationBlock: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  locationNumber: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,208,70,0.12)',
  },
  locationNumberText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  locationBody: { flex: 1, gap: 3 },
  locationName: { ...typography.body, color: colors.ink, fontWeight: '600' },
  locationSlug: { ...typography.caption, color: colors.accent, fontSize: 11 },
  addressText: { ...typography.caption, color: colors.ink2, lineHeight: 18, marginTop: 2 },
  missingDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },
  missingDetailText: { ...typography.caption, color: colors.dim, flex: 1 },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: 'rgba(247,208,70,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(247,208,70,0.15)',
  },
  nextStepReady: { backgroundColor: 'rgba(63,209,124,0.06)', borderColor: 'rgba(63,209,124,0.16)' },
  nextStepIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,208,70,0.10)',
  },
  nextStepIconReady: { backgroundColor: 'rgba(63,209,124,0.10)' },
  nextStepCopy: { flex: 1, gap: 3 },
  nextStepLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: colors.dim },
  nextStepText: { ...typography.caption, color: colors.ink2, lineHeight: 18 },
  rejectBox: { gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.glassLine, paddingTop: spacing.md },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  compactAction: {
    minWidth: 86,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine2,
  },
  compactActionPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  compactActionDanger: { backgroundColor: 'rgba(240,66,66,0.08)', borderColor: 'rgba(240,66,66,0.28)' },
  compactActionDisabled: { opacity: 0.4 },
  compactActionLabel: { fontSize: 12, fontWeight: '700' },
  managementActions: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassLine },
  managementLeftAction: { flex: 1, alignItems: 'flex-start' },
  managementRightAction: { flex: 1, alignItems: 'flex-end' },
  managementConfirm: { gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.glassLine },
  managementWarning: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.field, backgroundColor: colors.glass },
  managementWarningText: { ...typography.caption, color: colors.ink2, lineHeight: 18, flex: 1 },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxl,
  },
  stateIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(63,209,124,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(63,209,124,0.18)',
  },
  stateIconError: { backgroundColor: 'rgba(240,66,66,0.09)', borderColor: 'rgba(240,66,66,0.18)' },
  stateTitle: { ...typography.headline, color: colors.ink, textAlign: 'center' },
  stateText: { ...typography.body, color: colors.ink2, textAlign: 'center', lineHeight: 21 },
  stateButton: { minWidth: 150, marginTop: spacing.xs },
});
