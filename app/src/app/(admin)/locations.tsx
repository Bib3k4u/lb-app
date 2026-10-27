/**
 * FR-ORG-03: every location this gym operates, plus adding a new one.
 * Coordinates come from GPS, same reasoning as the gym-registration flow
 * (see (auth)/register-gym/location.tsx) — nobody knows their own lat/long,
 * and check-in geofencing needs it to be right.
 */
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import QRCode from 'react-native-qrcode-svg';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, GlassCard, Button, TextField, SearchableSelect } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { slugify } from '../../lib/slugify';
import { buildLocationQrPayload } from '../../lib/checkin/qrPayload';
import { districtsForStateName, indiaStateNames } from '../../lib/india';

interface LocationSummary {
  id: string;
  slug: string;
  name: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  phoneE164: string | null;
  checkinRadiusM: number;
  latitude: number;
  longitude: number;
  approvalState: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
}

interface QrCodeResponse {
  token: string;
  reusable: boolean;
}

interface QrSvgRef {
  toDataURL: (callback: (data: string) => void) => void;
}

export default function LocationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingLocation, setEditingLocation] = useState<LocationSummary | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [qrLocation, setQrLocation] = useState<LocationSummary | null>(null);

  const query = useQuery({
    queryKey: ['org', 'managed-locations'],
    queryFn: async () => (await api.get<LocationSummary[]>('/locations')).data,
  });

  const deleteMutation = useMutation({
    mutationFn: (locationId: string) => api.delete(`/locations/${locationId}`),
    onSuccess: async () => {
      setDeleteConfirmId(null);
      await queryClient.invalidateQueries({ queryKey: ['org', 'managed-locations'] });
      await queryClient.invalidateQueries({ queryKey: ['org', 'live-locations'] });
    },
  });

  async function deleteLocation(locationId: string) {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(locationId);
    } catch (error) {
      setDeleteError(problemFrom(error).detail ?? 'Could not delete this location.');
    }
  }

  return (
    <Screen scroll={false}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
            <Ionicons name="chevron-back" size={22} color={colors.ink} />
          </Pressable>
          <Text style={styles.title}>Locations</Text>
          <Pressable
            onPress={() => setAdding(true)}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.addButton}
          >
            <Ionicons name="add" size={20} color={colors.onAccent} />
          </Pressable>
        </View>

        {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}

        {query.isPending ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: spacing.xxl }} />
        ) : query.isError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{problemFrom(query.error).detail ?? 'Could not load locations.'}</Text>
            <Button label="Retry" onPress={() => query.refetch()} variant="ghost" />
          </View>
        ) : (query.data ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={32} color={colors.dim} />
            <Text style={styles.emptyText}>No locations yet.</Text>
          </View>
        ) : (
          <FlatList
            showsVerticalScrollIndicator={false}
            data={query.data}
            keyExtractor={(l) => l.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.accent} />}
            renderItem={({ item }) => (
              <GlassCard style={styles.card}>
                <View style={styles.cardMain}>
                  <View style={styles.cardIconWrap}>
                    <Ionicons name="location" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName}>{item.name}</Text>
                      <LocationStatus state={item.approvalState} />
                    </View>
                    <Text style={styles.cardMeta}>
                      {item.addressLine1}, {item.city}, {item.state} {item.pincode}
                    </Text>
                    <Text style={styles.cardMetaSmall}>
                      Check-in radius {item.checkinRadiusM}m{item.phoneE164 ? ` · ${item.phoneE164}` : ''}
                    </Text>
                    {item.approvalState === 'REJECTED' && item.rejectionReason ? (
                      <Text style={styles.rejectionText}>Review note: {item.rejectionReason}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <View style={styles.cardActionGroup}>
                    <Pressable onPress={() => setEditingLocation(item)} style={({ pressed }) => [styles.cardAction, pressed && styles.pressed]}>
                      <Ionicons name="create-outline" size={16} color={colors.ink2} />
                      <Text style={styles.cardActionText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setDeleteConfirmId(item.id)}
                      style={({ pressed }) => [styles.cardAction, pressed && styles.pressed]}
                      accessibilityLabel={`Delete ${item.name}`}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.alert} />
                      <Text style={styles.cardActionDangerText}>Delete</Text>
                    </Pressable>
                  </View>
                  {item.approvalState === 'APPROVED' ? (
                    <Pressable
                      onPress={() => setQrLocation(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`View printable QR for ${item.name}`}
                      style={({ pressed }) => [styles.qrButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="qr-code-outline" size={16} color={colors.onAccent} />
                      <Text style={styles.qrButtonText}>QR code</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.pendingHint}>QR available after approval</Text>
                  )}
                </View>
                {deleteConfirmId === item.id ? (
                  <View style={styles.deleteConfirm}>
                    <Text style={styles.deleteConfirmText}>Delete this location? Historical records will be preserved.</Text>
                    <View style={styles.deleteConfirmActions}>
                      <Pressable onPress={() => setDeleteConfirmId(null)} disabled={deleteMutation.isPending} style={styles.miniButton}>
                        <Text style={styles.miniButtonText}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={() => void deleteLocation(item.id)} disabled={deleteMutation.isPending} style={[styles.miniButton, styles.miniButtonDanger]}>
                        {deleteMutation.isPending ? <ActivityIndicator size="small" color={colors.alert} /> : <Text style={styles.miniButtonDangerText}>Delete location</Text>}
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </GlassCard>
            )}
          />
        )}

        {adding || editingLocation ? (
          <AddLocationSheet
            key={editingLocation?.id ?? 'new-location'}
            location={editingLocation}
            onClose={() => {
              setAdding(false);
              setEditingLocation(null);
            }}
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['org', 'managed-locations'] });
              setAdding(false);
              setEditingLocation(null);
            }}
          />
        ) : null}

        {qrLocation ? <LocationQrSheet location={qrLocation} onClose={() => setQrLocation(null)} /> : null}
      </View>
    </Screen>
  );
}

function LocationQrSheet({ location, onClose }: { location: LocationSummary; onClose: () => void }) {
  const qrRef = useRef<QrSvgRef | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['attendance', 'location-qr', location.id],
    queryFn: async () => (await api.get<QrCodeResponse>(`/locations/${location.id}/qr-token`)).data,
    staleTime: Infinity,
  });
  const qrPayload = query.data ? buildLocationQrPayload(location.id, query.data.token) : null;

  async function printQr() {
    if (!qrPayload || !qrRef.current) return;
    setPrinting(true);
    setPrintError(null);
    try {
      const qrBase64 = await new Promise<string>((resolve, reject) => {
        try {
          qrRef.current?.toDataURL(resolve);
        } catch (error) {
          reject(error);
        }
      });
      await Print.printAsync({ html: printableQrHtml(location, qrBase64) });
    } catch {
      setPrintError('Could not open the print dialog. Please try again.');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <GlassCard style={styles.qrSheet} raised>
        <View style={styles.qrSheetHeader}>
          <View style={styles.qrSheetCopy}>
            <Text style={styles.sheetTitle}>Location check-in QR</Text>
            <Text style={styles.qrLocationName}>{location.name}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close QR code" style={styles.closeButton}>
            <Ionicons name="close" size={20} color={colors.ink2} />
          </Pressable>
        </View>

        {query.isPending ? (
          <View style={styles.qrLoading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.cardMeta}>Preparing this location&apos;s code…</Text>
          </View>
        ) : query.isError ? (
          <View style={styles.qrLoading}>
            <Text style={styles.error}>{problemFrom(query.error).detail ?? 'Could not load this QR code.'}</Text>
            <Button label="Retry" onPress={() => query.refetch()} variant="ghost" />
          </View>
        ) : query.data ? (
          <>
            <View style={styles.qrPaper}>
              <QRCode
                value={qrPayload ?? ''}
                size={220}
                quietZone={12}
                color="#111111"
                backgroundColor="#FFFFFF"
                ecl="H"
                getRef={(ref) => {
                  qrRef.current = ref as QrSvgRef | null;
                }}
              />
            </View>
            <View style={styles.fixedNote}>
              <Ionicons name="print-outline" size={17} color={colors.accent} />
              <Text style={styles.fixedNoteText}>
                This code is fixed for {location.name}. Print it once and post it at this location.
              </Text>
            </View>
            <Text style={styles.securityNote}>
              Members must also be physically within this location&apos;s check-in radius.
            </Text>
          </>
        ) : null}

        {printError ? <Text style={styles.error}>{printError}</Text> : null}

        <Button
          label="Print location QR"
          onPress={() => void printQr()}
          loading={printing}
          disabled={!query.data}
        />
      </GlassCard>
    </View>
  );
}

function AddLocationSheet({ location, onClose, onCreated }: {
  location: LocationSummary | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState(location?.name ?? '');
  const [addressLine1, setAddressLine1] = useState(location?.addressLine1 ?? '');
  const [city, setCity] = useState(location?.city ?? '');
  const [stateName, setStateName] = useState(location?.state ?? '');
  const [pincode, setPincode] = useState(location?.pincode ?? '');
  const [phone, setPhone] = useState(location?.phoneE164 ?? '');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(
    location ? { latitude: location.latitude, longitude: location.longitude } : null,
  );
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateOptions = useMemo(() => indiaStateNames(), []);
  const cityOptions = useMemo(() => districtsForStateName(stateName), [stateName]);

  function selectState(next: string) {
    setStateName(next);
    setCity('');
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        slug: location?.slug ?? (slugify(name) || `location-${Date.now()}`),
        name: name.trim(),
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        phoneE164: phone.trim() || undefined,
      };
      return location ? api.put(`/locations/${location.id}`, payload) : api.post('/locations', payload);
    },
    onSuccess: onCreated,
  });

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to pin this address.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setError('Could not get your location.');
    } finally {
      setLocating(false);
    }
  }

  const valid = name.trim() && addressLine1.trim() && city.trim() && stateName.trim() && pincode.trim() && coords !== null;

  async function submit() {
    if (!valid) return;
    setError(null);
    try {
      await saveMutation.mutateAsync();
    } catch (e) {
      setError(problemFrom(e).detail ?? `Could not ${location ? 'save' : 'create'} this location.`);
    }
  }

  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View>
            <GlassCard style={styles.sheet} raised>
              <Text style={styles.sheetTitle}>{location ? 'Edit location' : 'New location'}</Text>
              {!location ? <Text style={styles.reviewNotice}>New locations go live after superadmin approval.</Text> : null}
              <TextField label="Name" value={name} onChangeText={setName} placeholder="HSR Layout" autoFocus />
              <TextField label="Address" value={addressLine1} onChangeText={setAddressLine1} placeholder="123 27th Main" />
              <View style={styles.row}>
                <View style={styles.flexHalf}>
                  <SearchableSelect
                    label="State"
                    value={stateName}
                    onSelect={selectState}
                    options={stateOptions}
                    placeholder="Karnataka"
                    searchPlaceholder="Search states…"
                  />
                </View>
                <View style={styles.flexHalf}>
                  <SearchableSelect
                    label="City"
                    value={city}
                    onSelect={setCity}
                    options={cityOptions}
                    placeholder={stateName ? 'Bengaluru' : 'Choose a state first'}
                    searchPlaceholder="Search cities…"
                    disabled={!stateName}
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.flexHalf}>
                  <TextField label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" placeholder="560102" />
                </View>
                <View style={styles.flexHalf}>
                  <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+91..." />
                </View>
              </View>

              <Pressable onPress={useCurrentLocation}>
                <View style={[styles.locationRow, coords && styles.locationRowDone]}>
                  {locating ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <Ionicons name={coords ? 'checkmark-circle' : 'locate-outline'} size={18} color={coords ? colors.good : colors.accent} />
                  )}
                  <Text style={styles.locationRowText}>{coords ? 'Location captured' : 'Use my current location'}</Text>
                </View>
              </Pressable>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.actionsRow}>
                <View style={styles.actionFlex}>
                  <Button label="Cancel" onPress={onClose} variant="subtle" />
                </View>
                <View style={styles.actionFlex}>
                  <Button label={location ? 'Save' : 'Submit'} onPress={submit} loading={saveMutation.isPending} disabled={!valid} />
                </View>
              </View>
            </GlassCard>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

function LocationStatus({ state }: { state: LocationSummary['approvalState'] }) {
  const approved = state === 'APPROVED';
  const rejected = state === 'REJECTED';
  return (
    <View style={[styles.statusBadge, approved ? styles.statusApproved : rejected ? styles.statusRejected : styles.statusPending]}>
      <Text style={[styles.statusText, approved ? styles.statusTextApproved : rejected ? styles.statusTextRejected : styles.statusTextPending]}>
        {approved ? 'Live' : rejected ? 'Needs changes' : 'In review'}
      </Text>
    </View>
  );
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
  card: { gap: spacing.md, padding: spacing.lg },
  cardMain: { flexDirection: 'row', gap: spacing.md },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.field,
    backgroundColor: 'rgba(247,208,70,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 2 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardName: { ...typography.body, color: colors.ink, fontWeight: '600' },
  cardMeta: { ...typography.caption, color: colors.ink2 },
  cardMetaSmall: { ...typography.caption, color: colors.dim, fontSize: 11 },
  rejectionText: { ...typography.caption, color: colors.alert, marginTop: spacing.xs },
  cardActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 52 },
  cardActionGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cardAction: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm },
  cardActionText: { ...typography.caption, color: colors.ink2, fontWeight: '700' },
  cardActionDangerText: { ...typography.caption, color: colors.alert, fontWeight: '700' },
  pendingHint: { ...typography.caption, color: colors.dim, fontSize: 11 },
  qrButton: {
    height: 34,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: colors.accent,
  },
  qrButtonText: { ...typography.caption, color: colors.onAccent, fontWeight: '800' },
  statusBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  statusApproved: { backgroundColor: 'rgba(63,209,124,0.10)', borderColor: 'rgba(63,209,124,0.24)' },
  statusPending: { backgroundColor: 'rgba(247,208,70,0.10)', borderColor: 'rgba(247,208,70,0.24)' },
  statusRejected: { backgroundColor: 'rgba(240,66,66,0.10)', borderColor: 'rgba(240,66,66,0.24)' },
  statusText: { fontSize: 10, fontWeight: '800' },
  statusTextApproved: { color: colors.good },
  statusTextPending: { color: colors.accent },
  statusTextRejected: { color: colors.alert },
  deleteConfirm: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.field, backgroundColor: 'rgba(240,66,66,0.07)', borderWidth: 1, borderColor: 'rgba(240,66,66,0.20)' },
  deleteConfirmText: { ...typography.caption, color: colors.ink2, lineHeight: 18 },
  deleteConfirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  miniButton: { minWidth: 72, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.glassLine2, backgroundColor: colors.glass },
  miniButtonDanger: { borderColor: 'rgba(240,66,66,0.30)', backgroundColor: 'rgba(240,66,66,0.08)' },
  miniButtonText: { ...typography.caption, color: colors.ink2, fontWeight: '700' },
  miniButtonDangerText: { ...typography.caption, color: colors.alert, fontWeight: '700' },
  pressed: { opacity: 0.72 },
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
  reviewNotice: { ...typography.caption, color: colors.accent, marginTop: -spacing.sm },
  qrSheet: {
    padding: spacing.xl,
    gap: spacing.lg,
    alignItems: 'stretch',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  qrSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  qrSheetCopy: { flex: 1, gap: spacing.xs },
  qrLocationName: { ...typography.body, color: colors.ink2 },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass2,
  },
  qrPaper: {
    alignSelf: 'center',
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: '#FFFFFF',
  },
  qrLoading: { minHeight: 260, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  fixedNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: `rgba(${colors.accentRgb},0.1)`,
  },
  fixedNoteText: { ...typography.caption, color: colors.ink2, lineHeight: 18, flex: 1 },
  securityNote: { ...typography.caption, color: colors.dim, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.md },
  flexHalf: { flex: 1 },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.field,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  locationRowDone: { borderColor: colors.good },
  locationRowText: { ...typography.body, color: colors.ink },
  error: { ...typography.caption, color: colors.alert },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionFlex: { flex: 1 },
});

function printableQrHtml(location: LocationSummary, qrBase64: string): string {
  const name = escapeHtml(location.name);
  const address = escapeHtml(`${location.addressLine1}, ${location.city}, ${location.state}`);
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #15130e; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .poster { min-height: 250mm; border: 3px solid #15130e; border-radius: 24px; padding: 28px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .brand { font-size: 15px; font-weight: 800; letter-spacing: 3px; color: #94720a; }
      h1 { font-size: 36px; margin: 14px 0 8px; }
      h2 { font-size: 22px; margin: 0 0 6px; }
      .address { max-width: 420px; margin: 0 0 28px; color: #5d584d; font-size: 15px; }
      .qr { width: 340px; height: 340px; image-rendering: pixelated; }
      .steps { margin: 28px 0 0; font-size: 18px; font-weight: 650; line-height: 1.55; }
      .note { margin-top: 16px; color: #6c6659; font-size: 13px; }
    </style>
  </head>
  <body>
    <main class="poster">
      <div class="brand">LIMITBEYOND</div>
      <h1>CHECK IN HERE</h1>
      <h2>${name}</h2>
      <p class="address">${address}</p>
      <img class="qr" src="data:image/png;base64,${qrBase64}" />
      <p class="steps">Open LIMITBEYOND → Tap Check in → Scan this code</p>
      <p class="note">Location access is required to confirm you are at this gym.</p>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
