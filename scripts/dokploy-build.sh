#!/usr/bin/env sh
set -eu

# Dokploy build command. The CI-provided SHA is preferred; when Dokploy does
# not provide it, derive the immutable commit identity from its checked-out repo.
if [ -z "${GIT_SHA:-}" ]; then
  GIT_SHA=$(git rev-parse HEAD 2>/dev/null || true)
fi

if ! printf '%s' "$GIT_SHA" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "ERROR: cannot determine full commit SHA; configure GIT_SHA in Dokploy" >&2
  exit 1
fi

exec docker build --build-arg "GIT_SHA=$GIT_SHA" -t "${IMAGE_TAG:-maintainex:$GIT_SHA}" .
