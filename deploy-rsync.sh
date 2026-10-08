#!/bin/bash
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
VPS="${VPS:?Set VPS, for example root@your-vps-host}"
SRC="${SRC:-$(pwd)}"
SERVICE="${SERVICE:-maintainex-mx-vcaohy}"
REMOTE_STAGING="${REMOTE_STAGING:-/root/maintainex-src}"
REMOTE_BACKUPS="${REMOTE_BACKUPS:-/root/maintainex-backups}"
REMOTE_BACKUP_ENCRYPTION_KEY_FILE="${REMOTE_BACKUP_ENCRYPTION_KEY_FILE:-/root/.maintainex-backup.key}"
RELEASE_SHA="${RELEASE_SHA:-$(git -C "$SRC" rev-parse HEAD)}"
SHORT_SHA="${RELEASE_SHA:0:12}"
IMAGE_REPO="${IMAGE_REPO:-maintainex-mx-vcaohy}"
RELEASE_IMAGE="${IMAGE_REPO}:release-${SHORT_SHA}"
ALLOW_PAYPAL_SANDBOX_SMOKE="${ALLOW_PAYPAL_SANDBOX_SMOKE:-false}"
ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="${ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP:-false}"
# Comma-separated allowlist of production releases that cannot complete
# first-time super-admin MFA enrollment on their own.
PRE_ENROLLMENT_RELEASE_SHAS="${PRE_ENROLLMENT_RELEASE_SHAS:-7c526b9401cc46b2c115006992e35735038719da,d8e3bfafa980f7b4e7710cdafbe213510ddb069e,3b096e18c194c4b35b7fc83a34b02c07eec305db}"

echo "========================================"
echo " MaintainEX immutable release deployment"
echo "========================================"
echo "Release: $RELEASE_SHA"
echo "Service: $SERVICE"
echo "Image:   $RELEASE_IMAGE"
echo

if ! printf '%s' "$RELEASE_SHA" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "ERROR: RELEASE_SHA must be a full 40-character lowercase git SHA." >&2
  exit 1
fi

if ! grep -q 'provider = "postgresql"' "$SRC/prisma/schema.prisma"; then
  echo "ERROR: prisma/schema.prisma must use PostgreSQL." >&2
  exit 1
fi

if ! git -C "$SRC" diff --quiet || ! git -C "$SRC" diff --cached --quiet; then
  echo "ERROR: local worktree is dirty; deploy a committed release only." >&2
  exit 1
fi

if [ "$(git -C "$SRC" rev-parse HEAD)" != "$RELEASE_SHA" ]; then
  echo "ERROR: RELEASE_SHA must match the checked-out committed HEAD." >&2
  exit 1
fi

SSH=(ssh -i "$SSH_KEY" -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=5)
RSYNC_SSH="ssh -i $SSH_KEY -o BatchMode=yes -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=5"

echo "=== 1/7 Verify production service and safe environment modes ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' ALLOW_PAYPAL_SANDBOX_SMOKE='$ALLOW_PAYPAL_SANDBOX_SMOKE' ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP='$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP' PRE_ENROLLMENT_RELEASE_SHAS='$PRE_ENROLLMENT_RELEASE_SHAS' sh -s" <<'REMOTE'
set -eu
ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="${ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP:-false}"
PRE_ENROLLMENT_RELEASE_SHAS="${PRE_ENROLLMENT_RELEASE_SHAS:-}"

docker service inspect "$SERVICE" >/dev/null
service_env=$(docker service inspect "$SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}')
env_names=$(printf '%s\n' "$service_env" | cut -d= -f1)
required='DATABASE_URL MARKETPLACE_JWT_SECRET STAFF_JWT_SECRET PASSWORD_PEPPER IDENTITY_CLAIM_PEPPER CRON_SECRET INTERNAL_SYNC_SECRET TRUSTED_PROXY_MODE'
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

env_value() {
  name="$1"
  printf '%s\n' "$service_env" | sed -n "s/^$name=//p" | head -1
}

if [ "$(env_value ALLOW_TEST_OTP)" = "true" ]; then
  echo "ERROR: ALLOW_TEST_OTP must be disabled in production" >&2
  exit 1
fi

if [ "$(env_value TRUSTED_PROXY_MODE)" != "cloudflare" ]; then
  echo "ERROR: TRUSTED_PROXY_MODE must be cloudflare for the current production edge topology" >&2
  exit 1
fi

paypal_configured=''
for name in PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET PAYPAL_WEBHOOK_ID; do
  if printf '%s\n' "$env_names" | grep -qx "$name"; then
    paypal_configured=yes
  fi
done
if [ -n "$paypal_configured" ]; then
  for name in PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET PAYPAL_WEBHOOK_ID; do
    if ! printf '%s\n' "$env_names" | grep -qx "$name"; then
      echo "ERROR: incomplete PayPal production configuration" >&2
      exit 1
    fi
  done
  if [ "$(env_value PAYPAL_SANDBOX)" != "false" ]; then
    if [ "$ALLOW_PAYPAL_SANDBOX_SMOKE" = "true" ]; then
      echo "WARNING: PayPal sandbox explicitly authorized for controlled production smoke testing" >&2
    else
      echo "ERROR: PayPal production configuration must explicitly disable sandbox" >&2
      exit 1
    fi
  fi
fi

payhere_configured=''
for name in PAYHERE_MERCHANT_ID PAYHERE_MERCHANT_SECRET PAYHERE_APP_ID PAYHERE_APP_SECRET; do
  if printf '%s\n' "$env_names" | grep -qx "$name"; then
    payhere_configured=yes
  fi
done
if [ -n "$payhere_configured" ]; then
  for name in PAYHERE_MERCHANT_ID PAYHERE_MERCHANT_SECRET PAYHERE_APP_ID PAYHERE_APP_SECRET; do
    if ! printf '%s\n' "$env_names" | grep -qx "$name"; then
      echo "ERROR: incomplete PayHere reconciliation configuration" >&2
      exit 1
    fi
  done
  if [ "$(env_value PAYHERE_SANDBOX)" != "false" ]; then
    echo "ERROR: PayHere production reconciliation configuration must explicitly disable sandbox" >&2
    exit 1
  fi
fi

service_mounts=$(docker service inspect "$SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Mounts}}{{println .Source "->" .Target}}{{end}}')
for want in "/var/lib/maintainex/public-uploads -> /app/public/uploads" "/var/lib/maintainex/private-uploads -> /app/uploads"; do
  if ! printf '%s\n' "$service_mounts" | grep -qxF "$want"; then
    echo "ERROR: required production upload mount missing: $want (uploads must not live on container overlay)" >&2
    exit 1
  fi
done

container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
if [ -z "$container" ]; then
  echo "ERROR: running application container not found" >&2
  exit 1
fi

SUPER_ADMIN_MFA_STATE=$(docker exec "$container" node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
Promise.all([
  prisma.adminUser.count({
    where: {
      role: "SUPER_ADMIN",
      isActive: true,
      deletedAt: null,
      OR: [{ totpEnabled: false }, { totpSecret: null }],
    },
  }),
  prisma.adminUser.count({ where: { role: "SUPER_ADMIN", isActive: true } }),
  prisma.adminUser.count({ where: { role: "SUPER_ADMIN", isActive: true, email: { endsWith: "@test.com" } } }),
  prisma.adminUser.count({ where: { role: "SUPER_ADMIN", isActive: false, email: { endsWith: "@test.com" } } }),
  prisma.adminUser.count({ where: { role: "SUPER_ADMIN", isActive: false, email: { endsWith: "@maintainex.lk" } } }),
]).then(([missing, activeSuperAdmins, activeTestSeed, inactiveTestSeed, inactiveStaffSuperAdmin]) => {
  process.stdout.write(
    [missing, activeSuperAdmins, activeTestSeed, inactiveTestSeed, inactiveStaffSuperAdmin].join("|")
  );
}).finally(() => prisma.$disconnect());
')
SUPER_ADMIN_MFA_MISSING=$(printf '%s' "$SUPER_ADMIN_MFA_STATE" | cut -d'|' -f1)
if [ "$SUPER_ADMIN_MFA_MISSING" != "0" ]; then
  if [ "$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP" = "true" ]; then
    # One-time bootstrap only. The legacy release cannot complete enrollment,
    # so the single remaining owner must enroll immediately after this upgrade.
    # Every condition must hold or this fails closed.
    IFS='|' read -r _bs_missing MFA_ACTIVE_SA MFA_ACTIVE_TEST_SEED MFA_INACTIVE_TEST_SEED MFA_INACTIVE_STAFF_SA <<EOF
$SUPER_ADMIN_MFA_STATE
EOF
    deployed_sha=$(env_value APP_RELEASE_SHA)
    bootstrap_ok=1
    [ "$MFA_ACTIVE_SA" = "1" ] || bootstrap_ok=0
    [ "$MFA_ACTIVE_TEST_SEED" = "0" ] || bootstrap_ok=0
    [ "$MFA_INACTIVE_TEST_SEED" -ge 18 ] || bootstrap_ok=0
    [ "$MFA_INACTIVE_STAFF_SA" -ge 1 ] || bootstrap_ok=0
    case ",$PRE_ENROLLMENT_RELEASE_SHAS," in *",$deployed_sha,"*) ;; *) bootstrap_ok=0 ;; esac
    if [ "$bootstrap_ok" != "1" ]; then
      echo "ERROR|initial owner MFA bootstrap conditions not satisfied (activeSA=$MFA_ACTIVE_SA activeTestSeed=$MFA_ACTIVE_TEST_SEED inactiveTestSeed=$MFA_INACTIVE_TEST_SEED inactiveStaff=$MFA_INACTIVE_STAFF_SA deployed=$deployed_sha)" >&2
      exit 1
    fi
    echo "LEGACY_RELEASE_BOOTSTRAP|authorized-once"
  else
    echo "ERROR: active SUPER_ADMIN account is missing required MFA enrollment" >&2
    exit 1
  fi
fi

echo "Production environment modes: OK"
echo "Super-admin MFA readiness: OK"
REMOTE

echo
echo "=== 2/7 Rsync committed source to isolated staging ==="
"${SSH[@]}" "$VPS" "mkdir -p '$REMOTE_STAGING' '$REMOTE_BACKUPS' && chmod 700 '$REMOTE_BACKUPS'"
rsync -av --delete --partial --compress --compress-level=6 --timeout=60 --stats \
  --exclude='.next/' \
  --exclude='node_modules/' \
  --exclude='.git/' \
  --exclude='apps/mobile/.expo/' \
  --exclude='tests/' \
  --exclude='docs/' \
  --exclude='.env' \
  --exclude='.env.*' \
  --exclude='.npmrc' \
  --exclude='.netrc' \
  --exclude='secrets/' \
  --exclude='credentials/' \
  --exclude='id_rsa*' \
  --exclude='id_ed25519*' \
  --exclude='*.key' \
  --exclude='*.p8' \
  --exclude='*.p12' \
  --exclude='*.pfx' \
  --exclude='*.ppk' \
  --exclude='*.dump' \
  --exclude='*.backup' \
  --exclude='*.sql.gz' \
  --exclude='*.tar.gz' \
  --exclude='*.zip' \
  --exclude='backups/' \
  --exclude='backup/' \
  --exclude='maintainex-backup/' \
  --exclude='envs/' \
  --exclude='.terraform/' \
  --exclude='*.tfstate' \
  --exclude='*.tfstate.*' \
  --exclude='._*' \
  --exclude='.DS_Store' \
  --exclude='src-tauri/' \
  -e "$RSYNC_SSH" \
  "$SRC/" "$VPS:$REMOTE_STAGING/"

echo
echo "=== 3/7 Create encrypted and verified production database backup ==="
BACKUP_INFO=$("${SSH[@]}" "$VPS" "SERVICE='$SERVICE' BACKUP_DIR='$REMOTE_BACKUPS' BACKUP_KEY_FILE='$REMOTE_BACKUP_ENCRYPTION_KEY_FILE' sh -s" <<'REMOTE'
set -eu
umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

if [ ! -s "$BACKUP_KEY_FILE" ]; then
  echo "ERROR|remote backup encryption key file is missing or empty"
  exit 1
fi
if ! command -v openssl >/dev/null 2>&1; then
  echo "ERROR|openssl is required for encrypted deployment backups"
  exit 1
fi

APP_CONTAINER=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
if [ -z "$APP_CONTAINER" ]; then
  echo "ERROR|running application container not found"
  exit 1
fi

DB_META=$(docker exec "$APP_CONTAINER" node -e '
const raw = process.env.DATABASE_URL;
if (!raw) process.exit(2);
const u = new URL(raw);
const user = decodeURIComponent(u.username || "");
const path = u.pathname || "";
const name = decodeURIComponent(path.startsWith("/") ? path.slice(1) : path);
const host = u.hostname || "";
if (!user || !name || !host) process.exit(3);
process.stdout.write([user, name, host].join("|"));
')
if [ -z "$DB_META" ]; then
  echo "ERROR|could not derive production database identity from application DATABASE_URL"
  exit 1
fi

DB_USER=$(printf '%s' "$DB_META" | cut -d'|' -f1)
DB_NAME=$(printf '%s' "$DB_META" | cut -d'|' -f2)
DB_HOST=$(printf '%s' "$DB_META" | cut -d'|' -f3)

DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -F "$DB_HOST" | head -1 || true)
if [ -z "$DB_CONTAINER" ]; then
  DB_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E 'maintainex-db|dokploy-postgres' | head -1 || true)
fi
if [ -z "$DB_CONTAINER" ]; then
  echo "ERROR|production PostgreSQL container not found"
  exit 1
fi

LIVE_DB=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -Atqc 'SELECT current_database()')
if [ "$LIVE_DB" != "$DB_NAME" ]; then
  echo "ERROR|database identity mismatch"
  exit 1
fi

LIVE_TABLES=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -Atqc "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public'")
if [ -z "$LIVE_TABLES" ] || [ "$LIVE_TABLES" -le 0 ]; then
  echo "ERROR|live production database has no public tables"
  exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
backup="$BACKUP_DIR/maintainex-db-pre-release-$stamp.sql.gz.enc"

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists \
  | gzip -c \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 200000 -out "$backup" -pass file:"$BACKUP_KEY_FILE"

test -s "$backup"
chmod 600 "$backup"

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$backup" -pass file:"$BACKUP_KEY_FILE" \
  | gzip -t

openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$backup" -pass file:"$BACKUP_KEY_FILE" \
  | gzip -dc \
  | grep -q '_prisma_migrations'

BACKUP_TABLES=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in "$backup" -pass file:"$BACKUP_KEY_FILE" \
  | gzip -dc \
  | grep -c '^CREATE TABLE public\.' || true)
if [ "$BACKUP_TABLES" -ne "$LIVE_TABLES" ]; then
  echo "ERROR|backup table count mismatch live=$LIVE_TABLES backup=$BACKUP_TABLES"
  exit 1
fi

size=$(wc -c < "$backup" | tr -d ' ')
echo "$backup|$size|$DB_CONTAINER|$DB_NAME|$LIVE_TABLES"
REMOTE
)

if printf '%s' "$BACKUP_INFO" | grep -q '^ERROR|'; then
  echo "$BACKUP_INFO" >&2
  exit 1
fi

BACKUP_PATH=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f1)
BACKUP_SIZE=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f2)
DB_CONTAINER=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f3)
DB_NAME=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f4)
DB_TABLES=$(printf '%s' "$BACKUP_INFO" | cut -d'|' -f5)

echo "Encrypted backup: $BACKUP_PATH"
echo "Database:         $DB_NAME"
echo "Tables:           $DB_TABLES"
echo "Size:             $BACKUP_SIZE bytes"

echo
echo "=== 4/7 Record rollback image and build new immutable image ==="
PREVIOUS_IMAGE=$("${SSH[@]}" "$VPS" "docker service inspect '$SERVICE' --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}'")
PREVIOUS_RELEASE_SHA=$("${SSH[@]}" "$VPS" "docker service inspect '$SERVICE' --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | sed -n 's/^APP_RELEASE_SHA=//p' | head -1")
echo "Rollback image: $PREVIOUS_IMAGE"
echo "Previous release SHA: ${PREVIOUS_RELEASE_SHA:-unknown}"

rollback_release() {
  if [ -n "$PREVIOUS_RELEASE_SHA" ]; then
    "${SSH[@]}" "$VPS" "docker service update --force --env-add APP_RELEASE_SHA='$PREVIOUS_RELEASE_SHA' --image '$PREVIOUS_IMAGE' '$SERVICE'" || true
  else
    "${SSH[@]}" "$VPS" "docker service update --force --env-rm APP_RELEASE_SHA --image '$PREVIOUS_IMAGE' '$SERVICE'" || true
  fi
}

"${SSH[@]}" "$VPS" "cd '$REMOTE_STAGING' && docker build --pull --build-arg GIT_SHA='$RELEASE_SHA' -t '$RELEASE_IMAGE' ."

echo
echo "=== 5/7 Switch Swarm service to release image ==="
set +e
"${SSH[@]}" "$VPS" "docker service update --force --env-add APP_RELEASE_SHA='$RELEASE_SHA' --image '$RELEASE_IMAGE' '$SERVICE'"
UPDATE_EXIT=$?
set -e
if [ "$UPDATE_EXIT" -ne 0 ]; then
  echo "ERROR: Swarm update failed. Rolling back application image." >&2
  rollback_release
  exit "$UPDATE_EXIT"
fi

echo
echo "=== 6/7 Verify task, Docker health and public release identity ==="
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
  HEALTH_JSON=$(curl -fsS https://maintainex.lk/api/health)
  printf '%s' "$HEALTH_JSON" | grep -q '"status":"healthy"'
  printf '%s' "$HEALTH_JSON" | grep -q "\"release\":\"$RELEASE_SHA\""
  printf '%s' "$HEALTH_JSON" | grep -q '"testOtpMode":"disabled"'
  PUBLIC_EXIT=$?
else
  PUBLIC_EXIT=1
fi
set -e

if [ "$VERIFY_EXIT" -ne 0 ] || [ "$PUBLIC_EXIT" -ne 0 ]; then
  echo "ERROR: release health/identity verification failed. Rolling back application image." >&2
  rollback_release
  echo "Encrypted database backup retained at: $BACKUP_PATH" >&2
  exit 1
fi

echo
echo "=== 7/7 Verify migrations, runtime user and release identity from the new container ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' EXPECTED_RELEASE_SHA='$RELEASE_SHA' sh -s" <<'REMOTE'
set -eu
container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
test -n "$container"
docker exec "$container" npx prisma migrate status
docker exec "$container" sh -c 'test "$(id -u)" != "0"'
test "$(docker exec "$container" sh -c 'printf %s "$APP_RELEASE_SHA"')" = "$EXPECTED_RELEASE_SHA"
REMOTE

echo
echo "========================================"
echo " RELEASE SWITCH COMPLETE"
echo "========================================"
echo "Release SHA:      $RELEASE_SHA"
echo "Release image:    $RELEASE_IMAGE"
echo "Rollback image:   $PREVIOUS_IMAGE"
echo "Encrypted DB backup: $BACKUP_PATH"
echo
echo "Next: run the authenticated CRM/mobile/public smoke checklist before marking the release complete."
