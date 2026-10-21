#!/usr/bin/env bash
# Stop the processes started by scripts/start-services.sh (reads <LOG_DIR>/*.pid).
# Kills each recorded process together with its descendants (npm spawns node).
# Safe to run when nothing is running; always exits 0.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
LOG_DIR="${LOG_DIR:-logs}"

descendants() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null || true); do
    descendants "$child"
    echo "$child"
  done
}

for pid_file in "$LOG_DIR"/*.pid; do
  [[ -f "$pid_file" ]] || continue
  pid="$(<"$pid_file")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    pids="$(descendants "$pid" | tr '\n' ' ') $pid"
    echo "Stopping $(basename "$pid_file" .pid) (pids: $pids)"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    sleep 1
    # shellcheck disable=SC2086
    kill -9 $pids 2>/dev/null || true
  fi
  rm -f "$pid_file"
done
exit 0
