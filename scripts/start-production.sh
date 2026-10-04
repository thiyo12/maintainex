#!/bin/sh
# Production container entrypoint.
#
# Release-identity rule (Phase: release provenance):
# the baked /app/.release-sha written at image build time is the source of
# truth for the code actually inside this image. A stale ambient
# APP_RELEASE_SHA (e.g. left over in the deployment environment from an older
# release) must never mislabel the running code, so the baked value wins and
# the mismatch is logged loudly. Nothing secret is printed here.
set -eu

BAKED_FILE="/app/.release-sha"
BAKED_SHA=""

if [ -f "$BAKED_FILE" ]; then
  BAKED_SHA="$(tr -d ' \t\r\n' < "$BAKED_FILE" 2>/dev/null || true)"
  case "$BAKED_SHA" in
    ''|*[!0-9a-f]*)
      echo "[release] WARNING: baked release SHA is missing or malformed; keeping environment value" >&2
      BAKED_SHA=""
      ;;
    *)
      if [ "${#BAKED_SHA}" -ne 40 ]; then
        echo "[release] WARNING: baked release SHA has unexpected length; keeping environment value" >&2
        BAKED_SHA=""
      fi
      ;;
  esac
fi

if [ -n "$BAKED_SHA" ]; then
  if [ "${APP_RELEASE_SHA:-}" != "$BAKED_SHA" ]; then
    echo "[release] WARNING: ambient APP_RELEASE_SHA does not match image content; using baked image SHA" >&2
  fi
  APP_RELEASE_SHA="$BAKED_SHA"
  export APP_RELEASE_SHA
fi

echo "[release] starting ${APP_RELEASE_SHA:-unknown}"

npx prisma migrate deploy \
  && node scripts/bootstrap-payment-providers.cjs \
  && exec npm start
