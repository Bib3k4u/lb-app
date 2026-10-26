/**
 * Onboarding step 3 of 3 — the fitness profile every account owns
 * unconditionally (FR-PFP-01). Optional, same as step 2; "Finish" and "Skip"
 * both land back in the app, the only difference is whether this step's
 * fields were saved first.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, TextField, Button, Chip, ProgressSteps } from '../../../components/ui';
import { colors, spacing, typography } from '../../../lib/theme';
import { api, problemFrom } from '../../../lib/api/client';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../../../lib/auth/store';
import { useStepSwipe } from '../../../lib/onboarding/useStepSwipe';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const GOALS = ['Weight loss', 'Muscle gain', 'Endurance', 'General fitness', 'Strength'];

export default function OnboardingFitnessScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [heightCm, setHeightCm] = useState('');
  const [level, setLevel] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const height = parseFloat(heightCm);
      if (heightCm || level || goal) {
        const { data } = await api.patch<MeResponseDto>('/me', {
          heightCm: heightCm && !Number.isNaN(height) ? height : undefined,
          experienceLevel: level ? level.toUpperCase() : undefined,
          primaryGoal: goal ?? undefined,
        });
        setUser(mapMeResponseToUser(data, user));
      }
      router.replace('/');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  const swipeHandlers = useStepSwipe({
    onNext: () => void finish(),
    onPrevious: () => router.back(),
    disabled: busy,
  });

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        {...swipeHandlers}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={() => router.back()} disabled={busy} style={styles.backArrow}>
          <Ionicons name="arrow-back" size={22} color={colors.ink2} />
        </Pressable>
        <ProgressSteps total={3} current={2} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>ALMOST THERE</Text>
          <Text style={styles.title}>Your fitness profile</Text>
          <Text style={styles.subtitle}>The same profile you&apos;ll use for training, whatever role you hold.</Text>
        </View>

        <View style={styles.section}>
          <TextField
            label="Height (cm)"
            value={heightCm}
            onChangeText={(t) => setHeightCm(t.replace(/[^0-9.]/g, ''))}
            keyboardType="decimal-pad"
            placeholder="170"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Experience level</Text>
          <View style={styles.chipRow}>
            {LEVELS.map((l) => (
              <Chip key={l} label={l} selected={level === l} onPress={() => setLevel(l === level ? null : l)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Primary goal</Text>
          <View style={styles.chipRow}>
            {GOALS.map((g) => (
              <Chip key={g} label={g} selected={goal === g} onPress={() => setGoal(g === goal ? null : g)} />
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <View style={styles.navigationRow}>
            <Button label={busy ? 'Finishing…' : 'Finish'} onPress={finish} loading={busy} style={styles.navigationButton} />
          </View>
          <Button label="Skip for now" onPress={() => router.replace('/')} variant="subtle" />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.xl, gap: spacing.xl },
  backArrow: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: -spacing.md },
  header: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.ink2 },
  section: { gap: spacing.md },
  label: { ...typography.caption, color: colors.ink2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  error: { ...typography.caption, color: colors.alert },
  actions: { gap: spacing.md, marginTop: spacing.lg, paddingBottom: spacing.lg },
  navigationRow: { flexDirection: 'row', gap: spacing.md },
  navigationButton: { flex: 1 },
});
