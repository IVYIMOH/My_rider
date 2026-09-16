#!/usr/bin/env bash
# Verifies the four security fixes against a running backend on a scratch DB.
# Usage: bash scripts/verify-security-fixes.sh
set -uo pipefail

API=${API:-http://localhost:8099}
PASS=0; FAIL=0
# j <key> [key...] — reads stdin JSON and walks the given keys, printing '' if absent.
j() { python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit()
for k in sys.argv[1:]:
    d = d.get(k) if isinstance(d, dict) else None
    if d is None: break
print("" if d is None else d)
' "$@"; }
check() { # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "  PASS  $1"; PASS=$((PASS+1));
  else echo "  FAIL  $1 (expected '$2', got '$3')"; FAIL=$((FAIL+1)); fi
}

echo
echo "=============================================================="
echo " 1. /register ignores role and always creates a tourist"
echo "=============================================================="
curl -s -X POST $API/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mallory Attacker","email":"mallory@evil.test","password":"password123","role":"admin"}' >/dev/null
TOKEN=$(grep -o 'token=[a-f0-9]*' /tmp/sipi-api.log | tail -1 | cut -d= -f2)
curl -s "$API/api/auth/verify-email?token=$TOKEN" >/dev/null
MAL=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"mallory@evil.test","password":"password123"}')
MAL_ROLE=$(echo "$MAL" | j user role)
MAL_TOK=$(echo "$MAL" | j token)
check "role sent as 'admin' is ignored -> tourist" "tourist" "$MAL_ROLE"
ADMIN_TRY=$(curl -s -o /dev/null -w '%{http_code}' $API/api/admin/users -H "Authorization: Bearer $MAL_TOK")
check "that account cannot reach /api/admin/users" "403" "$ADMIN_TRY"

echo
echo "=============================================================="
echo " 2. Phone login requires an OTP (no code = no token)"
echo "=============================================================="
START=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' \
  -d '{"phone":"+256700000002","role":"tourist"}')
HAS_TOKEN=$(echo "$START" | python3 -c "import sys,json;print('token' in json.load(sys.stdin))")
check "step 1 returns NO session token" "False" "$HAS_TOKEN"
CODE=$(echo "$START" | j devCode)
echo "        (dev code issued: $CODE)"

BAD=$(curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
  -d '{"phone":"+256700000002","code":"000000"}')
BAD_CODE=$(echo "$BAD" | j error code)
if [ "$CODE" = "000000" ]; then echo "  SKIP  wrong-code test (random code collided with 000000)";
else check "wrong code rejected" "OTP_INVALID" "$BAD_CODE"; fi

GOOD=$(curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+256700000002\",\"code\":\"$CODE\"}")
GOOD_NAME=$(echo "$GOOD" | j user name)
check "correct code issues a session" "Amara Boateng" "$GOOD_NAME"

REPLAY=$(curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+256700000002\",\"code\":\"$CODE\"}" | j error code)
check "code is single-use (replay rejected)" "OTP_NOT_FOUND" "$REPLAY"

echo
echo "=============================================================="
echo " 3. Ride accept requires a verified, online driver"
echo "=============================================================="
RT=$(echo "$GOOD" | j token)
RIDE=$(curl -s -X POST $API/api/rides -H 'Content-Type: application/json' -H "Authorization: Bearer $RT" \
  -d '{"vehicleClassId":"car","pickup":"Sheraton Kampala Hotel","destination":"Entebbe Airport","distanceKm":41,"durationMin":62}' | j ride id)
echo "        (test ride #$RIDE created)"

login_phone() { # login_phone <phone> <role>
  local c
  c=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' \
      -d "{\"phone\":\"$1\",\"role\":\"$2\"}" | j devCode)
  curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
      -d "{\"phone\":\"$1\",\"code\":\"$c\"}"
}

# Grace: has a drivers row, verified = 0
GT=$(login_phone '+256700555666' driver | j token)
R=$(curl -s -X POST $API/api/rides/$RIDE/accept -H "Authorization: Bearer $GT" | j error code)
check "unverified driver rejected" "DRIVER_NOT_VERIFIED" "$R"

# Brand-new phone signup: no drivers row at all
NEW=$(login_phone '+256771234567' driver)
NT=$(echo "$NEW" | j token)
R=$(curl -s -X POST $API/api/rides/$RIDE/accept -H "Authorization: Bearer $NT" | j error code)
check "driver with no profile rejected" "DRIVER_PROFILE_MISSING" "$R"

# Peter: verified = 1, but offline
PT=$(login_phone '+256700111222' driver | j token)
R=$(curl -s -X POST $API/api/rides/$RIDE/accept -H "Authorization: Bearer $PT" | j error code)
check "verified but offline driver rejected" "DRIVER_OFFLINE" "$R"

curl -s -X PATCH $API/api/drivers/me -H 'Content-Type: application/json' -H "Authorization: Bearer $PT" \
  -d '{"online":true}' >/dev/null
R=$(curl -s -X POST $API/api/rides/$RIDE/accept -H "Authorization: Bearer $PT" | j ride status)
check "verified + online driver CAN accept" "active" "$R"

echo
echo "=============================================================="
echo " 4. Driver created via phone signup lands in 'pending'"
echo "=============================================================="
NEW_STATUS=$(echo "$NEW" | j user status)
NEW_ROLE=$(echo "$NEW" | j user role)
check "new phone-signup driver role" "driver" "$NEW_ROLE"
check "new phone-signup driver status" "pending" "$NEW_STATUS"

RIDER=$(login_phone '+256772000111' tourist)
check "new phone-signup rider stays active" "active" "$(echo "$RIDER" | j user status)"

echo
echo "=============================================================="
printf " RESULT: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "=============================================================="
echo
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
