/** Phone-only entry point for the OTP authentication flow. */
import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, TextField, Button, GlassCard } from '../../components/ui';
import { colors, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';

const PHONE_RE = /^[6-9]\d{9}$/;

export default function IdentifierScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);

  const valid = PHONE_RE.test(value);
  const identifier = `+91${value}`;

  async function continueFlow() {
    if (!valid) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/otp/request', { identifier, channel: 'sms' });
      router.push({ pathname: '/(auth)/otp', params: { identifier } });
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll contentContainerStyle={styles.screen}>
      <Pressable style={styles.flex} onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Ionicons name="flash" size={19} color={colors.onAccent} /></View>
              <Text style={styles.wordmark}>LIMIT<Text style={styles.wordmarkAccent}>BEYOND</Text></Text>
            </View>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Start before your excuses get comfortable.</Text>
          </View>

          <GlassCard style={styles.form}>
            <TextField
                ref={inputRef}
                label="Phone number"
                value={value}
                onChangeText={setValue}
                placeholder="9876543210"
                leftAdornment="+91"
                keyboardType="number-pad"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={10}
                returnKeyType="go"
                onSubmitEditing={continueFlow}
              />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button label={busy ? 'Sending…' : 'Continue'} onPress={continueFlow} disabled={!valid} loading={busy} />
          </GlassCard>
          <Text style={styles.legal}>By continuing, you agree to our Terms and Privacy Policy.</Text>
        </KeyboardAvoidingView>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xl, paddingBottom: spacing.xl },
  flex: { flex: 1, justifyContent: 'center', gap: spacing.xl },
  header: { alignItems: 'center', gap: spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  brandMark: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  wordmark: { ...typography.headline, color: colors.ink, letterSpacing: 1.1, fontWeight: '800' },
  wordmarkAccent: { color: colors.accent },
  title: { ...typography.display, color: colors.ink },
  subtitle: { ...typography.body, color: colors.ink2, textAlign: 'center', lineHeight: 21, maxWidth: 300 },
  form: { gap: spacing.lg, padding: spacing.lg },
  error: { ...typography.caption, color: colors.alert },
  legal: { fontSize: 11, fontWeight: '500', color: colors.dim, textAlign: 'center', lineHeight: 16 },
});
