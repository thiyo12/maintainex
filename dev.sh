#!/bin/bash
# Start maintainex development servers
# Usage: ./dev.sh [local|production]
#   local      - API on localhost:3000, mobile connects to localhost
#   production - API on maintainex.lk, mobile connects to production (default)

MODE="${1:-production}"

if [ "$MODE" = "local" ]; then
  echo "🔧 Starting in LOCAL mode — mobile will connect to localhost:3000"
  export EXPO_PUBLIC_API_URL=http://localhost:3000
else
  echo "🌐 Starting in PRODUCTION mode — mobile will connect to maintainex.lk"
  export EXPO_PUBLIC_API_URL=https://maintainex.lk
fi

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $API_PID 2>/dev/null
  kill $EXPO_PID 2>/dev/null
  wait
  echo "Done."
}

trap cleanup SIGINT SIGTERM

# 1. Start Next.js API
echo "📡 Starting API server..."
npm run dev &
API_PID=$!

# Wait for API to be ready
sleep 4

# 2. Start Expo
echo "📱 Starting Expo dev server..."
cd apps/mobile && EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL npx expo start &
EXPO_PID=$!

echo ""
echo "═══════════════════════════════════════"
echo "  API:    http://localhost:3000"
echo "  Mobile: http://localhost:8081"
echo "  Mode:   $MODE"
echo "═══════════════════════════════════════"
echo "  Press Ctrl+C to stop both"
echo ""

wait
