#!/usr/bin/env bash
# AlphaLog → Fly.io secrets script
# -----------------------------------------------------------------------------
# This is a TEMPLATE. Fill in the values from your existing source of truth
# (Supabase dashboard, Postmark, OpenAI, QStash, etc.) then run:
#
#   bash .fly-secrets.example.sh                # sets on alphalog-pwa
#   bash .fly-secrets.example.sh alphalog-cron  # sets on the cron sidecar
#
# Only covers the `alphalog-pwa` and `alphalog-cron` Fly apps. The separate
# `coinarb-50x` app (its own deploy, its own secrets store) is documented at
# the bottom of this file for traceability only — those secrets are NOT set
# by this script, since every `fly secrets set --app` call below targets one
# of the two apps above.
#
# WARNING: do NOT commit this file with real values. After running it once,
# either delete it or `git restore` it. It's already in .gitignore.
# -----------------------------------------------------------------------------

set -euo pipefail
APP="${1:-alphalog-pwa}"

echo "Setting secrets on Fly app: ${APP}"

fly secrets set --app "${APP}" --stage \
  NEXT_PUBLIC_SUPABASE_URL="https://jgkvnnlodwdtjsmmzwry.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="REPLACE_ME" \
  SUPABASE_SERVICE_ROLE_KEY="REPLACE_ME" \
  SUPABASE_FUNCTIONS_URL="REPLACE_ME" \
  \
  DATA_ENCRYPTION_KEY="REPLACE_ME_base64_32bytes" \
  \
  NEXT_PUBLIC_VAPID_PUBLIC_KEY="REPLACE_ME" \
  VAPID_PRIVATE_KEY="REPLACE_ME" \
  VAPID_SUBJECT="mailto:rivejova2015@gmail.com" \
  \
  POSTMARK_SERVER_TOKEN="REPLACE_ME" \
  POSTMARK_INBOUND_WEBHOOK_SECRET="REPLACE_ME" \
  \
  OPENAI_API_KEY="REPLACE_ME" \
  \
  QSTASH_TOKEN="REPLACE_ME" \
  QSTASH_CURRENT_SIGNING_KEY="REPLACE_ME" \
  QSTASH_NEXT_SIGNING_KEY="REPLACE_ME" \
  QSTASH_BASE_URL="https://qstash.upstash.io" \
  \
  CRON_SECRET="REPLACE_ME_openssl_rand_base64_32" \
  OPS_CRON_SECRET="REPLACE_ME_openssl_rand_base64_32" \
  OPS_ALERT_TOKEN="REPLACE_ME" \
  \
  MT5_WEBHOOK_SECRET="REPLACE_ME" \
  BOT_OPS_USER_ID="REPLACE_ME_uuid" \
  ALPHALOG_PUSH_NOTIFY_URL="https://alphalog.io/api/push/notify-user" \
  ALPHALOG_PUSH_NOTIFY_TOKEN="REPLACE_ME" \
  \
  NEXT_PUBLIC_HCAPTCHA_SITE_KEY="REPLACE_ME" \
  \
  NEXT_PUBLIC_SENTRY_DSN="REPLACE_ME_or_leave_blank_for_noop" \
  SENTRY_DSN="REPLACE_ME_or_leave_blank_for_noop" \
  SENTRY_ORG="REPLACE_ME" \
  SENTRY_PROJECT="alphalog-pwa" \
  SENTRY_AUTH_TOKEN="REPLACE_ME_build_time_only"

echo "Staged. Deploy will pick them up."
echo "  fly deploy --app ${APP}"

# -----------------------------------------------------------------------------
# coinarb-50x (separate Fly app — crypto trading bot, NOT set by this script)
# -----------------------------------------------------------------------------
# These are configured out-of-band directly on the `coinarb-50x` app. Listed
# here purely for traceability (Wave 2 item 8 — "which secrets exist where").
# To set them for real, run against that app explicitly, e.g.:
#
#   fly secrets set --app coinarb-50x --stage \
#     COINBASE_CDP_KEY_NAME="REPLACE_ME" \
#     COINBASE_CDP_PRIVATE_KEY="REPLACE_ME_PEM"
#
#   COINBASE_CDP_KEY_NAME        Coinbase Developer Platform API key name.
#   COINBASE_CDP_PRIVATE_KEY     CDP EC private key (PEM) — signs live spot orders.
#   COINARB_50X_PAPER_MODE       'true' = paper mode (default), 'false' = live money.
#   COINARB_AGENT_ID             UUID in coinarb_agents.
#   COINARB_BOT_ACCOUNT_ID       UUID in bot_accounts.
#   COINARB_BOT_ID               UUID in bots.
#   COINARB_USER_ID              Owner UUID (auth.users) — same as BOT_OPS_USER_ID above.
#   COINARB_STARTING_CAPITAL     USD initial capital (default 100).
#   COINARB_PUSH_ENABLED         'true' to send pushes from the bot process itself.
#   FLY_API_TOKEN_COINARB        Deploy-scoped token, lives on alphalog-cron (auto-deploy).
