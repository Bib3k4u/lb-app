/**
 * Onboarding step 2 of 3 — DOB and gender. Both optional (CompleteProfileRequest
 * leaves whatever's omitted untouched), which is why "Skip" is a real,
 * equally-sized option here, not a small dismiss link.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, Button, Chip, ProgressSteps } from '../../../components/ui';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { api, problemFrom } from '../../../lib/api/client';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../../../lib/auth/store';
import { useStepSwipe } from '../../../lib/onboarding/useStepSwipe';

const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

export default function OnboardingDetailsScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [dob, setDob] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [gender, setGender] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(andContinue: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (dob || gender) {
        const { data } = await api.patch<MeResponseDto>('/me', {
          dateOfBirth: dob ? format(dob, 'yyyy-MM-dd') : undefined,
          gender: gender ?? undefined,
        });
        setUser(mapMeResponseToUser(data, user));
      }
      if (andContinue) router.push('/(auth)/onboarding/fitness');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  function onChangeDate(_: unknown, selected?: Date) {
    if (Platform.OS === 'android') setShowPicker(false);
    if (selected) setDob(selected);
  }

  const dobLabel = dob
    ? dob.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Select date of birth';

  const swipeHandlers = useStepSwipe({
    onNext: () => void save(true),
    onPrevious: () => router.back(),
    disabled: busy || showPicker,
  });

  return (
    <Screen scroll>
      <View style={styles.flex} {...swipeHandlers}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} disabled={busy} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={22} color={colors.ink2} />
        </Pressable>
        <ProgressSteps total={3} current={1} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>A FEW DETAILS</Text>
          <Text style={styles.title}>Tell us a bit more</Text>
          <Text style={styles.subtitle}>Helps your trainer tailor your plan. Skip if you&apos;d rather not say.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Date of birth</Text>
          <Pressable onPress={() => setShowPicker((s) => !s)}>
            <GlassCard style={styles.dobField}>
              <Text style={[styles.dobLabel, !dob && { color: colors.dim }]}>{dobLabel}</Text>
            </GlassCard>
          </Pressable>
          {showPicker ? (
            <DateTimePicker
              value={dob ?? new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              maximumDate={new Date()}
              onChange={onChangeDate}
              themeVariant="dark"
            />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDERS.map((g) => (
              <Chip key={g} label={g} selected={gender === g} onPress={() => setGender(g === gender ? null : g)} />
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <View style={styles.navigationRow}>
            <Button label={busy ? 'Saving…' : 'Continue'} onPress={() => save(true)} loading={busy} style={styles.navigationButton} />
          </View>
          <Button label="Skip for now" onPress={() => router.push('/(auth)/onboarding/fitness')} variant="subtle" />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.xl, gap: spacing.xxl },
  backArrow: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: -spacing.lg },
  header: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.ink2 },
  section: { gap: spacing.md },
  label: { ...typography.caption, color: colors.ink2 },
  dobField: { paddingHorizontal: spacing.lg, paddingVertical: 16, borderRadius: radius.field },
  dobLabel: { ...typography.headline, color: colors.ink },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.caption, color: colors.alert },
  actions: { gap: spacing.md, marginTop: 'auto', paddingBottom: spacing.lg },
  navigationRow: { flexDirection: 'row', gap: spacing.md },
  navigationButton: { flex: 1 },
});
