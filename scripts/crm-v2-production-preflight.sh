#!/bin/bash
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
VPS="${VPS:?Set VPS, for example root@your-vps-host}"
SERVICE="${SERVICE:-maintainex-mx-vcaohy}"
REMOTE_BACKUPS="${REMOTE_BACKUPS:-/root/maintainex-backups}"
OUTPUT_DIR="${OUTPUT_DIR:-$HOME/maintainex-release}"
CONFIRM_DB_CREDENTIAL_ROTATED="${CONFIRM_DB_CREDENTIAL_ROTATED:-no}"

if [ "$CONFIRM_DB_CREDENTIAL_ROTATED" != "yes" ]; then
  echo "ERROR: database credential rotation must be completed first." >&2
  echo "Set CONFIRM_DB_CREDENTIAL_ROTATED=yes only after the exposed credential has been rotated and production DATABASE_URL updated." >&2
  exit 1
fi

SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=5)
mkdir -p "$OUTPUT_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
RECEIPT="$OUTPUT_DIR/crm-v2-preflight-$STAMP.txt"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

echo "MaintainEX CRM V2 production preflight"
echo "Service: $SERVICE"
echo

echo "=== 1/5 Verify service, current health and environment names ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' sh -s" <<'REMOTE' > "$tmp"
set -eu
docker service inspect "$SERVICE" >/dev/null

container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
if [ -z "$container" ]; then
  echo "ERROR|running production container not found"
  exit 1
fi

health=$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}')
user=$(docker inspect "$container" --format '{{.Config.User}}')
image=$(docker service inspect "$SERVICE" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')

env_names=$(docker service inspect "$SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | cut -d= -f1)
required='DATABASE_URL MARKETPLACE_JWT_SECRET STAFF_JWT_SECRET PASSWORD_PEPPER CRON_SECRET INTERNAL_SYNC_SECRET'
missing=''
for name in $required; do
  if ! printf '%s\n' "$env_names" | grep -qx "$name"; then
    missing="$missing $name"
  fi
done
if [ -n "$missing" ]; then
  echo "ERROR|required environment names missing:$missing"
  exit 1
fi

echo "IMAGE|$image"
echo "HEALTH|$health"
echo "USER|$user"
echo "ENV|ok"
REMOTE

cat "$tmp"
if grep -q '^ERROR|' "$tmp"; then
  exit 1
fi
CURRENT_IMAGE=$(awk -F'|' '$1=="IMAGE"{print $2}' "$tmp")
CURRENT_HEALTH=$(awk -F'|' '$1=="HEALTH"{print $2}' "$tmp")
CURRENT_USER=$(awk -F'|' '$1=="USER"{print $2}' "$tmp")
if [ "$CURRENT_HEALTH" != "healthy" ]; then
  echo "ERROR: current production container is not healthy." >&2
  exit 1
fi
if [ "$CURRENT_USER" = "0" ] || [ "$CURRENT_USER" = "root" ] || [ -z "$CURRENT_USER" ]; then
  echo "ERROR: current production container is not running as an explicit non-root user." >&2
  exit 1
fi

echo
echo "=== 2/5 Verify current production migrations ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' sh -s" <<'REMOTE'
set -eu
container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
test -n "$container"
docker exec "$container" npx prisma migrate status
REMOTE

echo
echo "=== 3/5 Create validated production database backup ==="
BACKUP_INFO=$("${SSH[@]}" "$VPS" "BACKUP_DIR='$REMOTE_BACKUPS' sh -s" <<'REMOTE'
set -eu
mkdir -p "$BACKUP_DIR"
DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'maintainex-db|dokploy-postgres' | head -1)
if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR|database container not found"
  exit 1
fi
stamp=$(date +%Y%m%d-%H%M%S)
backup="$BACKUP_DIR/maintainex-db-pre-merge-$stamp.sql.gz"
docker exec "$DB_CONTAINER" pg_dump -U postgres -d postgres --clean --if-exists | gzip -c > "$backup"
test -s "$backup"
gzip -t "$backup"
gzip -dc "$backup" | grep -q '_prisma_migrations'
size=$(wc -c < "$backup" | tr -d ' ')
echo "$backup|$size|$DB_CONTAINER"
REMOTE
)
if printf '%s' "$BACKUP_INFO" | grep -q '^ERROR|'; then
  echo "$BACKUP_INFO" >&2
  exit 1
fi
BACKUP_PATH=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f1)
BACKUP_SIZE=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f2)
DB_CONTAINER=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f3)
echo "Backup: $BACKUP_PATH"
echo "Size:   $BACKUP_SIZE bytes"

echo
echo "=== 4/5 Verify public liveness and protected readiness behavior ==="
curl -fsS https://maintainex.lk/api/health >/dev/null
READINESS_STATUS=$(curl -sS -o /dev/null -w '%{http_code}' https://maintainex.lk/api/internal/readiness)
if [ "$READINESS_STATUS" != "403" ]; then
  echo "ERROR: unauthenticated readiness endpoint should return 403, got $READINESS_STATUS." >&2
  exit 1
fi
echo "Public health: OK"
echo "Readiness auth boundary: OK"

echo
echo "=== 5/5 Write non-secret preflight receipt ==="
{
  echo "timestamp=$STAMP"
  echo "service=$SERVICE"
  echo "current_image=$CURRENT_IMAGE"
  echo "current_health=$CURRENT_HEALTH"
  echo "current_user=$CURRENT_USER"
  echo "required_env_names=ok"
  echo "db_container=$DB_CONTAINER"
  echo "backup_path=$BACKUP_PATH"
  echo "backup_size_bytes=$BACKUP_SIZE"
  echo "public_health=ok"
  echo "readiness_auth_boundary=ok"
  echo "db_credential_rotation_confirmed=yes"
} > "$RECEIPT"

chmod 600 "$RECEIPT"

echo
echo "========================================"
echo " PRE-MERGE PRODUCTION PREFLIGHT: PASS"
echo "========================================"
echo "Receipt:        $RECEIPT"
echo "Rollback image: $CURRENT_IMAGE"
echo "DB backup:      $BACKUP_PATH"
echo
echo "Do not paste the receipt if it contains infrastructure identifiers you do not want shared."
