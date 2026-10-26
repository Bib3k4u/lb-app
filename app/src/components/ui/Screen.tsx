/**
 * Full-screen wrapper carrying the ambient bloom every LIMITBEYOND screen
 * sits on — two soft radial glows behind the content, nothing else in the
 * UI is a gradient (see docs/uisample/dashboard.html's own note). Frosted
 * GlassCards pick up this light through BlurView; without it they'd have
 * nothing to blur against.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, ScrollView, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../../lib/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
}

export function Screen({ children, scroll = false, padded = true, style, contentContainerStyle }: ScreenProps) {
  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? {
        contentContainerStyle: [
          padded && styles.padded,
          { flexGrow: 1 },
          contentContainerStyle,
          styles.flushBottom,
        ],
        keyboardShouldPersistTaps: 'handled' as const,
        keyboardDismissMode: 'on-drag' as const,
        showsVerticalScrollIndicator: false,
      }
    : { style: [{ flex: 1 }, padded && styles.padded, contentContainerStyle] };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[colors.glowWarm, 'transparent']}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.75, y: 0.7 }}
          style={styles.glowTop}
        />
        <LinearGradient
          colors={[colors.glowDeep, 'transparent']}
          start={{ x: 1, y: 1 }}
          end={{ x: 0.2, y: 0.35 }}
          style={styles.glowBottom}
        />
      </View>
      <SafeAreaView style={[styles.safe, style]} edges={['top']}>
        <Body {...(bodyProps as object)}>{children}</Body>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  safe: { flex: 1 },
  padded: { paddingHorizontal: spacing.md },
  flushBottom: { paddingBottom: 0 },
  glowTop: {
    position: 'absolute',
    top: '-15%',
    left: '-20%',
    width: '110%',
    height: '55%',
    borderRadius: 999,
  },
  glowBottom: {
    position: 'absolute',
    bottom: '-15%',
    right: '-20%',
    width: '100%',
    height: '50%',
    borderRadius: 999,
  },
});
