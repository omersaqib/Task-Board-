#!/usr/bin/env bash
# Wait until every given HTTP endpoint answers with a 2xx status.
#
# Fails (exit 1) and dumps the service logs when:
#   * any URL is still unhealthy after the timeout, or
#   * any watched process (pid file) has exited while we were waiting.
#
# Usage:
#   scripts/wait-for-services.sh [options] URL [URL...]
#
# Options (each also settable through the env var shown):
#   -t, --timeout SECS     overall deadline                 WAIT_TIMEOUT   (default 120)
#   -i, --interval SECS    delay between polling rounds     WAIT_INTERVAL  (default 2)
#   -p, --pid-file FILE    process that must stay alive     WAIT_PID_FILES (space separated)
#   -l, --log-file FILE    log to print on failure          WAIT_LOG_FILES (space separated)
#   -h, --help
#   URLs may also come from WAIT_URLS (space separated).
#
# Example (as used in CI):
#   scripts/wait-for-services.sh --timeout 120 \
#     --pid-file logs/backend.pid --pid-file logs/frontend.pid \
#     --log-file logs/backend.log --log-file logs/frontend.log \
#     http://localhost:3001/api/health http://localhost:4173/
set -euo pipefail

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }

timeout="${WAIT_TIMEOUT:-120}"
interval="${WAIT_INTERVAL:-2}"
read -r -a urls <<<"${WAIT_URLS:-}"
read -r -a pid_files <<<"${WAIT_PID_FILES:-}"
read -r -a log_files <<<"${WAIT_LOG_FILES:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t | --timeout) timeout="${2:?--timeout needs a value}"; shift 2 ;;
    -i | --interval) interval="${2:?--interval needs a value}"; shift 2 ;;
    -p | --pid-file) pid_files+=("${2:?--pid-file needs a value}"); shift 2 ;;
    -l | --log-file) log_files+=("${2:?--log-file needs a value}"); shift 2 ;;
    -h | --help) usage; exit 0 ;;
    --) shift; urls+=("$@"); break ;;
    -*) echo "wait-for-services: unknown option $1" >&2; usage >&2; exit 2 ;;
    *) urls+=("$1"); shift ;;
  esac
done

if [[ ${#urls[@]} -eq 0 ]]; then
  echo "wait-for-services: no URLs given" >&2
  usage >&2
  exit 2
fi
if ! [[ "$timeout" =~ ^[0-9]+$ && "$interval" =~ ^[0-9]+$ ]]; then
  echo "wait-for-services: --timeout and --interval must be whole seconds" >&2
  exit 2
fi
command -v curl >/dev/null || { echo "wait-for-services: curl is required" >&2; exit 2; }

dump_logs() {
  local f
  for f in ${log_files[@]+"${log_files[@]}"}; do
    echo "::group::Last 200 lines of $f"
    if [[ -f "$f" ]]; then tail -n 200 "$f"; else echo "(log file not found)"; fi
    echo "::endgroup::"
  done
}

fail() {
  echo "::error title=Services not healthy::$*"
  dump_logs
  exit 1
}

# Returns non-zero (and prints why) if a watched process is gone.
check_processes() {
  local f pid
  for f in ${pid_files[@]+"${pid_files[@]}"}; do
    [[ -f "$f" ]] || { echo "pid file $f does not exist"; return 1; }
    pid="$(<"$f")"
    if ! [[ "$pid" =~ ^[0-9]+$ ]] || ! kill -0 "$pid" 2>/dev/null; then
      echo "process from $f (pid '${pid}') is not running"
      return 1
    fi
  done
}

echo "Waiting up to ${timeout}s for: ${urls[*]}"
deadline=$((SECONDS + timeout))
# Parallel to "urls": 1 once that URL has answered 2xx (indexed array keeps
# this compatible with the bash 3.2 that ships with macOS).
healthy=()

while :; do
  if ! reason="$(check_processes)"; then
    fail "A service process exited before becoming healthy: $reason"
  fi

  pending=()
  for i in "${!urls[@]}"; do
    [[ "${healthy[$i]:-0}" == 1 ]] && continue
    url="${urls[$i]}"
    # curl prints 000 and exits non-zero when nothing is listening; that is
    # an expected "not ready yet" state, not an error of this script.
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null)" || code="${code:-000}"
    if [[ "$code" =~ ^2[0-9][0-9]$ ]]; then
      healthy[$i]=1
      echo "  healthy: $url (HTTP $code) after ${SECONDS}s"
    else
      pending+=("$url (last status: $code)")
    fi
  done

  if [[ ${#pending[@]} -eq 0 ]]; then
    echo "All ${#urls[@]} service(s) healthy."
    exit 0
  fi
  if ((SECONDS >= deadline)); then
    fail "Timed out after ${timeout}s; still unhealthy: ${pending[*]}"
  fi
  sleep "$interval"
done
