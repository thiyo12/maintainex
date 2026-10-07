# Release-identity gate for production startup.
#
# Intended usage: `. ./scripts/require-release-sha.sh` from
# scripts/start-production.sh. On success it exports APP_RELEASE_SHA set to
# the baked image SHA. On any problem it returns/exits non-zero WITHOUT
# falling back to an ambient value, so a container can never start while
# mislabelled.
#
# Test override (CI/unit only): RELEASE_SHA_FILE may point at a fixture file
# instead of /app/.release-sha. Nothing secret is printed here.
RELEASE_SHA_FILE="${RELEASE_SHA_FILE:-/app/.release-sha}"

_baked_sha=""
if [ -f "$RELEASE_SHA_FILE" ]; then
  _baked_sha="$(tr -d ' \t\r\n' < "$RELEASE_SHA_FILE" 2>/dev/null || true)"
fi

_had_baked=0
if [ -n "$_baked_sha" ]; then
  _had_baked=1
fi

_release_ok=0
if [ "$_had_baked" -eq 1 ] && [ "${#_baked_sha}" -eq 40 ]; then
  case "$_baked_sha" in
    ''|*[!0-9a-f]*)
      _release_ok=0
      ;;
    *)
      _release_ok=1
      ;;
  esac
fi

if [ "$_release_ok" -ne 1 ]; then
  echo "[release] FATAL: $RELEASE_SHA_FILE is missing or is not exactly 40 lowercase hex characters; refusing to start" >&2
  unset _baked_sha _had_baked _release_ok
  return 1 2>/dev/null || exit 1
fi

if [ -n "${APP_RELEASE_SHA:-}" ] && [ "$APP_RELEASE_SHA" != "$_baked_sha" ]; then
  echo "[release] WARNING: ambient APP_RELEASE_SHA disagrees with baked image SHA; using baked image SHA" >&2
fi

APP_RELEASE_SHA="$_baked_sha"
export APP_RELEASE_SHA
unset _baked_sha _had_baked _release_ok
