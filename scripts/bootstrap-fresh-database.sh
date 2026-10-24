#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a genuinely empty PostgreSQL database from the current Prisma
# schema, restore the checked-in SQL invariants Prisma cannot represent, then
# baseline the immutable historical migration chain. Existing databases must
# use `prisma migrate deploy` and are never accepted by this script.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_FILE="$PROJECT_DIR/prisma/schema.prisma"
INVARIANTS_FILE="$PROJECT_DIR/prisma/bootstrap/postgresql-invariants.sql"

fail() { printf '[BOOTSTRAP] ERROR: %s\n' "$1" >&2; exit 1; }

[[ -n "${DATABASE_URL:-}" ]] || fail 'DATABASE_URL is required.'
command -v psql >/dev/null 2>&1 || fail 'psql is required.'
command -v npx >/dev/null 2>&1 || fail 'npx is required.'
[[ -f "$INVARIANTS_FILE" ]] || fail 'Checked-in PostgreSQL invariant SQL is missing.'

cd "$PROJECT_DIR"
TEMP_DIR="$(mktemp -d)"
TEMP_SCHEMA="$PROJECT_DIR/prisma/.schema.postgresql.bootstrap.prisma"
cleanup() {
  rm -f "$TEMP_SCHEMA"
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Do not edit the developer's schema file or allow an interrupt to strand it
# with a different provider. Prisma commands use a temporary PostgreSQL copy.
sed -E 's/(provider[[:space:]]*=[[:space:]]*)"sqlite"/\1"postgresql"/' \
  "$SCHEMA_FILE" > "$TEMP_SCHEMA"
grep -Eq 'provider[[:space:]]*=[[:space:]]*"postgresql"' "$TEMP_SCHEMA" ||
  fail 'Could not prepare a PostgreSQL Prisma schema.'

# Count every public relation, not only tables. In particular, refuse a
# database that already has Prisma history even if the application tables are
# absent, so this bootstrap cannot erase or relabel an existing environment.
EMPTY_STATE="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -t -A -c \
  "SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')) || ':' || (to_regclass('public.\"_prisma_migrations\"') IS NOT NULL)" 2>/dev/null)" ||
  fail 'Could not connect to PostgreSQL.'
[[ "$EMPTY_STATE" == '0:false' ]] || fail "Target database is not empty (public relations and migration history: $EMPTY_STATE)."

MIGRATION_COUNT="$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d -print | wc -l | tr -d ' ')"
[[ "$MIGRATION_COUNT" -gt 0 ]] || fail 'No Prisma migration directories found.'

printf '[BOOTSTRAP] Generating current schema baseline.\n'
npx prisma migrate diff --from-empty --to-schema-datamodel "$TEMP_SCHEMA" --script > "$TEMP_DIR/baseline.sql"
[[ -s "$TEMP_DIR/baseline.sql" ]] || fail 'Prisma generated an empty baseline.'

printf '[BOOTSTRAP] Applying schema and PostgreSQL-only invariants.\n'
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$TEMP_DIR/baseline.sql" >/dev/null
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f "$INVARIANTS_FILE" >/dev/null

# `migrate resolve` is used only after the complete current Prisma schema and
# the separately versioned raw SQL invariants have actually been installed.
# Any resolution failure stops bootstrap; never swallow errors with grep/|| true.
printf '[BOOTSTRAP] Recording %s historical migrations as superseded by this baseline.\n' "$MIGRATION_COUNT"
while IFS= read -r migration_dir; do
  migration_name="$(basename "$migration_dir")"
  npx prisma migrate resolve --applied "$migration_name" --schema "$TEMP_SCHEMA"
done < <(find prisma/migrations -mindepth 1 -maxdepth 1 -type d -print | sort)

printf '[BOOTSTRAP] Verifying migration history and schema status.\n'
npx prisma migrate deploy --schema "$TEMP_SCHEMA"
STATUS="$(npx prisma migrate status --schema "$TEMP_SCHEMA" 2>&1)" || {
  printf '%s\n' "$STATUS" >&2
  fail 'Prisma migration status failed.'
}
printf '%s\n' "$STATUS"
grep -q 'Database schema is up to date' <<< "$STATUS" || fail 'Schema is not up to date.'

APPLIED_COUNT="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -t -A -c \
  'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')"
[[ "$APPLIED_COUNT" == "$MIGRATION_COUNT" ]] ||
  fail "Expected $MIGRATION_COUNT successful migration records, found $APPLIED_COUNT."

printf '[BOOTSTRAP] Fresh PostgreSQL bootstrap verified (%s migrations baselined).\n' "$APPLIED_COUNT"
