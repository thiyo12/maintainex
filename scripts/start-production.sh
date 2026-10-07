#!/bin/sh
# Production container entrypoint.
#
# Order of operations (privilege separation):
#   1. require-release-sha.sh validates the baked release identity (fail closed)
#   2. Prisma migrations run with DIRECT_URL (dedicated migration role)
#   3. DIRECT_URL is removed from the environment before the app starts
#   4. provider bootstrap + Next.js run with DATABASE_URL (restricted runtime role)
#
# Nothing secret is printed here.
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

# shellcheck disable=SC1091
. "$SCRIPT_DIR/require-release-sha.sh"

echo "[release] starting ${APP_RELEASE_SHA:-unknown}"

if [ -z "${DIRECT_URL:-}" ]; then
  echo "[release] FATAL: DIRECT_URL (migration role) is required for startup migrations; refusing to start" >&2
  exit 1
fi

# Prisma reads only env("DATABASE_URL"), so the migration credential must be
# supplied through that exact variable for this command only. It is unset
# immediately afterwards and never reaches the long-running application.
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy

unset DIRECT_URL

node scripts/bootstrap-payment-providers.cjs \
  && exec npm start
