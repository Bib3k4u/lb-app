import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '../../lib/training/types';
import { equipmentFor, platesPerSide } from '../../lib/training/equipment';
import { colors, radius, spacing, typography } from '../../lib/theme';

const icons: Record<ReturnType<typeof equipmentFor>, keyof typeof Ionicons.glyphMap> = {
  BARBELL: 'barbell-outline', DUMBBELLS: 'barbell-outline', CABLE: 'git-branch-outline', KETTLEBELL: 'fitness-outline', MACHINE: 'hardware-chip-outline', BODYWEIGHT: 'body-outline', WEIGHTS: 'fitness-outline',
};

export function ExerciseEquipment({ exercise, weight }: { exercise: Exercise; weight: number }) {
  const equipment = equipmentFor(exercise);
  const plates = equipment === 'BARBELL' ? platesPerSide(weight) : [];
  return <View style={styles.panel}>
    <View style={styles.icon}><Ionicons name={icons[equipment]} size={20} color={colors.accent} /></View>
    <View style={styles.copy}><Text style={styles.eyebrow}>EQUIPMENT</Text><Text style={styles.name}>{equipment[0] + equipment.slice(1).toLowerCase()}</Text><Text style={styles.meta}>{equipment === 'BODYWEIGHT' ? 'No external load required' : weight > 0 ? `${weight} kg working weight` : equipment === 'BARBELL' ? '20 kg bar before plates' : 'Enter a working weight below'}</Text></View>
    {plates.length ? <View style={styles.plates}>{[...new Set(plates)].map((plate) => <View key={plate} style={styles.plate}><Text style={styles.plateText}>{plate}</Text></View>)}<Text style={styles.perSide}>each side</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.field, backgroundColor: colors.glass2, borderWidth: 1, borderColor: colors.glassLine },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: `rgba(${colors.accentRgb},0.11)` },
  copy: { flex: 1 }, eyebrow: { ...typography.eyebrow, color: colors.dim }, name: { ...typography.caption, color: colors.ink, fontWeight: '700', marginTop: 2 }, meta: { fontSize: 10, color: colors.dim, marginTop: 2 },
  plates: { flexDirection: 'row', alignItems: 'center', gap: 3, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 100 },
  plate: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: `rgba(${colors.accentRgb},0.15)`, borderWidth: 1, borderColor: `rgba(${colors.accentRgb},0.28)` },
  plateText: { fontSize: 8, fontWeight: '800', color: colors.accent }, perSide: { fontSize: 8, color: colors.dim, width: '100%', textAlign: 'right' },
});
