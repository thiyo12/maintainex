#!/bin/bash
set -euo pipefail
umask 077

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="${BACKUP_DIR:-$HOME/maintainex-backup}"
ARCHIVE_NAME="maintainex-full-backup-${DATE}.tar.gz.enc"
WORK_DIR=$(mktemp -d)
PLAIN_ARCHIVE=$(mktemp "${TMPDIR:-/tmp}/maintainex-backup.XXXXXX.tar.gz")
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
SERVER="${SERVER:?Set SERVER, for example root@your-vps-host}"
SERVICE="${SERVICE:-maintainex-mx-vcaohy}"
BACKUP_ENCRYPTION_KEY_FILE="${BACKUP_ENCRYPTION_KEY_FILE:?Set BACKUP_ENCRYPTION_KEY_FILE to a protected local key file}"

cleanup() {
  rm -rf "$WORK_DIR"
  rm -f "$PLAIN_ARCHIVE"
}
trap cleanup EXIT

if [ ! -f "$BACKUP_ENCRYPTION_KEY_FILE" ]; then
  echo "ERROR: backup encryption key file does not exist" >&2
  exit 1
fi
if [ ! -s "$BACKUP_ENCRYPTION_KEY_FILE" ]; then
  echo "ERROR: backup encryption key file is empty" >&2
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR: openssl is required for encrypted backups" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

echo "=== MaintainEX Encrypted Full Backup ==="
echo "Date: $DATE"
echo

echo "[1/5] Backing up source code..."
mkdir -p "$WORK_DIR/code"
git -C "$PROJECT_DIR" archive --format=tar HEAD | tar -x -C "$WORK_DIR/code/"
echo "  ✓ Source code ($(du -sh "$WORK_DIR/code" | cut -f1))"

echo "[2/5] Backing up live database..."
mkdir -p "$WORK_DIR/database"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=5)

APP_CONTAINER=$("${SSH[@]}" "$SERVER" "docker ps --filter name='$SERVICE' --format '{{.ID}}' | head -1")
if [ -z "$APP_CONTAINER" ]; then
  echo "ERROR: running application container not found" >&2
  exit 1
fi

DB_META=$("${SSH[@]}" "$SERVER" "docker exec '$APP_CONTAINER' node -e 'const u=new URL(process.env.DATABASE_URL); const user=decodeURIComponent(u.username||\"\"); const path=u.pathname||\"\"; const name=decodeURIComponent(path.startsWith(\"/\")?path.slice(1):path); const host=u.hostname||\"\"; if(!user||!name||!host) process.exit(3); process.stdout.write([user,name,host].join(\"|\"));'")
DB_USER=$(printf '%s' "$DB_META" | cut -d'|' -f1)
DB_NAME=$(printf '%s' "$DB_META" | cut -d'|' -f2)
DB_HOST=$(printf '%s' "$DB_META" | cut -d'|' -f3)

DB_CONTAINER=$("${SSH[@]}" "$SERVER" "name=\$(docker ps --format '{{.Names}}' | grep -F '$DB_HOST' | head -1 || true); if [ -z \"\$name\" ]; then name=\$(docker ps --format '{{.Names}}' | grep -E 'maintainex-db|dokploy-postgres' | head -1 || true); fi; printf '%s' \"\$name\"")
if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR: production PostgreSQL container not found" >&2
  exit 1
fi

LIVE_DB=$("${SSH[@]}" "$SERVER" "docker exec '$DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -Atqc 'SELECT current_database()'")
if [ "$LIVE_DB" != "$DB_NAME" ]; then
  echo "ERROR: database identity mismatch" >&2
  exit 1
fi

LIVE_TABLES=$("${SSH[@]}" "$SERVER" "docker exec '$DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -Atqc \"SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'\"")
"${SSH[@]}" "$SERVER" "docker exec '$DB_CONTAINER' pg_dump -U '$DB_USER' -d '$DB_NAME' --clean --if-exists" > "$WORK_DIR/database/maintainex-live-dump.sql"
BACKUP_TABLES=$(grep -c '^CREATE TABLE public\.' "$WORK_DIR/database/maintainex-live-dump.sql" || true)
if [ "$BACKUP_TABLES" -ne "$LIVE_TABLES" ]; then
  echo "ERROR: backup table count mismatch live=$LIVE_TABLES backup=$BACKUP_TABLES" >&2
  exit 1
fi
grep -q '_prisma_migrations' "$WORK_DIR/database/maintainex-live-dump.sql"
echo "  ✓ Database dump validated"

echo "[3/5] Backing up uploaded files..."
mkdir -p "$WORK_DIR/uploads"
cp -r "$PROJECT_DIR/public/uploads/." "$WORK_DIR/uploads/" 2>/dev/null || true
echo "  ✓ Uploads staged"

echo "[4/5] Writing non-secret restore metadata..."
mkdir -p "$WORK_DIR/config"
cp "$PROJECT_DIR/.env.example" "$WORK_DIR/config/" 2>/dev/null || true
cat > "$WORK_DIR/config/RESTORE-SECRETS.txt" <<'RESTORE'
Production secret values are intentionally NOT stored in this backup.
Restore source/database/uploads first, then restore environment variables from the approved production secret store and rotate any credential involved in an incident.
RESTORE
echo "  ✓ No plaintext environment secret files included"

echo "[5/5] Backing up Docker/config metadata..."
mkdir -p "$WORK_DIR/docker"
cp "$PROJECT_DIR/Dockerfile" "$WORK_DIR/docker/" 2>/dev/null || true
cp "$PROJECT_DIR/nixpacks.toml" "$WORK_DIR/docker/" 2>/dev/null || true
cp "$PROJECT_DIR/.dockerignore" "$WORK_DIR/docker/" 2>/dev/null || true

echo
echo "Packaging and encrypting archive..."
tar -czf "$PLAIN_ARCHIVE" -C "$WORK_DIR" .
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 \
  -in "$PLAIN_ARCHIVE" \
  -out "$BACKUP_DIR/$ARCHIVE_NAME" \
  -pass file:"$BACKUP_ENCRYPTION_KEY_FILE"
chmod 600 "$BACKUP_DIR/$ARCHIVE_NAME"

# Verify both decryption and tar integrity before reporting success.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
  -in "$BACKUP_DIR/$ARCHIVE_NAME" \
  -pass file:"$BACKUP_ENCRYPTION_KEY_FILE" \
  | tar -tzf - >/dev/null

echo
echo "=== Backup Complete ==="
echo "Encrypted archive: $BACKUP_DIR/$ARCHIVE_NAME"
echo "Size:              $(du -h "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1)"
echo
echo "The encryption key is not included in the backup. Store it in the approved secret store."
