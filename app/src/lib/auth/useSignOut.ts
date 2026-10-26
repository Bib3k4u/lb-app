/**
 * Every "Sign out" button uses this, not useAuth().signOut directly.
 *
 * index.tsx's <Redirect> only fires while index.tsx itself is mounted —
 * once expo-router has navigated away from `/` to wherever the account
 * actually landed (gym-pending, choose-path, deep inside onboarding), that
 * route component is gone, and clearing `user` in the store has nothing
 * left listening to react to it. The button looked broken for exactly that
 * reason: the store updated correctly, nothing on screen ever knew to
 * navigate anywhere. Explicitly replacing the route here, rather than
 * relying on the passive root-redirect pattern, is what actually moves the
 * screen.
 */
import { useRouter } from 'expo-router';
import { useAuth } from './store';

export function useSignOut(): () => Promise<void> {
  const router = useRouter();
  const signOut = useAuth((s) => s.signOut);

  return async () => {
    await signOut();
    router.replace('/(auth)/identifier');
  };
}
