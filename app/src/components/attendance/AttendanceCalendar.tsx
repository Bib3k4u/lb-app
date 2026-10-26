import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, addMonths, endOfMonth, endOfWeek, format, isAfter, isBefore, isSameDay, isSameMonth, parseISO, startOfDay, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { GlassCard } from '../ui';
import { colors, radius, spacing, typography } from '../../lib/theme';

export interface AttendanceEntry { id: string; occurredAt: string; pendingSync?: boolean }

export function AttendanceCalendar({ entries, loading = false }: { entries: AttendanceEntry[]; loading?: boolean }) {
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const data = useMemo(() => {
    const checked = new Set(entries.map((entry) => format(new Date(entry.occurredAt), 'yyyy-MM-dd')));
    const firstKey = [...checked].sort()[0]; const first = firstKey ? startOfDay(parseISO(firstKey)) : null; const today = startOfDay(new Date());
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }); const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 }); const days: Date[] = [];
    for (let cursor = start; !isAfter(cursor, end); cursor = addDays(cursor, 1)) days.push(cursor);
    const active30 = [...checked].filter((key) => !isBefore(parseISO(key), subDays(today, 29))).length;
    const last = [...entries].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0];
    return { checked, first, today, days, active30, last };
  }, [entries, month]);
  const canNext = isBefore(month, startOfMonth(new Date()));

  return <GlassCard style={styles.card} raised>
    <View style={styles.header}><View style={styles.icon}><Ionicons name="calendar-outline" size={19} color={colors.accent} /></View><View style={styles.grow}><Text style={styles.title}>Attendance calendar</Text><Text style={styles.meta}>Your gym consistency at a glance</Text></View><View style={styles.monthNav}><Pressable style={styles.navButton} onPress={() => setMonth((value) => addMonths(value, -1))}><Ionicons name="chevron-back" size={17} color={colors.ink2} /></Pressable><Text style={styles.month}>{format(month, 'MMM yyyy')}</Text><Pressable disabled={!canNext} style={[styles.navButton, !canNext && styles.disabled]} onPress={() => setMonth((value) => addMonths(value, 1))}><Ionicons name="chevron-forward" size={17} color={colors.ink2} /></Pressable></View></View>
    <View style={styles.stats}><View style={styles.stat}><Text style={styles.statValue}>{data.active30}</Text><Text style={styles.statLabel}>Active days · 30d</Text></View><View style={styles.divider} /><View style={styles.stat}><Text style={[styles.statValue, data.checked.has(format(data.today, 'yyyy-MM-dd')) && styles.good]}>{data.checked.has(format(data.today, 'yyyy-MM-dd')) ? 'Done' : 'Pending'}</Text><Text style={styles.statLabel}>Today</Text></View><View style={styles.divider} /><View style={styles.stat}><Text style={styles.lastValue}>{data.last ? format(new Date(data.last.occurredAt), 'd MMM') : '—'}</Text><Text style={styles.statLabel}>Last visit</Text></View></View>
    <View style={styles.legend}><Legend color={colors.good} label="Checked in" /><Legend color={colors.alert} label="Missed" /><Legend color={colors.accent} label="Today" /></View>
    <View style={styles.week}>{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, index) => <Text key={`${label}-${index}`} style={styles.weekLabel}>{label}</Text>)}</View>
    {loading ? <Text style={styles.loading}>Loading attendance…</Text> : <View style={styles.grid}>{data.days.map((day) => {
      const key = format(day, 'yyyy-MM-dd'); const checked = data.checked.has(key); const today = isSameDay(day, data.today); const missed = Boolean(data.first && isSameMonth(day, month) && !checked && isBefore(day, data.today) && !isBefore(day, data.first));
      return <View key={key} style={styles.dayCell}><View style={[styles.day, !isSameMonth(day, month) && styles.outside, missed && styles.missed, checked && styles.checked, today && !checked && styles.today]}><Text style={[styles.dayText, (checked || missed) && styles.dayTextActive]}>{format(day, 'd')}</Text>{entries.some((entry) => entry.pendingSync && format(new Date(entry.occurredAt), 'yyyy-MM-dd') === key) ? <View style={styles.syncDot} /> : null}</View></View>;
    })}</View>}
  </GlassCard>;
}

function Legend({ color, label }: { color: string; label: string }) { return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>; }

const styles = StyleSheet.create({ card: { padding: spacing.lg, gap: spacing.lg }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' }, icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: `rgba(${colors.accentRgb},0.10)` }, grow: { flex: 1, minWidth: 130 }, title: { ...typography.headline, color: colors.ink }, meta: { ...typography.caption, color: colors.dim }, monthNav: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, navButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass2 }, disabled: { opacity: 0.28 }, month: { ...typography.caption, color: colors.ink, minWidth: 62, textAlign: 'center' }, stats: { flexDirection: 'row', paddingVertical: spacing.sm, borderRadius: radius.field, backgroundColor: colors.glass2 }, stat: { flex: 1, alignItems: 'center', gap: 3 }, statValue: { ...typography.headline, color: colors.ink }, lastValue: { ...typography.caption, color: colors.ink, fontWeight: '700', marginTop: 3 }, statLabel: { fontSize: 8, color: colors.dim }, good: { color: colors.good }, divider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.glassLine2 }, legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { fontSize: 9, color: colors.dim }, week: { flexDirection: 'row' }, weekLabel: { width: `${100 / 7}%`, textAlign: 'center', ...typography.eyebrow, color: colors.dim, fontSize: 8 }, grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xs }, dayCell: { width: `${100 / 7}%`, alignItems: 'center' }, day: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, outside: { opacity: 0.2 }, checked: { backgroundColor: colors.good }, missed: { backgroundColor: 'rgba(244,96,96,0.72)' }, today: { borderWidth: 1.5, borderColor: colors.accent }, dayText: { fontSize: 11, color: colors.ink2 }, dayTextActive: { color: '#fff', fontWeight: '800' }, syncDot: { position: 'absolute', right: 1, top: 1, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent }, loading: { ...typography.caption, color: colors.dim, textAlign: 'center', paddingVertical: spacing.xl },
});
