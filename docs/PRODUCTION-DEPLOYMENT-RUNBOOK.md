# MaintainEX Production Deployment Runbook

This runbook documents the current immutable production release path.

## Canonical rule

Production releases must use the checked-in security controls:

1. `scripts/crm-v2-production-preflight.sh`
2. `deploy-rsync.sh`

Do not manually patch a running container.

The following legacy deployment techniques are retired and prohibited:

- `docker cp` of application code into the live container;
- deleting/replacing `.next` inside a running container;
- `docker commit` of an ad-hoc live container;
- deploying an uncommitted working tree;
- building a mutable `prod-latest` release instead of the SHA-bound immutable image;
- running `prisma db push`, `migrate reset`, or `--accept-data-loss`;
- creating plaintext production database dumps in shared temporary directories.

## Preconditions

Before any production release:

- the intended release commit is reviewed and committed;
- required CI/security gates are green;
- the local worktree is clean;
- production credential rotation requirements are complete;
- active SUPER_ADMIN accounts have MFA enrolled;
- rollback ownership is clear;
- the operator has the approved SSH key and production host identifier.

Never place secrets in command history, repository files, CI logs, chat, or the deployment receipt.

## Step 1 — Run production preflight

From the exact committed release checkout:

```bash
export VPS=<ssh-user>@<vps-host>
export SSH_KEY="$HOME/.ssh/id_ed25519"
export CONFIRM_DB_CREDENTIAL_ROTATED=yes
./scripts/crm-v2-production-preflight.sh
```

The preflight fails closed unless it can prove the required source-independent production conditions, including:

- running service/container identity;
- healthy explicit non-root application container;
- required production environment variable names;
- `ALLOW_TEST_OTP` disabled;
- expected trusted-proxy mode;
- complete production payment configuration when a provider is enabled;
- active SUPER_ADMIN MFA enrollment;
- exact 40-character `APP_RELEASE_SHA`;
- immutable image tag matching that release SHA;
- Prisma migration status;
- validated private pre-release database snapshot;
- public health and protected readiness behavior.

Keep the generated receipt private. It must contain no secret values.

## Step 2 — Deploy the exact committed release

```bash
export VPS=<ssh-user>@<vps-host>
export SSH_KEY="$HOME/.ssh/id_ed25519"
export RELEASE_SHA="$(git rev-parse HEAD)"
./deploy-rsync.sh
```

The deployment script verifies the SHA and clean worktree, stages only approved source, excludes secret/backup artifacts, creates a protected backup, records the rollback image, builds an immutable `release-<short-sha>` image, updates the Swarm service, applies migrations through the approved path, and verifies release identity/health.

Do not bypass a failed deployment-script check manually. Fix the failed prerequisite instead.

## Step 3 — Verify the release

Required evidence after the service update:

- expected immutable image is running;
- `APP_RELEASE_SHA` equals the reviewed release commit;
- container health is healthy;
- application runs as an explicit non-root user;
- Prisma reports no unexpected pending migration;
- `/api/health` succeeds;
- unauthenticated access to protected readiness/internal routes remains denied;
- admin login and required MFA behavior remain correct;
- critical booking/payment/escrow flows pass smoke validation;
- recent logs show no new security or financial errors.

Do not use production money for release smoke testing.

## Rollback

`deploy-rsync.sh` records the previous immutable image and release SHA and contains rollback handling for release failures.

If a manual rollback is required, use the previously recorded immutable image and its matching application/database compatibility plan. Do not create a replacement image from a live container.

Database rollback is a separate incident decision. Do not reverse migrations casually; preserve financial and audit integrity and use a verified recovery point.

## Secret and database safety

- Environment values remain in the production secret/configuration store; source transfer excludes `.env*`, keys, tokens, credential folders, database dumps and backup archives.
- Database identity must be derived from the running application configuration, not assumed.
- Production backup material must be private and validated.
- A known exposed credential must be rotated before release preflight can be confirmed.
- A deployment receipt may record identifiers and pass/fail evidence, never credentials.

## External security evidence

A successful repository build is not proof of production state. Final release approval also requires live evidence for VPS/network exposure, Dokploy/Swarm runtime configuration, Cloudflare/origin protection, production database least privilege, monitoring delivery, and backup restore capability.

Until those checks are collected, the security release gate remains conditional even if CI is green.
