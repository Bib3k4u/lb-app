/**
 * The screen a brand-new, zero-grant account lands on after onboarding
 * (see index.tsx's routing). Two paths only — SUPER_ADMIN is seeded, never
 * self-served (FR-AUTH-03), and LOCATION_ADMIN is a promotion an existing
 * admin grants, not something anyone picks for themselves (FR-AUTH-17) — so
 * "start a gym" (become its owner, on activation) and "join a gym" (as a
 * member or trainer, on approval) are the only two real choices left.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen, GlassCard } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { useSignOut } from '../../lib/auth/useSignOut';

export default function ChoosePathScreen() {
  const router = useRouter();
  const signOut = useSignOut();

  function go(path: '/(auth)/register-gym' | '/(auth)/join-gym') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(path);
  }

  return (
    <Screen scroll>
      <View style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ONE LAST THING</Text>
          <Text style={styles.title}>How will you use LIMITBEYOND?</Text>
          <Text style={styles.subtitle}>You can always add more gyms or roles later.</Text>
        </View>

        <PathCard
          icon="business-outline"
          title="I run a gym"
          body="Register your gym and locations. You'll become its owner once our team verifies and activates it."
          onPress={() => go('/(auth)/register-gym')}
        />

        <PathCard
          icon="barbell-outline"
          title="I want to train"
          body="Join a gym as a member or trainer. Your gym's admin approves new members before you get full access."
          onPress={() => go('/(auth)/join-gym')}
        />

        <Pressable onPress={signOut} style={styles.signOut} accessibilityRole="button">
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function PathCard({
  icon,
  title,
  body,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <GlassCard style={styles.card} raised>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon} size={26} color={colors.accent} />
        </View>
        <View style={styles.cardText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardBody}>{body}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.dim} />
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.xxl },
  header: { gap: spacing.sm, marginBottom: spacing.md },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.ink2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.field,
    backgroundColor: 'rgba(247,208,70,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { ...typography.headline, color: colors.ink },
  cardBody: { ...typography.caption, color: colors.ink2, lineHeight: 18 },
  signOut: { alignSelf: 'center', padding: spacing.md, marginTop: spacing.md },
  signOutLabel: { ...typography.caption, color: colors.dim },
});
