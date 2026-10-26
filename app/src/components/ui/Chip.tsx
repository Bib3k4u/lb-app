/**
 * A single selectable pill — the building block for one-tap choices
 * (gender, experience level, primary goal) that would otherwise need a
 * dropdown. Dropdowns are a web pattern; a row of tappable chips is the
 * native, faster-feeling equivalent.
 */
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radius, spacing, typography } from '../../lib/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[typography.caption, { color: selected ? colors.onAccent : colors.ink2 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassLine,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
