#!/usr/bin/env bash
# Builds one fully-activated gym + live membership + a member ready to
# check in, then writes every id/token the load-test scripts need to
# .fixture.env (sourced by them, and by you if you want to poke around
# manually with curl). Safe to re-run: each run creates fresh rows with a
# timestamp-suffixed slug/phone so it never collides with a previous run.
#
# Requires: the backend running locally (see backend/DEV.md), psql on PATH
# pointed at the same Postgres the backend uses, python3.
set -euo pipefail

BASE="${BASE:-http://localhost:8080/api/v1}"
PSQL="psql -p 5433 -U lb_migrator -d limitbeyond -tAc"
STAMP=$(date +%s)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

json_field() { python3 -c "import sys,json; print(json.load(sys.stdin)$1)"; }

echo "== Signing in the seeded dev Super Admin ==" >&2
ADMIN_ACCESS=$(curl -s -X POST "$BASE/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"bibek.jha1911@gmail.com","password":"Bibek@#1123#"}' | json_field "['accessToken']")

OWNER_PHONE="+9197$((STAMP % 100000000))"
echo "== Registering a fresh gym owner ($OWNER_PHONE) ==" >&2
curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$OWNER_PHONE\",\"channel\":\"sms\"}" -o /dev/null
OWNER_ACCESS=$(curl -s -X POST "$BASE/auth/otp/verify" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$OWNER_PHONE\",\"code\":\"123456\",\"firstName\":\"Load\",\"lastName\":\"Owner\"}" \
  | json_field "['accessToken']")

echo "== Registering gym loadtest-gym-$STAMP ==" >&2
GYM_ID=$(curl -s -X POST "$BASE/platform/gyms" -H "Authorization: Bearer $OWNER_ACCESS" -H "Content-Type: application/json" -d "{
  \"slug\":\"loadtest-gym-$STAMP\",\"legalName\":\"Load Test Gym $STAMP Pvt Ltd\",\"tradingName\":\"Load Test Gym\",
  \"gstin\":\"29ABCDE1234F1Z5\",
  \"location\":{\"slug\":\"main\",\"name\":\"Main\",\"addressLine1\":\"1 Test Street\",\"addressLine2\":null,
  \"city\":\"Bengaluru\",\"state\":\"Karnataka\",\"pincode\":\"560102\",\"latitude\":12.9121,\"longitude\":77.6446,
  \"phoneE164\":\"+919876500000\"}}" | json_field "")

echo "== Verifying + activating the gym ==" >&2
curl -s -X POST "$BASE/platform/gyms/$GYM_ID/verification" -H "Authorization: Bearer $ADMIN_ACCESS" \
  -H "Content-Type: application/json" -d '{"approved":true}' -o /dev/null

OFFERING_ID=$($PSQL "SELECT id FROM subscription_offerings ORDER BY created_at DESC LIMIT 1;")
if [ -z "$OFFERING_ID" ]; then
  $PSQL "INSERT INTO subscription_offerings (name, term_months, price_minor, currency) VALUES ('Standard Annual', 12, 4999900, 'INR');" >/dev/null
  OFFERING_ID=$($PSQL "SELECT id FROM subscription_offerings ORDER BY created_at DESC LIMIT 1;")
fi

curl -s -X POST "$BASE/platform/gyms/$GYM_ID/subscription-payments" -H "Authorization: Bearer $ADMIN_ACCESS" \
  -H "Content-Type: application/json" -H "Idempotency-Key: seed-$STAMP" -d "{
  \"offeringId\":\"$OFFERING_ID\",\"amountMinor\":4999900,\"method\":\"BANK_TRANSFER\",\"reference\":\"TXN-$STAMP\",
  \"receivedOn\":\"$(date +%F)\"}" -o /dev/null

LOCATION_ID=$($PSQL "SELECT id FROM locations WHERE gym_id='$GYM_ID';")

echo "== Refreshing owner token (now carries GYM_OWNER + ACTIVE) ==" >&2
curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$OWNER_PHONE\",\"channel\":\"sms\"}" -o /dev/null
OWNER_ACCESS=$(curl -s -X POST "$BASE/auth/otp/verify" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$OWNER_PHONE\",\"code\":\"123456\"}" | json_field "['accessToken']")

echo "== Creating a plan ==" >&2
PLAN_ID=$(curl -s -X POST "$BASE/plans" -H "Authorization: Bearer $OWNER_ACCESS" -H "Content-Type: application/json" \
  -d '{"name":"Monthly Unlimited","durationMonths":1,"priceMinor":150000}' | json_field "")

MEMBER_PHONE="+9198$((STAMP % 100000000))"
echo "== Registering a member ($MEMBER_PHONE) ==" >&2
curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$MEMBER_PHONE\",\"channel\":\"sms\"}" -o /dev/null
MEMBER_ACCESS=$(curl -s -X POST "$BASE/auth/otp/verify" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$MEMBER_PHONE\",\"code\":\"123456\",\"firstName\":\"Load\",\"lastName\":\"Member\"}" \
  | json_field "['accessToken']")

curl -s -X POST "$BASE/auth/register" -H "Authorization: Bearer $MEMBER_ACCESS" -H "Content-Type: application/json" \
  -d "{\"gymId\":\"$GYM_ID\",\"locationId\":\"$LOCATION_ID\",\"role\":\"MEMBER\"}" -o /dev/null

MEMBER_USER_ID=$($PSQL "SELECT id FROM users WHERE phone_e164='$MEMBER_PHONE';")
MEMBER_RECORD_ID=$($PSQL "SELECT id FROM member_records WHERE user_id='$MEMBER_USER_ID';")

echo "== Approving the member ==" >&2
curl -s -X POST "$BASE/verifications/$MEMBER_USER_ID" -H "Authorization: Bearer $OWNER_ACCESS" \
  -H "Content-Type: application/json" -d '{"approved":true}' -o /dev/null

echo "== Selling a membership ==" >&2
curl -s -X POST "$BASE/members/$MEMBER_RECORD_ID/memberships" -H "Authorization: Bearer $OWNER_ACCESS" \
  -H "Content-Type: application/json" -d "{\"planId\":\"$PLAN_ID\",\"startsOn\":\"$(date +%F)\"}" -o /dev/null

echo "== Fetching a fresh member token (short-lived — re-run this script if load tests report 401s) ==" >&2
curl -s -X POST "$BASE/auth/otp/request" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$MEMBER_PHONE\",\"channel\":\"sms\"}" -o /dev/null
MEMBER_ACCESS=$(curl -s -X POST "$BASE/auth/otp/verify" -H "Content-Type: application/json" \
  -d "{\"identifier\":\"$MEMBER_PHONE\",\"code\":\"123456\"}" | json_field "['accessToken']")

cat > "$SCRIPT_DIR/.fixture.env" <<EOF
export BASE="$BASE"
export GYM_ID="$GYM_ID"
export LOCATION_ID="$LOCATION_ID"
export PLAN_ID="$PLAN_ID"
export MEMBER_RECORD_ID="$MEMBER_RECORD_ID"
export MEMBER_ACCESS="$MEMBER_ACCESS"
export OWNER_ACCESS="$OWNER_ACCESS"
export ADMIN_ACCESS="$ADMIN_ACCESS"
export LOCATION_LATITUDE="12.9121"
export LOCATION_LONGITUDE="77.6446"
EOF

echo "" >&2
echo "Fixture ready. Wrote $SCRIPT_DIR/.fixture.env — source it before running the load scripts:" >&2
echo "  source $SCRIPT_DIR/.fixture.env" >&2
