# MaintainEX CRM V2 — Production Release Runbook

**Release branch:** `feature/crm-v2-rebuild`  
**Production base:** `main`  
**Release principle:** merging to `main` may trigger Dokploy. Treat merge as a production change unless auto-deploy is explicitly paused.

## A. Release identity and freeze

- [ ] PR #37 remains the only release PR.
- [ ] PR is mergeable with `main`.
- [ ] Release branch is 0 commits behind `main`.
- [ ] Push Release Validation is green on the exact release SHA.
- [ ] PR Release Validation is green on the exact release SHA.
- [ ] Security Exposure Audit is green on the exact release SHA.
- [ ] No additional code changes after this checkpoint unless a blocker is found.

If any release commit is added, restart section A for the new SHA.

## B. Hard blockers before merge

These must be complete **before PR #37 is made ready or merged**.

### B1. Rotate the previously tracked database credential

The old credential must be treated as exposed because Git history retains earlier versions even after current-tree cleanup.

- [ ] Generate a new strong database credential outside Git.
- [ ] Change the production PostgreSQL credential for the role used by `DATABASE_URL`.
- [ ] Update `DATABASE_URL` in Dokploy / the production secret manager.
- [ ] Restart or redeploy only after both database and application environment agree on the new credential.
- [ ] Verify database connectivity without printing the connection string.
- [ ] Revoke the old credential.
- [ ] Do not paste the new credential into issues, PRs, logs, docs, chat transcripts, or shell history.

### B2. Verify required production environment names

Required:

- [ ] `DATABASE_URL`
- [ ] `MARKETPLACE_JWT_SECRET`
- [ ] `STAFF_JWT_SECRET`
- [ ] `PASSWORD_PEPPER`
- [ ] `CRON_SECRET`
- [ ] `INTERNAL_SYNC_SECRET`

Release metadata:

- [ ] `APP_RELEASE_SHA` will equal the merged release commit.

Payment/media/email variables should be present when those production capabilities are enabled, but absence must not be hidden by placeholder values.

### B3. Create production recovery point

Immediately before merge/deploy:

- [ ] Create a PostgreSQL `pg_dump`.
- [ ] Verify backup file is non-empty.
- [ ] Verify gzip integrity.
- [ ] Store the backup outside the app container.
- [ ] Record the current production Swarm image reference.
- [ ] Confirm that image is still available locally/on the registry for rollback.

Do not proceed when backup or rollback-image verification fails.

### B4. Confirm deployment trigger

Exactly one path:

**Path A — Dokploy auto-deploy**
- [ ] Confirm Dokploy watches `main`.
- [ ] Confirm environment variables are updated before merge.
- [ ] Do not run the manual deployment script.
- [ ] Merge becomes the activation event.

**Path B — Manual immutable deployment**
- [ ] Pause/disable Dokploy auto-deploy from `main`.
- [ ] Merge PR #37.
- [ ] Fetch the exact merged `main` commit locally.
- [ ] Run `deploy-rsync.sh` with the production VPS/SSH configuration.
- [ ] Do not re-enable auto-deploy until the release is verified.

## C. Merge gate

Only after all B items are complete:

- [ ] Re-check PR #37 is mergeable.
- [ ] Re-check exact-head CI remains green.
- [ ] Mark PR ready for review/merge.
- [ ] Merge PR #37 into `main`.
- [ ] Record the resulting `main` commit SHA.
- [ ] Confirm no unrelated commit landed between final comparison and merge.

## D. Deployment health gate

The release is not considered healthy until:

- [ ] Swarm service has a running task on the new image.
- [ ] Container health = `healthy`.
- [ ] Container runs as non-root.
- [ ] `GET /api/health` returns HTTP 200.
- [ ] Authenticated `/api/internal/readiness` returns `status: ready`.
- [ ] Readiness reports database = `ok`.
- [ ] Readiness reports migrations = `ok`.
- [ ] `npx prisma migrate status` reports no pending migration.
- [ ] Release SHA reported by health/readiness matches the deployed release when configured.

If any item fails, stop functional smoke testing and execute rollback.

## E. Critical authenticated smoke tests

Perform with controlled test accounts and minimum necessary permissions.

### Owner / staff

- [ ] Owner login succeeds.
- [ ] 2FA/TOTP succeeds where enabled.
- [ ] Session persists across refresh.
- [ ] Staff directory loads.
- [ ] Effective permission restrictions are respected.
- [ ] Session list loads without token material.
- [ ] Authorized session revocation works.
- [ ] Owner-protected session cannot be revoked by a lower role.

### CRM operations

- [ ] Dashboard loads.
- [ ] Global market selector scopes data.
- [ ] Customer detail loads.
- [ ] Tasker detail loads.
- [ ] Company detail loads.
- [ ] Job list loads.
- [ ] Job 360 loads and timeline is intact.
- [ ] Dispute workspace loads.
- [ ] KYC workspace loads with protected document access.

### Finance

Use non-destructive test records unless a controlled financial test has been explicitly prepared.

- [ ] Payments workspace loads only for authorized staff.
- [ ] Escrow workspace loads.
- [ ] Ledger workspace loads.
- [ ] Refund approval boundaries are enforced.
- [ ] Payout approval boundaries are enforced.
- [ ] Settlement/commission views maintain country/currency isolation.
- [ ] Unauthorized roles cannot view restricted finance search results.

### Platform

- [ ] Catalog loads.
- [ ] Professions/taxonomy loads.
- [ ] Locations load.
- [ ] Market configuration loads.
- [ ] Website runtime controls load.
- [ ] Mobile runtime controls load.
- [ ] Notification runtime controls load.
- [ ] Promotions/subscriptions load.
- [ ] Real Estate moderation loads.

### Intelligence / governance

- [ ] Analytics loads.
- [ ] Audit history loads and stays append-only.
- [ ] Security Monitor loads.
- [ ] System Health loads without secret values.
- [ ] Approval queue loads.
- [ ] High-risk action step-up flow works.

## F. Public/mobile regression smoke

- [ ] Public homepage loads.
- [ ] Public catalog reads work.
- [ ] Public catalog reads do not mutate data.
- [ ] Public offer CTAs remain behind the approved booking gate.
- [ ] Unauthenticated protected endpoints return 401/403 as designed.
- [ ] Customer mobile login/refresh works.
- [ ] Tasker mobile login/refresh works.
- [ ] Company flow works.
- [ ] Runtime service/category visibility follows CRM controls.
- [ ] Notification registration/delivery honors runtime controls.
- [ ] Real Estate public APIs expose only publishable fields/states.

Public website booking remains intentionally design-gated and must not be enabled as part of this release.

## G. Rollback triggers

Immediately roll back the application image if any of the following occurs:

- health/readiness failure;
- migration startup failure;
- repeated 5xx on core routes;
- owner/admin authentication failure;
- authorization boundary failure;
- finance data leakage or lifecycle inconsistency;
- severe queue/notification failure affecting job lifecycle;
- security exposure of tokens, secrets, KYC documents, or cross-market data.

Application rollback:

```bash
docker service update --force --image <PREVIOUS_IMAGE> maintainex-mx-vcaohy
```

Then verify:

```bash
docker service ps maintainex-mx-vcaohy
curl -fsS https://maintainex.lk/api/health
```

Keep the pre-release database backup. Do not attempt destructive database rollback without verifying migration compatibility with the restored application version.

## H. Post-release verification

These are important but are **not pre-merge blockers** once sections B–F are green:

- [ ] Review application errors after release.
- [ ] Review queue backlog.
- [ ] Review failed logins / security events for anomalies.
- [ ] Review payment/refund/payout error queues.
- [ ] Verify expected notifications are flowing.
- [ ] Verify no unexpected new audit/security events.
- [ ] Confirm deployment backup retention.
- [ ] Remove obsolete temporary release images only after rollback window closes.
- [ ] Keep PR/release evidence linked to the deployed SHA.

## Final release state

A CRM V2 release is complete only when:

1. exact release SHA passed all automated gates;
2. exposed database credential was rotated;
3. a verified DB backup and rollback image exist;
4. only one deployment trigger was used;
5. health/readiness/migrations are green;
6. critical authenticated CRM/finance/security smoke tests pass;
7. public/mobile regression smoke passes;
8. no rollback trigger is active.
