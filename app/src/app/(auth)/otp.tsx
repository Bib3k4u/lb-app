/** Step 2: enter the 6-digit code emailed to the address from the previous screen. */
import { useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Text, View, StyleSheet, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen, OtpInput, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { storeSession } from '../../lib/auth/session';
import { mapMeResponseToUser, useAuth, type TokenResponseDto } from '../../lib/auth/store';

const RESEND_SECONDS = 30;

export default function OtpScreen() {
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const router = useRouter();
  const setUser = useAuth((s) => s.setUser);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => {
    if (code.length === 6) void verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function verify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post<TokenResponseDto>('/auth/otp/verify', { identifier, code });

      await storeSession(data.accessToken, data.refreshToken);
      const user = mapMeResponseToUser(data.user);
      setUser(user);
      router.replace(user.profileComplete ? '/' : '/(auth)/onboarding/name');
    } catch (e) {
      setError(problemFrom(e).detail ?? 'That code did not work.');
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  // Lets people paste the emailed code in one tap; the input itself is hidden.
  async function pasteCode() {
    const digits = (await Clipboard.getStringAsync()).replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) setCode(digits);
    else setError('Copy the 6-digit code from your email first.');
  }

  async function resend() {
    if (resendIn > 0) return;
    setError(null);
    try {
      await api.post('/auth/otp/request', { identifier, channel: 'email' });
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      setError(problemFrom(e).detail ?? 'Could not resend the code.');
    }
  }

  return (
    <Screen>
      <Pressable style={styles.page} onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.wrap}>
            <View style={styles.header}>
              <Text style={styles.title}>Enter the code</Text>
              <Text style={styles.subtitle}>
                Sent by email to <Text style={styles.identifier}>{identifier}</Text>
              </Text>
            </View>

            <View style={styles.otpBlock}>
              <OtpInput value={code} onChangeValue={setCode} />
              <View style={styles.changeNumberRow}>
                <Text style={styles.changeNumberPrompt}>Wrong email?</Text>
                <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.changeNumberLink}>Change email</Text>
                </Pressable>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable onPress={() => void pasteCode()} accessibilityRole="button" style={styles.resend}>
              <Text style={styles.resendLabel}>Paste code</Text>
            </Pressable>

            <Button label={busy ? 'Verifying…' : 'Verify'} onPress={verify} disabled={code.length < 6} loading={busy} />

            <Pressable onPress={resend} disabled={resendIn > 0} accessibilityRole="button" style={styles.resend}>
              <Text style={[styles.resendLabel, resendIn > 0 && styles.resendLabelDisabled]}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  flex: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'center', gap: spacing.xxl },
  header: { gap: spacing.sm, alignItems: 'center' },
  title: { ...typography.title, color: colors.ink },
  subtitle: { ...typography.body, color: colors.ink2, textAlign: 'center' },
  identifier: { color: colors.ink, fontWeight: '700' },
  otpBlock: { gap: spacing.md },
  enteredNumber: { fontSize: 13, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  changeNumberRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 },
  changeNumberPrompt: { fontSize: 12, fontWeight: '500', color: colors.dim },
  changeNumberLink: { fontSize: 12, fontWeight: '700', color: colors.accent, textDecorationLine: 'underline' },
  error: { ...typography.caption, color: colors.alert, textAlign: 'center' },
  resend: { alignSelf: 'center', padding: spacing.sm },
  resendLabel: { ...typography.caption, color: colors.accent, fontWeight: '700' },
  resendLabelDisabled: { color: colors.dim },
});
