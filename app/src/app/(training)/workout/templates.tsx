import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen, GlassCard } from '../../../components/ui';
import { workoutTemplates } from '../../../lib/training/templates';
import { colors, radius, spacing, typography } from '../../../lib/theme';

export default function WorkoutTemplatesScreen() {
  const router = useRouter();
  const [open, setOpen] = useState(workoutTemplates[0]?.id ?? '');

  return <Screen scroll contentContainerStyle={styles.content}>
    <View style={styles.header}>
      <Pressable style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={21} color={colors.ink} /></Pressable>
      <View style={styles.grow}><Text style={styles.eyebrow}>PROGRAMMES</Text><Text style={styles.title}>Workout templates</Text></View>
    </View>
    <Text style={styles.intro}>Choose a proven split, then copy any day into a workout you can adjust before saving.</Text>
    {workoutTemplates.map((template) => {
      const expanded = open === template.id;
      return <GlassCard key={template.id} style={styles.card} raised={expanded}>
        <Pressable style={styles.templateTop} onPress={() => setOpen(expanded ? '' : template.id)}>
          <View style={styles.icon}><Ionicons name="calendar" size={20} color={colors.accent} /></View>
          <View style={styles.grow}><Text style={styles.cardTitle}>{template.name}</Text><Text style={styles.muted}>{template.level}</Text></View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.dim} />
        </Pressable>
        <Text style={styles.description}>{template.description}</Text>
        {expanded ? <View style={styles.days}>{template.days.map((day) => <View key={day.day} style={styles.day}>
          <View style={styles.dayTop}><View style={styles.dayNumber}><Text style={styles.dayNumberText}>{day.day}</Text></View><View style={styles.grow}><Text style={styles.dayTitle}>{day.name}</Text><Text style={styles.muted}>{day.focus}</Text></View></View>
          <View style={styles.exerciseList}>{day.exercises.map((exercise) => <Text key={exercise.exerciseName} style={styles.exercise}><Text style={styles.exerciseName}>{exercise.exerciseName}</Text>  ·  {exercise.sets} × {exercise.reps}{exercise.seconds ? ` · ${exercise.seconds}s` : ''}</Text>)}</View>
          <Pressable style={styles.useButton} onPress={() => router.push({ pathname: '/(training)/workout/new', params: { templateId: template.id, day: String(day.day) } })}>
            <Ionicons name="copy-outline" size={16} color={colors.onAccent} /><Text style={styles.useLabel}>Use this day</Text>
          </Pressable>
        </View>)}</View> : null}
      </GlassCard>;
    })}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, gap: spacing.lg }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.glass2, alignItems: 'center', justifyContent: 'center' }, grow: { flex: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.accent }, title: { ...typography.title, color: colors.ink }, intro: { ...typography.body, color: colors.ink2, lineHeight: 22 },
  card: { padding: spacing.lg, gap: spacing.md }, templateTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 42, height: 42, borderRadius: radius.field, backgroundColor: `rgba(${colors.accentRgb},0.12)`, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...typography.headline, color: colors.ink }, muted: { ...typography.caption, color: colors.dim }, description: { ...typography.body, color: colors.ink2, lineHeight: 21 },
  days: { gap: spacing.md }, day: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.glassLine2, paddingTop: spacing.md, gap: spacing.md },
  dayTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, dayNumber: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.glass2, alignItems: 'center', justifyContent: 'center' },
  dayNumberText: { ...typography.caption, color: colors.accent }, dayTitle: { ...typography.headline, color: colors.ink }, exerciseList: { gap: 7 }, exercise: { ...typography.caption, color: colors.dim }, exerciseName: { color: colors.ink2 },
  useButton: { height: 42, borderRadius: radius.pill, backgroundColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, useLabel: { ...typography.caption, color: colors.onAccent, fontWeight: '700' },
});
