/**
 * Operational work lives inside the Manage tab so its stack keeps the
 * universal bottom navigation mounted on every admin/trainer screen.
 *
 * This guard only controls visibility. The server still enforces authority
 * and location scope for every request.
 */
import { Redirect, Stack } from 'expo-router';
import { useAuth, visibleSections } from '../../../lib/auth/store';

export default function ManageLayout() {
  const user = useAuth((state) => state.user);

  if (!user) return <Redirect href="/(auth)/identifier" />;

  const sections = visibleSections(user);
  if (!sections.admin && !sections.trainer) {
    return <Redirect href="/(training)/today" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
