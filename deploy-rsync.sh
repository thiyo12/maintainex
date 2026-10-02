#!/bin/bash
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
VPS="${VPS:?Set VPS, for example root@your-vps-host}"
SRC="${SRC:-$(pwd)}"
SERVICE="${SERVICE:-maintainex-mx-vcaohy}"
REMOTE_STAGING="${REMOTE_STAGING:-/root/maintainex-src}"
REMOTE_BACKUPS="${REMOTE_BACKUPS:-/root/maintainex-backups}"
RELEASE_SHA="${RELEASE_SHA:-$(git -C "$SRC" rev-parse HEAD)}"
SHORT_SHA="${RELEASE_SHA:0:12}"
IMAGE_REPO="${IMAGE_REPO:-maintainex-mx-vcaohy}"
RELEASE_IMAGE="${IMAGE_REPO}:release-${SHORT_SHA}"

echo "========================================"
echo " MaintainEX immutable release deployment"
echo "========================================"
echo "Release: $RELEASE_SHA"
echo "Service: $SERVICE"
echo "Image:   $RELEASE_IMAGE"
echo

if ! grep -q 'provider = "postgresql"' "$SRC/prisma/schema.prisma"; then
  echo "ERROR: prisma/schema.prisma must use PostgreSQL." >&2
  exit 1
fi

if ! git -C "$SRC" diff --quiet || ! git -C "$SRC" diff --cached --quiet; then
  echo "ERROR: local worktree is dirty; deploy a committed release only." >&2
  exit 1
fi

SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=5)
RSYNC_SSH="ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=5"

echo "=== 1/7 Verify production service and required environment names ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' sh -s" <<'REMOTE'
set -eu
docker service inspect "$SERVICE" >/dev/null
env_names=$(docker service inspect "$SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | cut -d= -f1)
required='DATABASE_URL MARKETPLACE_JWT_SECRET STAFF_JWT_SECRET PASSWORD_PEPPER CRON_SECRET INTERNAL_SYNC_SECRET'
missing=''
for name in $required; do
  if ! printf '%s\n' "$env_names" | grep -qx "$name"; then
    missing="$missing $name"
  fi
done
if [ -n "$missing" ]; then
  echo "ERROR: required production environment variables missing:$missing" >&2
  exit 1
fi
echo "Required production environment names: OK"
REMOTE

echo
echo "=== 2/7 Rsync committed source to isolated staging ==="
"${SSH[@]}" "$VPS" "mkdir -p '$REMOTE_STAGING' '$REMOTE_BACKUPS'"
rsync -av --delete --partial --compress --compress-level=6 --timeout=60 --stats \
  --exclude='.next/' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='apps/' \
  --exclude='tests/' \
  --exclude='docs/' \
  --exclude='*.tar.gz' \
  --exclude='*.dump' \
  --exclude='._*' \
  --exclude='.DS_Store' \
  --exclude='src-tauri/' \
  -e "$RSYNC_SSH" \
  "$SRC/" "$VPS:$REMOTE_STAGING/"

echo
echo "=== 3/7 Create and verify production database backup ==="
BACKUP_INFO=$("${SSH[@]}" "$VPS" "BACKUP_DIR='$REMOTE_BACKUPS' sh -s" <<'REMOTE'
set -eu
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'maintainex-db|dokploy-postgres' | head -1)
if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR: production PostgreSQL container not found" >&2
  exit 1
fi
stamp=$(date +%Y%m%d-%H%M%S)
backup="$BACKUP_DIR/maintainex-db-pre-release-$stamp.sql.gz"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --clean --if-exists | gzip -c > "$backup"
test -s "$backup"
gzip -t "$backup"
size=$(wc -c < "$backup" | tr -d ' ')
echo "$backup|$size|$DB_CONTAINER"
REMOTE
)
BACKUP_PATH=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f1)
BACKUP_SIZE=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f2)
echo "Backup verified: $BACKUP_PATH ($BACKUP_SIZE bytes)"

echo
echo "=== 4/7 Record rollback image and build new immutable image ==="
PREVIOUS_IMAGE=$("${SSH[@]}" "$VPS" "docker service inspect '$SERVICE' --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'")
echo "Rollback image: $PREVIOUS_IMAGE"
"${SSH[@]}" "$VPS" "cd '$REMOTE_STAGING' && docker build --pull -t '$RELEASE_IMAGE' ."

echo
echo "=== 5/7 Switch Swarm service to release image ==="
set +e
"${SSH[@]}" "$VPS" "docker service update --force --image '$RELEASE_IMAGE' '$SERVICE'"
UPDATE_EXIT=$?
set -e
if [ "$UPDATE_EXIT" -ne 0 ]; then
  echo "ERROR: Swarm update failed. Rolling back application image." >&2
  "${SSH[@]}" "$VPS" "docker service update --force --image '$PREVIOUS_IMAGE' '$SERVICE'" || true
  exit "$UPDATE_EXIT"
fi

echo
echo "=== 6/7 Verify task, Docker health and public liveness ==="
set +e
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' sh -s" <<'REMOTE'
set -eu
attempt=0
while [ "$attempt" -lt 24 ]; do
  attempt=$((attempt + 1))
  task=$(docker service ps "$SERVICE" --filter desired-state=running --format '{{.ID}}|{{.CurrentState}}|{{.Error}}' | head -1)
  echo "Task: $task"
  container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
  if [ -n "$container" ]; then
    status=$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}')
    user=$(docker inspect "$container" --format '{{.Config.User}}')
    echo "Container health: $status"
    echo "Container user: $user"
    if [ "$status" = "healthy" ] && [ "$user" != "0" ] && [ "$user" != "root" ] && [ -n "$user" ]; then
      exit 0
    fi
  fi
  sleep 5
done
exit 1
REMOTE
VERIFY_EXIT=$?
if [ "$VERIFY_EXIT" -eq 0 ]; then
  curl -fsS https://maintainex.lk/api/health >/dev/null
  PUBLIC_EXIT=$?
else
  PUBLIC_EXIT=1
fi
set -e

if [ "$VERIFY_EXIT" -ne 0 ] || [ "$PUBLIC_EXIT" -ne 0 ]; then
  echo "ERROR: release health verification failed. Rolling back application image." >&2
  "${SSH[@]}" "$VPS" "docker service update --force --image '$PREVIOUS_IMAGE' '$SERVICE'" || true
  echo "Database backup retained at: $BACKUP_PATH" >&2
  exit 1
fi

echo
echo "=== 7/7 Verify migrations/readiness from the new container ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' sh -s" <<'REMOTE'
set -eu
container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
test -n "$container"
docker exec "$container" npx prisma migrate status
docker exec "$container" sh -c 'test "$(id -u)" != "0"'
REMOTE

echo
echo "========================================"
echo " RELEASE SWITCH COMPLETE"
echo "========================================"
echo "Release SHA:    $RELEASE_SHA"
echo "Release image:  $RELEASE_IMAGE"
echo "Rollback image: $PREVIOUS_IMAGE"
echo "DB backup:      $BACKUP_PATH"
echo
echo "Next: run the authenticated CRM/mobile/public smoke checklist before marking the release complete."
