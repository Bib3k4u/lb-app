/**
 * A tap-to-open, search-to-filter picker — same glass field chrome as
 * TextField, but for choosing from a fixed list (state, city) instead of
 * typing free text. Options are matched case-insensitively as the user types.
 */
import { useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '../../lib/theme';

interface SearchableSelectProps {
  label?: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: string | null;
  compact?: boolean;
}

export function SearchableSelect({
  label,
  value,
  options,
  onSelect,
  placeholder = 'Select',
  searchPlaceholder = 'Search…',
  disabled,
  error,
  compact = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => option.toLowerCase().includes(q));
  }, [options, query]);

  function close() {
    Keyboard.dismiss();
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        onPress={() => {
          if (disabled) return;
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={[
          styles.field,
          compact && styles.fieldCompact,
          { borderColor: error ? colors.alert : colors.glassLine },
          disabled && styles.fieldDisabled,
        ]}
      >
        <Text style={[value ? styles.value : styles.placeholder, compact && styles.compactText]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.dim} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label ?? placeholder}</Text>
                <Pressable onPress={close} hitSlop={8} accessibilityLabel="Close" style={styles.closeButton}>
                  <Ionicons name="close" size={20} color={colors.ink2} />
                </Pressable>
              </View>

              <View style={styles.searchField}>
                <Ionicons name="search" size={16} color={colors.dim} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor={colors.dim}
                  style={styles.searchInput}
                  autoFocus
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>

              <FlatList
                data={filtered}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                style={styles.list}
                ListEmptyComponent={<Text style={styles.emptyText}>No matches.</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => {
                      onSelect(item);
                      close();
                    }}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  >
                    <Text style={styles.optionText}>{item}</Text>
                    {item === value ? <Ionicons name="checkmark" size={18} color={colors.accent} /> : null}
                  </Pressable>
                )}
              />
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { ...typography.caption, color: colors.ink2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
    paddingVertical: 16,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldCompact: { paddingHorizontal: spacing.md, paddingVertical: 11 },
  value: { ...typography.headline, color: colors.ink, flex: 1, marginRight: spacing.sm },
  placeholder: { ...typography.headline, color: colors.dim, flex: 1, marginRight: spacing.sm },
  compactText: { ...typography.body, fontWeight: '600' },
  error: { ...typography.caption, color: colors.alert },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    maxHeight: '75%',
    backgroundColor: colors.ground,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.glassLine,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...typography.headline, color: colors.ink },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass2,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassLine,
    borderRadius: radius.field,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.ink, paddingVertical: 12 },
  list: { flexGrow: 0 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.glassLine,
  },
  optionPressed: { opacity: 0.6 },
  optionText: { ...typography.body, color: colors.ink },
  emptyText: { ...typography.body, color: colors.dim, textAlign: 'center', paddingVertical: spacing.xl },
});
