/**
 * The holding state required by FR-AUTH-09: a pending account may view and
 * correct its own profile and see its status, and reach nothing else.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, GlassCard, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../lib/theme';
import { api, problemFrom } from '../../lib/api/client';
import { refreshSession } from '../../lib/auth/session';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../../lib/auth/store';
import { useSignOut } from '../../lib/auth/useSignOut';

export default function PendingScreen() {
  const router = useRouter();
  const signOut = useSignOut();
  const currentUser = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function checkStatus() {
    setChecking(true);
    setMessage(null);
    try {
      // Approval changes the claims embedded in the JWT, so refresh the token
      // before reading /me rather than updating only the visible client state.
      const refreshed = await refreshSession();
      if (!refreshed) {
        setMessage('Your session expired. Please sign in again.');
        return;
      }

      const { data } = await api.get<MeResponseDto>('/me');
      const user = mapMeResponseToUser(data, currentUser);
      setUser(user);

      if (user.state === 'ACTIVE') {
        router.replace('/');
      } else {
        setMessage('Your application is still waiting for approval.');
      }
    } catch (error) {
      setMessage(problemFrom(error).detail ?? 'Could not check your approval status.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card} raised>
          <View style={styles.iconWrap}>
            <Ionicons name="hourglass-outline" size={30} color={colors.accent} />
          </View>
          <Text style={styles.title}>Awaiting verification</Text>
          <Text style={styles.body}>
            Your gym&apos;s administrator needs to approve your account before you can check in,
            book classes or see your training plan. You&apos;ll be notified as soon as that happens.
          </Text>
        </GlassCard>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Button label="Check approval status" onPress={() => void checkStatus()} loading={checking} />
        <Button label="Sign out" onPress={signOut} variant="subtle" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: spacing.xl },
  card: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(247,208,70,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  body: { ...typography.body, color: colors.ink2, textAlign: 'center', lineHeight: 22 },
  message: { ...typography.caption, color: colors.ink2, textAlign: 'center' },
});
