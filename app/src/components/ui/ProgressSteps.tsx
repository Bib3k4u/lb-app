/**
 * The step indicator across the onboarding flow — a row of pill segments,
 * filled up to the current step. Deliberately a progress bar per step, not
 * numbered dots: the point being communicated is "how much is left," which
 * a filled/unfilled bar reads faster than a number does.
 */
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { colors, radius, spacing } from '../../lib/theme';

interface ProgressStepsProps {
  total: number;
  current: number; // 0-indexed
}

export function ProgressSteps({ total, current }: ProgressStepsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <Segment key={i} filled={i <= current} />
      ))}
    </View>
  );
}

function Segment({ filled }: { filled: boolean }) {
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? colors.accent : colors.glassLine2, { duration: 250 }),
  }));
  return <Animated.View style={[styles.segment, animatedStyle]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill },
});
