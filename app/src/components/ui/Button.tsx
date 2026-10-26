/**
 * The one button component every screen uses. Pill geometry, a spring
 * press-scale (the detail that makes a UI feel native rather than "web in a
 * WebView"), and light haptic feedback on tap — an iOS convention worth
 * borrowing on Android too.
 */
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, radius, shadow, typography } from '../../lib/theme';

type Variant = 'primary' | 'ghost' | 'subtle' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', disabled = false, loading = false, style }: ButtonProps) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const onPressIn = useCallback(() => {
    scale.set(withSpring(0.96, { damping: 15, stiffness: 300 }));
  }, [scale]);

  const onPressOut = useCallback(() => {
    scale.set(withSpring(1, { damping: 12, stiffness: 250 }));
  }, [scale]);

  const handlePress = useCallback(() => {
    if (isDisabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [isDisabled, onPress]);

  const variantStyle =
    variant === 'primary'
      ? styles.primary
      : variant === 'ghost'
        ? styles.ghost
        : variant === 'danger'
          ? styles.danger
          : styles.subtle;
  const labelColor = variant === 'primary' ? colors.onAccent : colors.ink;

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[
        styles.base,
        variantStyle,
        variant === 'primary' && shadow.accent,
        isDisabled && styles.disabled,
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={labelColor} />
      ) : (
        <Text style={[typography.headline, { color: labelColor }]}>{label}</Text>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primary: { backgroundColor: colors.accent },
  ghost: { backgroundColor: colors.glass2, borderWidth: 1, borderColor: colors.glassLine2 },
  danger: { backgroundColor: colors.alert },
  subtle: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
});
