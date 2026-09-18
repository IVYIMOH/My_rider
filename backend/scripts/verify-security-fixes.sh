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
echo " 5. Pending accounts cannot exchange an OTP for a session"
echo "=============================================================="
# Seeded John Ochieng (#4) is a tourist with status='pending'.
PC=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' \
  -d '{"phone":"+256700000004","role":"tourist"}' | j devCode)
PT_ERR=$(curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+256700000004\",\"code\":\"$PC\"}" | j error code)
check "pending TOURIST blocked at /phone-login/verify" "ACCOUNT_PENDING" "$PT_ERR"

# A pending admin is reachable: created active, then moved to pending by an
# admin via PATCH /api/admin/users/:id. Verify both login paths reject it.
AT=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@sipirider.com","password":"admin1234"}' | j token)
PA_ID=$(curl -s -X POST $API/api/admin/users -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" \
  -d '{"name":"Pending Admin","email":"pending.admin@sipirider.com","password":"StrongAdminPass9","role":"admin","phone":"+256772000333"}' \
  | j user id)
PA_STATE=$(curl -s -X PATCH $API/api/admin/users/$PA_ID -H 'Content-Type: application/json' -H "Authorization: Bearer $AT" \
  -d '{"status":"pending"}' | j status)
check "pending ADMIN state is reachable (admin #$PA_ID -> pending)" "Pending" "$PA_STATE"

PA_EMAIL_ERR=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"pending.admin@sipirider.com","password":"StrongAdminPass9"}' | j error code)
check "pending ADMIN blocked at /auth/login (email path)" "ACCOUNT_PENDING" "$PA_EMAIL_ERR"

PAC=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' \
  -d '{"phone":"+256772000333","role":"tourist"}' | j devCode)
PA_PHONE_ERR=$(curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
  -d "{\"phone\":\"+256772000333\",\"code\":\"$PAC\"}" | j error code)
check "pending ADMIN blocked at /phone-login/verify (phone path)" "ACCOUNT_PENDING" "$PA_PHONE_ERR"

echo
echo "=============================================================="
echo " 7. F1 — the ride board is gated, not just /accept"
echo "=============================================================="
# Reuse the exact pending-driver token shape from the F1 finding: a phone
# signup that never onboarded and was never approved.
PDRIVE=$(login_phone '+256779000111' driver)
PDT=$(echo "$PDRIVE" | j token)
BOARD=$(curl -s $API/api/rides/available -H "Authorization: Bearer $PDT")
check "pending driver: board returns DRIVER_PROFILE_MISSING" "DRIVER_PROFILE_MISSING" "$(echo "$BOARD" | j error code)"
case "$BOARD" in
  *pickup*|*destination*|*estimatedFare*) echo "  FAIL  board leaks ride details"; FAIL=$((FAIL+1));;
  *) echo "  PASS  board response contains no ride details"; PASS=$((PASS+1));;
esac

curl -s -o /dev/null -X POST $API/api/drivers/onboarding -H 'Content-Type: application/json' -H "Authorization: Bearer $PDT" \
  -d '{"fullName":"Unapproved Driver","association":"Not Reviewed Yet","vehicleClassId":"car"}'
check "onboarded but unverified: board rejected" "DRIVER_NOT_VERIFIED" \
  "$(curl -s $API/api/rides/available -H "Authorization: Bearer $PDT" | j error code)"

echo
echo "=============================================================="
echo " 8. F3 — online requires verification; changes revoke it"
echo "=============================================================="
check "unverified driver cannot go online" "DRIVER_NOT_VERIFIED" \
  "$(curl -s -X PATCH $API/api/drivers/me -H 'Content-Type: application/json' -H "Authorization: Bearer $PDT" \
     -d '{"online":true}' | j error code)"

ADMT=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@sipirider.com","password":"admin1234"}' | j token)
PD_DID=$(curl -s $API/api/drivers/me -H "Authorization: Bearer $PDT" | j profile id)
curl -s -o /dev/null -X PATCH $API/api/admin/drivers/$PD_DID -H 'Content-Type: application/json' -H "Authorization: Bearer $ADMT" -d '{"verified":true}'
curl -s -o /dev/null -X PATCH $API/api/drivers/me -H 'Content-Type: application/json' -H "Authorization: Bearer $PDT" -d '{"online":true}'
check "approved driver can go online" "true" \
  "$(curl -s $API/api/drivers/me -H "Authorization: Bearer $PDT" | j profile online)"
check "approved driver can see the board" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' $API/api/rides/available -H "Authorization: Bearer $PDT")"

# The exact F3 scenario: approved as one association/class, then swapped.
curl -s -o /dev/null -X PATCH $API/api/drivers/me -H 'Content-Type: application/json' -H "Authorization: Bearer $PDT" \
  -d '{"association":"Something Else Entirely","vehicleClassId":"coach"}'
AFTER=$(curl -s $API/api/drivers/me -H "Authorization: Bearer $PDT")
check "changing association/class revokes verification" "false" "$(echo "$AFTER" | j profile verified)"
check "changing association/class forces offline" "false" "$(echo "$AFTER" | j profile online)"
check "and the accept gate now rejects them" "DRIVER_NOT_VERIFIED" \
  "$(curl -s -X POST $API/api/rides/1/accept -H "Authorization: Bearer $PDT" | j error code)"

echo
echo "=============================================================="
echo " 9. F2 — messaging requires a shared ride"
echo "=============================================================="
# The exact exploit: unapproved driver -> tourist #2, no ride between them.
check "pending driver cannot DM an unrelated rider" "NO_SHARED_RIDE" \
  "$(curl -s -X POST $API/api/messages -H 'Content-Type: application/json' -H "Authorization: Bearer $PDT" \
     -d '{"recipientId":2,"body":"Unsolicited message"}' | j error code)"

# Normal path: seeded ride #1 links tourist #2 and driver Peter (#5).
T2=$(login_phone '+256700000002' tourist | j token)
check "rider CAN message the driver they share a ride with" "1" \
  "$(curl -s -X POST $API/api/messages -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
     -d '{"recipientId":5,"body":"See you at the Sheraton"}' | j conversationId)"

echo
echo "=============================================================="
echo " 10. F4 — phone changes require re-verification"
echo "=============================================================="
check "PATCH /api/profile no longer writes phone" "+256700000002" \
  "$(curl -s -X PATCH $API/api/profile -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
     -d '{"phone":"+256779555888"}' >/dev/null; curl -s $API/api/profile -H "Authorization: Bearer $T2" | j profile phone)"
check "and the verified badge is intact (nothing changed)" "True" \
  "$(curl -s $API/api/profile -H "Authorization: Bearer $T2" | j profile phoneVerified)"

PCODE=$(curl -s -X POST $API/api/profile/phone -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
  -d '{"phone":"+256779555888"}' | j devCode)
check "phone unchanged until the code is confirmed" "+256700000002" \
  "$(curl -s $API/api/profile -H "Authorization: Bearer $T2" | j profile phone)"
check "a profile code cannot be used to SIGN IN" "OTP_NOT_FOUND" \
  "$(curl -s -X POST $API/api/auth/phone-login/verify -H 'Content-Type: application/json' \
     -d "{\"phone\":\"+256779555888\",\"code\":\"$PCODE\"}" | j error code)"

PCODE2=$(curl -s -X POST $API/api/profile/phone -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
  -d '{"phone":"+256779555999"}' | j devCode)
curl -s -o /dev/null -X POST $API/api/profile/phone/verify -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
  -d "{\"phone\":\"+256779555999\",\"code\":\"$PCODE2\"}"
AFTER_P=$(curl -s $API/api/profile -H "Authorization: Bearer $T2")
check "confirmed code saves the new number" "+256779555999" "$(echo "$AFTER_P" | j profile phone)"
check "and it is marked verified" "True" "$(echo "$AFTER_P" | j profile phoneVerified)"
check "cannot claim a number another account holds" "PHONE_TAKEN" \
  "$(curl -s -X POST $API/api/profile/phone -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
     -d '{"phone":"+256700111222"}' | j error code)"

echo
echo "=============================================================="
echo " 11. OTP send rate limiting (last — deliberately exhausts the IP budget)"
echo "=============================================================="
VICTIM='+256772777001'
S1=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/api/auth/phone-login \
  -H 'Content-Type: application/json' -d "{\"phone\":\"$VICTIM\"}")
check "1st code request succeeds" "200" "$S1"

S2=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' -d "{\"phone\":\"$VICTIM\"}")
S2_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/api/auth/phone-login \
  -H 'Content-Type: application/json' -d "{\"phone\":\"$VICTIM\"}")
check "immediate 2nd request returns 429" "429" "$S2_CODE"
case "$(echo "$S2" | j error message)" in
  *"wait"*"seconds"*) echo "  PASS  429 is the per-number cooldown"; PASS=$((PASS+1));;
  *) echo "  FAIL  429 is the per-number cooldown (got: $(echo "$S2" | j error message))"; FAIL=$((FAIL+1));;
esac

# Burn through the hourly per-number budget (cooldown blocks each send, but the
# hourly counter still advances, so the message switches once it is exhausted).
for _ in 1 2 3 4 5; do
  LAST=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' -d "{\"phone\":\"$VICTIM\"}")
done
case "$(echo "$LAST" | j error message)" in
  *"for this number"*) echo "  PASS  per-number hourly cap trips after $(printf 5) sends"; PASS=$((PASS+1));;
  *) echo "  FAIL  per-number hourly cap (got: $(echo "$LAST" | j error message))"; FAIL=$((FAIL+1));;
esac

# Spraying DIFFERENT numbers from one client must trip the per-IP gate.
IP_TRIPPED=no
for n in $(seq 1 40); do
  MSG=$(curl -s -X POST $API/api/auth/phone-login -H 'Content-Type: application/json' \
    -d "{\"phone\":\"+2567728$(printf '%05d' $n)\"}" | j error message)
  case "$MSG" in *"from this device"*) IP_TRIPPED=yes; break;; esac
done
check "spraying many numbers trips the per-IP cap" "yes" "$IP_TRIPPED"

echo
echo "=============================================================="
printf " RESULT: %d passed, %d failed\n" "$PASS" "$FAIL"
echo "=============================================================="
echo
exit $([ "$FAIL" -eq 0 ] && echo 0 || echo 1)
