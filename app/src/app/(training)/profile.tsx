/**
 * Universal account profile. Every active account owns this screen regardless
 * of its operational role, just as every account owns the training tabs.
 */
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { Screen, GlassCard, Button, Chip, TextField } from '../../components/ui';
import { colors, radius, spacing, typography } from '../../lib/theme';
import { mapMeResponseToUser, useAuth, type MeResponseDto } from '../../lib/auth/store';
import { api, problemFrom } from '../../lib/api/client';
import { useSignOut } from '../../lib/auth/useSignOut';
import type { Role } from '../../lib/auth/permissions';

const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  GYM_OWNER: 'Gym Owner',
  LOCATION_ADMIN: 'Location Admin',
  TRAINER: 'Trainer',
  MEMBER: 'Member',
};

function displayValue(value: string | null): string {
  if (!value) return 'Not provided';
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ProfileScreen() {
  const user = useAuth((state) => state.user);
  const setUser = useAuth((state) => state.setUser);
  const signOut = useSignOut();
  const [editing, setEditing] = useState(false);
  const [dob, setDob] = useState<Date | null>(null); const [showDate, setShowDate] = useState(false);
  const [gender, setGender] = useState<string | null>(null); const [height, setHeight] = useState('');
  const [experience, setExperience] = useState<string | null>(null); const [goal, setGoal] = useState(''); const [editError, setEditError] = useState<string | null>(null);
  const meQuery = useQuery({ queryKey: ['identity', 'me'], queryFn: async () => (await api.get<MeResponseDto>('/me')).data });
  useEffect(() => { if (meQuery.data) setUser(mapMeResponseToUser(meQuery.data, useAuth.getState().user)); }, [meQuery.data, setUser]);
  const update = useMutation({ mutationFn: async () => (await api.patch<MeResponseDto>('/me', { dateOfBirth: dob ? format(dob, 'yyyy-MM-dd') : undefined, gender, heightCm: height ? Number(height) : undefined, experienceLevel: experience, primaryGoal: goal.trim() || undefined })).data, onSuccess: (data) => { setUser(mapMeResponseToUser(data, user)); setEditing(false); } });

  function openEditor() { setDob(user?.dateOfBirth ? new Date(`${user.dateOfBirth}T00:00:00`) : null); setGender(user?.gender ?? null); setHeight(user?.heightCm ?? ''); setExperience(user?.experienceLevel ?? null); setGoal(user?.primaryGoal ?? ''); setEditError(null); setEditing(true); }
  async function saveProfile() { setEditError(null); try { await update.mutateAsync(); } catch (e) { setEditError(problemFrom(e).detail ?? 'Could not update your profile.'); } }

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || 'LB';
  const roles = [...new Set(user.grants.map((grant) => grant.role))];

  function confirmSignOut() {
    Alert.alert('Log out?', 'You will need to sign in again to access your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen scroll contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View><Text style={styles.eyebrow}>YOUR ACCOUNT</Text><Text style={styles.title}>Profile</Text></View>
        <Pressable style={styles.editButton} onPress={openEditor}><Ionicons name="create-outline" size={17} color={colors.onAccent} /><Text style={styles.editButtonText}>Edit</Text></Pressable>
      </View>

      {editing ? <GlassCard style={styles.editCard} raised><View style={styles.editHeader}><Text style={styles.editTitle}>Edit personal details</Text><Pressable onPress={() => setEditing(false)} hitSlop={8}><Ionicons name="close" size={20} color={colors.ink2} /></Pressable></View><Text style={styles.fieldLabel}>Date of birth</Text><Pressable onPress={() => setShowDate((v) => !v)}><View style={styles.dateField}><Text style={dob ? styles.dateText : styles.datePlaceholder}>{dob ? dob.toLocaleDateString() : 'Add date of birth'}</Text><Ionicons name="calendar-outline" size={18} color={colors.accent} /></View></Pressable>{showDate ? <DateTimePicker value={dob ?? new Date(2000, 0, 1)} mode="date" maximumDate={new Date()} display={Platform.OS === 'ios' ? 'spinner' : 'default'} themeVariant="dark" onChange={(_, date) => { if (Platform.OS === 'android') setShowDate(false); if (date) setDob(date); }} /> : null}<Text style={styles.fieldLabel}>Gender</Text><View style={styles.editChips}>{['MALE', 'FEMALE', 'OTHER', 'PREFER NOT TO SAY'].map((value) => <Chip key={value} label={displayValue(value)} selected={gender === value} onPress={() => setGender(value)} />)}</View><TextField label="Height (cm)" value={height} onChangeText={(v) => setHeight(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="170" /><Text style={styles.fieldLabel}>Experience</Text><View style={styles.editChips}>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map((value) => <Chip key={value} label={displayValue(value)} selected={experience === value} onPress={() => setExperience(value)} />)}</View><TextField label="Primary goal" value={goal} onChangeText={setGoal} placeholder="Strength, endurance, general fitness…" />{editError ? <Text style={styles.editError}>{editError}</Text> : null}<Button label="Save profile" onPress={() => void saveProfile()} loading={update.isPending} /></GlassCard> : null}

      <GlassCard style={styles.identityCard} raised>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.name}>{fullName || 'LIMITBEYOND user'}</Text>
          <Text style={styles.accountState}>{displayValue(user.state)}</Text>
        </View>
        <View style={styles.verifiedIcon}>
          <Ionicons name="checkmark" size={16} color={colors.onAccent} />
        </View>
      </GlassCard>

      <ProfileSection title="Contact" icon="person-outline">
        <DetailRow icon="mail-outline" label="Email" value={user.email ?? 'Not provided'} />
        <DetailRow icon="call-outline" label="Mobile" value={user.phoneE164 ?? 'Not provided'} />
        <DetailRow icon="calendar-outline" label="Date of birth" value={user.dateOfBirth ?? 'Not provided'} last />
      </ProfileSection>

      <ProfileSection title="Fitness profile" icon="barbell-outline">
        <DetailRow icon="body-outline" label="Gender" value={displayValue(user.gender)} />
        <DetailRow
          icon="resize-outline"
          label="Height"
          value={user.heightCm ? `${user.heightCm} cm` : 'Not provided'}
        />
        <DetailRow icon="trending-up-outline" label="Experience" value={displayValue(user.experienceLevel)} />
        <DetailRow icon="flag-outline" label="Primary goal" value={displayValue(user.primaryGoal)} last />
      </ProfileSection>

      <ProfileSection title="Access" icon="key-outline">
        <View style={styles.roles}>
          {roles.length > 0 ? (
            roles.map((role) => (
              <View key={role} style={styles.roleChip}>
                <Text style={styles.roleText}>{ROLE_LABELS[role]}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.muted}>No active role</Text>
          )}
        </View>
      </ProfileSection>

      <Button label="Log out" onPress={confirmSignOut} variant="danger" />
      <Text style={styles.logoutHint}>Your saved account data will remain safely on the server.</Text>
    </Screen>
  );
}

function ProfileSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Ionicons name={icon} size={16} color={colors.accent} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <GlassCard style={styles.detailsCard}>{children}</GlassCard>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !last && styles.detailBorder]}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={17} color={colors.ink2} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xl },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.display, color: colors.ink },
  editButton: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  editButtonText: { ...typography.caption, color: colors.onAccent, fontWeight: '800' },
  editCard: { padding: spacing.lg, gap: spacing.md },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  editTitle: { ...typography.title, color: colors.ink },
  fieldLabel: { ...typography.caption, color: colors.ink2 },
  dateField: { minHeight: 54, paddingHorizontal: spacing.lg, borderRadius: radius.field, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.glassLine, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateText: { ...typography.body, color: colors.ink },
  datePlaceholder: { ...typography.body, color: colors.dim },
  editChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  editError: { ...typography.caption, color: colors.alert },
  identityCard: {
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  avatarText: { ...typography.headline, color: colors.onAccent, fontWeight: '800' },
  identityCopy: { flex: 1, gap: spacing.xs },
  name: { ...typography.title, color: colors.ink },
  accountState: { ...typography.caption, color: colors.good },
  verifiedIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  section: { gap: spacing.sm },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.eyebrow, color: colors.ink2 },
  detailsCard: { overflow: 'hidden' },
  detailRow: {
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.glassLine2 },
  detailIcon: { width: 24, alignItems: 'center' },
  detailLabel: { ...typography.caption, color: colors.ink2, flex: 1 },
  detailValue: { ...typography.body, color: colors.ink, flex: 1.35, textAlign: 'right' },
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.lg },
  roleChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: `rgba(${colors.accentRgb},0.14)`,
    borderWidth: 1,
    borderColor: `rgba(${colors.accentRgb},0.3)`,
  },
  roleText: { ...typography.caption, color: colors.accent },
  muted: { ...typography.body, color: colors.dim },
  logoutHint: { ...typography.caption, color: colors.dim, textAlign: 'center', marginTop: -spacing.md },
});
