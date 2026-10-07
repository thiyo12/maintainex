# Operations — Backup & Restore

This runbook describes the current MaintainEX backup and recovery controls. It is the operational source of truth; older plaintext archive instructions are retired.

## Backup classes

### 1. Full encrypted backup — canonical archival backup

Use `backup.sh`.

The script:

- sets `umask 077`;
- stages source, the live PostgreSQL dump, uploads, non-secret restore metadata, and Docker/build metadata in a private temporary directory;
- intentionally excludes production environment secret values;
- validates the live database identity and table count before accepting the dump;
- encrypts the archive with AES-256-CBC + PBKDF2;
- writes only `.tar.gz.enc` output with mode `0600`;
- verifies decryption and tar integrity before reporting success;
- removes plaintext staging files on exit.

Required operator inputs:

```bash
export SERVER=<ssh-user>@<vps-host>
export SSH_KEY="$HOME/.ssh/id_ed25519"
export BACKUP_ENCRYPTION_KEY_FILE=/path/to/protected/backup.key
./backup.sh
```

The encryption key must be stored separately from the backup archive. Never commit it, copy it into the archive, or paste it into tickets/chat.

### 2. Pre-release production snapshot — rollback safety only

`scripts/crm-v2-production-preflight.sh` creates a short-lived production database snapshot before a release.

The preflight:

- derives the database identity from the running application instead of assuming a database name;
- verifies migration state and application release identity;
- writes the remote backup directory as `0700`;
- creates the snapshot under `umask 077`;
- writes the snapshot as `0600`;
- validates gzip integrity, Prisma migration presence, and table count;
- writes a non-secret preflight receipt as `0600`.

This snapshot is a release-safety control, not a substitute for an encrypted off-host archival backup.

### 3. Programmatic database-only backup

`lib/backup/index.ts` is a private database-only helper.

It invokes `pg_dump` with an argument array rather than shell interpolation, streams output through gzip, creates the backup directory as `0700`, writes files as `0600`, and deletes partial files when a dump fails.

Database-only `.sql.gz` files are sensitive production data. Keep them only on an approved protected host and do not treat them as portable archival backups.

## Prohibited backup practices

Do not:

- copy `.env`, `.env.*`, mobile environment files, private keys, tokens, or credential files into a backup;
- place a production database dump in world-readable `/tmp`;
- email or upload an unencrypted production database dump;
- derive the target database from a hard-coded `postgres/postgres` assumption;
- restore a production dump over the live production database as a test;
- disable encryption or file-permission checks to make a backup command pass.

## Encrypted restore drill

A restore drill must use an isolated non-production database and isolated filesystem.

1. Create a private workspace.

```bash
umask 077
RESTORE_DIR="$(mktemp -d)"
```

2. Decrypt and extract the full archive without creating a second persistent plaintext archive.

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in /path/to/maintainex-full-backup-YYYY-MM-DD.tar.gz.enc \
  -pass file:"$BACKUP_ENCRYPTION_KEY_FILE" \
  | tar -xzf - -C "$RESTORE_DIR"
```

3. Restore the database dump only into a dedicated restore-test PostgreSQL database. Never point the restore command at production.

4. Verify the restored database contains `_prisma_migrations`, expected core tables, and no unfinished migration rows.

5. Point an isolated application instance at the restored database and run:

- Prisma migration status;
- application health/readiness checks;
- authentication smoke tests;
- job/payment/escrow/wallet/commission integrity tests;
- the current security and regression suites.

6. Record a non-secret restore receipt containing the backup identifier, restore-test database identifier, verification results, and operator/date. Do not record credentials.

7. Destroy the plaintext restore workspace and restore-test database after the drill unless retention is explicitly required.

## Production recovery

A real production restore is an incident operation. Before changing production:

1. identify the exact deployed release SHA and rollback image;
2. take a new protected backup if the database is still readable;
3. confirm the incident scope and the selected recovery point;
4. restore only from a verified backup;
5. verify migrations before serving traffic;
6. reconcile financial state and audit continuity;
7. rotate credentials if compromise is suspected;
8. record the recovery evidence in the security incident record.

Do not use `prisma db push`, `migrate reset`, or `--accept-data-loss` on production.

## Verification evidence required for Phase 28

Phase 28 can be marked GREEN only after a real isolated restore drill succeeds. Repository tests prove the backup controls exist; they do not prove a production backup can actually be restored.
