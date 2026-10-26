/**
 * Platform section — mounted only when the account holds a qualifying grant.
 *
 * NN-5: this guard decides what is SHOWN. The server re-evaluates authority on
 * every request and RLS filters every query. Never treat a mounted route as
 * proof of permission.
 */
import { Redirect } from 'expo-router';
import { useAuth, visibleSections } from '../../lib/auth/store';

export default function SuperAdminLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/(auth)/identifier" />;
  if (!visibleSections(user).superadmin) return <Redirect href="/(training)/today" />;
  return <Redirect href="/(training)/manage" />;
}
