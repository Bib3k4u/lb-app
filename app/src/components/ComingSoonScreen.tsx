import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, GlassCard } from './ui';
import { colors, radius, spacing, typography } from '../lib/theme';

export function ComingSoonScreen({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <Screen>
      <View style={styles.content}>
        <GlassCard style={styles.card} raised>
          <View style={styles.icon}>
            <Ionicons name={icon} size={28} color={colors.accent} />
          </View>
          <Text style={styles.eyebrow}>COMING SOON</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </GlassCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  card: { padding: spacing.xl, alignItems: 'center', gap: spacing.md },
  icon: {
    width: 58,
    height: 58,
    borderRadius: radius.field,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `rgba(${colors.accentRgb},0.12)`,
    marginBottom: spacing.xs,
  },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, textAlign: 'center' },
  body: { ...typography.body, color: colors.ink2, textAlign: 'center', lineHeight: 22 },
});
