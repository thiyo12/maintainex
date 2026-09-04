#!/bin/bash
set -e

DATE=$(date +%Y-%m-%d)
BACKUP_DIR="/Users/thiyoth/maintainex-backup"
ARCHIVE_NAME="maintainex-full-backup-${DATE}.tar.gz"
WORK_DIR=$(mktemp -d)
PROJECT_DIR="/Users/thiyoth/Documents/NEWM/maintainex"
SERVER="root@147.93.106.54"

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

DB_CONTAINER=$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$SERVER" "docker ps --format '{{.Names}}' | grep maintainex-db | head -1")
ssh -o BatchMode=yes "$SERVER" "docker exec $DB_CONTAINER pg_dump -U postgres -d postgres --clean --if-exists" > "$WORK_DIR/database/maintainex-live-dump.sql"

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
