/**
 * A member's own profile, membership and check-in history all live on the
 * universal (training) tab (FR-PFP-01 — training is not staff-only, and a
 * member's "extra" beyond training is exactly membership status, which
 * today.tsx already shows). This section exists only so
 * visibleSections().member has somewhere real to point; nothing here is
 * worth duplicating away from the tab a member already lands on.
 */
import { Redirect } from 'expo-router';

export default function MemberHome() {
  return <Redirect href="/(training)/today" />;
}
