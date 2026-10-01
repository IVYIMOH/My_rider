#!/usr/bin/env bash
# Verifies the four security fixes against a running backend on a scratch DB.
# Usage: bash scripts/verify-security-fixes.sh
# Provisions its own seeded scratch DB and server — see "Harness provisioning" below.
set -uo pipefail

# ---------------------------------------------------------------------------
# Harness provisioning
#
# This script owns its whole environment: a throwaway SQLite DB seeded with the
# demo fixtures the cases below reference by name and phone number, a server
# started against that DB alone, and a log file case 1 reads the emailed
# verification token out of. It never touches ./sipi.db, and it pins dotenv at
# an empty file so a developer's backend/.env cannot quietly change what is
# being asserted. Everything is torn down on exit, including on Ctrl-C.
#
# Env knobs:
#   PORT=8099         port the scratch server listens on
#   API=http://host   test an already-running server instead of starting one
#   LOG=/tmp/...      server log the verification-token grep reads
#   KEEP_SCRATCH=1    leave the scratch DB on disk for inspection
# ---------------------------------------------------------------------------
BACKEND_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
PORT=${PORT:-8099}
LOG=${LOG:-/tmp/sipi-api.log}
KEEP_SCRATCH=${KEEP_SCRATCH:-}
# An explicit API means "use that server"; otherwise we start our own.
if [ -n "${API:-}" ]; then OWN_SERVER=no; else OWN_SERVER=yes; fi
API=${API:-http://localhost:$PORT}

SCRATCH_DIR=""
SERVER_PID=""
SERVER_PGID=""
SCRIPT_PGID=$(ps -o pgid= -p $$ 2>/dev/null | tr -d ' ')

die() { echo "  ABORT  $*" >&2; exit 1; }

stop_server() {
  [ -n "$SERVER_PID" ] || return 0
  # tsx runs the app in a child process, so signal the whole group. Falls back
  # to pid + children if setsid did not give us a group of our own.
  if [ -n "$SERVER_PGID" ] && [ "$SERVER_PGID" != "$SCRIPT_PGID" ]; then
    kill -TERM "-$SERVER_PGID" 2>/dev/null
  else
    pkill -TERM -P "$SERVER_PID" 2>/dev/null
    kill -TERM "$SERVER_PID" 2>/dev/null
  fi
  wait "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  stop_server
  if [ -n "$SCRATCH_DIR" ]; then
    if [ -n "$KEEP_SCRATCH" ]; then echo "  (scratch DB kept at $SCRATCH_DIR)"
    else rm -rf "$SCRATCH_DIR"; fi
  fi
  exit $status
}
trap cleanup EXIT INT TERM

start_server() {
  command -v curl >/dev/null 2>&1 || die "curl is required"
  command -v python3 >/dev/null 2>&1 || die "python3 is required (used to read JSON)"
  [ -d "$BACKEND_DIR/node_modules" ] || die "run 'npm install' in $BACKEND_DIR first"
  if curl -fsS "$API/api/health" >/dev/null 2>&1; then
    die "something is already listening on $API — stop it, or set API=$API to test against it"
  fi

  SCRATCH_DIR=$(mktemp -d "${TMPDIR:-/tmp}/sipi-verify.XXXXXX") || die "could not create a scratch dir"
  : >"$SCRATCH_DIR/empty.env"
  : >"$LOG" || die "cannot write $LOG"

  echo "Starting a scratch API for this run"
  echo "  url:        $API"
  echo "  scratch DB: $SCRATCH_DIR/sipi.db  (ALLOW_SEED=true, removed on exit)"
  echo "  server log: $LOG"

  cd "$BACKEND_DIR" || die "cannot enter $BACKEND_DIR"
  # setsid puts the server in its own process group so teardown can signal the
  # whole tree; without it stop_server falls back to pid + direct children.
  local setsid=""
  command -v setsid >/dev/null 2>&1 && setsid=setsid
  $setsid env \
    DOTENV_CONFIG_PATH="$SCRATCH_DIR/empty.env" \
    DB_PATH="$SCRATCH_DIR/sipi.db" \
    ALLOW_SEED=true \
    PHONE_MOCK=true \
    NODE_ENV=development \
    PORT="$PORT" \
    JWT_SECRET="verify-harness-$$-$RANDOM$RANDOM" \
    SMTP_HOST= \
    SMS_GATEWAY_URL= \
    npx tsx src/index.ts >>"$LOG" 2>&1 &
  SERVER_PID=$!
  SERVER_PGID=$(ps -o pgid= -p "$SERVER_PID" 2>/dev/null | tr -d ' ')

  local i
  for i in $(seq 1 120); do
    if curl -fsS "$API/api/health" >/dev/null 2>&1; then
      echo "  ready after $((i / 2))s"
      return 0
    fi
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo "--- last 30 lines of $LOG ---" >&2; tail -n 30 "$LOG" >&2
      die "the API exited before it was ready"
    fi
    sleep 0.5
  done
  echo "--- last 30 lines of $LOG ---" >&2; tail -n 30 "$LOG" >&2
  die "the API did not answer /api/health within 60s"
}

if [ "$OWN_SERVER" = yes ]; then
  start_server
else
  echo "Testing the API already running at $API (reading $LOG for the verification token)"
  [ -f "$LOG" ] || die "$LOG does not exist — that server must log to it for case 1 to work"
fi

PASS=0; FAIL=0
# j <key> [key...] — reads stdin JSON and walks the given keys, printing '' if absent.
# Booleans print as JSON's true/false, not Python's True/False, so expectations
# below can be written as the API actually returns them.
j() { python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit()
for k in sys.argv[1:]:
    d = d.get(k) if isinstance(d, dict) else None
    if d is None: break
if isinstance(d, bool):
    print("true" if d else "false")
else:
    print("" if d is None else d)
' "$@"; }
check() { # check <label> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "  PASS  $1"; PASS=$((PASS+1));
  else echo "  FAIL  $1 (expected '$2', got '$3')"; FAIL=$((FAIL+1)); fi
}

# dbq <sql> — prints the first column of the first row from the scratch DB.
# dbx <sql> — runs a statement against it, printing lastInsertRowid.
#
# These drive the backend's own better-sqlite3 (already a dependency) instead of
# the sqlite3 CLI, which is not installed everywhere. Reads open the file
# read-only; better-sqlite3's default busy timeout covers the brief moments the
# server holds a write lock. Only usable when we started the server ourselves,
# since otherwise its DB path is unknown.
db_node() {
  ( cd "$BACKEND_DIR" && DB_FILE="$SCRATCH_DIR/sipi.db" SQL="$1" MODE="$2" \
    node --input-type=module -e '
import Database from "better-sqlite3";
const db = new Database(process.env.DB_FILE, { readonly: process.env.MODE === "read" });
if (process.env.MODE === "read") {
  const row = db.prepare(process.env.SQL).get();
  console.log(row === undefined ? "" : String(Object.values(row)[0] ?? ""));
} else {
  console.log(String(db.prepare(process.env.SQL).run().lastInsertRowid));
}
' )
}
dbq() { db_node "$1" read; }
dbx() { db_node "$1" write; }

echo
echo "=============================================================="
echo " 1. /register ignores role and always creates a tourist"
echo "=============================================================="
curl -s -X POST $API/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Mallory Attacker","email":"mallory@evil.test","password":"password123","role":"admin"}' >/dev/null
TOKEN=$(grep -o 'token=[a-f0-9]*' "$LOG" | tail -1 | cut -d= -f2)
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
echo " 8b. C(ii) — an ADMIN revoke also forces offline"
echo "=============================================================="
# Section 8 covers the self-service path: PATCH /api/drivers/me, which routes
# through revokeVerificationForReReview() and so calls goOffline(). This covers
# the admin-panel path, PATCH /api/admin/drivers/:id — a separate handler that
# has to hold the same invariant: nobody is online without being verified.
curl -s -o /dev/null -X PATCH $API/api/admin/drivers/$PD_DID -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMT" -d '{"verified":true}'
curl -s -o /dev/null -X PATCH $API/api/drivers/me -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $PDT" -d '{"online":true}'
BEFORE=$(curl -s $API/api/drivers/me -H "Authorization: Bearer $PDT")
check "driver is verified AND online before the revoke" "true|true" \
  "$(echo "$BEFORE" | j profile verified)|$(echo "$BEFORE" | j profile online)"

# online_seconds banks whole seconds, so leave it something to bank.
sleep 2

REVOKED=$(curl -s -X PATCH $API/api/admin/drivers/$PD_DID -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $ADMT" -d '{"verified":false}')
check "admin revoke reports verified=false" "false" "$(echo "$REVOKED" | j verified)"

AFTER_REVOKE=$(curl -s $API/api/drivers/me -H "Authorization: Bearer $PDT")
check "verification is cleared" "false" "$(echo "$AFTER_REVOKE" | j profile verified)"
check "admin revoke ALSO forces the driver offline" "false" "$(echo "$AFTER_REVOKE" | j profile online)"

# profile.online is the drivers.online column projected straight through
# (src/routes/drivers.ts), but read the row itself too — that is where the
# invariant actually has to hold.
if [ -n "$SCRATCH_DIR" ]; then
  check "drivers.online is 0 in the database itself" "0" \
    "$(dbq "SELECT online FROM drivers WHERE id = $PD_DID")"
  check "drivers.online_at is cleared" "" \
    "$(dbq "SELECT online_at FROM drivers WHERE id = $PD_DID")"
else
  echo "  SKIP  direct DB read (testing a server we did not start, so its DB path is unknown)"
fi

# Banked, not still accruing: a driver left at online = 1 keeps counting up.
BANKED=$(echo "$AFTER_REVOKE" | j stats onlineSeconds)
sleep 2
LATER=$(curl -s $API/api/drivers/me -H "Authorization: Bearer $PDT" | j stats onlineSeconds)
check "online_seconds was banked, not left accruing" "$BANKED" "$LATER"
case "$BANKED" in
  ''|0) echo "  FAIL  the online stretch was banked at all (got '$BANKED' seconds)"; FAIL=$((FAIL+1));;
  *)    echo "  PASS  the online stretch was banked at all ($BANKED seconds)"; PASS=$((PASS+1));;
esac

check "board gate rejects the de-verified driver" "DRIVER_NOT_VERIFIED" \
  "$(curl -s $API/api/rides/available -H "Authorization: Bearer $PDT" | j error code)"
check "accept gate rejects the de-verified driver" "DRIVER_NOT_VERIFIED" \
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
# Amara (#2) signs in by email, not by phone: section 2 already texted
# +256700000002, and a second code inside the per-number cooldown (see
# assertOtpSendAllowed in src/lib/otp.ts) 429s with no devCode, which would
# leave this section and section 10 with no session at all. Neither section
# is testing phone login.
T2=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"tourist@sipirider.com","password":"tourist1234"}' | j token)
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
check "and the verified badge is intact (nothing changed)" "true" \
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
check "and it is marked verified" "true" "$(echo "$AFTER_P" | j profile phoneVerified)"
check "cannot claim a number another account holds" "PHONE_TAKEN" \
  "$(curl -s -X POST $API/api/profile/phone -H 'Content-Type: application/json' -H "Authorization: Bearer $T2" \
     -d '{"phone":"+256700111222"}' | j error code)"

echo
echo "=============================================================="
echo " 10b. F2 (part 2) — EXISTING threads need a shared ride too"
echo "=============================================================="
# Section 9 only proves thread CREATION is gated. This covers the other three
# paths, which used to accept historical participation on its own.
#
# The thread is planted straight into the DB because the API will no longer
# create one: it stands in for a thread opened before the gate existed. David
# (#3, tourist) and Joseph (#6, driver) share no ride.
if [ -z "$SCRATCH_DIR" ]; then
  echo "  SKIP  needs a scratch DB to plant a legacy thread (testing a server we did not start)"
else
  LEGACY_ID=$(dbx "INSERT INTO conversations (user_a, user_b) VALUES (3, 6)")
  dbx "INSERT INTO messages (conversation_id, sender_id, body) VALUES ($LEGACY_ID, 6, 'Legacy thread, no shared ride')" >/dev/null
  echo "        (planted legacy thread #$LEGACY_ID between users 3 and 6)"

  D3=$(curl -s -X POST $API/api/auth/login -H 'Content-Type: application/json' \
    -d '{"email":"david@sipirider.com","password":"tourist1234"}' | j token)
  check "participant on a legacy thread cannot READ it" "NO_SHARED_RIDE" \
    "$(curl -s $API/api/messages/$LEGACY_ID -H "Authorization: Bearer $D3" | j error code)"
  check "participant on a legacy thread cannot POST into it" "NO_SHARED_RIDE" \
    "$(curl -s -X POST $API/api/messages/$LEGACY_ID -H 'Content-Type: application/json' \
       -H "Authorization: Bearer $D3" -d '{"body":"still there?"}' | j error code)"
  check "legacy thread is hidden from the thread list" "absent" \
    "$(curl -s $API/api/messages -H "Authorization: Bearer $D3" | python3 -c "
import sys, json
ids = [c['id'] for c in json.load(sys.stdin).get('conversations', [])]
print('present' if $LEGACY_ID in ids else 'absent')")"
  check "the row is retained, not deleted (admins still need the history)" "1" \
    "$(dbq "SELECT COUNT(*) FROM conversations WHERE id = $LEGACY_ID")"
  check "a non-participant is still refused before the ride check" "403" \
    "$(curl -s -o /dev/null -w '%{http_code}' $API/api/messages/1 -H "Authorization: Bearer $D3")"

  # And the legitimate thread — Amara (#2) and Peter (#5), linked by ride #1 —
  # must be entirely unaffected by all of the above.
  check "ride-linked thread is still listed" "1" \
    "$(curl -s $API/api/messages -H "Authorization: Bearer $T2" | python3 -c "
import sys, json
print(len([c for c in json.load(sys.stdin).get('conversations', []) if c['id'] == 1]))")"
  check "ride-linked thread is still readable" "200" \
    "$(curl -s -o /dev/null -w '%{http_code}' $API/api/messages/1 -H "Authorization: Bearer $T2")"
  check "ride-linked thread still accepts posts" "201" \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/api/messages/1 -H 'Content-Type: application/json' \
       -H "Authorization: Bearer $T2" -d '{"body":"On my way"}')"
fi

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
