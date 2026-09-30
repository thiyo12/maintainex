#!/bin/bash
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519}"
VPS="${VPS:?Set VPS, for example root@your-vps-host}"
SRC="${SRC:-$(pwd)}"
REMOTE_STAGING="/root/maintainex-src"

echo "========================================"
echo "  DEPLOY: rsync delta sync + on-VPS build"
echo "========================================"

echo ""
echo "=== Phase 1: rsync delta transfer ==="
RSYNC_START=$(date +%s)

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
  -e "ssh -i $SSH_KEY -o ConnectTimeout=30 -o ServerAliveInterval=15 -o ServerAliveCountMax=5" \
  "$SRC/" "$VPS:$REMOTE_STAGING/"

RSYNC_END=$(date +%s)
RSYNC_DURATION=$((RSYNC_END - RSYNC_START))

echo ""
echo "=== Phase 2: docker cp staging into container ==="
COPY_START=$(date +%s)

CONTAINER=$(ssh -i "$SSH_KEY" -o ConnectTimeout=30 "$VPS" \
  "docker ps --filter name=maintainex-mx --format '{{.Names}}' | head -1")
echo "Container: $CONTAINER"

ssh -i "$SSH_KEY" -o ConnectTimeout=30 "$VPS" "CONTAINER=$CONTAINER && cd /root/maintainex-src && \
  for d in lib app prisma public components hooks scripts types; do \
    docker exec -u 0 -w /app \$CONTAINER rm -rf \$d 2>/dev/null; \
    if [ -d \$d ]; then docker cp \$d \$CONTAINER:/app/; fi; \
  done && \
  for f in package.json package-lock.json tsconfig.json next.config.js vitest.config.mts middleware.ts tailwind.config.ts postcss.config.js next-env.d.ts; do \
    docker exec -u 0 -w /app \$CONTAINER rm -f \$f 2>/dev/null; \
    if [ -f \$f ]; then docker cp \$f \$CONTAINER:/app/; fi; \
  done && \
  docker exec -u 0 -w /app \$CONTAINER sh -c 'chown -R appuser:appgroup /app/lib /app/app /app/prisma /app/public /app/components /app/hooks /app/scripts /app/types /app/package.json /app/package-lock.json /app/tsconfig.json /app/next.config.js /app/vitest.config.mts /app/middleware.ts /app/tailwind.config.ts /app/postcss.config.js /app/next-env.d.ts 2>/dev/null; true' && \
  echo CP_DONE"

COPY_END=$(date +%s)
COPY_DURATION=$((COPY_END - COPY_START))

echo ""
echo "=== Phase 3: prisma generate + next build ==="
BUILD_START=$(date +%s)

ssh -i "$SSH_KEY" -o ConnectTimeout=30 "$VPS" "docker exec -w /app $CONTAINER sh -c '
  sed -i.bak \"s/provider = \\\"sqlite\\\"/provider = \\\"postgresql\\\"/\" prisma/schema.prisma
  npx prisma generate 2>&1 | tail -2
  mv prisma/schema.prisma.bak prisma/schema.prisma
'"

ssh -i "$SSH_KEY" -o ConnectTimeout=600 "$VPS" "docker exec -w /app $CONTAINER sh -c '
  sed -i.bak \"s/provider = \\\"sqlite\\\"/provider = \\\"postgresql\\\"/\" prisma/schema.prisma
  npx next build 2>&1
  BUILD_EXIT=\$?
  mv prisma/schema.prisma.bak prisma/schema.prisma
  exit \$BUILD_EXIT
'"

BUILD_END=$(date +%s)
BUILD_DURATION=$((BUILD_END - BUILD_START))

echo ""
echo "=== Phase 4: docker commit + service update ==="
RESTART_START=$(date +%s)

ssh -i "$SSH_KEY" -o ConnectTimeout=30 "$VPS" "
  docker commit $CONTAINER maintainex-mx-vcaohy:prod-latest 2>&1
  docker service update --force --image maintainex-mx-vcaohy:prod-latest maintainex-mx-vcaohy 2>&1 | tail -3
"

RESTART_END=$(date +%s)
RESTART_DURATION=$((RESTART_END - RESTART_START))

TOTAL=$((RSYNC_DURATION + COPY_DURATION + BUILD_DURATION + RESTART_DURATION))

echo ""
echo "========================================"
echo "        DEPLOY METRICS"
echo "========================================"
echo "Rsync transfer:      ${RSYNC_DURATION}s"
echo "Docker cp:           ${COPY_DURATION}s"
echo "Build (prisma+next): ${BUILD_DURATION}s"
echo "Commit+restart:      ${RESTART_DURATION}s"
echo "Total:               ${TOTAL}s"
echo "========================================"
