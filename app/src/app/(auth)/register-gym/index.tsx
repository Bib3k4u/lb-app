/**
 * Start-a-gym, step 1 of 2: the gym's own identity. Slug is pre-filled from
 * the legal name (slugify) rather than asked for separately — one less
 * thing to type; still editable if someone wants a tidier URL.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, TextField, Button, ProgressSteps } from '../../../components/ui';
import { colors, spacing, typography } from '../../../lib/theme';
import { slugify } from '../../../lib/slugify';

export default function RegisterGymStep1() {
  const router = useRouter();
  const [legalName, setLegalName] = useState('');
  const [tradingName, setTradingName] = useState('');
  const [gstin, setGstin] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [slug, setSlug] = useState('');

  function onLegalNameChange(text: string) {
    setLegalName(text);
    if (!slugEdited) setSlug(slugify(text));
  }

  const valid = legalName.trim().length > 0 && slug.length > 0;

  function next() {
    router.push({
      pathname: '/(auth)/register-gym/location',
      params: { slug, legalName: legalName.trim(), tradingName: tradingName.trim(), gstin: gstin.trim() },
    });
  }

  return (
    <Screen scroll>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ProgressSteps total={2} current={0} />

        <View style={styles.header}>
          <Text style={styles.eyebrow}>REGISTER YOUR GYM</Text>
          <Text style={styles.title}>Tell us about your gym</Text>
        </View>

        <View style={styles.form}>
          <TextField
            label="Gym legal name"
            value={legalName}
            onChangeText={onLegalNameChange}
            placeholder="Ironclad Fitness Pvt Ltd"
            autoFocus
            returnKeyType="next"
          />
          <TextField
            label="Trading name (optional)"
            value={tradingName}
            onChangeText={setTradingName}
            placeholder="Ironclad Fitness"
          />
          <TextField
            label="GSTIN (optional)"
            value={gstin}
            onChangeText={setGstin}
            placeholder="29ABCDE1234F1Z5"
            autoCapitalize="characters"
          />
          <TextField
            label="Gym URL"
            value={slug}
            onChangeText={(t) => {
              setSlugEdited(true);
              setSlug(slugify(t));
            }}
            leftAdornment="limitbeyond.app/"
            autoCapitalize="none"
          />
        </View>

        <Button label="Continue" onPress={next} disabled={!valid} style={styles.cta} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingTop: spacing.xl, gap: spacing.xxl },
  header: { gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.title, color: colors.ink, marginTop: spacing.xs },
  form: { gap: spacing.lg, flex: 1 },
  cta: { marginBottom: spacing.lg },
});
