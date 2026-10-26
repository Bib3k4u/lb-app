/**
 * Onboarding step 1 of 3. The only step that isn't skippable — everything
 * downstream (a member's own display name in class rosters, a trainer's in
 * their gym's staff list) needs at least this much. Steps 2 and 3 are not:
 * DOB/gender and the fitness profile are enrichment CompleteProfileRequest
 * happily leaves null.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, TextField, Button, ProgressSteps } from '../../../components/ui';
import { colors, spacing, typography } from '../../../lib/theme';
import { api, problemFrom } from '../../../lib/api/client';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../../../lib/auth/store';
import { useStepSwipe } from '../../../lib/onboarding/useStepSwipe';

export default function OnboardingNameScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0;

  async function next() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.patch<MeResponseDto>('/me', {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      setUser(mapMeResponseToUser(data, user));
      router.push('/(auth)/onboarding/details');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not save your name.');
    } finally {
      setBusy(false);
    }
  }

  const swipeHandlers = useStepSwipe({ onNext: next, disabled: !valid || busy });

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
        <ProgressSteps total={3} current={0} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>WELCOME TO LIMITBEYOND</Text>
          <Text style={styles.title}>What should we call you?</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoFocus
            returnKeyType="next"
          />
          <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" returnKeyType="done" />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Button label={busy ? 'Saving…' : 'Continue'} onPress={next} disabled={!valid} loading={busy} style={styles.cta} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.xl, gap: spacing.xxl },
  backArrow: { alignSelf: 'flex-start', padding: spacing.xs, marginBottom: -spacing.lg },
  header: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  form: { gap: spacing.lg, flex: 1 },
  error: { ...typography.caption, color: colors.alert },
  cta: { marginBottom: spacing.lg },
});
