import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, GlassCard, Button } from '../../components/ui';
import { colors, spacing, typography } from '../../lib/theme';
import { useSignOut } from '../../lib/auth/useSignOut';

export default function BlockedScreen() {
  const signOut = useSignOut();

  return (
    <Screen>
      <View style={styles.wrap}>
        <GlassCard style={styles.card} raised>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.alert} />
          </View>
          <Text style={styles.title}>Account unavailable</Text>
          <Text style={styles.body}>
            This account has been suspended or deactivated. Please speak to your gym.
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
    backgroundColor: 'rgba(240,66,66,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  body: { ...typography.body, color: colors.ink2, textAlign: 'center', lineHeight: 22 },
});
