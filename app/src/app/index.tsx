/**
 * Entry route. Decides where a signed-in account lands.
 *
 * Every account goes to (training) first, whatever its role — that is
 * FR-PFP-01 expressed in navigation. Operational sections are reachable
 * alongside it, never instead of it.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth/store';

export default function Index() {
  const { user, hydrated } = useAuth();

  if (!hydrated) return null;
  if (!user) return <Redirect href="/(auth)/identifier" />;

  // Onboarding comes before everything else: a brand-new account is
  // PENDING_VERIFICATION from the moment OTP verify creates it
  // (FR-AUTH-06/09), same as one waiting on admin approval — but "finish
  // telling us who you are" is a different, earlier gate than "wait for a
  // human," and profileComplete is what tells them apart.
  if (!user.profileComplete) {
    return <Redirect href="/(auth)/onboarding/name" />;
  }

  // Zero grants is ambiguous on its own: either this account hasn't chosen
  // a path yet (never registered anywhere), or it registered a gym and is
  // waiting on the Super Admin (FR-AUTH-16: Gym Owner is granted only on
  // activation, not registration — so the registrant sits at zero grants
  // the whole time their gym is under review). pendingGym is what tells
  // those two apart; without checking it first, a gym registrant would
  // bounce right back to "choose a path" in a loop every time they open
  // the app.
  if (user.grants.length === 0) {
    if (user.pendingGym) return <Redirect href="/(auth)/gym-pending" />;
    return <Redirect href="/(auth)/choose-path" />;
  }

  // A pending account is restricted to its own profile and its status
  // (FR-AUTH-09). Nothing else is reachable until an admin verifies it.
  if (user.state === 'PENDING_VERIFICATION') {
    return <Redirect href="/(auth)/pending" />;
  }

  if (user.state !== 'ACTIVE') return <Redirect href="/(auth)/blocked" />;

  // Admin accounts use the same phone OTP flow as everyone else, then land on
  // the dashboard selected from their grant. Keeping it inside the universal
  // tab shell leaves personal training and Profile one tap away.
  if (user.grants.some((g) =>
    g.role === 'SUPER_ADMIN' || g.role === 'GYM_OWNER' || g.role === 'LOCATION_ADMIN'
  )) {
    return <Redirect href="/(training)/manage" />;
  }

  return <Redirect href="/(training)/today" />;
}
