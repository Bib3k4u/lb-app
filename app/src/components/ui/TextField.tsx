/**
 * The one text input component every screen uses. Glass surface at rest, a
 * thin accent ring on focus — the same "picks up light" language as
 * GlassCard, just reacting to interaction instead of sitting still.
 */
import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputInstance, type TextInputProps, type ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '../../lib/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  leftAdornment?: string | undefined;
  containerStyle?: ViewStyle;
}

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, error, leftAdornment, containerStyle, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { borderColor: error ? colors.alert : focused ? colors.accent : colors.glassLine },
        ]}
      >
        {leftAdornment ? <Text style={styles.adornment}>{leftAdornment}</Text> : null}
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.dim}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.ink2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
  },
  adornment: { ...typography.headline, color: colors.ink2, marginRight: spacing.sm },
  input: {
    flex: 1,
    ...typography.headline,
    color: colors.ink,
    paddingVertical: 16,
  },
  error: { ...typography.caption, color: colors.alert },
});
