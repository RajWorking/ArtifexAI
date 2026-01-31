#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f "apps/api/package.json" ]; then
  pnpm --filter api dev &
  API_PID=$!
else
  echo "apps/api not found; skipping api"
  API_PID=""
fi

if [ -f "apps/web/package.json" ]; then
  pnpm --filter web dev &
  WEB_PID=$!
else
  echo "apps/web/package.json not found; skipping web"
  WEB_PID=""
fi

if [ -n "$API_PID" ] && [ -n "$WEB_PID" ]; then
  wait "$API_PID" "$WEB_PID"
elif [ -n "$API_PID" ]; then
  wait "$API_PID"
elif [ -n "$WEB_PID" ]; then
  wait "$WEB_PID"
else
  echo "Nothing to run."
  exit 1
fi
