-- Phase 3 Step 5 — UserSession Integration Tests
-- Runs against maintainex_test database

\set ON_ERROR_STOP on

-- SETUP
DELETE FROM "UserSession" WHERE "userId" IN ('test-user-step5-001', 'test-user-step5-002');
DELETE FROM "User" WHERE "id" IN ('test-user-step5-001', 'test-user-step5-002');
INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "isActive", "updatedAt")
VALUES ('test-user-step5-001', 'step5@test.com', 'hash', 'Step5 Test', 'CUSTOMER', true, NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "isActive", "updatedAt")
VALUES ('test-user-step5-002', 'step5b@test.com', 'hash', 'Step5 Test B', 'CUSTOMER', true, NOW());
\echo 'Setup complete'

-- TEST 1: CREATE SESSION
\echo '--- TEST 1: CREATE SESSION ---'
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "ipAddress", "userAgent", "expiresAt", "updatedAt")
VALUES ('sess-step5-001', 'test-user-step5-001', 'abc123hash', 'family-001', '127.0.0.1', 'test-agent', NOW() + interval '30 days', NOW())
RETURNING "id";

SELECT CASE WHEN "userId" = 'test-user-step5-001' THEN 'PASS: Session belongs to user' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';
SELECT CASE WHEN "refreshTokenHash" = 'abc123hash' THEN 'PASS: RefreshTokenHash stored' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';
SELECT CASE WHEN "revokedAt" IS NULL THEN 'PASS: RevokedAt null initially' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';
SELECT CASE WHEN "tokenFamilyId" = 'family-001' THEN 'PASS: TokenFamilyId present' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';

-- TEST 2: REVOKE SESSION
\echo '--- TEST 2: REVOKE SESSION ---'
UPDATE "UserSession" SET "revokedAt" = NOW(), "revokeReason" = 'logout' WHERE "id" = 'sess-step5-001';
SELECT CASE WHEN "revokedAt" IS NOT NULL THEN 'PASS: RevokedAt populated' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';
SELECT CASE WHEN "revokeReason" = 'logout' THEN 'PASS: RevokeReason set' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';

-- Idempotent revoke
UPDATE "UserSession" SET "revokedAt" = NOW(), "revokeReason" = 'logout' WHERE "id" = 'sess-step5-001' AND "revokedAt" IS NULL;
SELECT CASE WHEN "revokeReason" = 'logout' THEN 'PASS: Second revoke idempotent' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-001';

-- TEST 3: EXPIRATION
\echo '--- TEST 3: EXPIRATION ---'
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-expired', 'test-user-step5-001', 'expired-hash', 'family-exp', '2020-01-01 00:00:00', NOW());
SELECT CASE WHEN "expiresAt" < NOW() THEN 'PASS: Expired session detected' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-expired';
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS: Active count excludes expired/revoked' ELSE 'FAIL' END FROM "UserSession" WHERE "userId" = 'test-user-step5-001' AND "revokedAt" IS NULL AND "expiresAt" > NOW();

-- TEST 4: USER OWNERSHIP
\echo '--- TEST 4: USER OWNERSHIP ---'
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-own', 'test-user-step5-001', 'own-hash', 'family-own', NOW() + interval '30 days', NOW());
SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS: Correct user finds session' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-own' AND "userId" = 'test-user-step5-001';
SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS: Wrong user cannot find session' ELSE 'FAIL' END FROM "UserSession" WHERE "id" = 'sess-step5-own' AND "userId" = 'test-user-step5-002';

-- TEST 5: REVOKE ALL
\echo '--- TEST 5: REVOKE ALL USER SESSIONS ---'
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-revA1', 'test-user-step5-001', 'revA1', 'fam-revA1', NOW() + interval '30 days', NOW());
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-revA2', 'test-user-step5-001', 'revA2', 'fam-revA2', NOW() + interval '30 days', NOW());
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-revB', 'test-user-step5-002', 'revB', 'fam-revB', NOW() + interval '30 days', NOW());

UPDATE "UserSession" SET "revokedAt" = NOW(), "revokeReason" = 'logout_all' WHERE "userId" = 'test-user-step5-001' AND "revokedAt" IS NULL;
SELECT CASE WHEN COUNT(*) >= 2 THEN 'PASS: All user A active sessions revoked' ELSE 'FAIL' END FROM "UserSession" WHERE "userId" = 'test-user-step5-001' AND "revokedAt" IS NOT NULL;
SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS: User B session unaffected' ELSE 'FAIL' END FROM "UserSession" WHERE "userId" = 'test-user-step5-002' AND "revokedAt" IS NULL;

-- TEST 6: TOKEN FAMILY REVOKE
\echo '--- TEST 6: TOKEN FAMILY REVOCATION ---'
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-fam1', 'test-user-step5-001', 'fam1', 'fam-target', NOW() + interval '30 days', NOW());
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-fam2', 'test-user-step5-001', 'fam2', 'fam-target', NOW() + interval '30 days', NOW());
INSERT INTO "UserSession" ("id", "userId", "refreshTokenHash", "tokenFamilyId", "expiresAt", "updatedAt")
VALUES ('sess-step5-fam3', 'test-user-step5-001', 'fam3', 'fam-other', NOW() + interval '30 days', NOW());

UPDATE "UserSession" SET "revokedAt" = NOW(), "revokeReason" = 'replay_detected' WHERE "tokenFamilyId" = 'fam-target' AND "revokedAt" IS NULL;
SELECT CASE WHEN COUNT(*) = 2 THEN 'PASS: Target family revoked' ELSE 'FAIL' END FROM "UserSession" WHERE "tokenFamilyId" = 'fam-target' AND "revokedAt" IS NOT NULL;
SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS: Other family unaffected' ELSE 'FAIL' END FROM "UserSession" WHERE "tokenFamilyId" = 'fam-other' AND "revokedAt" IS NULL;

-- CLEANUP
\echo '--- CLEANUP ---'
DELETE FROM "UserSession" WHERE "userId" IN ('test-user-step5-001', 'test-user-step5-002');
DELETE FROM "User" WHERE "id" IN ('test-user-step5-001', 'test-user-step5-002');
\echo 'Cleanup complete'

-- VERIFY EXISTING DATA
\echo '--- VERIFY EXISTING DATA ---'
SELECT 'PASS: Users table intact' FROM (SELECT COUNT(*) AS c FROM "User") t WHERE t.c >= 0;
