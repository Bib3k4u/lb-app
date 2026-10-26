/**
 * Trainer section — mounted only when the account holds a qualifying grant.
 *
 * NN-5: this guard decides what is SHOWN. The server re-evaluates authority on
 * every request and RLS filters every query. Never treat a mounted route as
 * proof of permission.
 */
import { Redirect, Stack } from 'expo-router';
import { useAuth, visibleSections } from '../../lib/auth/store';

export default function TrainerLayout() {
  const user = useAuth((s) => s.user);
  if (!user) return <Redirect href="/(auth)/identifier" />;
  if (!visibleSections(user).trainer) return <Redirect href="/(training)/today" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
