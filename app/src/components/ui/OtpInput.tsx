/**
 * Six-box code entry. One hidden TextInput captures every keystroke (and
 * paste) — six separate inputs juggling focus across platforms is the
 * flakier road for the same result. Each visible box just reflects a
 * character of that single value and pops in when filled.
 */
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, radius, spacing } from '../../lib/theme';

const LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChangeValue: (value: string) => void;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChangeValue, autoFocus = true }: OtpInputProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.row}>
      {Array.from({ length: LENGTH }).map((_, i) => (
        <Box key={i} char={value[i]} active={i === value.length} />
      ))}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChangeValue(t.replace(/[^0-9]/g, '').slice(0, LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={LENGTH}
        style={styles.hiddenInput}
        caretHidden
      />
    </Pressable>
  );
}

function Box({ char, active }: { char: string | undefined; active: boolean }) {
  const scale = useSharedValue(char ? 1 : 0.85);
  useEffect(() => {
    scale.set(withSpring(char ? 1 : 0.85, { damping: 14, stiffness: 260 }));
  }, [char, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={[styles.box, active && styles.boxActive]}>
      <Animated.Text style={[styles.char, animatedStyle]}>{char ?? ''}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' },
  box: {
    width: 48,
    height: 58,
    borderRadius: radius.field,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.accent },
  char: { fontSize: 24, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
