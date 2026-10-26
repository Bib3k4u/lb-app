/**
 * The four-state contract.
 *
 * UI-04 requires every data-bearing view to handle loading, empty, error and
 * success. Making them REQUIRED props rather than a convention means a screen
 * cannot forget one by omission — the type checker refuses. This is ENG-01:
 * make the wrong thing hard to write.
 */
import type { ReactElement } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ActivityIndicator, Text, View, Pressable, StyleSheet } from 'react-native';
import { problemFrom } from '../lib/api/client';

interface QueryViewProps<T> {
  query: UseQueryResult<T>;
  success: (data: T) => ReactElement;
  loading?: () => ReactElement;
  empty?: () => ReactElement;
  error?: (message: string, retry: () => void) => ReactElement;
  /** How to tell whether a successful response is actually empty. */
  isEmpty?: (data: T) => boolean;
}

export function QueryView<T>({
  query,
  success,
  loading = () => <DefaultLoading />,
  empty = () => <DefaultEmpty />,
  error = (message, retry) => <DefaultError message={message} onRetry={retry} />,
  isEmpty = defaultIsEmpty,
}: QueryViewProps<T>): ReactElement {
  if (query.isPending) return loading();

  if (query.isError) {
    const problem = problemFrom(query.error);
    return error(
      problem.detail ?? problem.title ?? 'Something went wrong.',
      () => void query.refetch(),
    );
  }

  const data = query.data as T;
  if (isEmpty(data)) return empty();
  return success(data);
}

function defaultIsEmpty(data: unknown): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object' && 'items' in (data as Record<string, unknown>)) {
    const items = (data as { items?: unknown[] }).items;
    return Array.isArray(items) && items.length === 0;
  }
  return false;
}

function DefaultLoading() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator />
    </View>
  );
}

function DefaultEmpty() {
  return (
    <View style={styles.centre}>
      <Text style={styles.muted}>Nothing here yet.</Text>
    </View>
  );
}

/**
 * An error state says what went wrong and what the user may do about it
 * (UI-04). "Error" with no recourse is not a state, it is a dead end.
 */
function DefaultError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.errorText}>{message}</Text>
      <Pressable onPress={onRetry} style={styles.retry} accessibilityRole="button">
        <Text style={styles.retryLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  muted: { color: '#5a6273', fontSize: 15 },
  errorText: { color: '#9a2c2c', fontSize: 15, textAlign: 'center' },
  retry: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f3d5c',
  },
  retryLabel: { color: '#fff', fontWeight: '600' },
});
