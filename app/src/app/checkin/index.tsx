/**
 * Check-in. QR scan with an implicit geofence proof (FR-ATT-01, FR-ATT-02).
 *
 * Written local-first (ADR-06): the outbox write confirms in ~8ms and the
 * network round trip happens invisibly afterwards. Gym floors and basements
 * have poor signal, and this is the screen used there.
 *
 * UI-02 requires check-in to be reachable in three interactions from opening
 * the app — open, tap Check in, confirm. Keep it that way.
 */
import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, GlassCard, Button } from '../../components/ui';
import { AttendanceCalendar } from '../../components/attendance/AttendanceCalendar';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { enqueue, pendingCheckIns } from '../../lib/sync/outbox';
import { useAuth } from '../../lib/auth/store';
import { parseLocationQrPayload } from '../../lib/checkin/qrPayload';
import { api } from '../../lib/api/client';

type Mode = 'choose' | 'scanning' | 'locating' | 'done' | 'denied';

export default function CheckInScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuth((s) => s.user);
  const setActiveLocation = useAuth((s) => s.setActiveLocation);
  const [mode, setMode] = useState<Mode>('choose');
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const scanHandled = useRef(false);
  const historyQuery = useQuery({ queryKey: ['attendance', 'history'], queryFn: async () => { const [server, pending] = await Promise.all([api.get<CheckInCacheEntry[]>('/me/check-ins').then((response) => response.data), pendingCheckIns()]); return [...pending, ...server]; } });
  const locationsQuery = useQuery({
    queryKey: ['org', 'live-locations'],
    queryFn: async () => (await api.get<LiveLocation[]>('/locations/live')).data,
  });
  const alreadyCheckedToday = (historyQuery.data ?? []).some((entry) => new Date(entry.occurredAt).toDateString() === new Date().toDateString());

  function rememberCheckIn(locationId: string) {
    const occurredAt = new Date().toISOString();
    queryClient.setQueryData<CheckInCacheEntry[]>(['attendance', 'history'], (current = []) => [
      {
        id: `local-${occurredAt}`,
        locationId,
        method: 'QR',
        purpose: 'PERSONAL_WORKOUT',
        occurredAt,
        distanceM: null,
        deferred: true,
        flagged: false,
        pendingSync: true,
      },
      ...current,
    ]);
  }

  async function liveLocations(): Promise<LiveLocation[]> {
    if (locationsQuery.data) return locationsQuery.data;
    const result = await locationsQuery.refetch();
    if (result.error) throw result.error;
    return result.data ?? [];
  }

  function activate(location: LiveLocation) {
    if (user?.activeLocationId !== location.id || user.activeGymId !== location.gymId) {
      setActiveLocation(location.gymId, location.id);
    }
  }

  useEffect(() => {
    if (mode !== 'done') return;
    const t = setTimeout(() => router.back(), 1400);
    return () => clearTimeout(t);
  }, [mode, router]);

  /** QR path: the printed token is stable and signed for one location. The
   * phone's coordinates are submitted with it so a shared photo cannot be
   * used to check in from somewhere else. */
  async function onScanned(raw: string) {
    if (mode !== 'scanning' || scanHandled.current) return;
    scanHandled.current = true;
    setMode('locating');

    try {
      const locations = await liveLocations();
      const fallbackLocationId = user?.activeLocationId ?? (locations.length === 1 ? locations[0]?.id : null);
      const payload = parseLocationQrPayload(raw, fallbackLocationId);
      if (!payload) {
        setMode('denied');
        setMessage('This is not a valid LIMITBEYOND location QR code.');
        return;
      }
      const scannedLocation = locations.find((location) => location.id === payload.locationId);
      if (!scannedLocation) {
        setMode('denied');
        setMessage('This QR belongs to a location that is not available to your account.');
        return;
      }
      activate(scannedLocation);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMode('denied');
        setMessage('Location access is required with the printed QR to confirm you are at this gym.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const syncState = await enqueue('CHECK_IN', {
        locationId: payload.locationId,
        method: 'QR',
        qrToken: payload.token,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyM: position.coords.accuracy,
        purpose: 'PERSONAL_WORKOUT',
      });
      rememberCheckIn(payload.locationId);
      if (syncState === 'SYNCED') void queryClient.invalidateQueries({ queryKey: ['attendance', 'history'] });
      setPendingSync(syncState === 'PENDING');
      setMode('done');
      setMessage(syncState === 'SYNCED'
        ? 'Your attendance was confirmed by the gym.'
        : 'Saved on this phone. Your attendance will be confirmed automatically when the gym server is reachable.');
    } catch (error) {
      setMode('denied');
      setMessage(error instanceof Error ? error.message : 'We could not confirm your location. Please try again or ask the desk for help.');
    }
  }

  if (mode === 'scanning') {
    if (!cameraPermission?.granted) {
      return (
        <Screen>
          <View style={styles.stateWrap}>
            <GlassCard style={styles.stateCard} raised>
              <View style={styles.stateIcon}>
                <Ionicons name="camera-outline" size={30} color={colors.accent} />
              </View>
              <Text style={styles.stateTitle}>Camera access</Text>
              <Text style={styles.stateBody}>
                Allow camera access to scan the printed check-in code at your gym.
              </Text>
            </GlassCard>
            <Button label="Allow camera" onPress={() => void requestCameraPermission()} />
            <Button label="Cancel" onPress={() => router.back()} variant="subtle" />
          </View>
        </Screen>
      );
    }
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => void onScanned(data)}
        />
        <SafeAreaView style={styles.cameraChrome} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.cameraTopBar}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
              style={styles.cameraClose}
            >
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
            <View style={styles.cameraLabel}>
              <Text style={styles.cameraLabelText}>SCAN LOCATION QR</Text>
            </View>
          </View>

          <View style={styles.scanFrame} pointerEvents="none">
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>

          <View style={styles.cameraHelp}>
            <Ionicons name="qr-code-outline" size={20} color={colors.accent} />
            <View style={styles.cameraHelpCopy}>
              <Text style={styles.cameraHelpTitle}>Point at the printed code</Text>
              <Text style={styles.cameraHelpBody}>Hold steady—the scan happens automatically.</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (mode === 'locating') {
    return (
      <Screen>
        <View style={styles.stateWrap}>
          <GlassCard style={styles.stateCard} raised>
            <View style={styles.stateIcon}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
            <Text style={styles.stateTitle}>Confirming location</Text>
            <Text style={styles.stateBody}>Making sure you&apos;re at the correct gym location…</Text>
          </GlassCard>
        </View>
      </Screen>
    );
  }

  if (mode === 'done' || mode === 'denied') {
    const successful = mode === 'done';
    return (
      <Screen>
        <View style={styles.stateWrap}>
          <GlassCard style={styles.stateCard} raised>
            <View style={[styles.stateIcon, successful ? styles.successIcon : styles.errorIcon]}>
              <Ionicons
                name={successful ? 'checkmark' : 'alert-outline'}
                size={30}
                color={successful ? colors.good : colors.alert}
              />
            </View>
            <Text style={styles.stateTitle}>{successful ? (pendingSync ? 'Check-in saved' : 'You’re checked in') : 'Check-in unsuccessful'}</Text>
            <Text style={styles.stateBody}>{message}</Text>
            {successful && pendingSync ? <Text style={styles.syncNote}>Pending server confirmation</Text> : null}
          </GlassCard>
          {!successful ? (
            <>
              <Button
                label="Try again"
                onPress={() => {
                  scanHandled.current = false;
                  setPendingSync(false);
                  setMode('choose');
                  setMessage(null);
                }}
              />
              <Button label="Cancel" onPress={() => router.back()} variant="subtle" />
            </>
          ) : null}
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.content}>
        <View style={styles.heading}>
          <View style={styles.brandIcon}>
            <Ionicons name="enter-outline" size={25} color={colors.onAccent} />
          </View>
          <Text style={styles.eyebrow}>QUICK CHECK-IN</Text>
          <Text style={styles.title}>Welcome to the gym</Text>
          <Text style={styles.subtitle}>{alreadyCheckedToday ? 'Review your attendance history and consistency.' : 'Scan the gym QR code to confirm your arrival.'}</Text>
        </View>

        <AttendanceCalendar entries={historyQuery.data ?? []} loading={historyQuery.isPending} />

        {alreadyCheckedToday ? (
          <GlassCard style={styles.alreadyChecked}>
            <View style={styles.alreadyCheckedIcon}><Ionicons name="checkmark" size={20} color={colors.good} /></View>
            <View style={styles.optionCopy}><Text style={styles.optionTitle}>Checked in today</Text><Text style={styles.optionBody}>Your attendance is recorded. The calendar above contains your complete history.</Text></View>
          </GlassCard>
        ) : (
          <View style={styles.options}>
            <CheckInOption
              icon="qr-code-outline"
              title="Scan location QR"
              body="Scan the printed code displayed at the front desk."
              onPress={() => {
                scanHandled.current = false;
                setMode('scanning');
              }}
              primary
            />
          </View>
        )}

        <View style={styles.privacyRow}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.dim} />
          <Text style={styles.privacyText}>Location is used only to verify this check-in.</Text>
        </View>

        <Button label="Cancel" onPress={() => router.back()} variant="subtle" />
      </View>
    </Screen>
  );
}

interface CheckInCacheEntry {
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

interface LiveLocation {
  id: string;
  gymId: string;
  name: string;
  latitude: number;
  longitude: number;
  checkinRadiusM: number;
}

function CheckInOption({
  icon,
  title,
  body,
  onPress,
  primary = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => (
        <GlassCard style={[styles.optionCard, primary && styles.optionCardPrimary, pressed && styles.pressed]} raised>
          <View style={[styles.optionIcon, primary && styles.optionIconPrimary]}>
            <Ionicons name={icon} size={24} color={primary ? colors.onAccent : colors.accent} />
          </View>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>{title}</Text>
            <Text style={styles.optionBody}>{body}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.dim} />
        </GlassCard>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xl },
  heading: { alignItems: 'center', gap: spacing.sm },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginBottom: spacing.sm,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.display, color: colors.ink, textAlign: 'center' },
  subtitle: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  options: { gap: spacing.md },
  optionCard: {
    minHeight: 104,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  optionCardPrimary: { borderColor: `rgba(${colors.accentRgb},0.38)` },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${colors.accentRgb},0.12)`,
  },
  optionIconPrimary: { backgroundColor: colors.accent },
  optionCopy: { flex: 1, gap: spacing.xs },
  optionTitle: { ...typography.headline, color: colors.ink },
  optionBody: { ...typography.caption, color: colors.ink2, lineHeight: 18 },
  alreadyChecked: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: 'rgba(63,209,124,0.08)', borderColor: 'rgba(63,209,124,0.26)' },
  alreadyCheckedIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(63,209,124,0.13)' },
  pressed: { opacity: 0.74 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  privacyText: { ...typography.caption, color: colors.dim },
  stateWrap: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  stateCard: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${colors.accentRgb},0.12)`,
    borderWidth: 1,
    borderColor: `rgba(${colors.accentRgb},0.24)`,
  },
  successIcon: { backgroundColor: 'rgba(63,209,124,0.12)', borderColor: 'rgba(63,209,124,0.3)' },
  errorIcon: { backgroundColor: 'rgba(240,66,66,0.12)', borderColor: 'rgba(240,66,66,0.3)' },
  stateTitle: { ...typography.title, color: colors.ink, textAlign: 'center' },
  stateBody: { ...typography.body, color: colors.ink2, lineHeight: 22, textAlign: 'center' },
  syncNote: { ...typography.caption, color: colors.good, textAlign: 'center' },
  cameraScreen: { flex: 1, backgroundColor: colors.ground },
  cameraChrome: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  cameraTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cameraClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,10,9,0.78)',
    borderWidth: 1,
    borderColor: colors.glassLine2,
  },
  cameraLabel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(11,10,9,0.78)',
    borderWidth: 1,
    borderColor: colors.glassLine2,
  },
  cameraLabelText: { ...typography.eyebrow, color: colors.accent },
  scanFrame: {
    width: 260,
    height: 260,
    alignSelf: 'center',
    position: 'relative',
  },
  corner: { position: 'absolute', width: 48, height: 48, borderColor: colors.accent },
  cornerTopLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  cornerTopRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 },
  cameraHelp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: 'rgba(11,10,9,0.86)',
    borderWidth: 1,
    borderColor: colors.glassLine2,
  },
  cameraHelpCopy: { flex: 1, gap: 2 },
  cameraHelpTitle: { ...typography.headline, color: colors.ink },
  cameraHelpBody: { ...typography.caption, color: colors.ink2 },
});
