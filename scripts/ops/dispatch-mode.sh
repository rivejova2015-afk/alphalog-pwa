#!/usr/bin/env bash
# scripts/ops/dispatch-mode.sh — flip DISPATCH_MODE on Fly alphalog-pwa.
#
# Usage:
#   ./scripts/ops/dispatch-mode.sh status                 # what's currently set
#   ./scripts/ops/dispatch-mode.sh shadow                 # set to shadow (safe)
#   ./scripts/ops/dispatch-mode.sh live                   # set to live (places real orders)
#   ./scripts/ops/dispatch-mode.sh preflight              # run pre-flight checks without flipping
#
# Pre-flight checks for `live`:
#   1. flyctl exists + is authenticated
#   2. SUPABASE_SERVICE_ROLE_KEY exists on Fly
#   3. alphalog-cron is running (machines in started state)
#   4. The flipper confirms interactively (no --yes flag = no oopsies)
#
# Companion runbook: scripts/ops/dispatch-mode-flip.md

set -euo pipefail

APP="alphalog-pwa"
CRON_APP="alphalog-cron"
SECRET_KEY="DISPATCH_MODE"

cmd="${1:-status}"

ensure_flyctl() {
  if ! command -v flyctl >/dev/null 2>&1; then
    echo "ERROR: flyctl not installed. See https://fly.io/docs/flyctl/install" >&2
    exit 1
  fi
  if ! flyctl auth whoami >/dev/null 2>&1; then
    echo "ERROR: flyctl not authenticated. Run: flyctl auth login" >&2
    exit 1
  fi
}

show_status() {
  ensure_flyctl
  echo "=== $APP secrets ==="
  if flyctl secrets list -a "$APP" 2>/dev/null | grep -E "^${SECRET_KEY}\b"; then
    echo "OK: $SECRET_KEY is set (effective mode read at runtime — restart required to change)"
  else
    echo "WARN: $SECRET_KEY not explicitly set — defaults to 'shadow' (safe)"
  fi
}

preflight() {
  ensure_flyctl
  local fail=0
  echo "=== Pre-flight for DISPATCH_MODE=live ==="

  echo -n "[1/4] SUPABASE_SERVICE_ROLE_KEY on $APP ... "
  if flyctl secrets list -a "$APP" 2>/dev/null | grep -q "^SUPABASE_SERVICE_ROLE_KEY"; then
    echo "OK"
  else
    echo "MISSING"
    fail=1
  fi

  echo -n "[2/4] CRON_SECRET on $APP ... "
  if flyctl secrets list -a "$APP" 2>/dev/null | grep -q "^CRON_SECRET"; then
    echo "OK"
  else
    echo "MISSING"
    fail=1
  fi

  echo -n "[3/4] $CRON_APP machines running ... "
  if flyctl machine list -a "$CRON_APP" 2>/dev/null | grep -qE "started"; then
    echo "OK"
  else
    echo "FAIL — no started machines; cron isn't firing"
    fail=1
  fi

  echo -n "[4/4] recent tradovate-poll activity ... "
  if flyctl logs -a "$CRON_APP" --no-tail 2>/dev/null | tail -50 | grep -q "tradovate-poll"; then
    echo "OK (see logs above)"
  else
    echo "INCONCLUSIVE (no recent logs — verify manually)"
  fi

  if [[ $fail -ne 0 ]]; then
    echo
    echo "Pre-flight FAILED. Fix the issues above before flipping to live."
    exit 1
  fi
  echo
  echo "Pre-flight PASSED. Run: $0 live"
}

flip_to_shadow() {
  ensure_flyctl
  echo "Flipping $APP → DISPATCH_MODE=shadow ..."
  flyctl secrets set "${SECRET_KEY}=shadow" -a "$APP"
  echo "Done. Next dispatcher cycle (≤60s) returns to shadow mode."
}

flip_to_live() {
  ensure_flyctl
  preflight
  echo
  echo "⚠️  About to flip $APP to DISPATCH_MODE=live."
  echo "    This makes the dispatcher cron place REAL orders on Tradovate within ~60s."
  echo "    Rollback: $0 shadow"
  echo
  read -r -p "Type LIVE to confirm: " confirm
  if [[ "$confirm" != "LIVE" ]]; then
    echo "Aborted."
    exit 1
  fi
  flyctl secrets set "${SECRET_KEY}=live" -a "$APP"
  echo
  echo "Done. Tail logs to verify the first 'placed' action:"
  echo "  flyctl logs -a $APP | grep DispatchTradovate"
}

case "$cmd" in
  status)    show_status ;;
  shadow)    flip_to_shadow ;;
  live)      flip_to_live ;;
  preflight) preflight ;;
  *)
    echo "Usage: $0 {status|shadow|live|preflight}" >&2
    exit 2
    ;;
esac
