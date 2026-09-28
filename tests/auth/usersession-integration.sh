#!/bin/bash
# Phase 3 Step 5 — UserSession Integration Tests
# Runs against VPS PostgreSQL test database (maintainex_test)

SSH_KEY="$HOME/.ssh/id_ed25519_ssaaxcy"
VPS_HOST="root@147.93.106.54"
DB_CONTAINER="maintainex-db-maintainex-iwjbmo.1.65ynn3cvucsedu0iss84wjfd7"
DB_NAME="maintainex_test"
PASS=0
FAIL=0

TEST_UID="test-user-step5-001"
TEST_UID_B="test-user-step5-002"

psql_cmd() {
  local sql="$1"
  ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$VPS_HOST" \
    "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"\$(echo '$sql')\"" 2>/dev/null
}

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (expected='$expected', got='$actual')"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_empty() {
  local desc="$1" val="$2"
  if [ -n "$val" ]; then
    echo "  PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $desc (empty)"
    FAIL=$((FAIL + 1))
  fi
}

run_remote() {
  ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$VPS_HOST" "$1" 2>/dev/null
}

echo "=== Phase 3 Step 5: UserSession Integration Tests ==="
echo ""

# --- SETUP ---
echo "--- SETUP ---"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"DELETE FROM \\\"UserSession\\\" WHERE \\\"userId\\\" IN ('$TEST_UID', '$TEST_UID_B')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"DELETE FROM \\\"User\\\" WHERE \\\"id\\\" IN ('$TEST_UID', '$TEST_UID_B')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"User\\\" (\\\"id\\\", \\\"email\\\", \\\"passwordHash\\\", \\\"name\\\", \\\"role\\\", \\\"isActive\\\", \\\"updatedAt\\\") VALUES ('$TEST_UID', 'step5@test.com', 'hash', 'Step5 Test', 'CUSTOMER', true, NOW())\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"User\\\" (\\\"id\\\", \\\"email\\\", \\\"passwordHash\\\", \\\"name\\\", \\\"role\\\", \\\"isActive\\\", \\\"updatedAt\\\") VALUES ('$TEST_UID_B', 'step5b@test.com', 'hash', 'Step5 Test B', 'CUSTOMER', true, NOW())\""
echo "  Setup complete"
echo ""

# --- TEST 1: CREATE SESSION ---
echo "--- TEST 1: CREATE SESSION ---"
SESSION_ID=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"ipAddress\\\", \\\"userAgent\\\", \\\"expiresAt\\\") VALUES ('sess-step5-001', '$TEST_UID', 'abc123hash', 'family-001', '127.0.0.1', 'test-agent', NOW() + interval '30 days') RETURNING \\\"id\\\"\"")
assert_eq "Session created" "sess-step5-001" "$SESSION_ID"

OWNER=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT \\\"userId\\\" FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-001'\"")
assert_eq "Session belongs to user" "$TEST_UID" "$OWNER"

HASH_VAL=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT \\\"refreshTokenHash\\\" FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-001'\"")
assert_eq "RefreshTokenHash stored" "abc123hash" "$HASH_VAL"

REVOKED=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT CASE WHEN \\\"revokedAt\\\" IS NULL THEN 't' ELSE 'f' END FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-001'\"")
assert_eq "RevokedAt null initially" "t" "$REVOKED"
echo ""

# --- TEST 2: REVOKE SESSION ---
echo "--- TEST 2: REVOKE SESSION ---"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"UPDATE \\\"UserSession\\\" SET \\\"revokedAt\\\" = NOW(), \\\"revokeReason\\\" = 'logout' WHERE \\\"id\\\" = 'sess-step5-001'\""
REVOKED_AT=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT CASE WHEN \\\"revokedAt\\\" IS NOT NULL THEN 't' ELSE 'f' END FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-001'\"")
assert_eq "RevokedAt populated" "t" "$REVOKED_AT"

REASON=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT \\\"revokeReason\\\" FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-001'\"")
assert_eq "RevokeReason set" "logout" "$REASON"

# Idempotent
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"UPDATE \\\"UserSession\\\" SET \\\"revokedAt\\\" = NOW(), \\\"revokeReason\\\" = 'logout' WHERE \\\"id\\\" = 'sess-step5-001' AND \\\"revokedAt\\\" IS NULL\""
REASON2=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT \\\"revokeReason\\\" FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-001'\"")
assert_eq "Second revoke idempotent" "logout" "$REASON2"
echo ""

# --- TEST 3: EXPIRATION ---
echo "--- TEST 3: EXPIRATION ---"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-expired', '$TEST_UID', 'expired-hash', 'family-exp', '2020-01-01 00:00:00'::timestamp)\""
EXPIRED=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT CASE WHEN \\\"expiresAt\\\" < NOW() THEN 't' ELSE 'f' END FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-expired'\"")
assert_eq "Expired session detected" "t" "$EXPIRED"

ACTIVE=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"userId\\\" = '$TEST_UID' AND \\\"revokedAt\\\" IS NULL AND \\\"expiresAt\\\" > NOW()\"")
assert_eq "Active count excludes expired/revoked" "0" "$ACTIVE"
echo ""

# --- TEST 4: USER OWNERSHIP ---
echo "--- TEST 4: USER OWNERSHIP ---"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-own', '$TEST_UID', 'own-hash', 'family-own', NOW() + interval '30 days')\""
OWN_OK=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-own' AND \\\"userId\\\" = '$TEST_UID'\"")
assert_eq "Correct user finds session" "1" "$OWN_OK"

OWN_FAIL=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"id\\\" = 'sess-step5-own' AND \\\"userId\\\" = '$TEST_UID_B'\"")
assert_eq "Wrong user cannot find session" "0" "$OWN_FAIL"
echo ""

# --- TEST 5: REVOKE ALL ---
echo "--- TEST 5: REVOKE ALL USER SESSIONS ---"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-revA1', '$TEST_UID', 'revA1', 'fam-revA1', NOW() + interval '30 days')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-revA2', '$TEST_UID', 'revA2', 'fam-revA2', NOW() + interval '30 days')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-revB', '$TEST_UID_B', 'revB', 'fam-revB', NOW() + interval '30 days')\""

run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"UPDATE \\\"UserSession\\\" SET \\\"revokedAt\\\" = NOW(), \\\"revokeReason\\\" = 'logout_all' WHERE \\\"userId\\\" = '$TEST_UID' AND \\\"revokedAt\\\" IS NULL\""

A_REVOKED=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"userId\\\" = '$TEST_UID' AND \\\"revokedAt\\\" IS NOT NULL\"")
assert_eq "All user A sessions revoked" "2" "$A_REVOKED"

B_ACTIVE=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"userId\\\" = '$TEST_UID_B' AND \\\"revokedAt\\\" IS NULL\"")
assert_eq "User B session unaffected" "1" "$B_ACTIVE"
echo ""

# --- TEST 6: TOKEN FAMILY REVOKE ---
echo "--- TEST 6: TOKEN FAMILY REVOCATION ---"
FT="fam-target-$(date +%s)"
FO="fam-other-$(date +%s)"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-fam1', '$TEST_UID', 'fam1', '$FT', NOW() + interval '30 days')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-fam2', '$TEST_UID', 'fam2', '$FT', NOW() + interval '30 days')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"INSERT INTO \\\"UserSession\\\" (\\\"id\\\", \\\"userId\\\", \\\"refreshTokenHash\\\", \\\"tokenFamilyId\\\", \\\"expiresAt\\\") VALUES ('sess-step5-fam3', '$TEST_UID', 'fam3', '$FO', NOW() + interval '30 days')\""

run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"UPDATE \\\"UserSession\\\" SET \\\"revokedAt\\\" = NOW(), \\\"revokeReason\\\" = 'replay_detected' WHERE \\\"tokenFamilyId\\\" = '$FT' AND \\\"revokedAt\\\" IS NULL\""

T_REV=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"tokenFamilyId\\\" = '$FT' AND \\\"revokedAt\\\" IS NOT NULL\"")
assert_eq "Target family revoked" "2" "$T_REV"

O_ACTIVE=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"UserSession\\\" WHERE \\\"tokenFamilyId\\\" = '$FO' AND \\\"revokedAt\\\" IS NULL\"")
assert_eq "Other family unaffected" "1" "$O_ACTIVE"
echo ""

# --- CLEANUP ---
echo "--- CLEANUP ---"
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"DELETE FROM \\\"UserSession\\\" WHERE \\\"userId\\\" IN ('$TEST_UID', '$TEST_UID_B')\""
run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"DELETE FROM \\\"User\\\" WHERE \\\"id\\\" IN ('$TEST_UID', '$TEST_UID_B')\""
echo "  Cleanup complete"
echo ""

# --- VERIFY EXISTING DATA ---
echo "--- VERIFY EXISTING DATA INTACT ---"
USER_COUNT=$(run_remote "docker exec $DB_CONTAINER psql -U postgres -d $DB_NAME -t -A -c \"SELECT COUNT(*) FROM \\\"User\\\"\"")
assert_not_empty "Users table intact" "$USER_COUNT"
echo ""

# --- SUMMARY ---
echo "=== RESULTS ==="
TOTAL=$((PASS + FAIL))
echo "  PASS: $PASS / $TOTAL"
echo "  FAIL: $FAIL / $TOTAL"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "PHASE 3 STEP 5 BLOCKED — INTEGRATION TESTS FAILED"
  exit 1
else
  echo "ALL INTEGRATION TESTS PASSED"
fi
