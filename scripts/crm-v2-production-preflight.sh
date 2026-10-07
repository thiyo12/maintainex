#!/bin/bash
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
VPS="${VPS:?Set VPS, for example root@your-vps-host}"
SERVICE="${SERVICE:-maintainex-mx-vcaohy}"
REMOTE_BACKUPS="${REMOTE_BACKUPS:-/root/maintainex-backups}"
OUTPUT_DIR="${OUTPUT_DIR:-$HOME/maintainex-release}"
CONFIRM_DB_CREDENTIAL_ROTATED="${CONFIRM_DB_CREDENTIAL_ROTATED:-no}"
ALLOW_PAYPAL_SANDBOX_SMOKE="${ALLOW_PAYPAL_SANDBOX_SMOKE:-false}"
ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP="${ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP:-false}"
LEGACY_BOOTSTRAP_RELEASE_SHA="${LEGACY_BOOTSTRAP_RELEASE_SHA:-7c526b9401cc46b2c115006992e35735038719da}"

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

echo "=== 1/5 Verify service, current health, release identity and safe environment modes ==="
"${SSH[@]}" "$VPS" "SERVICE='$SERVICE' ALLOW_PAYPAL_SANDBOX_SMOKE='$ALLOW_PAYPAL_SANDBOX_SMOKE' ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP='$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP' LEGACY_BOOTSTRAP_RELEASE_SHA='$LEGACY_BOOTSTRAP_RELEASE_SHA' sh -s" <<'REMOTE' > "$tmp"
set -eu
PAYPALMODE=''

docker service inspect "$SERVICE" >/dev/null

container=$(docker ps --filter "name=$SERVICE" --format '{{.ID}}' | head -1)
if [ -z "$container" ]; then
  echo "ERROR|running production container not found"
  exit 1
fi

health=$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}')
user=$(docker inspect "$container" --format '{{.Config.User}}')
image=$(docker service inspect "$SERVICE" --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}')
service_env=$(docker service inspect "$SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}')
env_names=$(printf '%s\n' "$service_env" | cut -d= -f1)

required='DATABASE_URL MARKETPLACE_JWT_SECRET STAFF_JWT_SECRET PASSWORD_PEPPER IDENTITY_CLAIM_PEPPER CRON_SECRET INTERNAL_SYNC_SECRET APP_RELEASE_SHA TRUSTED_PROXY_MODE'
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

env_value() {
  name="$1"
  printf '%s\n' "$service_env" | sed -n "s/^$name=//p" | head -1
}

if [ "$(env_value ALLOW_TEST_OTP)" = "true" ]; then
  echo "ERROR|ALLOW_TEST_OTP must be disabled in production"
  exit 1
fi

if [ "$(env_value TRUSTED_PROXY_MODE)" != "cloudflare" ]; then
  echo "ERROR|TRUSTED_PROXY_MODE must be cloudflare for the current production edge topology"
  exit 1
fi

# Online payment providers must be either fully configured or intentionally
# absent. A partial credential set is always a configuration error.
paypal_present=0
for name in PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET PAYPAL_WEBHOOK_ID; do
  if printf '%s\n' "$env_names" | grep -qx "$name"; then
    paypal_present=1
  fi
done

if [ "$paypal_present" = "0" ]; then
  PAYPALMODE='disabled'
  echo "PAYPALMODE|$PAYPALMODE"
else
  for name in PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET PAYPAL_WEBHOOK_ID; do
    if ! printf '%s\n' "$env_names" | grep -qx "$name"; then
      echo "ERROR|incomplete PayPal production configuration"
      exit 1
    fi
  done
  if [ "$(env_value PAYPAL_SANDBOX)" != "false" ]; then
    if [ "$ALLOW_PAYPAL_SANDBOX_SMOKE" = "true" ]; then
      PAYPALMODE='sandbox-smoke-authorized'
      echo "PAYPALMODE|$PAYPALMODE"
    else
      echo "ERROR|PayPal production configuration must explicitly disable sandbox"
      exit 1
    fi
  else
    PAYPALMODE='live'
    echo "PAYPALMODE|$PAYPALMODE"
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
      echo "ERROR|incomplete PayHere reconciliation configuration"
      exit 1
    fi
  done
  if [ "$(env_value PAYHERE_SANDBOX)" != "false" ]; then
    echo "ERROR|PayHere production reconciliation configuration must explicitly disable sandbox"
    exit 1
  fi
fi


MFA_STATE=$(docker exec "$container" node -e '
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

IFS='|' read -r MFA_MISSING MFA_ACTIVE_SA MFA_ACTIVE_TEST_SEED MFA_INACTIVE_TEST_SEED MFA_INACTIVE_STAFF_SA <<EOF
$MFA_STATE
EOF
SUPER_ADMIN_MFA_MISSING=$MFA_MISSING

if [ "$SUPER_ADMIN_MFA_MISSING" != "0" ]; then
  if [ "$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP" = "true" ]; then
    # One-time bootstrap only. The currently deployed legacy release cannot
    # complete enrollment, so the single remaining owner must enroll
    # immediately after the upgrade. Every condition must hold or fail closed.
    bootstrap_deployed_sha=$(env_value APP_RELEASE_SHA)
    bootstrap_ok=1
    [ "$MFA_ACTIVE_SA" = "1" ] || bootstrap_ok=0
    [ "$MFA_ACTIVE_TEST_SEED" = "0" ] || bootstrap_ok=0
    [ "$MFA_INACTIVE_TEST_SEED" -ge 18 ] || bootstrap_ok=0
    [ "$MFA_INACTIVE_STAFF_SA" -ge 1 ] || bootstrap_ok=0
    [ "$bootstrap_deployed_sha" = "7c526b9401cc46b2c115006992e35735038719da" ] || bootstrap_ok=0
    if [ "$bootstrap_ok" != "1" ]; then
      echo "ERROR|initial owner MFA bootstrap conditions not satisfied (activeSA=$MFA_ACTIVE_SA activeTestSeed=$MFA_ACTIVE_TEST_SEED inactiveTestSeed=$MFA_INACTIVE_TEST_SEED inactiveStaff=$MFA_INACTIVE_STAFF_SA deployed=$bootstrap_deployed_sha)"
      exit 1
    fi
    echo "MFA_BOOTSTRAP|authorized-once-for-single-unenrolled-owner"
  else
    echo "ERROR|active SUPER_ADMIN account is missing required MFA enrollment"
    exit 1
  fi
fi

release_sha=$(env_value APP_RELEASE_SHA)
if [ -z "$release_sha" ]; then
  echo "ERROR|APP_RELEASE_SHA is required"
  exit 1
elif [ ${#release_sha} -ne 40 ] || ! printf '%s' "$release_sha" | grep -Eq '^[0-9a-f]{40}$'; then
  echo "ERROR|APP_RELEASE_SHA must be a lowercase 40-character git SHA"
  exit 1
fi

# Legacy release identity bootstrap. The pre-hardening release ran a mutable
# image tag with no baked release SHA, so these two checks can never pass until
# a hardened release is deployed. They may be skipped ONCE, only for the exact
# legacy release, only when the already-established MFA bootstrap conditions
# all hold and PayPal sandbox smoke was explicitly authorized.
legacy_release_bootstrap=''
if [ "$ALLOW_INITIAL_OWNER_MFA_BOOTSTRAP" = "true" ] \
  && { [ "$PAYPALMODE" = "sandbox-smoke-authorized" ] || [ "$PAYPALMODE" = "disabled" ]; }; then
  if [ "$SUPER_ADMIN_MFA_MISSING" != "0" ] \
    && [ "$MFA_ACTIVE_SA" = "1" ] \
    && [ "$MFA_ACTIVE_TEST_SEED" = "0" ] \
    && [ "$MFA_INACTIVE_TEST_SEED" -ge 18 ] \
    && [ "$MFA_INACTIVE_STAFF_SA" -ge 1 ] \
    && [ "$release_sha" = "$LEGACY_BOOTSTRAP_RELEASE_SHA" ]; then
    legacy_release_bootstrap='authorized-once'
    echo "LEGACY_RELEASE_BOOTSTRAP|authorized-once"
  fi
fi

if [ -z "$legacy_release_bootstrap" ]; then
  short_release=$(printf '%s' "$release_sha" | cut -c1-12)
  case "$image" in
    *"release-$short_release"*) ;;
    *)
      echo "ERROR|release SHA does not match immutable image tag"
      exit 1
      ;;
  esac
  baked_sha=$(docker exec "$container" cat /app/.release-sha 2>/dev/null | tr -d ' \t\r\n' || true)
  if [ -n "$baked_sha" ]; then
    if ! printf '%s' "$baked_sha" | grep -Eq '^[0-9a-f]{40}$'; then
      echo "ERROR|baked release SHA is malformed"
      exit 1
    fi
    if [ "$release_sha" != "$baked_sha" ]; then
      echo "ERROR|service APP_RELEASE_SHA does not match baked image SHA"
      exit 1
    fi
  fi
fi
echo "IMAGE|$image"
echo "RELEASE|$release_sha"
echo "HEALTH|$health"
echo "USER|$user"
echo "ENV|ok"
REMOTE

cat "$tmp"
if grep -q '^ERROR|' "$tmp"; then
  exit 1
fi

CURRENT_IMAGE=$(awk -F'|' '$1=="IMAGE"{print $2}' "$tmp")
CURRENT_RELEASE_SHA=$(awk -F'|' '$1=="RELEASE"{print $2}' "$tmp")
CURRENT_HEALTH=$(awk -F'|' '$1=="HEALTH"{print $2}' "$tmp")
CURRENT_USER=$(awk -F'|' '$1=="USER"{print $2}' "$tmp")
PAYPALMODE=$(awk -F'|' '$1=="PAYPALMODE"{print $2}' "$tmp")
MFA_BOOTSTRAP_MODE=$(awk -F'|' '$1=="MFA_BOOTSTRAP"{print $2}' "$tmp")
[ -n "$MFA_BOOTSTRAP_MODE" ] || MFA_BOOTSTRAP_MODE=not-authorized

if [ "$PAYPALMODE" = "sandbox-smoke-authorized" ]; then
  echo "PayPal sandbox explicitly authorized for controlled production smoke testing"
elif [ "$PAYPALMODE" != "live" ]; then
  echo "ERROR: PayPal production mode could not be determined." >&2
  exit 1
fi

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
BACKUP_INFO=$("${SSH[@]}" "$VPS" "SERVICE='$SERVICE' BACKUP_DIR='$REMOTE_BACKUPS' sh -s" <<'REMOTE'
set -eu
umask 077
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

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
backup="$BACKUP_DIR/maintainex-db-pre-merge-$stamp.sql.gz"
docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip -c > "$backup"
chmod 600 "$backup"
test -s "$backup"
gzip -t "$backup"
gzip -dc "$backup" | grep -q '_prisma_migrations'
BACKUP_TABLES=$(gzip -dc "$backup" | grep -c '^CREATE TABLE public\.' || true)
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

echo "Backup: $BACKUP_PATH"
echo "Database: $DB_NAME"
echo "Tables:   $DB_TABLES"
echo "Size:     $BACKUP_SIZE bytes"

echo
echo "=== 4/5 Verify public liveness and protected readiness behavior ==="
HEALTH_JSON=$(curl -fsS https://maintainex.lk/api/health)
printf '%s' "$HEALTH_JSON" | grep -q '"status":"healthy"'
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
  echo "current_release_sha=$CURRENT_RELEASE_SHA"
  echo "current_health=$CURRENT_HEALTH"
  echo "current_user=$CURRENT_USER"
  echo "required_env_names=ok"
  echo "db_container=$DB_CONTAINER"
  echo "database_name=$DB_NAME"
  echo "database_public_tables=$DB_TABLES"
  echo "backup_path=$BACKUP_PATH"
  echo "backup_size_bytes=$BACKUP_SIZE"
  echo "public_health=ok"
  echo "readiness_auth_boundary=ok"
  echo "paypal_mode=$PAYPALMODE"
  echo "mfa_bootstrap=$MFA_BOOTSTRAP_MODE"
  echo "db_credential_rotation_confirmed=yes"
} > "$RECEIPT"

chmod 600 "$RECEIPT"

echo
echo "========================================"
echo " PRE-MERGE PRODUCTION PREFLIGHT: PASS"
echo "========================================"
echo "Receipt:             $RECEIPT"
echo "Rollback image:      $CURRENT_IMAGE"
echo "Current release SHA: $CURRENT_RELEASE_SHA"
echo "DB backup:           $BACKUP_PATH"
echo
echo "Do not paste the receipt if it contains infrastructure identifiers you do not want shared."
