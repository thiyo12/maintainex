#!/bin/bash
set -e

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="${BACKUP_DIR:-$HOME/maintainex-backup}"
ARCHIVE_NAME="maintainex-full-backup-${DATE}.tar.gz"
WORK_DIR=$(mktemp -d)
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
SERVER="${SERVER:?Set SERVER, for example root@your-vps-host}"
SERVICE="${SERVICE:-maintainex-mx-vcaohy}"

echo "=== Maintainex Full Backup ==="
echo "Date: $DATE"
echo ""

# ──────────────────────────────────────────────
# Part 1: Source Code
# ──────────────────────────────────────────────
echo "[1/5] Backing up source code..."
mkdir -p "$WORK_DIR/code"
git -C "$PROJECT_DIR" archive --format=tar HEAD | tar -x -C "$WORK_DIR/code/"
echo "  ✓ Source code ($(du -sh "$WORK_DIR/code" | cut -f1))"

# ──────────────────────────────────────────────
# Part 2: Database (live pg_dump from production)
# ──────────────────────────────────────────────
echo "[2/5] Backing up live database..."
mkdir -p "$WORK_DIR/database"

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
SSH_OPTS="-i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=10"

APP_CONTAINER=$(ssh $SSH_OPTS "$SERVER" "docker ps --filter name=$SERVICE --format '{{.ID}}' | head -1")
if [ -z "$APP_CONTAINER" ]; then
  echo "ERROR: running application container not found" >&2
  exit 1
fi

DB_META=$(ssh $SSH_OPTS "$SERVER" "docker exec $APP_CONTAINER node -e 'const u=new URL(process.env.DATABASE_URL); const user=decodeURIComponent(u.username||\"\"); const path=u.pathname||\"\"; const name=decodeURIComponent(path.startsWith(\"/\")?path.slice(1):path); const host=u.hostname||\"\"; if(!user||!name) process.exit(3); process.stdout.write([user,name,host].join(\"|\"));'")
DB_USER=$(printf '%s' "$DB_META" | cut -d'|' -f1)
DB_NAME=$(printf '%s' "$DB_META" | cut -d'|' -f2)
DB_HOST=$(printf '%s' "$DB_META" | cut -d'|' -f3)

DB_CONTAINER=$(ssh $SSH_OPTS "$SERVER" "name=\$(docker ps --format '{{.Names}}' | grep -F '$DB_HOST' | head -1); if [ -z \"\$name\" ]; then name=\$(docker ps --format '{{.Names}}' | grep -E 'maintainex-db|dokploy-postgres' | head -1); fi; printf '%s' \"\$name\"")
if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR: production PostgreSQL container not found" >&2
  exit 1
fi

LIVE_DB=$(ssh $SSH_OPTS "$SERVER" "docker exec '$DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -Atqc 'SELECT current_database()'")
if [ "$LIVE_DB" != "$DB_NAME" ]; then
  echo "ERROR: database identity mismatch" >&2
  exit 1
fi

LIVE_TABLES=$(ssh $SSH_OPTS "$SERVER" "docker exec '$DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -Atqc \"SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'\"")
ssh $SSH_OPTS "$SERVER" "docker exec '$DB_CONTAINER' pg_dump -U '$DB_USER' -d '$DB_NAME' --clean --if-exists" > "$WORK_DIR/database/maintainex-live-dump.sql"
BACKUP_TABLES=$(grep -c '^CREATE TABLE public\.' "$WORK_DIR/database/maintainex-live-dump.sql" || true)
if [ "$BACKUP_TABLES" -ne "$LIVE_TABLES" ]; then
  echo "ERROR: backup table count mismatch live=$LIVE_TABLES backup=$BACKUP_TABLES" >&2
  exit 1
fi
grep -q '_prisma_migrations' "$WORK_DIR/database/maintainex-live-dump.sql"
echo "  ✓ Database dump ($(du -sh "$WORK_DIR/database/maintainex-live-dump.sql" | cut -f1))"

# ──────────────────────────────────────────────
# Part 3: Uploaded Files
# ──────────────────────────────────────────────
echo "[3/5] Backing up uploaded files..."
mkdir -p "$WORK_DIR/uploads"
cp -r "$PROJECT_DIR/public/uploads/"* "$WORK_DIR/uploads/" 2>/dev/null || true
echo "  ✓ Uploads ($(du -sh "$WORK_DIR/uploads" | cut -f1))"

# ──────────────────────────────────────────────
# Part 4: Environment Files
# ──────────────────────────────────────────────
echo "[4/5] Backing up environment files..."
mkdir -p "$WORK_DIR/envs"
cp "$BACKUP_DIR/envs/"* "$WORK_DIR/envs/" 2>/dev/null || true
cp "$PROJECT_DIR/.env.example" "$WORK_DIR/envs/" 2>/dev/null || true
cp "$PROJECT_DIR/apps/mobile/.env" "$WORK_DIR/envs/mobile.env" 2>/dev/null || true
echo "  ✓ Environment files"

# ──────────────────────────────────────────────
# Part 5: Docker & Config Files
# ──────────────────────────────────────────────
echo "[5/5] Backing up Docker and config files..."
mkdir -p "$WORK_DIR/docker"
cp "$PROJECT_DIR/Dockerfile" "$WORK_DIR/docker/" 2>/dev/null || true
cp "$PROJECT_DIR/nixpacks.toml" "$WORK_DIR/docker/" 2>/dev/null || true
cp "$PROJECT_DIR/.dockerignore" "$WORK_DIR/docker/" 2>/dev/null || true
echo "  ✓ Docker config"

# ──────────────────────────────────────────────
# Package everything
# ──────────────────────────────────────────────
echo ""
echo "Packaging archive..."
tar -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$WORK_DIR" .
rm -rf "$WORK_DIR"

echo ""
echo "=== Backup Complete ==="
echo "Archive: $BACKUP_DIR/$ARCHIVE_NAME"
echo "Size:    $(du -h "$BACKUP_DIR/$ARCHIVE_NAME" | cut -f1)"
echo ""
echo "To rebuild from this archive, see REBUILD.md inside, or run:"
echo "  tar -xzf $BACKUP_DIR/$ARCHIVE_NAME"
echo "  cd code && npm install && npm run build"
