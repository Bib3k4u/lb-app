/**
 * Where a gym registrant lands while their gym is PENDING_VERIFICATION or
 * VERIFIED-but-not-yet-LIVE (see index.tsx routing and the backend's
 * GymFacade.findPendingRegistrationFor). Distinct from (auth)/pending.tsx,
 * which is about an individual MEMBER/TRAINER grant awaiting a gym admin's
 * approval — this is about the gym itself awaiting the Super Admin.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, GlassCard, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../lib/theme';
import { useAuth } from '../../lib/auth/store';
import { useSignOut } from '../../lib/auth/useSignOut';

export default function GymPendingScreen() {
  const user = useAuth((s) => s.user);
  const signOut = useSignOut();
  const gym = user?.pendingGym;

  const statusCopy =
    gym?.state === 'VERIFIED'
      ? "Verified — we're setting up your subscription next."
      : 'Our team reviews every new gym before it goes live.';

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card} raised>
          <View style={styles.iconWrap}>
            <Ionicons name="business-outline" size={30} color={colors.accent} />
          </View>
          <Text style={styles.title}>{gym?.legalName ?? 'Your gym'} is under review</Text>
          <Text style={styles.body}>
            {statusCopy} You&apos;ll be able to manage locations, plans and members the moment it&apos;s
            activated — no action needed from you right now.
          </Text>
        </GlassCard>

        <Button label="Sign out" onPress={signOut} variant="ghost" />
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
});
