#!/usr/bin/env bash
# Seeds N distinct, fully-activated members (with a live membership) directly
# via SQL against the gym seed-fixture.sh already created — bypassing the
# OTP round-trip entirely, since minting 500 real OTP logins to build a load
# fixture would be its own multi-minute bottleneck unrelated to what this is
# actually trying to measure.
#
# Why this matters at all: check-ins carry a duplicate-check-in-window guard
# (FR-ATT — the same member can't check in twice within a short window), so
# hammering the endpoint AS ONE member mostly measures that rejection path,
# not real write throughput. Real throughput needs many DIFFERENT members,
# each checking in once. This is what makes that possible without an hour of
# OTP calls.
#
# Requires: seed-fixture.sh has already been run (sources its .fixture.env
# for GYM_ID/LOCATION_ID/PLAN_ID). Writes member user ids to .members.txt,
# one per line — checkin-load-many.js reads that file and mints a JWT per
# member itself (same HS256 dev secret the backend trusts; see that
# script's comment for why this is fine for a local load test only).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/.fixture.env"

COUNT="${1:-300}"
PSQL="psql -p 5433 -U lb_migrator -d limitbeyond -tAc"
STAMP=$(date +%s)

echo "Seeding $COUNT members for gym $GYM_ID / location $LOCATION_ID ..." >&2

psql -p 5433 -U lb_migrator -d limitbeyond -v ON_ERROR_STOP=1 <<SQL
-- member_records/memberships/role_grants/role_grant_locations all carry
-- FORCE ROW LEVEL SECURITY (NN-2) — that applies even to lb_migrator, the
-- table owner, since it isn't a Postgres superuser. Bypassing here, for this
-- session only, is the SQL-level equivalent of AuthContext.superAdmin(),
-- appropriate for a one-off local test fixture and nothing else.
SELECT set_config('app.is_super_admin', 'true', false);

DO \$\$
DECLARE
  i int;
  new_user_id uuid;
  new_member_record_id uuid;
  new_role_grant_id uuid;
BEGIN
  FOR i IN 1..$COUNT LOOP
    new_user_id := gen_random_uuid();
    INSERT INTO users (id, phone_e164, first_name, last_name, state, phone_verified_at)
      VALUES (new_user_id, '+91900${STAMP}' || lpad(i::text, 4, '0'), 'Load', 'Member' || i, 'ACTIVE', now());
    INSERT INTO fitness_profiles (id, user_id) VALUES (gen_random_uuid(), new_user_id);

    new_member_record_id := gen_random_uuid();
    INSERT INTO member_records (id, user_id, gym_id, primary_location_id)
      VALUES (new_member_record_id, new_user_id, '$GYM_ID', '$LOCATION_ID');

    INSERT INTO memberships (id, member_record_id, plan_id, starts_on, expires_on, price_agreed_minor, state)
      VALUES (gen_random_uuid(), new_member_record_id, '$PLAN_ID', CURRENT_DATE, CURRENT_DATE + interval '30 days', 150000, 'ACTIVE');

    new_role_grant_id := gen_random_uuid();
    INSERT INTO role_grants (id, user_id, gym_id, role, is_gym_wide)
      VALUES (new_role_grant_id, new_user_id, '$GYM_ID', 'MEMBER', false);
    INSERT INTO role_grant_locations (id, role_grant_id, location_id)
      VALUES (gen_random_uuid(), new_role_grant_id, '$LOCATION_ID');
  END LOOP;
END \$\$;
SQL

# Pull the ids back out (role_grants rows created above are the simplest
# unambiguous marker — one per seeded member, all created just now). Same
# session-level RLS bypass as above, needed for this SELECT too.
psql -p 5433 -U lb_migrator -d limitbeyond -tAc \
  "SELECT set_config('app.is_super_admin', 'true', false);
   SELECT user_id FROM role_grants WHERE gym_id='$GYM_ID' AND role='MEMBER' ORDER BY granted_at DESC LIMIT $COUNT" \
  | tail -n +2 > "$SCRIPT_DIR/.members.txt"

echo "Wrote $(wc -l < "$SCRIPT_DIR/.members.txt" | tr -d ' ') member ids to $SCRIPT_DIR/.members.txt" >&2
