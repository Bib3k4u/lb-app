/**
 * Start-a-gym, step 2 of 2: the first location (FR-AUTH-04 — one
 * submission carries the gym profile AND its first location). Coordinates
 * come from the device's GPS, not typed in — nobody knows their own
 * lat/long, and check-in geofencing needs them to be right.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Screen, TextField, SearchableSelect, Button, ProgressSteps, GlassCard } from '../../../components/ui';
import { colors, spacing, typography } from '../../../lib/theme';
import { slugify } from '../../../lib/slugify';
import { districtsForStateName, indiaStateNames } from '../../../lib/india';
import { api, problemFrom } from '../../../lib/api/client';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../../../lib/auth/store';

export default function RegisterGymStep2() {
  const params = useLocalSearchParams<{ slug: string; legalName: string; tradingName: string; gstin: string }>();
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const user = useAuth((s) => s.user);

  const [name, setName] = useState('Main');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateOptions = useMemo(() => indiaStateNames(), []);
  const cityOptions = useMemo(() => districtsForStateName(stateName), [stateName]);

  function selectState(next: string) {
    setStateName(next);
    setCity('');
  }

  async function useCurrentLocation() {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is needed to pin your gym on the map.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch {
      setError('Could not get your location. You can try again.');
    } finally {
      setLocating(false);
    }
  }

  const valid =
    name.trim().length > 0 &&
    addressLine1.trim().length > 0 &&
    city.trim().length > 0 &&
    stateName.trim().length > 0 &&
    pincode.trim().length > 0 &&
    coords !== null;

  async function submit() {
    if (!valid || !coords) return;
    setBusy(true);
    setError(null);
    try {
      await api.post<string>('/platform/gyms', {
        slug: params.slug,
        legalName: params.legalName,
        tradingName: params.tradingName || undefined,
        gstin: params.gstin || undefined,
        location: {
          slug: slugify(name) || 'main',
          name: name.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          phoneE164: phone.trim() || undefined,
        },
      });
      // The registration response is just the new gym's id — refetch /me to
      // pick up pendingGym, which is what routes this account to the
      // "under review" screen instead of bouncing back to choose-path.
      const me = await api.get<MeResponseDto>('/me');
      setUser(mapMeResponseToUser(me.data, user));
      router.replace('/');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not register your gym.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ProgressSteps total={2} current={1} />

          <View style={styles.header}>
            <Text style={styles.eyebrow}>FIRST LOCATION</Text>
            <Text style={styles.title}>Where&apos;s your gym?</Text>
          </View>

        <View style={styles.form}>
          <TextField label="Location name" value={name} onChangeText={setName} placeholder="Main" />
          <TextField label="Address line 1" value={addressLine1} onChangeText={setAddressLine1} placeholder="123 27th Main" />
          <TextField
            label="Address line 2 (optional)"
            value={addressLine2}
            onChangeText={setAddressLine2}
            placeholder="Sector 2"
          />
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
              <TextField
                label="Phone (optional)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="+91..."
              />
            </View>
          </View>

          <Pressable onPress={useCurrentLocation}>
            <GlassCard style={styles.locationCard} raised={coords !== null}>
              {locating ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Ionicons
                  name={coords ? 'checkmark-circle' : 'locate-outline'}
                  size={20}
                  color={coords ? colors.good : colors.accent}
                />
              )}
              <Text style={styles.locationLabel}>
                {coords ? 'Location captured' : 'Use my current location'}
              </Text>
            </GlassCard>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

          <Button label={busy ? 'Registering…' : 'Register gym'} onPress={submit} disabled={!valid} loading={busy} style={styles.cta} />
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.xl, gap: spacing.xxl },
  header: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  form: { gap: spacing.lg, flex: 1 },
  row: { flexDirection: 'row', gap: spacing.lg },
  flexHalf: { flex: 1 },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  locationLabel: { ...typography.headline, color: colors.ink },
  error: { ...typography.caption, color: colors.alert },
  cta: { marginBottom: spacing.lg },
});
