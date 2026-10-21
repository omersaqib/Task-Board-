#!/usr/bin/env bash
# Start the built API and web preview in the background, exactly as CI does.
# Requires `npm run build` first. Pair with scripts/wait-for-services.sh and
# scripts/stop-services.sh.
#
# Environment (all optional):
#   API_PORT        (default 3001)            backend PORT
#   WEB_PORT        (default 4173)            vite preview port
#   LOG_DIR         (default logs, relative to the repo root) where <svc>.log / <svc>.pid are written
#   NODE_ENV        (default production)
#   JWT_SECRET      required when NODE_ENV=production (>= 32 chars). Never commit one;
#                   CI generates a throwaway value per run.
#   DATABASE_PATH   (default: a fresh temp dir per run, so every E2E run starts empty)
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

API_PORT="${API_PORT:-3001}"
WEB_PORT="${WEB_PORT:-4173}"
LOG_DIR="${LOG_DIR:-logs}"
export NODE_ENV="${NODE_ENV:-production}"
DATABASE_PATH="${DATABASE_PATH:-$(mktemp -d "${TMPDIR:-/tmp}/taskboard-e2e.XXXXXX")/taskboard.db}"

jwt_secret="${JWT_SECRET:-}"
if [[ "$NODE_ENV" == production ]] && ((${#jwt_secret} < 32)); then
  echo "start-services: JWT_SECRET (>= 32 chars) is required when NODE_ENV=production" >&2
  exit 2
fi
for artefact in backend/dist/server.js frontend/dist/index.html; do
  [[ -f "$artefact" ]] || { echo "start-services: $artefact missing - run 'npm run build' first" >&2; exit 2; }
done

mkdir -p "$LOG_DIR" "$(dirname "$DATABASE_PATH")"

start() {
  local name="$1"
  shift
  echo "Starting $name: $*  (log: $LOG_DIR/$name.log)"
  # nohup + own stdin so the process survives the step's shell and never
  # blocks on a TTY.
  nohup "$@" >"$LOG_DIR/$name.log" 2>&1 </dev/null &
  echo $! >"$LOG_DIR/$name.pid"
}

PORT="$API_PORT" DATABASE_PATH="$DATABASE_PATH" \
  start backend npm run start -w backend

API_PROXY_TARGET="http://localhost:$API_PORT" \
  start frontend npm run preview -w frontend -- --port "$WEB_PORT"

echo "API  -> http://localhost:$API_PORT/api/health"
echo "Web  -> http://localhost:$WEB_PORT/"
