/**
 * The frosted-glass surface every card, sheet and input sits on — translucent
 * white over the Screen's bloom, blurred so it picks up the colour behind
 * it. BlurView's `intensity` reads differently per platform (Android's
 * blur is a software approximation, iOS uses the real UIVisualEffectView),
 * so this leans on a solid low-alpha tint doing most of the work and blur as
 * the finishing touch — the card still reads correctly even where blur is
 * weak.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, radius } from '../../lib/theme';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Use the slightly-brighter glass tone for a card that should stand out
   *  from its siblings (e.g. the active step in a flow). */
  raised?: boolean;
  radiusOverride?: number;
}

export function GlassCard({ children, style, raised = false, radiusOverride }: GlassCardProps) {
  const r = radiusOverride ?? radius.card;
  return (
    <View style={[styles.wrap, { borderRadius: r, borderColor: raised ? colors.glassLine2 : colors.glassLine }, style]}>
      <BlurView intensity={raised ? 40 : 26} tint="dark" style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: raised ? colors.glass2 : colors.glass, borderRadius: r },
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: 1,
  },
});
