#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# MAINTAINEX — Fresh Database Bootstrap Script
# ==============================================================================
#
# Creates a complete MaintainEX schema on an empty PostgreSQL database by:
#   1. Generating the canonical baseline SQL from the Prisma schema
#   2. Applying it to the target database
#   3. Marking all historical migrations as already applied
#   4. Running `prisma migrate deploy` to verify consistency
#
# WHY THIS EXISTS:
#   The historical migration chain (28 migrations) cannot replay on a fresh
#   database because 20250626000000 references the User table before the
#   20260101000000 baseline creates it. Production and staging are unaffected
#   because the baseline was applied during initial setup before migrations
#   were tracked retrospectively.
#
# USAGE:
#   DATABASE_URL="postgresql://..." ./scripts/bootstrap-fresh-database.sh
#
# ENVIRONMENT:
#   DATABASE_URL  — PostgreSQL connection string (required)
#   SKIP_BASELINE_SQL — set to "true" if baseline SQL was already applied
#
# SAFETY:
#   - Refuses to run if the target database already contains tables
#   - Never creates backups (target must be empty)
#   - Prints no secrets
#   - Exits on any error
#
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()   { echo -e "${GREEN}[BOOTSTRAP]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARNING]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── Validate environment ──────────────────────────────────────────────────────

if [[ -z "${DATABASE_URL:-}" ]]; then
  error "DATABASE_URL is not set."
  exit 1
fi

# Check for psql
if ! command -v psql &>/dev/null; then
  error "psql not found. Install postgresql-client or run from a host with psql."
  exit 1
fi

# Check for npx/prisma
if ! command -v npx &>/dev/null; then
  error "npx not found. Ensure Node.js is installed."
  exit 1
fi

DB_DISPLAY=$(echo "$DATABASE_URL" | sed -E 's|.*@[^/]+/([^?]+).*|\1|')
log "Target database: $DB_DISPLAY"

# ── Step 0: Refuse non-empty database ─────────────────────────────────────────

if [[ "${SKIP_BASELINE_SQL:-false}" != "true" ]]; then
  TABLE_COUNT=$(psql "$DATABASE_URL" -t -A -c \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null || echo "CONNECTION_FAILED")

  if [[ "$TABLE_COUNT" == "CONNECTION_FAILED" ]]; then
    error "Cannot connect to database. Check DATABASE_URL."
    exit 1
  fi

  if [[ "$TABLE_COUNT" -gt 0 ]]; then
    error "Database '$DB_DISPLAY' already has $TABLE_COUNT table(s)."
    error "This script only bootstraps EMPTY databases."
    error "For existing databases, use: prisma migrate deploy"
    exit 1
  fi

  log "Database is empty — OK to bootstrap."
fi

# ── Step 1: Ensure schema.prisma has postgresql provider ──────────────────────

cd "$PROJECT_DIR"

# Find the datasource provider line (skip the generator provider line)
ORIGINAL_PROVIDER=$(grep -A2 'datasource' prisma/schema.prisma | grep -E '^\s*provider\s*=' | head -1 | sed -E 's/.*=\s*"([^"]+)".*/\1/')

if [[ "$ORIGINAL_PROVIDER" != "postgresql" ]]; then
  log "Temporarily switching schema provider to postgresql..."
  sed -i.bak "s/provider = \"$ORIGINAL_PROVIDER\"/provider = \"postgresql\"/" prisma/schema.prisma && rm -f prisma/schema.prisma.bak
  SWITCHED_PROVIDER=true
else
  SWITCHED_PROVIDER=false
fi

cleanup() {
  if [[ "${SWITCHED_PROVIDER:-false}" == "true" ]]; then
    sed -i.bak "s/provider = \"postgresql\"/provider = \"$ORIGINAL_PROVIDER\"/" prisma/schema.prisma && rm -f prisma/schema.prisma.bak
    log "Restored schema provider to $ORIGINAL_PROVIDER"
  fi
}
trap cleanup EXIT

# ── Step 2: Generate and apply baseline SQL ────────────────────────────────────

if [[ "${SKIP_BASELINE_SQL:-false}" != "true" ]]; then
  log "Generating baseline SQL from Prisma schema..."
  BASELINE_SQL=$(npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script 2>&1)

  if [[ -z "$BASELINE_SQL" ]]; then
    error "Failed to generate baseline SQL from schema."
    exit 1
  fi

  LINE_COUNT=$(echo "$BASELINE_SQL" | wc -l | tr -d ' ')
  log "Baseline SQL generated: $LINE_COUNT lines"

  log "Applying baseline SQL to database..."
  echo "$BASELINE_SQL" | psql "$DATABASE_URL" -q 2>&1 | tail -5
  log "Baseline schema applied."
fi

# ── Step 3: Mark all historical migrations as applied ──────────────────────────

MIGRATION_DIRS=$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d | sort)

if [[ -z "$MIGRATION_DIRS" ]]; then
  error "No migration directories found."
  exit 1
fi

MIGRATION_COUNT=$(echo "$MIGRATION_DIRS" | wc -l | tr -d ' ')
log "Marking $MIGRATION_COUNT historical migrations as applied..."

while IFS= read -r dir; do
  MIGRATION_NAME=$(basename "$dir")
  npx prisma migrate resolve --applied "$MIGRATION_NAME" 2>&1 | grep -v "^$"
done <<< "$MIGRATION_DIRS"

APPLIED_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM \"_prisma_migrations\"" 2>/dev/null)
log "Marked $APPLIED_COUNT migrations as applied."

# ── Step 4: Verify with prisma migrate deploy ─────────────────────────────────

log "Running prisma migrate deploy to verify consistency..."
npx prisma migrate deploy 2>&1

# ── Step 5: Verify with prisma migrate status ─────────────────────────────────

log "Running prisma migrate status..."
STATUS_OUTPUT=$(npx prisma migrate status 2>&1)
echo "$STATUS_OUTPUT"

if echo "$STATUS_OUTPUT" | grep -q "Database schema is up to date"; then
  log "Database schema is up to date"
else
  error "Migration status check did not report 'up to date'."
  exit 1
fi

# ── Step 6: Verify table count ────────────────────────────────────────────────

TABLE_COUNT=$(psql "$DATABASE_URL" -t -A -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" 2>/dev/null)

log "Final table count: $TABLE_COUNT"

if [[ "$TABLE_COUNT" -lt 100 ]]; then
  warn "Table count ($TABLE_COUNT) seems low. Expected 150+."
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
log "============================================================"
log "  FRESH DATABASE BOOTSTRAP COMPLETE"
log "============================================================"
log "  Database:     $DB_DISPLAY"
log "  Tables:       $TABLE_COUNT"
log "  Migrations:   $APPLIED_COUNT (all marked applied)"
log "  Schema:       up to date"
log "============================================================"
